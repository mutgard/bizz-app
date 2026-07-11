import type { Client } from '../types';
import { parsePayments } from './clientHelpers';

export interface ClientFinance {
  client: Client;
  priceTotal: number;
  paid: number;
  outstanding: number;
  pct: number;
}

/** Per-client payment rollup (total invoiced, paid, outstanding, % collected),
 *  sorted by outstanding descending. Clients with no parseable payments are
 *  omitted (nothing to show on a finance summary). */
export function buildFinances(clients: Client[]): ClientFinance[] {
  return clients
    .map(client => {
      const { priceTotal, paid } = parsePayments(client.payments);
      const total = priceTotal ?? 0;
      const outstanding = Math.max(0, total - paid);
      const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
      return { client, priceTotal: total, paid, outstanding, pct };
    })
    .filter(f => f.priceTotal > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}
