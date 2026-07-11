import { useState, type ReactNode } from 'react';
import type { Client } from '../types';
import { T } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { PageHeader } from '../components/PageHeader';
import { Badge, Mono } from '../components/primitives';
import { initials, parsePayments } from '../lib/clientHelpers';
import { t, formatCurrency, clientStatuses, statusByKey, featureOn, listFields } from '../config';
import type { PackField } from '../config';

interface Props { clients: Client[]; onOpen: (id: number) => void; onCreate: () => void; }

export function ClientsScreen({ clients, onOpen, onCreate }: Props) {
  const mobile = useIsMobile();
  const statusChips = [
    { id: 'totes', l: t('status.all') },
    ...clientStatuses().map(s => ({ id: s.key, l: s.shortLabel ?? s.label })),
  ];
  const [filter, setFilter] = useState('totes');
  const [search, setSearch] = useState('');
  type SortKey = 'days_until' | 'name' | 'status';
  type SortDir = 'asc' | 'desc';
  const [sortKey, setSortKey] = useState<SortKey>('days_until');
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return null;
    return <span style={{ marginLeft: 4, fontSize: 8 }}>{sortDir === 'asc' ? '▲' : '▼'}</span>;
  };

  const list = clients
    .filter(c => {
      const okF = filter === 'totes' || c.status === filter;
      const okS = !search || c.name.toLowerCase().includes(search.toLowerCase());
      return okF && okS;
    })
    .sort((a, b) => {
      let cmp = 0;
      if (sortKey === 'days_until') cmp = a.days_until - b.days_until;
      if (sortKey === 'name') cmp = a.name.localeCompare(b.name);
      if (sortKey === 'status') {
        const order = clientStatuses().map(s => s.key);
        cmp = order.indexOf(a.status) - order.indexOf(b.status);
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });

  const px = mobile ? 20 : 40;

  const urgency = (days: number, status: string): 'critical' | 'warning' | 'none' => {
    if (!featureOn('keyDate')) return 'none';
    if (statusByKey(status)?.terminal) return 'none';
    if (days <= 14 && days >= 0) return 'critical';
    if (days <= 30 && days >= 0) return 'warning';
    return 'none';
  };

  const fieldVal = (c: Client, f: PackField): string =>
    String((f.storage === 'custom' ? c.custom?.[f.key] : (c as unknown as Record<string, unknown>)[f.key]) ?? '');

  // First non-key-date list field becomes the "item" column (atelier: garment → "Peça").
  const itemListField = listFields().find(f => !f.isKeyDate);

  type Col = { label: string; sortKey: SortKey | null; render: (c: Client, past: boolean) => ReactNode };
  const desktopCols: Col[] = [
    { label: t('common.client'), sortKey: 'name', render: (c) => (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.paper3, border: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 13, fontStyle: 'italic', color: T.ink2, flexShrink: 0 }}>{initials(c.name)}</div>
        <span style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500 }}>{c.name}</span>
      </div>
    ) },
    ...(itemListField ? [{ label: itemListField.listLabel ?? itemListField.label, sortKey: null, render: (c: Client) => <Mono size={11} color={T.ink2}>{fieldVal(c, itemListField) || '—'}</Mono> } as Col] : []),
    { label: t('clients.colStatus'), sortKey: 'status', render: (c) => <Badge status={c.status} size="sm" /> },
    ...(featureOn('keyDate') ? [
      { label: t('event.keyDate'), sortKey: null, render: (c: Client) => <Mono size={11}>{c.wedding_date}</Mono> } as Col,
      { label: t('clients.colDays'), sortKey: 'days_until', render: (c: Client, past: boolean) => <Mono size={11} color={past ? T.accent : T.ink2}>{past ? `−${Math.abs(c.days_until)}d` : `${c.days_until}d`}</Mono> } as Col,
    ] : []),
    ...(featureOn('fabrics') ? [{ label: t('nav.fabrics'), sortKey: null, render: (c: Client) => <Mono size={11} color={T.ink3}>{c.fabrics.length > 0 ? String(c.fabrics.length) : '—'}</Mono> } as Col] : []),
    { label: t('common.pending'), sortKey: null, render: (c) => {
      const { priceTotal, paid } = parsePayments(c.payments);
      if (priceTotal === null || priceTotal === 0) return <Mono size={11} color={T.ink3}>—</Mono>;
      const outstanding = Math.max(0, priceTotal - paid);
      return outstanding > 0
        ? <Mono size={11} color={T.gold}>{formatCurrency(outstanding)}</Mono>
        : <Mono size={11} color={T.ink3}>✓</Mono>;
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
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, border: `1px solid ${T.hairline}`, padding: '7px 12px', borderRadius: 2, background: T.vellum, minWidth: mobile ? 'auto' : 220 }}>
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke={T.ink3} strokeWidth="1.5">
        <circle cx="5" cy="5" r="3.5"/><path d="M8 8l2.5 2.5" strokeLinecap="round"/>
      </svg>
      <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('clients.search')}
        style={{ border: 'none', background: 'none', fontFamily: T.sans, fontSize: 13, color: T.ink, outline: 'none', width: '100%' }} />
    </div>
  );

  const chips = (
    <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
      {statusChips.map(f => {
        const on = filter === f.id;
        return (
          <button key={f.id} onClick={() => setFilter(f.id)} style={{
            padding: '4px 12px', flexShrink: 0,
            fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase',
            border: `1px solid ${on ? T.ink : T.hairline}`,
            background: on ? T.ink : 'transparent',
            color: on ? T.paper : T.ink3,
            borderRadius: 2, cursor: 'pointer',
          }}>{f.l}</button>
        );
      })}
    </div>
  );

  if (!mobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
        <PageHeader eyebrow={t('clients.eyebrow')} title={t('nav.clients')} subtitle={`${clients.length} ${t('clients.brides')}`} right={<>{searchBox}{plusButton}</>} />
        <div style={{ padding: `14px ${px}px 0`, flexShrink: 0 }}>{chips}</div>
        <div style={{ flex: 1, overflow: 'auto', padding: `0 ${px}px 32px` }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr>
                {desktopCols.map(({ label, sortKey: key }) => (
                  <th key={label}
                    onClick={key ? () => toggleSort(key) : undefined}
                    style={{
                      textAlign: 'left', padding: '8px 12px 8px 0',
                      fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase',
                      color: key && sortKey === key ? T.ink2 : T.ink3,
                      borderBottom: `1px solid ${T.hairline}`, fontWeight: 400,
                      cursor: key ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                  >
                    {label}{key && sortArrow(key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {list.map(c => {
                const past = c.days_until < 0;
                return (
                  <tr
                    key={c.id}
                    onClick={() => onOpen(c.id)}
                    style={{
                      cursor: 'pointer',
                      borderBottom: `1px solid ${T.hairline}`,
                      borderLeft: urgency(c.days_until, c.status) === 'critical'
                        ? `3px solid ${T.accent}`
                        : urgency(c.days_until, c.status) === 'warning'
                        ? `3px solid ${T.gold}`
                        : '3px solid transparent',
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.paper2; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
                  >
                    {desktopCols.map((col, idx) => (
                      <td key={col.label} style={{ padding: idx === desktopCols.length - 1 ? '13px 0' : '13px 12px 13px 0' }}>
                        {col.render(c, past)}
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
          {list.length === 0 && (
            <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('clients.empty')}</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader eyebrow="Atelier" title={t('nav.clients')} subtitle={`${clients.length}`} right={<>{searchBox}{plusButton}</>} />
      <div style={{ padding: '10px 20px 0', flexShrink: 0 }}>{chips}</div>
      <div style={{ flex: 1, overflow: 'auto', padding: '10px 16px 24px' }}>
        {list.map(c => {
          const past = c.days_until < 0;
          return (
            <div
              key={c.id}
              onClick={() => onOpen(c.id)}
              style={{
                background: T.vellum,
                border: `1px solid ${T.hairline}`,
                borderLeft: urgency(c.days_until, c.status) === 'critical'
                  ? `3px solid ${T.accent}`
                  : urgency(c.days_until, c.status) === 'warning'
                  ? `3px solid ${T.gold}`
                  : `1px solid ${T.hairline}`,
                borderRadius: 4,
                padding: '14px',
                marginBottom: 8,
                cursor: 'pointer',
              }}
            >
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 10 }}>
                <div style={{ width: 40, height: 40, borderRadius: '50%', background: T.paper3, border: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 16, fontStyle: 'italic', color: T.ink2 }}>{initials(c.name)}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 500, color: T.ink }}>{c.name}</div>
                  {itemListField && <Mono size={10} color={T.ink3}>{fieldVal(c, itemListField) || '—'}</Mono>}
                </div>
                {featureOn('keyDate') && (
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <Mono size={11}>{c.wedding_date}</Mono>
                    <div style={{ marginTop: 2 }}>
                      <Mono size={9} color={past ? T.accent : T.ink3}>{past ? `−${Math.abs(c.days_until)}d` : `d−${c.days_until}`}</Mono>
                    </div>
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <Badge status={c.status} size="sm" />
                {featureOn('fabrics') && c.fabrics.length > 0 && <Mono size={9} color={T.ink3}>{c.fabrics.length} {t('clients.fabricsCount')}</Mono>}
              </div>
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
