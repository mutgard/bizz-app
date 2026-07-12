import type { Client } from '../types';

/** Case/diacritic-insensitive normalization for free-text matching. */
function normalize(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
}

/** Global client search: matches partial/case/diacritic-insensitive `name` and
 *  `garment`, or a digits-only comparison of `phone` (so "639 42 18 05" and
 *  "639421805" match each other regardless of formatting). Empty (or
 *  whitespace-only) query returns every client, unfiltered. */
export function searchClients(clients: Client[], q: string): Client[] {
  const query = q.trim();
  if (!query) return clients;

  const nq = normalize(query);
  const dq = query.replace(/\D/g, '');

  return clients.filter(c => {
    if (normalize(c.name).includes(nq)) return true;
    if (c.garment && normalize(c.garment).includes(nq)) return true;
    if (dq && c.phone) {
      const dPhone = c.phone.replace(/\D/g, '');
      if (dPhone && dPhone.includes(dq)) return true;
    }
    return false;
  });
}
