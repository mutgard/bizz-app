import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { T } from '../tokens';
import { Serif, Mono, Label } from '../components/primitives';
import { useIsMobile } from '../hooks/useIsMobile';
import { api } from '../api';
import type { AtelierEvent, Client, Lead } from '../types';
import { groupEventsByDay } from '../lib/timeline';
import { buildFinances } from '../lib/finance';
import { dateToIso, isoToday } from '../lib/calendarHelpers';
import { t, formatCurrency, featureOn, usePack } from '../config';

interface Props {
  clients: Client[];
  onOpenClient: (id: number) => void;
}

function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  return dateToIso(new Date(y, m - 1, d + days));
}

const EVENT_CHIP: Record<string, { bg: string; fg: string; bd: string }> = {
  appointment: { bg: 'transparent', fg: T.ink2, bd: T.ink3 },
  delivery:    { bg: '#f6efdc',     fg: '#6b5420', bd: T.gold },
  wedding:     { bg: T.accent,      fg: T.paper,   bd: T.accent },
};

function eventTypeLabel(type: AtelierEvent['type']): string {
  if (type === 'delivery') return t('event.typeDelivery');
  if (type === 'wedding') return t('event.keyDate');
  return t('event.typeAppointment');
}

export function TodayScreen({ clients, onOpenClient }: Props) {
  const mobile = useIsMobile();
  const px = mobile ? 20 : 40;
  const navigate = useNavigate();
  const pack = usePack();
  const [events, setEvents] = useState<AtelierEvent[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);

  useEffect(() => {
    const today = isoToday();
    api.listEvents(today, addDays(today, 30)).then(setEvents);
    if (featureOn('intake')) api.listLeads('open').then(setLeads);
  }, []);

  const groups = useMemo(() => groupEventsByDay(events, pack.locale), [events, pack.locale]);
  const finances = useMemo(() => buildFinances(clients), [clients]);

  const firstName = pack.brand.userName.split(' ')[0];
  const today = isoToday();
  const weekEnd = addDays(today, 6);

  const fittingsThisWeek = events.filter(e => e.type === 'appointment' && e.date >= today && e.date <= weekEnd).length;

  const nearestKeyDate = featureOn('keyDate')
    ? clients.filter(c => c.days_until > 0).sort((a, b) => a.days_until - b.days_until)[0]
    : undefined;

  const subParts: string[] = [];
  if (fittingsThisWeek > 0) subParts.push(`${fittingsThisWeek} ${t('common.fittings')} · ${t('common.thisWeek')}`);
  if (nearestKeyDate) subParts.push(`${nearestKeyDate.days_until} ${t('common.days')} · ${t('event.keyDate')}`);

  const urgent = featureOn('keyDate')
    ? finances
        .filter(f => f.outstanding > 0 && f.client.days_until > 0)
        .sort((a, b) => a.client.days_until - b.client.days_until)[0]
    : finances.filter(f => f.outstanding > 0)[0];

  const totalOutstanding = finances.reduce((s, f) => s + f.outstanding, 0);
  const totalPaid = finances.reduce((s, f) => s + f.paid, 0);
  const grandTotal = finances.reduce((s, f) => s + f.priceTotal, 0);
  const overallPct = grandTotal > 0 ? Math.min(100, Math.round((totalPaid / grandTotal) * 100)) : 0;

  const latestLead = leads.length > 0
    ? [...leads].sort((a, b) => b.created_at.localeCompare(a.created_at))[0]
    : undefined;

  const leadAgo = (createdAt: string): string => {
    const ms = Date.now() - new Date(createdAt).getTime();
    const hours = ms / 3600000;
    if (hours < 1) return `${Math.max(1, Math.round(ms / 60000))}m`;
    if (hours < 24) return `${Math.round(hours)}h`;
    return `${Math.round(hours / 24)}d`;
  };

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: `${mobile ? 20 : 28}px ${px}px 40px` }}>

      {/* Greeting */}
      <div style={{ marginBottom: 24 }}>
        <Serif size={32} italic>{t('avui.greeting')}, {firstName}</Serif>
        {subParts.length > 0 && (
          <Mono size={11} color={T.ink3} style={{ display: 'block', marginTop: 6 }}>
            {subParts.join(' · ')}
          </Mono>
        )}
      </div>

      {/* Urgent */}
      {urgent && (
        <div style={{ marginBottom: 28 }}>
          <Label style={{ marginBottom: 10 }}>{t('avui.urgentSection')}</Label>
          <div
            onClick={() => onOpenClient(urgent.client.id)}
            style={{
              background: T.vellum, border: `1px solid ${T.hairline}`, borderLeft: `3px solid ${T.accent}`,
              borderRadius: 4, padding: '14px 16px', cursor: 'pointer',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12,
            }}
          >
            <div>
              <div style={{ fontFamily: T.sans, fontSize: 15, fontWeight: 600, color: T.ink }}>{urgent.client.name}</div>
              <Mono size={11} color={T.accent} style={{ display: 'block', marginTop: 4 }}>
                {formatCurrency(urgent.outstanding)} {t('common.pending').toLowerCase()}
              </Mono>
            </div>
            {featureOn('keyDate') && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <Serif size={30} italic style={{ color: T.accent }}>{urgent.client.days_until}</Serif>
                <Mono size={9} color={T.ink3} style={{ display: 'block', textTransform: 'uppercase', letterSpacing: 0.8 }}>
                  {t('common.days')} · {t('event.keyDate')}
                </Mono>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div style={{ marginBottom: 28 }}>
        <Label style={{ marginBottom: 10 }}>{t('avui.todaySection')}</Label>
        {groups.length === 0 && (
          <Mono size={11} color={T.ink3}>{t('event.empty')}</Mono>
        )}
        {groups.map(group => (
          <div key={group.iso} style={{ marginBottom: 10 }}>
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0 6px',
            }}>
              <Mono size={10} color={group.isToday ? T.accent : T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 1.2, flexShrink: 0 }}>
                {group.isToday ? `${t('roadmap.today')} · ${group.dayLabel}` : group.dayLabel}
              </Mono>
              <div style={{ flex: 1, height: 1, background: T.hairline }} />
            </div>
            {group.events.map(e => {
              const chip = EVENT_CHIP[e.type] ?? EVENT_CHIP.appointment;
              const clickable = e.client_id != null;
              return (
                <div
                  key={`${e.type}-${e.id}`}
                  onClick={clickable ? () => onOpenClient(e.client_id!) : undefined}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0',
                    borderBottom: `1px solid ${T.hairline}`, cursor: clickable ? 'pointer' : 'default',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: T.sans, fontSize: 13.5, fontWeight: 500, color: T.ink, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {e.title}
                    </div>
                    {e.client_name && (
                      <Mono size={10} color={T.ink3} style={{ display: 'block', marginTop: 2 }}>{e.client_name}</Mono>
                    )}
                  </div>
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', flexShrink: 0,
                    padding: '2px 8px', borderRadius: 999,
                    border: `1px solid ${chip.bd}`, background: chip.bg, color: chip.fg,
                    fontFamily: T.mono, fontSize: 9, letterSpacing: 0.6, textTransform: 'uppercase',
                  }}>
                    {eventTypeLabel(e.type)}
                  </span>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {/* Inbox */}
      {latestLead && (
        <div style={{ marginBottom: 28 }}>
          <Label style={{ marginBottom: 10 }}>{t('avui.inboxSection')} · {leads.length}</Label>
          <div
            onClick={() => navigate('/intake')}
            style={{
              background: T.vellum, border: `1px solid ${T.hairline}`, borderLeft: `3px solid ${T.gold}`,
              borderRadius: 4, padding: '14px 16px', cursor: 'pointer',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10 }}>
              <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>
                {latestLead.name || t('inbox.unknown')}
              </span>
              <Mono size={9} color={T.ink3}>{t('inbox.waiting')} {leadAgo(latestLead.created_at)}</Mono>
            </div>
            {latestLead.notes && (
              <div style={{
                fontFamily: T.sans, fontSize: 12.5, fontStyle: 'italic', color: T.ink2, marginTop: 6,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {latestLead.notes}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Caixa */}
      <div>
        <Label style={{ marginBottom: 10 }}>{t('avui.caixaSection')}</Label>
        <div
          onClick={() => navigate('/caixa')}
          style={{ background: T.sheet, border: `1px solid ${T.hairline}`, borderRadius: 4, padding: '14px 16px', cursor: 'pointer' }}
        >
          <div style={{ display: 'flex', gap: mobile ? 20 : 32, flexWrap: 'wrap' }}>
            <div>
              <Serif size={21} italic style={{ color: T.accent }}>{formatCurrency(totalPaid)}</Serif>
              <Mono size={9} color={T.ink3} style={{ display: 'block', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('common.paid')}</Mono>
            </div>
            <div>
              <Serif size={21} italic style={{ color: totalOutstanding > 0 ? T.gold : T.ink3 }}>{formatCurrency(totalOutstanding)}</Serif>
              <Mono size={9} color={T.ink3} style={{ display: 'block', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('common.pending')}</Mono>
            </div>
            <div>
              <Serif size={21} italic>{overallPct}%</Serif>
              <Mono size={9} color={T.ink3} style={{ display: 'block', marginTop: 2, textTransform: 'uppercase', letterSpacing: 0.8 }}>{t('finances.progress')}</Mono>
            </div>
          </div>
          <div style={{ marginTop: 12, height: 5, background: T.hairline, borderRadius: 3 }}>
            <div style={{ height: '100%', width: `${overallPct}%`, background: overallPct >= 100 ? T.accent : T.gold, borderRadius: 3, transition: 'width 0.3s' }} />
          </div>
        </div>
      </div>
    </div>
  );
}
