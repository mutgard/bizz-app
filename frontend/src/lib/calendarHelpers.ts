import { getPack } from '../config';

/** Month names for the active pack locale (index 0 = January). */
export function monthNames(): string[] {
  return getPack().locale.monthNames;
}

/** Weekday headers for the active pack locale (Mon-first). */
export function dayNames(): string[] {
  return getPack().locale.dayNames;
}

/** Mon-first grid. Returns 35 or 42 Date|null entries. */
export function getMonthCells(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const lastDay  = new Date(year, month + 1, 0);
  const startOffset = (firstDay.getDay() + 6) % 7; // Mon=0 … Sun=6
  const totalCells  = Math.ceil((startOffset + lastDay.getDate()) / 7) * 7;
  return Array.from({ length: totalCells }, (_, i) => {
    const dayNum = i - startOffset + 1;
    if (dayNum < 1 || dayNum > lastDay.getDate()) return null;
    return new Date(year, month, dayNum);
  });
}

export function dateToIso(d: Date): string {
  const y  = d.getFullYear();
  const m  = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}

export function isoToday(): string {
  return dateToIso(new Date());
}

export function formatEventDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${monthNames()[m - 1]} ${y}`;
}
