import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { groupEventsByDay } from '../timeline';
import type { AtelierEvent } from '../../types';

const locale = {
  code: 'ca',
  numberLocale: 'ca-ES',
  currencySymbol: '€',
  paidKeyword: 'rebut',
  doneKeywords: ['feta', 'entregat'],
  monthNames: ['Gener', 'Febrer', 'Març', 'Abril', 'Maig', 'Juny', 'Juliol', 'Agost', 'Setembre', 'Octubre', 'Novembre', 'Desembre'],
  dayNames: ['Dl', 'Dt', 'Dc', 'Dj', 'Dv', 'Ds', 'Dg'],
};

function event(overrides: Partial<AtelierEvent>): AtelierEvent {
  return {
    id: 1,
    type: 'appointment',
    date: '2026-07-11',
    title: 'Prova',
    client_id: null,
    client_name: null,
    ...overrides,
  };
}

describe('groupEventsByDay', () => {
  beforeEach(() => {
    // 2026-07-11 is a Saturday; fix "today" for isToday checks.
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 6, 11, 9, 0, 0));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('groups events by day, sorted ascending, flagging today', () => {
    const events = [
      event({ id: 1, date: '2026-07-14', title: 'Última prova · Aina Puig', client_id: 3, client_name: 'Aina Puig' }),
      event({ id: 2, date: '2026-07-11', title: 'Prova · Clara Ferrer', client_id: 1, client_name: 'Clara Ferrer' }),
      event({ id: 3, date: '2026-07-14', title: 'Recollida tela', client_id: null, client_name: null }),
    ];

    const groups = groupEventsByDay(events, locale);

    expect(groups).toHaveLength(2);
    expect(groups[0].iso).toBe('2026-07-11');
    expect(groups[0].isToday).toBe(true);
    expect(groups[0].events).toHaveLength(1);
    expect(groups[0].events[0].id).toBe(2);

    expect(groups[1].iso).toBe('2026-07-14');
    expect(groups[1].isToday).toBe(false);
    expect(groups[1].events).toHaveLength(2);
    expect(groups[1].events.map(e => e.id)).toEqual([1, 3]);
  });

  it('builds day labels from the pack locale day/month names', () => {
    const groups = groupEventsByDay([event({ date: '2026-07-14' })], locale);
    // 2026-07-14 is a Tuesday -> dayNames[1] = 'Dt'; month index 6 = 'Juliol'.
    expect(groups[0].dayLabel).toContain('Dt');
    expect(groups[0].dayLabel).toContain('14');
    expect(groups[0].dayLabel).toContain('Juliol');
  });

  it('returns an empty array for empty input', () => {
    expect(groupEventsByDay([], locale)).toEqual([]);
  });
});
