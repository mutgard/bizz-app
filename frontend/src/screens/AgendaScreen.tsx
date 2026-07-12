import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { T } from '../tokens';
import { api } from '../api';
import type { AtelierEvent, Client } from '../types';
import { EventChip } from '../components/EventChip';
import { EventDialog } from '../components/EventDialog';
import { SegmentedControl } from '../components/SegmentedControl';
import { Mono } from '../components/primitives';
import {
  getMonthCells, dateToIso, monthNames, dayNames,
} from '../lib/calendarHelpers';
import { weekOf, shiftWeek, type Week } from '../lib/week';
import { t } from '../config';

interface Props {
  clients: Client[];
  onOpenClient: (id: number) => void;
  onRefresh: () => void;
}

// Left-border color per event type for the week view's stacked rows, per
// the design mock's week-view spec (docs/superpowers/plans/2026-07-11-redesign-v1-ia.md,
// Task 12 Step 3: "appointment T.ink2, delivery T.gold, key date T.accent").
// This intentionally does NOT match EventChip's solid-fill vocabulary
// (appointment T.accent, delivery T.gold, wedding T.ink, used in the month
// grid / Avui timeline) — only `delivery` happens to land on the same color
// in both. The week column needs a quieter thin-border treatment so several
// stacked rows stay legible in a narrow column.
const TYPE_BORDER: Record<string, string> = {
  appointment: T.ink2,
  delivery: T.gold,
  wedding: T.accent,
};

function rangeLabel(week: Week): string {
  const [, m1, d1] = week.start.split('-').map(Number);
  const [y2, m2, d2] = week.end.split('-').map(Number);
  const startDay = Number(d1);
  if (m1 === m2) {
    return `${startDay} – ${d2} ${monthNames()[m1 - 1]}`;
  }
  return `${startDay} ${monthNames()[m1 - 1]} – ${d2} ${monthNames()[m2 - 1]} ${y2}`;
}

export function AgendaScreen({ clients, onOpenClient, onRefresh }: Props) {
  const [view, setView] = useState<'week' | 'month'>('week');
  const [week, setWeek] = useState<Week>(() => weekOf(new Date()));
  const [monthCursor, setMonthCursor] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<AtelierEvent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>();

  const monthYear = monthCursor.getFullYear();
  const monthMonth = monthCursor.getMonth();

  const fetchEvents = () => {
    if (view === 'week') {
      api.listEvents(week.start, week.end).then(setEvents);
    } else {
      const from = dateToIso(new Date(monthYear, monthMonth, 1));
      const to = dateToIso(new Date(monthYear, monthMonth + 1, 0));
      api.listEvents(from, to).then(setEvents);
    }
  };

  useEffect(fetchEvents, [view, week.start, week.end, monthYear, monthMonth]);

  const todayIso = dateToIso(new Date());

  const eventsByIso = new Map<string, AtelierEvent[]>();
  for (const e of events) {
    const list = eventsByIso.get(e.date) ?? [];
    list.push(e);
    eventsByIso.set(e.date, list);
  }

  const handlePrev = () => {
    if (view === 'week') setWeek((w) => shiftWeek(w, -1));
    else setMonthCursor(new Date(monthYear, monthMonth - 1, 1));
  };
  const handleNext = () => {
    if (view === 'week') setWeek((w) => shiftWeek(w, 1));
    else setMonthCursor(new Date(monthYear, monthMonth + 1, 1));
  };
  const handleToday = () => {
    const now = new Date();
    setWeek(weekOf(now));
    setMonthCursor(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const handleCellClick = (iso: string) => {
    setCreateDate(iso);
    setCreateOpen(true);
  };

  const handleChanged = () => { fetchEvents(); onRefresh(); };

  const label = view === 'week'
    ? rangeLabel(week)
    : monthNames()[monthMonth];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{
        padding: '16px 28px', borderBottom: `1px solid ${T.hairline}`,
        display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0,
      }}>
        <button onClick={handlePrev} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, padding: 4 }}>
          <ChevronLeft size={18} />
        </button>
        <span style={{ fontFamily: T.serif, fontSize: 22, color: T.ink, letterSpacing: -0.5 }}>
          {label}
        </span>
        {view === 'month' && (
          <span style={{ fontFamily: T.mono, fontSize: 13, color: T.ink3 }}>{monthYear}</span>
        )}
        <button onClick={handleNext} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink2, padding: 4 }}>
          <ChevronRight size={18} />
        </button>
        <button
          onClick={handleToday}
          style={{
            fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
            textTransform: 'uppercase', color: T.ink3, background: 'none',
            border: `1px solid ${T.hairline2}`, cursor: 'pointer',
            padding: '5px 12px', borderRadius: 2,
          }}
        >
          {t('roadmap.today')}
        </button>

        <div style={{ flex: 1 }} />

        <SegmentedControl
          options={[
            { key: 'week', label: t('agenda.week') },
            { key: 'month', label: t('agenda.month') },
          ]}
          value={view}
          onChange={(v) => setView(v as 'week' | 'month')}
        />

        <button
          onClick={() => { setCreateDate(undefined); setCreateOpen(true); }}
          style={{
            background: T.ink, color: T.paper, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
            textTransform: 'uppercase', padding: '5px 14px', borderRadius: 2,
          }}
        >
          <Plus size={12} /> {t('agenda.newAppointment')}
        </button>
      </div>

      {view === 'week' ? (
        <>
          {/* Day-of-week + date headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${T.hairline}`, flexShrink: 0,
            padding: '0 4px',
          }}>
            {week.days.map((iso, i) => {
              const isToday = iso === todayIso;
              const dayNum = Number(iso.split('-')[2]);
              return (
                <div key={iso} style={{ padding: '6px 8px', textAlign: 'center' }}>
                  <Mono size={9} color={isToday ? T.accent : T.ink3}>
                    {dayNames()[i]} {dayNum}
                  </Mono>
                </div>
              );
            })}
          </div>

          {/* Week grid */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              padding: '0 4px 8px', gap: 6,
            }}>
              {week.days.map((iso) => {
                const isToday = iso === todayIso;
                const dayEvents = eventsByIso.get(iso) ?? [];
                return (
                  <div
                    key={iso}
                    style={{
                      minHeight: 160, padding: '6px 4px',
                      border: `1px solid ${isToday ? T.accent : T.hairline}`,
                      borderRadius: 2,
                    }}
                  >
                    {dayEvents.map((ev) => {
                      const clickable = ev.client_id != null;
                      return (
                        <div
                          key={`${ev.type}-${ev.id}`}
                          onClick={() => { if (ev.client_id != null) onOpenClient(ev.client_id); }}
                          style={{
                            borderLeft: `3px solid ${TYPE_BORDER[ev.type] ?? T.ink2}`,
                            background: T.paper2, padding: '4px 6px', marginBottom: 4,
                            cursor: clickable ? 'pointer' : 'default',
                          }}
                        >
                          <div style={{
                            fontFamily: T.sans, fontSize: 11, color: T.ink,
                            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          }}>
                            {ev.title}
                          </div>
                          {ev.client_name && (
                            <div style={{ fontFamily: T.mono, fontSize: 9, color: T.ink3, marginTop: 1 }}>
                              {ev.client_name}
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <div
                      onClick={() => handleCellClick(iso)}
                      style={{
                        border: `1px dashed ${T.hairline2}`, borderRadius: 2,
                        padding: '4px 6px', textAlign: 'center', cursor: 'pointer',
                        fontFamily: T.mono, fontSize: 9, letterSpacing: 0.3, color: T.ink3,
                      }}
                    >
                      + {t('agenda.freeSlot')}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : (
        <>
          {/* Day-of-week headers */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
            borderBottom: `1px solid ${T.hairline}`, flexShrink: 0,
            padding: '0 4px',
          }}>
            {dayNames().map((d) => (
              <div key={d} style={{ padding: '6px 8px', textAlign: 'center' }}>
                <Mono size={9} color={T.ink3}>{d}</Mono>
              </div>
            ))}
          </div>

          {/* Calendar grid — lifted from the retired RoadmapScreen */}
          <div style={{ flex: 1, overflow: 'auto' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
              padding: '0 4px 8px',
            }}>
              {getMonthCells(monthYear, monthMonth).map((date, i) => {
                if (!date) {
                  return <div key={`empty-${i}`} style={{ minHeight: 90, borderBottom: `1px solid ${T.hairline}`, padding: 6 }} />;
                }
                const iso      = dateToIso(date);
                const dayEvs   = eventsByIso.get(iso) ?? [];
                const isToday  = iso === todayIso;
                const visible  = dayEvs.slice(0, 3);
                const overflow = dayEvs.length - visible.length;

                return (
                  <div
                    key={iso}
                    onClick={() => handleCellClick(iso)}
                    style={{
                      minHeight: 90, borderBottom: `1px solid ${T.hairline}`,
                      padding: '6px 4px', cursor: 'pointer',
                      background: isToday ? T.paper2 : 'transparent',
                      transition: 'background 0.1s',
                    }}
                    onMouseEnter={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = T.vellum; }}
                    onMouseLeave={(e) => { if (!isToday) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    <div style={{
                      fontFamily: T.mono, fontSize: 11, marginBottom: 4,
                      color: isToday ? T.paper : T.ink2,
                      background: isToday ? T.ink : 'transparent',
                      width: 22, height: 22, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      {date.getDate()}
                    </div>

                    {visible.map((ev) => (
                      <EventChip
                        key={`${ev.type}-${ev.id}`}
                        event={ev}
                        clients={clients}
                        onChanged={handleChanged}
                      />
                    ))}

                    {overflow > 0 && (
                      <div style={{
                        fontFamily: T.mono, fontSize: 9, color: T.ink3,
                        paddingLeft: 3, letterSpacing: 0.3,
                      }}>
                        +{overflow} {t('roadmap.more')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {createOpen && (
        <EventDialog
          defaultDate={createDate}
          clients={clients}
          onSuccess={() => { setCreateOpen(false); handleChanged(); }}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}
