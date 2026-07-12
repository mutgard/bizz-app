import { dateToIso } from './calendarHelpers';

export interface Week {
  start: string;   // ISO date of the Monday
  end: string;     // ISO date of the Sunday
  days: string[];  // 7 ISO date strings, Monday .. Sunday
}

/**
 * The ISO Monday-start week containing `date`. Uses the Date object's local
 * calendar fields (never toISOString/UTC conversion) so callers passing a
 * local "now" or a locally-constructed date never see the day shift across
 * a timezone boundary — same house pattern as `isoToday` in `lib/timeline.ts`.
 */
export function weekOf(date: Date): Week {
  const dow = (date.getDay() + 6) % 7; // Mon=0 … Sun=6
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate() - dow);
  const days = Array.from({ length: 7 }, (_, i) =>
    dateToIso(new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + i))
  );
  return { start: days[0], end: days[6], days };
}

/** The week `delta` whole weeks away (±1 = adjacent week). */
export function shiftWeek(week: Week, delta: number): Week {
  const [y, m, d] = week.start.split('-').map(Number);
  return weekOf(new Date(y, m - 1, d + delta * 7));
}
