import type { ShoppingItem } from '../types';
import { parseQty, parsePrice } from './clientHelpers';

/** A shopping-list row joined with the destination client's days-until-key-date
 *  (the screen does the client_id → clients join; this lib stays client-shape-agnostic). */
export interface ShoppingItemWithDays extends ShoppingItem {
  days_until: number;
}

export interface SupplierGroup {
  /** '' is the sentinel for "no supplier" — the lib stays pure/untranslated;
   *  the screen renders it as t('shopping.noSupplier'). */
  supplier: string;
  items: ShoppingItemWithDays[];
  subtotal: number;
  metres: number;
}

/** Cost of one line: qty (m) × price (€/m), parsed from the seed's display strings. */
function lineCost(item: ShoppingItemWithDays): number {
  return parseQty(item.qty) * parsePrice(item.price);
}

/** Groups shopping items by supplier (empty string bucket for unset supplier),
 *  with each bucket's subtotal cost and total metres, sorted by the most
 *  urgent item inside (lowest days_until) first. */
export function groupBySupplier(items: ShoppingItemWithDays[]): SupplierGroup[] {
  const order: string[] = [];
  const buckets = new Map<string, ShoppingItemWithDays[]>();
  for (const item of items) {
    const key = item.supplier || '';
    let list = buckets.get(key);
    if (!list) {
      list = [];
      buckets.set(key, list);
      order.push(key);
    }
    list.push(item);
  }

  const groups: SupplierGroup[] = order.map(supplier => {
    const its = buckets.get(supplier)!;
    return {
      supplier,
      items: its,
      subtotal: its.reduce((s, f) => s + lineCost(f), 0),
      metres: its.reduce((s, f) => s + parseQty(f.qty), 0),
    };
  });

  groups.sort((a, b) => {
    const aMin = Math.min(...a.items.map(i => i.days_until));
    const bMin = Math.min(...b.items.map(i => i.days_until));
    return aMin - bMin;
  });

  return groups;
}

/** Buy-view totals strip: total metres, total cost estimate, distinct supplier count. */
export function totals(items: ShoppingItemWithDays[]): { metres: number; cost: number; suppliers: number } {
  return {
    metres: items.reduce((s, f) => s + parseQty(f.qty), 0),
    cost: items.reduce((s, f) => s + lineCost(f), 0),
    suppliers: new Set(items.map(f => f.supplier || '')).size,
  };
}
