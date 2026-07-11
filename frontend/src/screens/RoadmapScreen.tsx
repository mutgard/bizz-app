import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { T } from '../tokens';
import { api } from '../api';
import type { AtelierEvent, Client } from '../types';
import { EventChip } from '../components/EventChip';
import { EventDialog } from '../components/EventDialog';
import { Mono } from '../components/primitives';
import {
  getMonthCells, dateToIso, monthNames, dayNames,
} from '../lib/calendarHelpers';
import { t } from '../config';

interface Props {
  clients: Client[];
  onRefresh: () => void;
}

export function RoadmapScreen({ clients, onRefresh }: Props) {
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [events, setEvents] = useState<AtelierEvent[]>([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [createDate, setCreateDate] = useState<string | undefined>();

  const year  = current.getFullYear();
  const month = current.getMonth();

  const fetchEvents = () => {
    const from = dateToIso(new Date(year, month, 1));
    const to   = dateToIso(new Date(year, month + 1, 0));
    api.listEvents(from, to).then(setEvents);
  };

  useEffect(fetchEvents, [year, month]);

  const cells = getMonthCells(year, month);
  const todayIso = dateToIso(new Date());

  // Build map: ISO date → events
  const eventMap = new Map<string, AtelierEvent[]>();
  for (const e of events) {
    const list = eventMap.get(e.date) ?? [];
    list.push(e);
    eventMap.set(e.date, list);
  }

  const handlePrev  = () => setCurrent(new Date(year, month - 1, 1));
  const handleNext  = () => setCurrent(new Date(year, month + 1, 1));
  const handleToday = () => setCurrent(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  const handleCellClick = (iso: string) => {
    setCreateDate(iso);
    setCreateOpen(true);
  };

  const handleChanged = () => { fetchEvents(); onRefresh(); };

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
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontFamily: T.serif, fontSize: 24, color: T.ink, letterSpacing: -0.5 }}>
            {monthNames()[month]}
          </span>
          <span style={{ fontFamily: T.mono, fontSize: 13, color: T.ink3, marginLeft: 10 }}>
            {year}
          </span>
        </div>
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
        <button
          onClick={() => { setCreateDate(undefined); setCreateOpen(true); }}
          style={{
            background: T.ink, color: T.paper, border: 'none', cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
            fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
            textTransform: 'uppercase', padding: '5px 14px', borderRadius: 2,
          }}
        >
          <Plus size={12} /> {t('roadmap.new')}
        </button>
      </div>

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

      {/* Calendar grid */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          padding: '0 4px 8px',
        }}>
          {cells.map((date, i) => {
            if (!date) {
              return <div key={`empty-${i}`} style={{ minHeight: 90, borderBottom: `1px solid ${T.hairline}`, padding: 6 }} />;
            }
            const iso      = dateToIso(date);
            const dayEvs   = eventMap.get(iso) ?? [];
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
