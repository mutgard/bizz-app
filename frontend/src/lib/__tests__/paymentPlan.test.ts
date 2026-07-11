import { describe, it, expect, vi } from 'vitest';
import { planPaymentRegistration } from '../paymentPlan';
import { parsePayments } from '../clientHelpers';
import type { Payment } from '../../types';

// planPaymentRegistration doesn't itself read the pack, but the round-trip
// test below exercises the real parsePayments (clientHelpers.ts), which
// reads getPack().locale.paidKeyword — stub it like finance.test.ts does.
vi.mock('../../config', () => ({
  getPack: () => ({ locale: { paidKeyword: 'rebut' } }),
}));

const CA = { paidKeyword: 'rebut', currencySymbol: '€', numberLocale: 'ca-ES' };

function payment(overrides: Partial<Payment>): Payment {
  return { id: 1, label: 'Saldo', value: '', ...overrides };
}

describe('planPaymentRegistration', () => {
  it('partially covers a single unpaid row, shrinking it and keeping its wording', () => {
    const payments = [payment({ id: 1, value: '€1.800 pendent' })];

    const plan = planPaymentRegistration(payments, 500, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);

    expect(plan.clampedAmount).toBe(500);
    expect(plan.receiptValue).toBe('€500 · rebut');
    expect(plan.retire).toEqual([{ kind: 'update', id: 1, newValue: '€1.300 pendent' }]);
  });

  it('fully covers a single unpaid row by deleting it', () => {
    const payments = [payment({ id: 1, value: '€500 pendent' })];

    const plan = planPaymentRegistration(payments, 500, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);

    expect(plan.clampedAmount).toBe(500);
    expect(plan.retire).toEqual([{ kind: 'delete', id: 1 }]);
  });

  it('walks multiple unpaid rows, deleting each fully covered one in order', () => {
    const payments = [
      payment({ id: 1, value: '€300 pendent' }),
      payment({ id: 2, value: '€700 pendent' }),
    ];

    const plan = planPaymentRegistration(payments, 1000, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);

    expect(plan.clampedAmount).toBe(1000);
    expect(plan.retire).toEqual([
      { kind: 'delete', id: 1 },
      { kind: 'delete', id: 2 },
    ]);
  });

  it('covers one row fully then shrinks the next when rows outnumber the amount', () => {
    const payments = [
      payment({ id: 1, value: '€300 pendent' }),
      payment({ id: 2, value: '€1.000 pendent' }),
    ];

    const plan = planPaymentRegistration(payments, 1200, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);

    expect(plan.clampedAmount).toBe(1200);
    expect(plan.retire).toEqual([
      { kind: 'delete', id: 1 },
      { kind: 'update', id: 2, newValue: '€100 pendent' },
    ]);
  });

  it('clamps an overpay to the total outstanding instead of inflating totals', () => {
    const payments = [payment({ id: 1, value: '€500 pendent' })];

    const plan = planPaymentRegistration(payments, 10000, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);

    expect(plan.clampedAmount).toBe(500);
    expect(plan.receiptValue).toBe('€500 · rebut');
    expect(plan.retire).toEqual([{ kind: 'delete', id: 1 }]);
  });

  it('returns an empty plan for a zero or negative amount', () => {
    const payments = [payment({ id: 1, value: '€500 pendent' })];

    expect(planPaymentRegistration(payments, 0, CA.paidKeyword, CA.currencySymbol, CA.numberLocale))
      .toEqual({ receiptValue: '', retire: [], clampedAmount: 0 });
    expect(planPaymentRegistration(payments, -50, CA.paidKeyword, CA.currencySymbol, CA.numberLocale))
      .toEqual({ receiptValue: '', retire: [], clampedAmount: 0 });
  });

  it('returns an empty plan when there is nothing outstanding to retire', () => {
    const payments = [payment({ id: 1, value: '€500 · rebut' })]; // already paid

    const plan = planPaymentRegistration(payments, 500, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);

    expect(plan).toEqual({ receiptValue: '', retire: [], clampedAmount: 0 });
  });

  it('formats a shrunk row with the locale thousands separator, and it stays unpaid-parseable', () => {
    const payments = [payment({ id: 1, value: '€1.800 pendent' })];

    const plan = planPaymentRegistration(payments, 500, CA.paidKeyword, CA.currencySymbol, CA.numberLocale);
    const action = plan.retire[0];

    expect(action.kind).toBe('update');
    expect(action.newValue).toBe('€1.300 pendent');

    // Round-trip through the real parsePayments: the shrunk row must still
    // read as an unpaid amount (no paidKeyword) contributing its new total.
    const shrunk = [payment({ id: 1, value: action.newValue! })];
    const { priceTotal, paid } = parsePayments(shrunk);
    expect(priceTotal).toBe(1300);
    expect(paid).toBe(0);
  });
});
