import { describe, it, expect } from 'vitest';
import { groupBySupplier, totals } from '../materials';
import type { ShoppingItemWithDays } from '../materials';

// Realistic qty/price string shapes copied from backend/seed.py
// (e.g. Fabric(name="Mikado seda marfil", qty="3.2 m", price="€48/m", supplier="Gratacós")).
function item(overrides: Partial<ShoppingItemWithDays>): ShoppingItemWithDays {
  return {
    id: 1, name: 'Mikado seda marfil', use: 'Cos', qty: '3.2 m', price: '€48/m',
    to_buy: true, supplier: 'Gratacós',
    client_id: 1, client_name: 'Aina Puig',
    days_until: 25,
    ...overrides,
  };
}

describe('groupBySupplier', () => {
  it('buckets items by supplier with correct subtotal and metres', () => {
    const items = [
      item({ id: 1, name: 'Mikado seda marfil', qty: '3.2 m', price: '€48/m', supplier: 'Gratacós', days_until: 25 }),
      item({ id: 2, name: 'Puntilla italiana', qty: '0.8 m', price: '€78/m', supplier: 'Gratacós', client_name: 'Elena Roca', days_until: 74 }),
      item({ id: 3, name: 'Tul francès', qty: '2.5 m', price: '€22/m', supplier: 'Ribes & Casals', days_until: 25 }),
    ];

    const groups = groupBySupplier(items);

    expect(groups).toHaveLength(2);
    const gratacos = groups.find(g => g.supplier === 'Gratacós')!;
    expect(gratacos.items).toHaveLength(2);
    // 3.2*48 + 0.8*78 = 153.6 + 62.4 = 216
    expect(gratacos.subtotal).toBeCloseTo(216);
    expect(gratacos.metres).toBeCloseTo(4.0);

    const ribes = groups.find(g => g.supplier === 'Ribes & Casals')!;
    expect(ribes.items).toHaveLength(1);
    // 2.5*22 = 55
    expect(ribes.subtotal).toBeCloseTo(55);
    expect(ribes.metres).toBeCloseTo(2.5);
  });

  it('labels the empty-supplier bucket with the sentinel empty key (screen translates it)', () => {
    const items = [item({ supplier: '', days_until: 10 })];
    const groups = groupBySupplier(items);
    expect(groups).toHaveLength(1);
    expect(groups[0].supplier).toBe('');
  });

  it('sorts buckets by the earliest days_until among their items, ascending', () => {
    const items = [
      item({ id: 1, supplier: 'Far Away', days_until: 90 }),
      item({ id: 2, supplier: 'Urgent Co', days_until: 5 }),
      item({ id: 3, supplier: 'Mid Supplier', days_until: 40 }),
    ];
    const groups = groupBySupplier(items);
    expect(groups.map(g => g.supplier)).toEqual(['Urgent Co', 'Mid Supplier', 'Far Away']);
  });
});

describe('totals', () => {
  it('sums metres and cost across all items and counts distinct suppliers', () => {
    const items = [
      item({ id: 1, qty: '3.2 m', price: '€48/m', supplier: 'Gratacós' }),
      item({ id: 2, qty: '2.5 m', price: '€22/m', supplier: 'Ribes & Casals' }),
      item({ id: 3, qty: '1.2 m', price: '€95/m', supplier: '' }),
    ];
    const t = totals(items);
    expect(t.metres).toBeCloseTo(6.9);
    // 3.2*48 + 2.5*22 + 1.2*95 = 153.6 + 55 + 114 = 322.6
    expect(t.cost).toBeCloseTo(322.6);
    expect(t.suppliers).toBe(3);
  });

  it('returns zeros for an empty list', () => {
    expect(totals([])).toEqual({ metres: 0, cost: 0, suppliers: 0 });
  });
});
