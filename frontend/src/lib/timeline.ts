import type { AtelierEvent } from '../types';
import type { Pack } from '../config';
// `isoToday` itself is pure (no pack coupling) even though calendarHelpers.ts
// also exports pack-driven helpers (monthNames/dayNames) — importing just
// this one keeps a single source of truth without pulling any pack
// dependency into this module's own logic.
import { isoToday } from './calendarHelpers';

export interface DayGroup {
  dayLabel: string;
  iso: string;
  isToday: boolean;
  events: AtelierEvent[];
}

/**
 * Groups events by ISO date (`AtelierEvent.date`), sorted ascending by day.
 * Days with no events are simply absent (nothing to omit — the map is only
 * ever built from the given events). Day labels are built from the pack
 * locale's `dayNames` (Mon-first) and `monthNames`.
 */
export function groupEventsByDay(events: AtelierEvent[], locale: Pack['locale']): DayGroup[] {
  const map = new Map<string, AtelierEvent[]>();
  for (const e of events) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }

  const today = isoToday();

  return [...map.keys()].sort().map(iso => {
    const [y, m, d] = iso.split('-').map(Number);
    const dow = (new Date(y, m - 1, d).getDay() + 6) % 7; // Mon=0 … Sun=6
    const dayLabel = `${locale.dayNames[dow]} ${d} ${locale.monthNames[m - 1]}`;
    return { dayLabel, iso, isToday: iso === today, events: map.get(iso)! };
  });
}
