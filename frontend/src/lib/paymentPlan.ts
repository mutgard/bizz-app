import type { Payment } from '../types';

export interface PaymentAction {
  kind: 'update' | 'delete';
  id: number;
  newValue?: string;
}

export interface PaymentPlan {
  /** Value string for the new paid receipt row, e.g. "€1.300 · rebut". Empty when there's nothing to register. */
  receiptValue: string;
  /** Existing UNPAID rows to retire (delete = fully covered, update = shrunk by the covered amount). */
  retire: PaymentAction[];
  /** `amount` clamped to the total outstanding across unpaid rows (never negative, never inflates totals). */
  clampedAmount: number;
}

const AMOUNT_RE = /€([\d.,]+)/;

function parseLineAmount(value: string): number | null {
  const m = value.match(AMOUNT_RE);
  if (!m) return null;
  const amount = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
  return isNaN(amount) ? null : amount;
}

/**
 * Pure arithmetic for registering a payment against a client's UNPAID rows.
 * Mirrors `parsePayments` (clientHelpers.ts) semantics for identifying an
 * unpaid row: a parseable `€` amount whose value does NOT contain the pack's
 * `paidKeyword`.
 *
 * Walks unpaid rows (in their given order) retiring up to `amount` (clamped
 * to the total outstanding so an overpay never inflates totals): a row fully
 * covered by the remaining amount is deleted, a row only partially covered
 * is shrunk in place — keeping its original wording, with the reduced
 * numeric amount formatted using the locale's thousands separator (e.g.
 * `€1.300`, not `€1300`).
 */
export function planPaymentRegistration(
  payments: Payment[],
  amount: number,
  paidKeyword: string,
  currencySymbol: string,
  numberLocale: string,
): PaymentPlan {
  const empty: PaymentPlan = { receiptValue: '', retire: [], clampedAmount: 0 };
  if (!amount || amount <= 0) return empty;

  const unpaid = payments
    .map(p => ({ p, lineAmount: parseLineAmount(p.value) }))
    .filter((x): x is { p: Payment; lineAmount: number } =>
      x.lineAmount != null
      && x.lineAmount > 0
      && !x.p.value.toLowerCase().includes(paidKeyword.toLowerCase()));

  const totalOutstanding = unpaid.reduce((sum, x) => sum + x.lineAmount, 0);
  const clampedAmount = Math.round(Math.min(amount, totalOutstanding));
  if (clampedAmount <= 0) return empty;

  let remaining = clampedAmount;
  const retire: PaymentAction[] = [];
  for (const { p, lineAmount } of unpaid) {
    if (remaining <= 0) break;
    if (lineAmount <= remaining + 0.01) {
      retire.push({ kind: 'delete', id: p.id });
      remaining -= lineAmount;
    } else {
      const newAmount = Math.round(lineAmount - remaining);
      const m = p.value.match(AMOUNT_RE)!;
      const newValue = p.value.replace(m[0], `${currencySymbol}${newAmount.toLocaleString(numberLocale)}`);
      retire.push({ kind: 'update', id: p.id, newValue });
      remaining = 0;
    }
  }

  const receiptValue = `${currencySymbol}${clampedAmount.toLocaleString(numberLocale)} · ${paidKeyword}`;

  return { receiptValue, retire, clampedAmount };
}
