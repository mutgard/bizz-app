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
import {
  DAY_START, DAY_END, HOUR_PX,
  blockTop, blockHeight, hourLabels, slotHourFromOffset, isAllDay, layoutDay,
} from '../lib/hourGrid';
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

/** "1h", "1h30", "30 m" — compact duration text for an event block's header line. */
function durationLabel(min: number | null | undefined): string {
  const m = min ?? 60;
  if (m % 60 === 0) return `${m / 60}h`;
  if (m < 60) return `${m} m`;
  return `${Math.floor(m / 60)}h${m % 60}`;
}

/** Whether any event in `events` overlaps the given "HH:00" hour slot —
 *  used both to suppress the hover "+ HH:00" affordance and to refuse a
 *  slot click over an existing block. */
function isHourOccupied(events: AtelierEvent[], hour: string): boolean {
  const slotTop = blockTop(hour);
  const slotBottom = slotTop + HOUR_PX;
  return events.some((ev) => {
    const top = blockTop(ev.time);
    const bottom = top + blockHeight(ev.duration_min);
    return slotTop < bottom && slotBottom > top;
  });
}

/** One day's column in the hourly week grid: positioned event blocks, the
 *  hover "+ HH:00" empty-slot affordance, and (for today) the live now-line. */
function DayColumn({ iso, isToday, events, now, onSlotClick, onEventClick }: {
  iso: string;
  isToday: boolean;
  events: AtelierEvent[];
  now: Date;
  onSlotClick: (hour: string) => void;
  onEventClick: (event: AtelierEvent) => void;
}) {
  const [hoverY, setHoverY] = useState<number | null>(null);
  const columnHeight = (DAY_END - DAY_START) * HOUR_PX;

  const hoverHour = hoverY != null ? slotHourFromOffset(hoverY) : null;
  const hoverBlocked = hoverHour != null && isHourOccupied(events, hoverHour);

  const nowHour = now.getHours();
  const nowTop = isToday && nowHour >= DAY_START && nowHour < DAY_END
    ? blockTop(`${String(nowHour).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`)
    : null;

  return (
    <div
      data-testid={`day-col-${iso}`}
      onMouseMove={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setHoverY(e.clientY - rect.top);
      }}
      onMouseLeave={() => setHoverY(null)}
      onClick={(e) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const hour = slotHourFromOffset(e.clientY - rect.top);
        if (!isHourOccupied(events, hour)) onSlotClick(hour);
      }}
      style={{
        position: 'relative', height: columnHeight, cursor: hoverBlocked ? 'default' : 'pointer',
        borderLeft: `1px solid ${T.hairline}`,
        background: isToday ? `${T.accent}09` : 'transparent',
        backgroundImage: `repeating-linear-gradient(to bottom, transparent 0 ${HOUR_PX - 1}px, ${T.hairline} ${HOUR_PX - 1}px ${HOUR_PX}px)`,
      }}
    >
      {layoutDay(events).map(({ event: ev, top, height, col, cols }) => {
        const noShow = ev.outcome === 'no_show';
        const done = ev.outcome === 'done';
        const border = noShow ? T.accent : (TYPE_BORDER[ev.type] ?? T.ink2);
        const clickable = ev.client_id != null;
        // Overlapping events share the column width side by side (design mock
        // shows single blocks only; first-fit columns per overlap cluster).
        const widthPct = 100 / cols;
        return (
          <div
            key={`${ev.type}-${ev.id}`}
            onClick={(e) => { e.stopPropagation(); onEventClick(ev); }}
            style={{
              position: 'absolute', top, height,
              left: `calc(${col * widthPct}% + 4px)`,
              width: `calc(${widthPct}% - 8px)`,
              borderLeft: `3px solid ${border}`,
              background: noShow ? `${T.accent}14` : T.paper2,
              borderRadius: 2, padding: '3px 6px', overflow: 'hidden',
              cursor: clickable ? 'pointer' : 'default',
            }}
          >
            <Mono size={9} color={noShow ? T.accent : T.ink3} style={{ display: 'block' }}>
              {ev.time} · {noShow ? t('chip.noShow').toLowerCase() : durationLabel(ev.duration_min)}
              {done ? ` · ${t('avui.markDone').toLowerCase()}` : ''}
            </Mono>
            <div style={{
              fontFamily: T.sans, fontSize: 11, fontWeight: 600,
              color: noShow ? T.ink3 : T.ink,
              textDecoration: noShow ? 'line-through' : 'none',
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {ev.title}
            </div>
            {ev.client_name && (
              <div style={{
                fontFamily: T.sans, fontSize: 10, color: T.ink3,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {ev.client_name}
              </div>
            )}
          </div>
        );
      })}

      {hoverHour != null && !hoverBlocked && (
        <div style={{
          position: 'absolute', left: 4, right: 4, top: blockTop(hoverHour), height: HOUR_PX - 2,
          border: `1px dashed ${T.ink3}`, borderRadius: 2, pointerEvents: 'none',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: T.mono, fontSize: 10, color: T.ink3,
        }}>
          + {hoverHour}
        </div>
      )}

      {nowTop != null && (
        <div style={{ position: 'absolute', left: 0, right: 0, top: nowTop, height: 2, background: T.accent, zIndex: 2 }}>
          <div style={{ position: 'absolute', left: -1, top: -3, width: 8, height: 8, borderRadius: '50%', background: T.accent }} />
        </div>
      )}
    </div>
  );
}

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
  const [createTime, setCreateTime] = useState<string | undefined>();

  // Now-line: recomputed every minute so today's column keeps a live marker
  // (docs/design/proposal-v1-desktop.html section 5's ".nowline").
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(id);
  }, []);

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
    setCreateTime(undefined);
    setCreateOpen(true);
  };

  const handleSlotClick = (iso: string, hour: string) => {
    setCreateDate(iso);
    setCreateTime(hour);
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
          onClick={() => { setCreateDate(undefined); setCreateTime(undefined); setCreateOpen(true); }}
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
        <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px 16px' }}>
          <div style={{ border: `1px solid ${T.hairline}`, borderRadius: 4, overflow: 'hidden' }}>

            {/* Day-of-week + date headers (56px hour axis + 7 day columns) */}
            <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7, 1fr)` }}>
              <div style={{ borderBottom: `1px solid ${T.hairline}` }} />
              {week.days.map((iso, i) => {
                const isToday = iso === todayIso;
                const dayNum = Number(iso.split('-')[2]);
                return (
                  <div
                    key={iso}
                    style={{
                      padding: '7px 6px', textAlign: 'center',
                      borderLeft: `1px solid ${T.hairline}`, borderBottom: `1px solid ${T.hairline}`,
                    }}
                  >
                    <Mono size={9} color={isToday ? T.accent : T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>
                      {dayNames()[i]}
                    </Mono>
                    <div style={{ fontFamily: T.serif, fontSize: 14, color: isToday ? T.accent : T.ink, marginTop: 2 }}>
                      {dayNum}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* All-day strip: weddings + events without a time */}
            <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7, 1fr)` }}>
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '3px 2px', borderBottom: `1px solid ${T.hairline}`,
              }}>
                <Mono size={8} color={T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.5, textAlign: 'center', lineHeight: 1.2 }}>
                  {t('agenda.allDay')}
                </Mono>
              </div>
              {week.days.map((iso) => {
                const allDayEvents = (eventsByIso.get(iso) ?? []).filter(isAllDay);
                return (
                  <div
                    key={iso}
                    style={{
                      minHeight: 32, padding: '3px 4px', display: 'flex', flexDirection: 'column', gap: 3,
                      borderLeft: `1px solid ${T.hairline}`, borderBottom: `1px solid ${T.hairline}`,
                    }}
                  >
                    {allDayEvents.map((ev) => (
                      <div
                        key={`${ev.type}-${ev.id}`}
                        onClick={() => { if (ev.client_id != null) onOpenClient(ev.client_id); }}
                        style={{
                          fontFamily: T.sans, fontSize: 10.5, fontWeight: 600, color: T.ink,
                          background: T.paper2, borderLeft: `3px solid ${TYPE_BORDER[ev.type] ?? T.ink2}`,
                          borderRadius: 2, padding: '3px 6px',
                          cursor: ev.client_id != null ? 'pointer' : 'default',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}
                      >
                        {ev.title}
                      </div>
                    ))}
                  </div>
                );
              })}
            </div>

            {/* Hour axis + positioned event blocks */}
            <div style={{ display: 'grid', gridTemplateColumns: `56px repeat(7, 1fr)` }}>
              <div>
                {hourLabels().map((label) => (
                  <div key={label} style={{ height: HOUR_PX, textAlign: 'right', paddingRight: 8, paddingTop: 3, boxSizing: 'border-box' }}>
                    <Mono size={9} color={T.ink3}>{label}</Mono>
                  </div>
                ))}
              </div>
              {week.days.map((iso) => (
                <DayColumn
                  key={iso}
                  iso={iso}
                  isToday={iso === todayIso}
                  events={(eventsByIso.get(iso) ?? []).filter((e) => !isAllDay(e))}
                  now={now}
                  onSlotClick={(hour) => handleSlotClick(iso, hour)}
                  onEventClick={(ev) => { if (ev.client_id != null) onOpenClient(ev.client_id); }}
                />
              ))}
            </div>
          </div>
        </div>
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
          defaultTime={createTime}
          clients={clients}
          onSuccess={() => { setCreateOpen(false); handleChanged(); }}
          onClose={() => setCreateOpen(false)}
        />
      )}
    </div>
  );
}
