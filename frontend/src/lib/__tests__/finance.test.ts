import { describe, it, expect, vi } from 'vitest';
import { buildFinances } from '../finance';
import type { Client } from '../../types';

// buildFinances delegates to parsePayments (clientHelpers.ts), which reads
// getPack().locale.paidKeyword — stub the pack so this test doesn't depend
// on a loaded pack config.
vi.mock('../../config', () => ({
  getPack: () => ({ locale: { paidKeyword: 'rebut' } }),
}));

function client(overrides: Partial<Client>): Client {
  return {
    id: 1,
    name: 'Aina Puig',
    wedding_date: '17.05.2026',
    days_until: 25,
    status: 'clienta',
    garment: 'Vestit a mida',
    garment_style: 'princesa',
    measurements_date: '',
    phone: '',
    email: '',
    notes: '',
    fabrics: [],
    appointments: [],
    payments: [],
    ...overrides,
  };
}

describe('buildFinances', () => {
  it('computes totals, outstanding and pct from payment strings, sorted by outstanding desc', () => {
    // Realistic payment shapes copied from backend/seed.py.
    const aina = client({
      id: 1, name: 'Aina Puig',
      payments: [
        { id: 1, label: 'Paga i senyal', value: '€500 · rebut' },
        { id: 2, label: 'Saldo', value: '€1.800 pendent' },
      ],
    });
    const berta = client({
      id: 2, name: 'Berta Soler',
      payments: [{ id: 3, label: 'Paga i senyal', value: 'Pendent' }],
    });
    const clara = client({
      id: 3, name: 'Clara Ferrer',
      payments: [
        { id: 4, label: 'Paga i senyal', value: '€600 · rebut' },
        { id: 5, label: 'Saldo', value: '€2.200 · rebut' },
      ],
    });

    const finances = buildFinances([aina, berta, clara]);

    // Berta's only payment has no parseable amount → priceTotal 0 → excluded.
    expect(finances.map(f => f.client.id)).toEqual([1, 3]);

    const ainaFinance = finances.find(f => f.client.id === 1)!;
    expect(ainaFinance.priceTotal).toBe(2300);
    expect(ainaFinance.paid).toBe(500);
    expect(ainaFinance.outstanding).toBe(1800);
    expect(ainaFinance.pct).toBe(22);

    const claraFinance = finances.find(f => f.client.id === 3)!;
    expect(claraFinance.priceTotal).toBe(2800);
    expect(claraFinance.paid).toBe(2800);
    expect(claraFinance.outstanding).toBe(0);
    expect(claraFinance.pct).toBe(100);
  });

  it('returns an empty array when no client has parseable payments', () => {
    expect(buildFinances([client({ payments: [] })])).toEqual([]);
  });
});
