import { describe, it, expect } from 'vitest';
import { weekOf, shiftWeek } from '../week';

describe('weekOf', () => {
  it('returns the ISO Monday-start week containing the given date', () => {
    // 2026-07-11 is a Saturday.
    const week = weekOf(new Date(2026, 6, 11));
    expect(week.start).toBe('2026-07-06');
    expect(week.end).toBe('2026-07-12');
    expect(week.days).toHaveLength(7);
    expect(week.days).toEqual([
      '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09',
      '2026-07-10', '2026-07-11', '2026-07-12',
    ]);
    expect(week.days).toContain('2026-07-11');
  });

  it('treats Monday itself as the start of its own week', () => {
    const week = weekOf(new Date(2026, 6, 6));
    expect(week.start).toBe('2026-07-06');
    expect(week.end).toBe('2026-07-12');
  });

  it('handles a week that spans a month boundary', () => {
    // 2026-08-01 is a Saturday; its week starts 2026-07-27.
    const week = weekOf(new Date(2026, 7, 1));
    expect(week.start).toBe('2026-07-27');
    expect(week.end).toBe('2026-08-02');
  });
});

describe('shiftWeek', () => {
  it('moves the week forward by 7 days', () => {
    const week = weekOf(new Date(2026, 6, 11));
    const next = shiftWeek(week, 1);
    expect(next.start).toBe('2026-07-13');
    expect(next.end).toBe('2026-07-19');
  });

  it('moves the week backward by 7 days', () => {
    const week = weekOf(new Date(2026, 6, 11));
    const prev = shiftWeek(week, -1);
    expect(prev.start).toBe('2026-06-29');
    expect(prev.end).toBe('2026-07-05');
  });
});
