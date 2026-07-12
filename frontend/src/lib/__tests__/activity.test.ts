import { describe, it, expect } from 'vitest';
import { buildActivity } from '../activity';
import type { AtelierEvent, Payment, Note } from '../../types';

function event(overrides: Partial<AtelierEvent>): AtelierEvent {
  return {
    id: 1, type: 'appointment', date: '2026-01-01', title: 'Primera prova',
    client_id: 1, client_name: 'Aina Puig',
    ...overrides,
  };
}

function payment(overrides: Partial<Payment>): Payment {
  return { id: 1, label: 'Paga i senyal', value: '€500 · rebut', ...overrides };
}

function note(overrides: Partial<Note>): Note {
  return { id: 1, client_id: 1, ts: '2026-01-01T10:00:00', text: 'Trucada de seguiment', ...overrides };
}

describe('buildActivity', () => {
  it('sorts mixed events/payments/notes newest-first', () => {
    const feed = buildActivity({
      events: [event({ id: 1, date: '2026-03-01', title: 'Prova de mides' })],
      payments: [payment({ id: 1, label: 'Saldo', value: '€1.800 pendent' })],
      notes: [
        note({ id: 1, ts: '2026-02-15T09:00:00', text: 'Trucada: mou la prova' }),
        note({ id: 2, ts: '2026-04-01T09:00:00', text: 'Alta per WhatsApp' }),
      ],
    });

    // Dated entries (2 notes + 1 event) come first, newest → oldest; the
    // undated payment lands last regardless of its position in the input.
    expect(feed.map(f => f.title)).toEqual([
      'Alta per WhatsApp',       // 2026-04-01
      'Prova de mides',          // 2026-03-01
      'Trucada: mou la prova',   // 2026-02-15
      'Saldo',                   // no ts
    ]);
  });

  it('ranks a note logged today above an event dated yesterday', () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);

    const feed = buildActivity({
      events: [event({ date: yesterday, title: 'Entrega proveïdor' })],
      payments: [],
      notes: [note({ ts: `${today}T08:30:00`, text: 'Trucada avui' })],
    });

    expect(feed.map(f => f.title)).toEqual(['Trucada avui', 'Entrega proveïdor']);
  });

  it('sends entries without an ISO timestamp to the end, preserving their relative order', () => {
    const feed = buildActivity({
      events: [event({ id: 1, date: '2026-05-01', title: 'Prova' })],
      payments: [
        payment({ id: 1, label: 'Paga i senyal', value: '€500 · rebut' }),
        payment({ id: 2, label: 'Saldo', value: '€1.800 pendent' }),
      ],
      notes: [],
    });

    expect(feed.map(f => f.title)).toEqual(['Prova', 'Paga i senyal', 'Saldo']);
  });

  it('returns an empty feed for a client with no activity', () => {
    expect(buildActivity({ events: [], payments: [], notes: [] })).toEqual([]);
  });
});
