import { useEffect, useMemo, useRef, useState, type ReactNode, type CSSProperties } from 'react';
import type { Client } from '../types';
import { T } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { PageHeader } from '../components/PageHeader';
import { StatusChip } from '../components/StatusChip';
import { Mono } from '../components/primitives';
import { EventDialog } from '../components/EventDialog';
import { initials, parsePayments } from '../lib/clientHelpers';
import { searchClients } from '../lib/search';
import { t, formatCurrency, clientStatuses, statusByKey, featureOn, listFields } from '../config';
import type { PackField } from '../config';

interface Props { clients: Client[]; onOpen: (id: number) => void; onCreate: () => void; }

/** Is this input/textarea/select currently focused? Used to keep the table's
 *  own ↑↓/Enter keyboard nav from fighting GlobalSearch (or any other input)
 *  for the same keys. */
function isTypingTarget(): boolean {
  const tag = document.activeElement?.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}

function whatsappHref(phone: string): string | null {
  const digits = phone.replace(/\D/g, '');
  return digits ? `https://wa.me/${digits}` : null;
}

export function ClientsScreen({ clients, onOpen, onCreate }: Props) {
  const mobile = useIsMobile();
  const statusChips = [
    { id: 'totes', l: t('status.all') },
    ...clientStatuses().map(s => ({ id: s.key, l: s.shortLabel ?? s.label })),
  ];
  const [filter, setFilter] = useState('totes');
  const [mobileSearch, setMobileSearch] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(-1);
  const [eventClient, setEventClient] = useState<Client | null>(null);
  const rowRefs = useRef<(HTMLTableRowElement | null)[]>([]);

  const fieldVal = (c: Client, f: PackField): string =>
    String((f.storage === 'custom' ? c.custom?.[f.key] : (c as unknown as Record<string, unknown>)[f.key]) ?? '');

  // First non-key-date list field becomes the "item" column (atelier: garment → "Peça").
  const itemListField = listFields().find(f => !f.isKeyDate);

  const filtered = useMemo(() => {
    const byStatus = filter === 'totes' ? clients : clients.filter(c => c.status === filter);
    return mobile && mobileSearch ? searchClients(byStatus, mobileSearch) : byStatus;
  }, [clients, filter, mobile, mobileSearch]);

  // Canonical order: non-terminal clients first (soonest key-date, or name when
  // there's no key-date concept), terminal-status clients (delivered/discharged/…)
  // always last, dimmed.
  const list = useMemo(() => {
    const terminal = (c: Client) => !!statusByKey(c.status)?.terminal;
    const cmp = (a: Client, b: Client) =>
      featureOn('keyDate') ? a.days_until - b.days_until : a.name.localeCompare(b.name);
    const active = filtered.filter(c => !terminal(c)).sort(cmp);
    const done = filtered.filter(c => terminal(c)).sort(cmp);
    return [...active, ...done];
  }, [filtered]);

  // Reset keyboard selection whenever the visible list changes shape (filter
  // toggled, data refreshed) so a stale index can't point at the wrong row.
  useEffect(() => { setSelectedIdx(-1); }, [filter, clients]);

  useEffect(() => {
    if (mobile) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (isTypingTarget()) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIdx(i => Math.min(i + 1, list.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIdx(i => Math.max(i - 1, 0));
      } else if (e.key === 'Enter') {
        if (selectedIdx >= 0 && list[selectedIdx]) {
          e.preventDefault();
          onOpen(list[selectedIdx].id);
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [mobile, list, selectedIdx, onOpen]);

  useEffect(() => {
    rowRefs.current[selectedIdx]?.scrollIntoView({ block: 'nearest' });
  }, [selectedIdx]);

  const px = mobile ? 20 : 40;

  type Col = { label: string; align?: 'r'; render: (c: Client) => ReactNode };
  const desktopCols: Col[] = [
    { label: t('common.client'), render: (c) => (
      <div>
        <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500 }}>{c.name}</div>
        {c.phone && <Mono size={10.5} color={T.ink3} style={{ marginTop: 1, display: 'block' }}>{c.phone}</Mono>}
      </div>
    ) },
    ...(itemListField ? [{ label: itemListField.listLabel ?? itemListField.label, render: (c: Client) => <Mono size={11} color={T.ink2}>{fieldVal(c, itemListField) || '—'}</Mono> } as Col] : []),
    { label: t('clients.colStatus'), render: (c) => <StatusChip statusKey={c.status} size="sm" /> },
    ...(featureOn('keyDate') ? [
      { label: t('event.keyDate'), align: 'r', render: (c: Client) => <Mono size={11} color={T.ink3} style={{ fontVariantNumeric: 'tabular-nums' }}>{c.wedding_date}</Mono> } as Col,
      { label: t('clients.colDays'), align: 'r', render: (c: Client) => {
        const terminal = !!statusByKey(c.status)?.terminal;
        const soon = !terminal && c.days_until >= 0 && c.days_until < 45;
        return <span style={{ fontFamily: T.serif, fontSize: 15, fontWeight: 600, color: soon ? T.accent : T.ink, fontVariantNumeric: 'tabular-nums' }}>
          {terminal ? '✓' : c.days_until < 0 ? `−${Math.abs(c.days_until)}` : c.days_until}
        </span>;
      } } as Col,
    ] : []),
    { label: t('common.pending'), align: 'r', render: (c) => {
      const { priceTotal, paid } = parsePayments(c.payments);
      const outstanding = priceTotal ? Math.max(0, priceTotal - paid) : 0;
      return outstanding > 0
        ? <Mono size={12} color={T.accent} style={{ fontWeight: 600, fontVariantNumeric: 'tabular-nums' }}>{formatCurrency(outstanding)}</Mono>
        : <Mono size={12} color={T.ink3} style={{ fontVariantNumeric: 'tabular-nums' }}>—</Mono>;
    } },
  ];

  const plusButton = (
    <button
      onClick={onCreate}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, flexShrink: 0,
        border: `1px solid ${T.hairline2}`, background: T.vellum,
        cursor: 'pointer', borderRadius: 2,
      }}
      title={t('newClient.title')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.ink2} strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 1v12M1 7h12"/>
      </svg>
    </button>
  );

  const searchBox = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${T.hairline}`, padding: '7px 12px', borderRadius: 2, background: T.vellum, minWidth: 'auto' }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={T.ink3} strokeWidth="1.5">
        <circle cx="5" cy="5" r="3.5"/><path d="M8 8l2.5 2.5" strokeLinecap="round"/>
      </svg>
      <input value={mobileSearch} onChange={e => setMobileSearch(e.target.value)} placeholder={t('clients.search')}
        style={{ border: 'none', background: 'none', fontFamily: T.sans, fontSize: 13, color: T.ink, outline: 'none', width: '100%' }} />
    </div>
  );

  const chips = (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {statusChips.map(f => {
        const on = filter === f.id;
        return (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: mobile ? '8px 16px' : '6px 14px', flexShrink: 0,
            fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase',
            border: `1px solid ${on ? T.ink : T.hairline}`,
            background: on ? T.ink : 'transparent',
            color: on ? T.paper : T.ink3,
            borderRadius: 999, cursor: 'pointer',
          }}>{f.l}</button>
        );
      })}
    </div>
  );

  const rowActions = (c: Client) => {
    const wa = whatsappHref(c.phone);
    return (
      <div style={{ display: 'flex', gap: 5, justifyContent: 'flex-end' }} onClick={e => e.stopPropagation()}>
        <button onClick={() => onOpen(c.id)} style={actionPillStyle}>{t('nav.profile')}</button>
        {wa && <a href={wa} target="_blank" rel="noopener noreferrer" style={{ ...actionPillStyle, textDecoration: 'none', display: 'inline-block' }}>WhatsApp</a>}
        <button onClick={() => setEventClient(c)} style={actionPillStyle}>+ {t('event.typeAppointment')}</button>
      </div>
    );
  };

  if (!mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <PageHeader eyebrow={t('clients.eyebrow')} title={t('nav.clients')} subtitle={`${clients.length} ${t('clients.brides')}`} right={<>{plusButton}</>} />
        <div style={{ padding: `14px ${px}px 0`, flexShrink: 0 }}>{chips}</div>
        <div style={{ flex: 1, overflow: 'auto', padding: `0 ${px}px 32px` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr>
                {desktopCols.map(({ label, align }) => (
                  <th key={label} style={{
                    textAlign: align === 'r' ? 'right' : 'left', padding: '8px 12px 8px 0',
                    fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
                    color: T.ink3,
                    borderBottom: `1px solid ${T.hairline}`, fontWeight: 400,
                  }}>
                    {label}
                  </th>
                ))}
                <th style={{ width: 190, borderBottom: `1px solid ${T.hairline}` }} />
              </tr>
            </thead>
            <tbody>
              {list.map((c, idx) => {
                const active = idx === selectedIdx;
                const terminal = !!statusByKey(c.status)?.terminal;
                return (
                  <tr
                    key={c.id}
                    ref={el => { rowRefs.current[idx] = el; }}
                    onClick={() => onOpen(c.id)}
                    onMouseEnter={() => setSelectedIdx(idx)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: `1px solid ${T.hairline}`,
                      background: active ? T.paper2 : 'transparent',
                      opacity: terminal ? 0.55 : 1,
                    }}
                  >
                    {desktopCols.map((col, ci) => (
                      <td key={col.label} style={{
                        padding: '13px 12px 13px 0',
                        textAlign: col.align === 'r' ? 'right' : 'left',
                        boxShadow: active && ci === 0 ? `inset 3px 0 0 ${T.accent}` : 'none',
                      }}>
                        {col.render(c)}
                      </td>
                    ))}
                    <td style={{ padding: '13px 0' }}>
                      {active && rowActions(c)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('clients.empty')}</div>
          )}
        </div>
        {eventClient && (
          <EventDialog
            clients={clients}
            defaultClientId={eventClient.id}
            onSuccess={() => setEventClient(null)}
            onClose={() => setEventClient(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader eyebrow={t('clients.eyebrowMobile')} title={t('nav.clients')} subtitle={`${clients.length}`} right={<>{searchBox}{plusButton}</>} />
      <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>{chips}</div>
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px 24px' }}>
        {list.map(c => {
          const past = c.days_until < 0;
          const terminal = !!statusByKey(c.status)?.terminal;
          const { priceTotal, paid } = parsePayments(c.payments);
          const outstanding = priceTotal ? Math.max(0, priceTotal - paid) : 0;
          const soon = c.days_until >= 0 && c.days_until < 45;
          return (
            <div
              key={c.id}
              onClick={() => onOpen(c.id)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                background: T.sheet,
                border: `1px solid ${T.hairline}`,
                borderRadius: 14,
                padding: '13px 14px',
                marginBottom: 8,
                cursor: 'pointer',
                opacity: terminal ? 0.55 : 1,
              }}
            >
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.paper2, border: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontStyle: 'italic', fontWeight: 600, fontSize: 15, color: T.ink2 }}>{initials(c.name)}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: T.serif, fontSize: 18, fontWeight: 600, color: T.ink, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.name}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5 }}>
                  <StatusChip statusKey={c.status} size="sm" />
                  {outstanding > 0 && <Mono size={12.5} color={T.accent} style={{ fontWeight: 600 }}>{formatCurrency(outstanding)}</Mono>}
                </div>
              </div>
              {featureOn('keyDate') && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: T.serif, fontSize: 21, fontWeight: 600, color: terminal ? T.ink3 : (soon ? T.accent : T.ink), fontVariantNumeric: 'tabular-nums' }}>
                    {terminal ? '✓' : (past ? `−${Math.abs(c.days_until)}` : c.days_until)}
                  </div>
                  <Mono size={9.5} color={T.ink3} style={{ marginTop: 4, letterSpacing: 1, textTransform: 'uppercase', display: 'block' }}>
                    {terminal ? c.wedding_date : `${t('common.days')} · ${c.wedding_date}`}
                  </Mono>
                </div>
              )}
            </div>
          );
        })}
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '48px 0', fontFamily: T.serif, fontSize: 18, fontStyle: 'italic', color: T.ink3 }}>{t('clients.empty')}</div>
        )}
      </div>
    </div>
  );
}

const actionPillStyle: CSSProperties = {
  fontFamily: T.mono, fontSize: 10, fontWeight: 600, letterSpacing: 0.4, textTransform: 'uppercase',
  border: `1px solid ${T.hairline2}`, background: T.sheet, color: T.ink2,
  borderRadius: 6, padding: '5px 8px', cursor: 'pointer', whiteSpace: 'nowrap',
};
