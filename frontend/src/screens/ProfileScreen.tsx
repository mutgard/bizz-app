import { useState, useEffect, useRef } from 'react';
import type { Client, AtelierEvent, Note } from '../types';
import { api } from '../api';
import { T, fabricVariant } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { Label, Mono, Serif, Swatch, Checkbox } from '../components/primitives';
import { StatusChip } from '../components/StatusChip';
import { ConfirmSheet } from '../components/ConfirmSheet';
import { useUndoable, UndoToast } from '../hooks/useUndoable';
import { parsePayments } from '../lib/clientHelpers';
import { buildFinances } from '../lib/finance';
import { buildActivity } from '../lib/activity';
import { IntakeTab } from '../components/IntakeTab';
import { DynamicFields } from '../components/DynamicFields';
import { EventDialog } from '../components/EventDialog';
import { RegisterPaymentSheet } from '../components/RegisterPaymentSheet';
import { isoToday, formatEventDate } from '../lib/calendarHelpers';
import { t, featureOn, clientStatuses, statusByKey, itemFields, clientFieldsLabel } from '../config';
import type { PackField } from '../config';

interface Props {
  client: Client;
  onBack: () => void;
  onOpenFabrics: () => void;
  onRefresh: () => void;
  allClients: Client[];
}

/** One tile in the pinned facts strip. */
function Fact({ label, value, valueColor, sub, subColor, bar }: {
  label: string; value: string; valueColor?: string; sub?: string; subColor?: string; bar?: number;
}) {
  return (
    <div style={{ padding: '14px 16px', minWidth: 0 }}>
      <Label style={{ marginBottom: 6 }}>{label}</Label>
      <div style={{
        fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: valueColor ?? T.ink,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>
        {value}
      </div>
      {bar !== undefined && (
        <div style={{ height: 4, background: T.paper2, borderRadius: 2, marginTop: 6 }}>
          <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, bar))}%`, background: T.gold, borderRadius: 2 }} />
        </div>
      )}
      {sub && (
        <Mono size={10} color={subColor ?? T.ink3} style={{ display: 'block', marginTop: 4 }}>{sub}</Mono>
      )}
    </div>
  );
}

/** Row label for a day-old-or-future ISO date/datetime in the activity feed;
 *  "Avui" (reusing the shared "today" string) when the entry is from today. */
function feedDateLabel(ts?: string): string {
  if (!ts) return '—';
  const day = ts.slice(0, 10);
  return day === isoToday() ? t('roadmap.today') : formatEventDate(day);
}

export function ProfileScreen({ client: initial, onBack, onOpenFabrics, onRefresh, allClients }: Props) {
  const [c, setC] = useState<Client>(initial);
  const mobile = useIsMobile();
  const px = mobile ? 20 : 40;

  const [briefToken, setBriefToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Full event history (for the activity feed) — a separate, wider fetch than
  // the "upcoming only" one the old single-tab screen used, since the feed
  // needs past events too (fittings done, deliveries received…).
  const [allEvents, setAllEvents] = useState<AtelierEvent[]>([]);
  const refreshEvents = () => { api.listEvents('1900-01-01', '2999-12-31', c.id).then(setAllEvents); };
  useEffect(() => { refreshEvents(); }, [c.id]);
  const futureEvents = allEvents.filter(e => e.date >= isoToday()).sort((a, b) => a.date.localeCompare(b.date));

  // Comms/interaction log (Task 8) — timestamped notes, distinct from the
  // client's single free-text `notes` field.
  const [notes, setNotes] = useState<Note[]>([]);
  const refreshNotes = () => { api.listNotes(c.id).then(setNotes); };
  useEffect(() => { refreshNotes(); }, [c.id]);
  const [noteText, setNoteText] = useState('');
  const [noteSaving, setNoteSaving] = useState(false);

  const handleSaveNote = async () => {
    const text = noteText.trim();
    if (!text) return;
    setNoteSaving(true);
    try {
      await api.createNote({ client_id: c.id, text });
      setNoteText('');
      await refreshNotes();
    } finally {
      setNoteSaving(false);
    }
  };

  // Quick actions
  const [showEventDialog, setShowEventDialog] = useState(false);
  const [showPaymentSheet, setShowPaymentSheet] = useState(false);

  // Editing bundle: name/phone/email/wedding date, pack-declared item fields,
  // and the free-text notes field. Status is intentionally NOT part of this —
  // it only ever changes through the confirmed "Avançar estat…" flow below.
  const [editing, setEditing] = useState(false);
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
    custom: { ...(c.custom ?? {}) } as Record<string, string>,
  });

  useEffect(() => {
    api.getIntake(c.id)
      .then(data => setBriefToken(data && data.source !== 'lead' ? data.token ?? null : null))
      .catch(() => setBriefToken(null));
  }, [c.id]);

  if (!c) return null;

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
      custom: { ...(c.custom ?? {}) } as Record<string, string>,
    });
    setSaveError('');
    setEditing(true);
  };

  const cancelEdit = () => setEditing(false);

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
        // NOTE: editable storage:"column" fields must be listed explicitly here
        // (and seeded into `draft` above). New verticals should declare extra
        // fields as storage:"custom" — those are sent generically via draft.custom.
        garment: draft.garment,
        garment_style: draft.garment_style,
        notes: draft.notes,
        custom: draft.custom,
      });
      const updated = await api.getClient(c.id);
      setC(updated);
      onRefresh();
      setEditing(false);
    } catch {
      setSaveError(t('profile.saveError'));
    }
  };

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

  const handleToggleFabric = async (fabricId: number, current: boolean) => {
    await api.patchFabric(fabricId, { to_buy: !current });
    const updated = await api.getClient(c.id);
    setC(updated);
    onRefresh();
  };

  // ── Payments editor (unchanged logic, moved from the old Fitxa tab) ──────
  const { priceTotal, paid } = parsePayments(c.payments);
  const pct = priceTotal && priceTotal > 0 ? Math.min(100, Math.round((paid / priceTotal) * 100)) : 0;
  const [editingPaymentId, setEditingPaymentId] = useState<number | null>(null);
  const [paymentDraft, setPaymentDraft] = useState({ label: '', value: '' });
  const [addingPayment, setAddingPayment] = useState(false);
  const [newPayment, setNewPayment] = useState({ label: '', value: '' });

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

  const [pendingDeletePayment, setPendingDeletePayment] = useState<{ id: number; label: string; value: string } | null>(null);

  const handleConfirmDeletePayment = async () => {
    if (!pendingDeletePayment) return;
    const id = pendingDeletePayment.id;
    setPendingDeletePayment(null);
    await deletePayment(id);
  };

  const addPayment = async () => {
    if (!newPayment.label.trim() || !newPayment.value.trim()) return;
    await api.createPayment({ client_id: c.id, label: newPayment.label, value: newPayment.value });
    const updated = await api.getClient(c.id);
    setC(updated);
    setAddingPayment(false);
    setNewPayment({ label: '', value: '' });
  };

  // ── Safe status advance ──────────────────────────────────────────────────
  const pipeline = clientStatuses();
  const currentIdx = pipeline.findIndex(s => s.key === c.status);
  const nextStage = currentIdx >= 0 && currentIdx < pipeline.length - 1 ? pipeline[currentIdx + 1] : null;
  const currentStatus = statusByKey(c.status);
  const canAdvance = !!nextStage && !currentStatus?.terminal;

  const [confirmAdvanceOpen, setConfirmAdvanceOpen] = useState(false);
  const advanceRef = useRef<{ from: string; to: string } | null>(null);

  const advanceUndoable = useUndoable(
    async () => {
      const move = advanceRef.current;
      if (!move) return;
      await api.patchClient(c.id, { status: move.to });
      const updated = await api.getClient(c.id);
      setC(updated);
      onRefresh();
    },
    async () => {
      const move = advanceRef.current;
      if (!move) return;
      await api.patchClient(c.id, { status: move.from });
      const updated = await api.getClient(c.id);
      setC(updated);
      onRefresh();
    },
  );

  const handleConfirmAdvance = () => {
    if (!nextStage) return;
    advanceRef.current = { from: c.status, to: nextStage.key };
    setConfirmAdvanceOpen(false);
    advanceUndoable.fire();
  };

  // ── Facts strip ───────────────────────────────────────────────────────────
  const finance = buildFinances([c])[0] ?? { priceTotal: 0, paid: 0, outstanding: 0, pct: 0 };
  const primaryField = itemFields()[0];
  const secondaryField = itemFields()[1];
  const fieldValue = (f: PackField | undefined): string => {
    if (!f) return '';
    const store = f.storage === 'custom' ? (c.custom ?? {}) : (c as unknown as Record<string, unknown>);
    return String(store[f.key] ?? '');
  };
  const past = c.days_until < 0;

  const facts: React.ReactNode[] = [];
  if (featureOn('keyDate') && !currentStatus?.terminal) {
    facts.push(
      <Fact
        key="keydate"
        label={t('event.keyDate')}
        value={past ? `−${Math.abs(c.days_until)} ${t('common.days')}` : `${c.days_until} ${t('common.days')}`}
        valueColor={T.accent}
        sub={c.wedding_date}
      />
    );
  }
  facts.push(
    <Fact
      key="pendent"
      label={t('common.pending')}
      value={finance.outstanding > 0 ? `€${finance.outstanding.toLocaleString()}` : '—'}
      valueColor={finance.outstanding > 0 ? T.accent : T.ink3}
      bar={finance.priceTotal > 0 ? finance.pct : undefined}
      sub={finance.priceTotal > 0 ? `${finance.pct}% ${t('finances.progress').toLowerCase()}` : undefined}
    />
  );
  facts.push(
    <Fact
      key="garment"
      label={primaryField?.label ?? clientFieldsLabel()}
      value={fieldValue(primaryField) || '—'}
      sub={secondaryField ? fieldValue(secondaryField) : undefined}
    />
  );
  facts.push(
    <Fact
      key="lastmeasurement"
      label={t('profile.measurementsDate')}
      value={c.measurements_date || '—'}
      sub={currentStatus?.terminal ? undefined : (futureEvents.length > 0 ? formatEventDate(futureEvents[0].date) : t('profile.nextUnscheduled'))}
      subColor={futureEvents.length > 0 ? T.ink3 : T.accent}
    />
  );

  const feed = buildActivity({ events: allEvents, payments: c.payments, notes });

  const waDigits = c.phone.replace(/\D/g, '');

  const actionBtn: React.CSSProperties = {
    background: 'none', border: `1px solid ${T.hairline2}`, cursor: 'pointer',
    fontFamily: T.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
    padding: '6px 12px', color: T.ink2, whiteSpace: 'nowrap',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Sticky header */}
      <div style={{
        padding: `12px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0,
        background: T.paper, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      }}>
        <button onClick={onBack} style={{
          background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 14,
          color: T.ink2, padding: 0, flexShrink: 0, lineHeight: 1,
        }}>
          ←
        </button>

        {editing ? (
          <input
            value={draft.name}
            onChange={e => setDraft(d => ({ ...d, name: e.target.value }))}
            style={{ ...fieldInput, fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', flex: '1 1 160px', minWidth: 120 }}
          />
        ) : (
          <Serif size={mobile ? 20 : 22} italic style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.name}
          </Serif>
        )}

        {!editing && <StatusChip statusKey={c.status} size="sm" />}

        {editing && (
          <div style={{ display: 'flex', gap: 8, flex: '1 1 260px', minWidth: 200 }}>
            <input
              value={draft.phone}
              onChange={e => setDraft(d => ({ ...d, phone: e.target.value }))}
              placeholder={t('common.phone')}
              style={{ ...fieldInput, fontFamily: T.mono, fontSize: 11, flex: 1 }}
            />
            <input
              value={draft.email}
              onChange={e => setDraft(d => ({ ...d, email: e.target.value }))}
              placeholder={t('common.email')}
              type="email"
              style={{ ...fieldInput, fontFamily: T.mono, fontSize: 11, flex: 1 }}
            />
          </div>
        )}

        {!editing && !mobile && (c.phone || c.email) && (
          <Mono size={11} color={T.ink3} style={{ whiteSpace: 'nowrap' }}>
            {[c.phone, c.email].filter(Boolean).join(' · ')}
          </Mono>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          {editing ? (
            <>
              <button onClick={cancelEdit} style={actionBtn}>{t('common.cancel')}</button>
              <button onClick={saveEdit} style={{ ...actionBtn, background: T.ink, color: T.paper, border: `1px solid ${T.ink}` }}>
                {t('common.save')}
              </button>
            </>
          ) : (
            <>
              {waDigits && (
                <a
                  href={`https://wa.me/${waDigits}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ ...actionBtn, textDecoration: 'none', display: 'inline-block' }}
                >
                  WhatsApp
                </a>
              )}
              <button onClick={() => setShowEventDialog(true)} style={actionBtn}>
                + {t('agenda.newAppointment')}
              </button>
              <button onClick={() => setShowPaymentSheet(true)} style={actionBtn}>
                + {t('profile.payment')}
              </button>
              {canAdvance && (
                <button
                  onClick={() => setConfirmAdvanceOpen(true)}
                  style={{ ...actionBtn, color: T.accent, border: `1px solid ${T.accent}` }}
                >
                  {t('status.advanceButton')}
                </button>
              )}
              <button onClick={startEdit} style={{ ...actionBtn, border: 'none', padding: '6px 4px', color: T.ink3 }}>
                {t('common.edit')}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pinned facts strip */}
      {!editing && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: mobile ? 'repeat(2, 1fr)' : `repeat(${facts.length}, 1fr)`,
          borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, background: T.paper,
        }}>
          {facts.map((f, i) => (
            <div key={i} style={{
              borderRight: (mobile ? i % 2 === 0 : i < facts.length - 1) ? `1px solid ${T.hairline}` : 'none',
              borderBottom: mobile && i < facts.length - 2 ? `1px solid ${T.hairline}` : 'none',
            }}>
              {f}
            </div>
          ))}
        </div>
      )}

      {saveError && (
        <Mono size={11} color={T.accent} style={{ padding: `8px ${px}px 0`, display: 'block', flexShrink: 0 }}>{saveError}</Mono>
      )}

      {/* Scrollable two-column body */}
      <div style={{
        flex: 1, minHeight: 0, overflow: 'auto',
        padding: `${mobile ? 20 : 28}px ${px}px 40px`,
        display: 'flex', flexDirection: mobile ? 'column' : 'row', gap: mobile ? 28 : 40,
      }}>
        {/* Left: activity feed + always-visible note input */}
        <div style={{ flex: mobile ? '1 1 auto' : '1 1 58%', minWidth: 0 }}>
          <Label style={{ marginBottom: 10 }}>{t('profile.activity')}</Label>
          <div style={{ marginBottom: 14 }}>
            {feed.length === 0 ? (
              <Mono size={12} color={T.ink3}>{t('profile.activityEmpty')}</Mono>
            ) : feed.map((entry, i) => (
              <div key={i} style={{
                display: 'flex', gap: 14, padding: '9px 0',
                borderBottom: i < feed.length - 1 ? `1px solid ${T.hairline}` : 'none',
              }}>
                <Mono size={9} color={T.ink3} style={{ width: 64, flexShrink: 0, textTransform: 'uppercase', letterSpacing: 0.6, paddingTop: 1 }}>
                  {feedDateLabel(entry.ts)}
                </Mono>
                <div style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, lineHeight: 1.5, minWidth: 0 }}>
                  {entry.title}
                  {entry.kind === 'payment' && entry.detail ? ` · ${entry.detail}` : ''}
                </div>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', borderTop: `1px solid ${T.hairline}`, paddingTop: 12 }}>
            <input
              value={noteText}
              onChange={e => setNoteText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') handleSaveNote(); }}
              placeholder={t('profile.notesInputPlaceholder')}
              style={{
                flex: 1, padding: '7px 9px', border: `1px dashed ${T.hairline2}`, background: 'transparent',
                fontFamily: T.sans, fontSize: 12.5, color: T.ink, borderRadius: 2, outline: 'none',
              }}
            />
            <button
              onClick={handleSaveNote}
              disabled={noteSaving || !noteText.trim()}
              style={{
                padding: '7px 16px', background: T.ink, color: T.paper,
                fontFamily: T.mono, fontSize: 11, letterSpacing: 0.6, textTransform: 'uppercase',
                border: 'none', cursor: noteSaving ? 'not-allowed' : 'pointer',
                opacity: !noteText.trim() ? 0.5 : 1,
              }}
            >
              {t('common.save')}
            </button>
          </div>
        </div>

        {/* Right: payments, fabrics, garment fields, intake */}
        <div style={{ flex: mobile ? '1 1 auto' : '1 1 42%', minWidth: 0, borderLeft: mobile ? 'none' : `1px solid ${T.hairline}`, paddingLeft: mobile ? 0 : 32 }}>

          {/* Payments editor */}
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
                          <button onClick={() => setPendingDeletePayment(p)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, color: T.accent, padding: 0, opacity: 0.7 }}>✕</button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

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

          {/* Fabrics summary */}
          {featureOn('fabrics') && c.fabrics.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                <Label>{t('nav.fabrics')} ({c.fabrics.length})</Label>
                <button onClick={onOpenFabrics} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink3, padding: 0 }}>{t('profile.viewAll')} →</button>
              </div>
              {c.fabrics.map((f, i) => (
                <div key={f.id} style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '10px 0', borderBottom: i < c.fabrics.length - 1 ? `1px dashed ${T.hairline}` : 'none' }}>
                  <Checkbox checked={f.to_buy} onChange={() => handleToggleFabric(f.id, f.to_buy)} />
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

          {/* Garment / pack-declared item fields */}
          {editing && featureOn('keyDate') && (
            <div style={{ marginBottom: 12 }}>
              <Label style={{ marginBottom: 8 }}>{t('profile.weddingDate')}</Label>
              <input
                type="date"
                value={draft.wedding_date_iso}
                onChange={e => setDraft(d => ({ ...d, wedding_date_iso: e.target.value }))}
                style={{ ...fieldInput, fontFamily: T.mono, fontSize: 13, color: T.ink, padding: '6px 0', width: '100%' }}
              />
            </div>
          )}
          <DynamicFields
            fields={itemFields()}
            fieldsLabel={clientFieldsLabel()}
            editing={editing}
            getValue={(f: PackField) => {
              const src = editing ? draft : (c as unknown as Record<string, unknown>);
              const store = editing ? draft.custom : (c.custom ?? {});
              return String((f.storage === 'custom' ? store[f.key] : (src as Record<string, unknown>)[f.key]) ?? '');
            }}
            setValue={(f: PackField, v: string) => {
              if (f.storage === 'custom') {
                setDraft(d => ({ ...d, custom: { ...d.custom, [f.key]: v } }));
              } else {
                setDraft(d => ({ ...d, [f.key]: v }));
              }
            }}
          />

          {/* Notes (client's single free-text field) */}
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

          {/* Intake — collapsed by default */}
          {featureOn('intake') && (
            <div style={{ marginTop: 8 }}>
              {featureOn('brief') && briefToken && (
                <div style={{ marginBottom: 8, textAlign: 'right' }}>
                  <button
                    onClick={handleCopyLink}
                    style={{
                      background: 'none', border: 'none', cursor: 'pointer',
                      fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8,
                      textTransform: 'uppercase', padding: 0,
                      color: copied ? T.accent : T.ink3,
                    }}
                  >
                    {copied ? t('profile.copied') : t('profile.copyLink')}
                  </button>
                </div>
              )}
              <details>
                <summary style={{
                  cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                  textTransform: 'uppercase', color: T.ink3, padding: '8px 0', borderTop: `1px solid ${T.hairline}`,
                }}>
                  {t('nav.intake')}
                </summary>
                <IntakeTab clientId={c.id} />
              </details>
            </div>
          )}
        </div>
      </div>

      {showEventDialog && (
        <EventDialog
          defaultClientId={c.id}
          defaultDate={isoToday()}
          clients={allClients}
          onSuccess={() => { setShowEventDialog(false); refreshEvents(); onRefresh(); }}
          onClose={() => setShowEventDialog(false)}
        />
      )}

      {showPaymentSheet && (
        <RegisterPaymentSheet
          client={c}
          open
          onClose={() => setShowPaymentSheet(false)}
          onSaved={async () => {
            setShowPaymentSheet(false);
            const updated = await api.getClient(c.id);
            setC(updated);
            onRefresh();
          }}
        />
      )}

      {nextStage && (
        <ConfirmSheet
          open={confirmAdvanceOpen}
          title={t('status.advanceConfirmTitle').replace('{status}', nextStage.label)}
          body={t('status.advanceConfirmBody')}
          confirmLabel={t('status.advanceConfirmAction')}
          onConfirm={handleConfirmAdvance}
          onCancel={() => setConfirmAdvanceOpen(false)}
        />
      )}

      {pendingDeletePayment && (
        <ConfirmSheet
          open={!!pendingDeletePayment}
          title={t('payments.deleteConfirmTitle')}
          body={t('payments.deleteConfirmBody').replace('{payment}', `${pendingDeletePayment.label} · ${pendingDeletePayment.value}`)}
          confirmLabel={t('payments.deleteConfirmAction')}
          onConfirm={handleConfirmDeletePayment}
          onCancel={() => setPendingDeletePayment(null)}
        />
      )}

      <UndoToast pending={advanceUndoable.pending} onUndo={advanceUndoable.undoNow} label={t('common.done')} />
    </div>
  );
}
