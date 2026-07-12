import type { AtelierEvent, Payment, Note } from '../types';

export type ActivityKind = 'event' | 'payment' | 'note';

export interface ActivityEntry {
  /** ISO date or datetime. Undefined when the source record carries no
   *  reliable timestamp (payments, in this data model) — such entries sort
   *  after every dated one. */
  ts?: string;
  kind: ActivityKind;
  title: string;
  detail?: string;
}

interface BuildActivityInput {
  events: AtelierEvent[];
  payments: Payment[];
  notes: Note[];
}

/**
 * Merges a client's events, payments and notes into one reverse-chronological
 * activity feed for the Fitxa screen.
 *
 * - Notes always carry an ISO `ts` (set server-side on creation).
 * - Events carry their ISO `date` (YYYY-MM-DD) as `ts`.
 * - Payments have no timestamp at all in this data model (`Payment` is just
 *   `{id, label, value}`), so they're emitted with `ts: undefined` and always
 *   land after every dated entry.
 *
 * Sort is newest-first by `ts`; entries that tie (including the "no ts at
 * all" case) keep their relative input order — `Array.prototype.sort` is
 * spec-guaranteed stable, so returning 0 for a tie is enough.
 */
export function buildActivity({ events, payments, notes }: BuildActivityInput): ActivityEntry[] {
  const entries: ActivityEntry[] = [
    ...events.map(e => ({ ts: e.date, kind: 'event' as const, title: e.title, detail: e.type })),
    ...payments.map(p => ({ ts: undefined, kind: 'payment' as const, title: p.label, detail: p.value })),
    ...notes.map(n => ({ ts: n.ts, kind: 'note' as const, title: n.text })),
  ];

  return entries.sort((a, b) => {
    if (a.ts && b.ts) return a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0;
    if (a.ts && !b.ts) return -1;
    if (!a.ts && b.ts) return 1;
    return 0;
  });
}
