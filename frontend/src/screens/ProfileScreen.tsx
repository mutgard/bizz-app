import { useState, useEffect } from 'react';
import type { Client, AtelierEvent } from '../types';
import { api } from '../api';
import { T, fabricVariant } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { Label, Mono, Serif, Swatch, Checkbox } from '../components/primitives';
import { initials, parsePayments } from '../lib/clientHelpers';
import { IntakeTab } from '../components/IntakeTab';
import { EventList } from '../components/EventList';
import { isoToday } from '../lib/calendarHelpers';
import { t, featureOn, clientStatuses, statusByKey } from '../config';

interface Props {
  client: Client;
  onBack: () => void;
  onOpenFabrics: () => void;
  onRefresh: () => void;
  allClients: Client[];
}

export function ProfileScreen({ client: initial, onBack, onOpenFabrics, onRefresh, allClients }: Props) {
  const [c, setC] = useState<Client>(initial);
  const mobile = useIsMobile();
  const [tab, setTab] = useState<'fitxa' | 'ingres'>('fitxa');
  const [briefToken, setBriefToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [clientEvents, setClientEvents] = useState<AtelierEvent[]>([]);
  const [editing, setEditing] = useState(false);
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ label: '', value: '' });
  const [addingPayment, setAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ label: '', value: '' });
  const [saveError, setSaveError] = useState('');
  const [draft, setDraft] = useState({
    name: c.name,
    phone: c.phone,
    email: c.email,
    wedding_date: c.wedding_date,
    wedding_date_iso: c.wedding_date_iso ?? '',
    garment: c.garment,
    garment_style: c.garment_style,
    notes: c.notes,
    status: c.status,
  });

  const fetchClientEvents = () => {
    api.listEvents(isoToday(), '9999-12-31', c.id).then(setClientEvents);
  };

  useEffect(() => {
    if (!c) return;
    api.getIntake(c.id)
      .then(data => setBriefToken(data?.token ?? null))
      .catch(() => setBriefToken(null));
  }, [c?.id]);

  useEffect(() => { fetchClientEvents(); }, [c.id]);

  if (!c) return null;

  const past = c.days_until < 0;
  const { priceTotal, paid } = parsePayments(c.payments);
  const pct = priceTotal && priceTotal > 0 ? Math.min(100, Math.round((paid / priceTotal) * 100)) : 0;
  const px = mobile ? 20 : 40;

  const handleCopyLink = async () => {
    if (!briefToken) return;
    try {
      await navigator.clipboard.writeText(`${window.location.origin}/brief/${briefToken}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard not available — silently fail
    }
  };

  const handleToggle = async (fabricId: number, current: boolean) => {
    await api.patchFabric(fabricId, { to_buy: !current });
    const updated = await api.getClient(c.id);
    setC(updated);
    onRefresh();
  };

  const fieldInput = {
    border: 'none',
    borderBottom: `1px solid ${T.hairline2}`,
    background: 'transparent',
    outline: 'none',
    padding: '4px 0',
    color: T.ink,
  };

  const startEdit = () => {
    setDraft({
      name: c.name,
      phone: c.phone,
      email: c.email,
      wedding_date: c.wedding_date,
      wedding_date_iso: c.wedding_date_iso ?? '',
      garment: c.garment,
      garment_style: c.garment_style,
      notes: c.notes,
      status: c.status,
    });
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

  const PIPELINE = clientStatuses().map(s => ({ value: s.key, label: s.shortLabel ?? s.label }));
  const currentIdx = PIPELINE.findIndex(s => s.value === c.status);
  const nextStage = currentIdx < PIPELINE.length - 1 ? PIPELINE[currentIdx + 1] : null;

  const advanceStatus = async () => {
    if (!nextStage) return;
    await api.patchClient(c.id, { status: nextStage.value });
    const updated = await api.getClient(c.id);
    setC(updated);
    onRefresh();
  };

  const startEditPayment = (p: { id: number; label: string; value: string }) => {
    setEditingPaymentId(p.id);
    setPaymentDraft({ label: p.label, value: p.value });
  };

  const savePayment = async (id: number) => {
    await api.updatePayment(id, paymentDraft);
    const updated = await api.getClient(c.id);
    setC(updated);
    setEditingPaymentId(null);
  };

  const deletePayment = async (id: number) => {
    await api.deletePayment(id);
    const updated = await api.getClient(c.id);
    setC(updated);
  };

  const addPayment = async () => {
    if (!newPayment.label.trim() || !newPayment.value.trim()) return;
    await api.createPayment({ client_id: c.id, label: newPayment.label, value: newPayment.value });
    const updated = await api.getClient(c.id);
    setC(updated);
    setAddingPayment(false);
    setNewPayment({ label: '', value: '' });
  };

  const saveEdit = async () => {
    setSaveError('');
    try {
      const days = draft.wedding_date_iso
        ? Math.round((new Date(draft.wedding_date_iso).getTime() - Date.now()) / 86400000)
        : c.days_until;
      const wedding_date = draft.wedding_date_iso
        ? (() => { const [y, m, d] = draft.wedding_date_iso.split('-'); return `${d}.${m}.${y}`; })()
        : c.wedding_date;
      await api.patchClient(c.id, {
        name: draft.name,
        phone: draft.phone,
        email: draft.email,
        wedding_date,
        wedding_date_iso: draft.wedding_date_iso || undefined,
        days_until: days,
        garment: draft.garment,
        garment_style: draft.garment_style,
        notes: draft.notes,
        status: draft.status,
      });
      const updated = await api.getClient(c.id);
      setC(updated);
      onRefresh();
      setEditing(false);
    } catch {
      setSaveError(t('profile.saveError'));
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Back bar */}
      <div style={{ padding: `10px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink2, padding: 0, display: 'flex', alignItems: 'center', gap: 6 }}>
          ← {t('nav.clients')}
        </button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          {!editing && featureOn('brief') && briefToken && (
            <button
              onClick={handleCopyLink}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                textTransform: 'uppercase', padding: 0,
                color: copied ? T.accent : T.ink3,
              }}
            >
              {copied ? t('profile.copied') : t('profile.copyLink')}
            </button>
          )}
          {!editing && (
            <button
              onClick={startEdit}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                textTransform: 'uppercase', padding: 0, color: T.ink3,
              }}
            >
              {t('common.edit')}
            </button>
          )}
          {editing && (
            <>
              <button
                onClick={cancelEdit}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                  textTransform: 'uppercase', padding: 0, color: T.ink3,
                }}
              >
                {t('common.cancel')}
              </button>
              <button
                onClick={saveEdit}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                  textTransform: 'uppercase', padding: 0, color: T.accent,
                }}
              >
                {t('common.save')}
              </button>
            </>
          )}
          <Label style={{ color: T.ink3 }}>{t('profile.stepLabel')}</Label>
        </div>
      </div>

      {/* Hero */}
      <div style={{ padding: `${mobile ? 20 : 28}px ${px}px ${mobile ? 18 : 22}px`, borderBottom: `1px solid ${T.hairline}`, background: T.paper, flexShrink: 0, display: 'flex', alignItems: 'flex-start', gap: 20 }}>
        <div style={{ width: mobile ? 52 : 68, height: mobile ? 52 : 68, borderRadius: '50%', background: T.paper3, border: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontStyle: 'italic', fontSize: mobile ? 20 : 26, color: T.ink2 }}>{initials(c.name)}</div>
        <div style={{ flex: 1 }}>
          {editing ? (
            <input
              value={draft.name}
              onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
              style={{ ...fieldInput, fontFamily: T.serif, fontSize: mobile ? 28 : 36, fontStyle: 'italic', letterSpacing: -0.5, width: '100%' }}
            />
          ) : (
            <Serif size={mobile ? 32 : 40} italic>{c.name}</Serif>
          )}
          {editing ? (
            <div style={{ marginTop: 6, display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
              <select
                value={draft.status}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as import('../types').ClientStatus }))}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  border: `1px solid ${T.hairline2}`,
                  background: 'transparent', color: T.ink,
                  fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                  textTransform: 'uppercase', padding: '3px 10px',
                  borderRadius: 999, cursor: 'pointer', outline: 'none',
                }}
              >
                {clientStatuses().map(s => (
                  <option key={s.key} value={s.key}>{s.key}</option>
                ))}
              </select>
            </div>
          ) : (
            <div style={{ marginTop: 10 }}>
              {/* Pipeline strip */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 0, flexWrap: 'wrap', rowGap: 4 }}>
                {PIPELINE.map((stage, i) => {
                  const isCurrent = i === currentIdx;
                  const isPast = i < currentIdx;
                  const isLast = i === PIPELINE.length - 1;
                  return (
                    <div key={stage.value} style={{ display: 'flex', alignItems: 'center' }}>
                      <div style={{
                        padding: '3px 10px',
                        border: `1px ${isCurrent ? 'solid' : isPast ? 'solid' : 'dashed'} ${isCurrent ? T.accent : isPast ? T.hairline2 : T.hairline}`,
                        background: isCurrent ? T.accent : 'transparent',
                        color: isCurrent ? T.paper : T.ink3,
                        fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase',
                        whiteSpace: 'nowrap',
                        opacity: isPast ? 0.5 : 1,
                      }}>
                        {isPast ? '✓ ' : ''}{stage.label}
                      </div>
                      {!isLast && (
                        <div style={{ width: 12, height: 1, background: T.hairline, flexShrink: 0 }} />
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Next-stage action button */}
              {nextStage && (
                <button
                  onClick={advanceStatus}
                  style={{
                    marginTop: 10,
                    padding: '6px 14px',
                    background: 'transparent',
                    border: `1px solid ${T.ink}`,
                    color: T.ink,
                    fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8,
                    textTransform: 'uppercase', cursor: 'pointer',
                    display: 'inline-flex', alignItems: 'center', gap: 6,
                  }}
                >
                  {t('profile.advance')} → {nextStage.label}
                </button>
              )}

              {/* Subtitle: upcoming event */}
              {clientEvents.length > 0 && (
                <div style={{ marginTop: 6 }}>
                  <Mono size={10} color={T.ink3}>
                    {clientEvents[0].title} · {clientEvents[0].date}
                  </Mono>
                </div>
              )}
            </div>
          )}
          {editing ? (
            <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 6 }}>
              <input value={draft.phone} onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
                placeholder={t('common.phone')} style={{ ...fieldInput, fontFamily: T.mono, fontSize: 12, color: T.ink2 }} />
              <input value={draft.email} onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
                placeholder={t('common.email')} type="email" style={{ ...fieldInput, fontFamily: T.mono, fontSize: 12, color: T.ink2 }} />
            </div>
          ) : (
            (c.phone || c.email) ? (
              <div style={{ marginTop: 8, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                {c.phone && <Mono size={10} color={T.ink2}>{c.phone}</Mono>}
                {c.email && <Mono size={10} color={T.ink2}>{c.email}</Mono>}
              </div>
            ) : null
          )}
        </div>
      </div>

      {/* Tab strip — Ingrés tab only when the intake feature is on */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, background: T.paper }}>
        {(featureOn('intake') ? ['fitxa', 'ingres'] as const : ['fitxa'] as const).map((tabKey) => {
          const labels = { fitxa: t('nav.profile'), ingres: t('nav.intake') };
          const on = tab === tabKey;
          return (
            <div
              key={tabKey}
              onClick={() => setTab(tabKey)}
              style={{
                padding: '10px 20px',
                cursor: 'pointer',
                position: 'relative',
                fontFamily: T.serif,
                fontSize: 15,
                fontStyle: on ? 'italic' : 'normal',
                color: on ? T.ink : T.ink3,
              }}
            >
              {labels[tabKey]}
              {on && (
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2, background: T.accent }} />
              )}
            </div>
          );
        })}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'auto', padding: `${mobile ? 20 : 28}px ${px}px 40px`, display: tab === 'fitxa' ? 'block' : 'none' }}>

        {/* Countdown card — only when the key-date feature is on */}
        {editing && featureOn('keyDate') && (
          <div style={{ marginBottom: 16 }}>
            <Label style={{ marginBottom: 8 }}>{t('profile.weddingDate')}</Label>
            <input
              type="date"
              value={draft.wedding_date_iso}
              onChange={e => setDraft(d => ({ ...d, wedding_date_iso: e.target.value }))}
              style={{ ...fieldInput, fontFamily: T.mono, fontSize: 13, color: T.ink, padding: '6px 0', width: '100%' }}
            />
          </div>
        )}
        {!editing && featureOn('keyDate') && !statusByKey(c.status)?.terminal && (
          <div style={{ background: T.ink, color: T.paper, padding: '18px 22px', marginBottom: 24 }}>
            <Label style={{ color: 'rgba(246,241,232,0.55)', marginBottom: 8 }}>{t('profile.countdown')} · {t('event.keyDate')}</Label>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
                <Serif size={52} italic style={{ color: T.paper }}>{past ? `−${Math.abs(c.days_until)}` : c.days_until}</Serif>
                <Mono size={11} color="rgba(246,241,232,0.55)">{t('common.days')}</Mono>
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mono size={10} color="rgba(246,241,232,0.55)">{t('common.date')}</Mono>
                <div style={{ fontFamily: T.mono, fontSize: 13, color: T.gold, marginTop: 2 }}>{c.wedding_date}</div>
              </div>
            </div>
          </div>
        )}

        {/* Payment progress */}
        {(priceTotal !== null || c.payments.length === 0) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <Label>{t('common.payments')}</Label>
              <Mono size={10}>{paid > 0 ? `€${paid.toLocaleString()}` : '—'} / {priceTotal !== null && priceTotal > 0 ? `€${priceTotal.toLocaleString()}` : '—'}</Mono>
            </div>
            {priceTotal !== null && (
              <div style={{ height: 4, background: T.hairline, borderRadius: 2 }}>
                <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? T.accent : T.gold, borderRadius: 2 }} />
              </div>
            )}
            <div style={{ marginTop: 8 }}>
              {c.payments.map((p, i) => (
                <div key={p.id} style={{ borderBottom: i < c.payments.length - 1 ? `1px solid ${T.hairline}` : 'none' }}>
                  {editingPaymentId === p.id ? (
                    <div style={{ display: 'flex', gap: 8, padding: '6px 0', alignItems: 'center' }}>
                      <input
                        value={paymentDraft.label}
                        onChange={e => setPaymentDraft(d => ({ ...d, label: e.target.value }))}
                        style={{ flex: 1, border: 'none', borderBottom: `1px solid ${T.hairline2}`, background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink }}
                      />
                      <input
                        value={paymentDraft.value}
                        onChange={e => setPaymentDraft(d => ({ ...d, value: e.target.value }))}
                        style={{ flex: 1, border: 'none', borderBottom: `1px solid ${T.hairline2}`, background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink, textAlign: 'right' }}
                      />
                      <button onClick={() => savePayment(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.accent, padding: 0, letterSpacing: 0.6 }}>✓</button>
                      <button onClick={() => setEditingPaymentId(null)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.ink3, padding: 0, letterSpacing: 0.6 }}>✕</button>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' }}>
                      <Mono size={10} color={T.ink3}>{p.label}</Mono>
                      <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                        <Mono size={10} color={T.ink}>{p.value}</Mono>
                        <button onClick={() => startEditPayment(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.ink3, padding: 0, opacity: 0.6 }}>{t('common.edit')}</button>
                        <button onClick={() => deletePayment(p.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.accent, padding: 0, opacity: 0.7 }}>✕</button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* Add payment row */}
              {addingPayment ? (
                <div style={{ display: 'flex', gap: 8, padding: '8px 0', alignItems: 'center', borderTop: `1px solid ${T.hairline}`, marginTop: 4 }}>
                  <input
                    value={newPayment.label}
                    onChange={e => setNewPayment(d => ({ ...d, label: e.target.value }))}
                    placeholder={t('profile.paymentConcept')}
                    style={{ flex: 1, border: 'none', borderBottom: `1px solid ${T.hairline2}`, background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink, padding: '2px 0' }}
                  />
                  <input
                    value={newPayment.value}
                    onChange={e => setNewPayment(d => ({ ...d, value: e.target.value }))}
                    placeholder={t('profile.paymentExample')}
                    style={{ flex: 1, border: 'none', borderBottom: `1px solid ${T.hairline2}`, background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink, textAlign: 'right', padding: '2px 0' }}
                  />
                  <button onClick={addPayment} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.accent, padding: 0, letterSpacing: 0.6 }}>+ {t('common.add')}</button>
                  <button onClick={() => { setAddingPayment(false); setNewPayment({ label: '', value: '' }); }} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.ink3, padding: 0 }}>✕</button>
                </div>
              ) : (
                <button
                  onClick={() => setAddingPayment(true)}
                  style={{ marginTop: 8, background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink3, padding: 0, display: 'block' }}
                >
                  + {t('profile.payment')}
                </button>
              )}
            </div>
          </div>
        )}

        {/* Peça */}
        <div style={{ marginBottom: 24 }}>
          <Label style={{ marginBottom: 10 }}>{t('common.garment')}</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {([
              [t('common.type'), 'garment', c.garment],
              [t('common.style'), 'garment_style', c.garment_style],
            ] as [string, 'garment' | 'garment_style', string][]).map(([label, key, val]) => (
              <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.hairline}` }}>
                <Mono size={10} color={T.ink3}>{label}</Mono>
                {editing ? (
                  <input
                    value={draft[key]}
                    onChange={e => setDraft(d => ({ ...d, [key]: e.target.value }))}
                    placeholder="—"
                    style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink, textAlign: 'right', width: '60%' }}
                  />
                ) : (
                  val ? <Mono size={10} color={T.ink}>{val}</Mono> : null
                )}
              </div>
            ))}
            {!editing && c.measurements_date && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: `1px solid ${T.hairline}` }}>
                <Mono size={10} color={T.ink3}>{t('profile.measurementsDate')}</Mono>
                <Mono size={10} color={T.ink}>{c.measurements_date}</Mono>
              </div>
            )}
          </div>
        </div>

        {/* Teles */}
        {featureOn('fabrics') && c.fabrics.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
              <Label>{t('nav.fabrics')} ({c.fabrics.length})</Label>
              <button onClick={onOpenFabrics} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink3, padding: 0 }}>{t('profile.viewAll')} →</button>
            </div>
            {c.fabrics.map((f, i) => (
              <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: i < c.fabrics.length - 1 ? `1px dashed ${T.hairline}` : 'none' }}>
                <Checkbox checked={f.to_buy} onChange={() => handleToggle(f.id, f.to_buy)} />
                <Swatch size={32} variant={fabricVariant(f.name)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.ink }}>{f.name}</div>
                  <Mono size={9} color={T.ink3}>{f.use} · {f.qty} · {f.price}</Mono>
                </div>
                {f.to_buy && <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase', color: T.accent, border: `1px solid ${T.accent}`, padding: '2px 5px', flexShrink: 0 }}>{t('common.buy')}</span>}
              </div>
            ))}
          </div>
        )}

        {/* Esdeveniments */}
        <EventList
          events={clientEvents}
          clients={allClients}
          defaultClientId={c.id}
          onRefresh={fetchClientEvents}
        />

        {/* Notes */}
        {(editing || c.notes) && (
          <div style={{ marginBottom: 24 }}>
            <Label style={{ marginBottom: 8 }}>{t('common.notes')}</Label>
            {editing ? (
              <textarea
                value={draft.notes}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                placeholder={t('common.notesPlaceholder')}
                rows={4}
                style={{
                  width: '100%', border: `1px solid ${T.hairline}`, background: 'transparent',
                  outline: 'none', fontFamily: T.sans, fontSize: 13, color: T.ink,
                  lineHeight: 1.65, padding: '8px', resize: 'vertical', boxSizing: 'border-box' as const,
                }}
              />
            ) : (
              <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink2, lineHeight: 1.65 }}>{c.notes}</div>
            )}
          </div>
        )}
        {saveError && (
          <Mono size={11} color={T.accent} style={{ marginBottom: 16, display: 'block' }}>{saveError}</Mono>
        )}
      </div>
      {tab === 'ingres' && featureOn('intake') && (
        <div style={{ flex: 1, minHeight: 0, overflow: 'auto', display: 'flex', flexDirection: 'column' }}>
          <IntakeTab clientId={c.id} />
        </div>
      )}
    </div>
  );
}
