import React, { useState, useEffect } from 'react';
import type { Lead, LeadMatch, ClientCreate, LeadConvert } from '../types';
import { api } from '../api';
import { T } from '../tokens';
import { PageHeader } from '../components/PageHeader';
import { Label, Mono, Serif, Segment } from '../components/primitives';
import { DynamicFields } from '../components/DynamicFields';
import { useIsMobile } from '../hooks/useIsMobile';
import { computeDaysUntil, formatWeddingDate } from '../lib/clientHelpers';
import { formatEventDate } from '../lib/calendarHelpers';
import { t, featureOn, clientStatuses, clientFields, clientFieldsLabel, statusByKey } from '../config';
import type { PackField } from '../config';

interface Props {
  onClientCreated: (id: number) => void;
  onOpenClient: (id: number) => void;
}

type Mode = 'list' | 'new' | number;
type Filter = 'open' | 'converted' | 'dismissed';

const NEW_LEAD_CHANNELS: Lead['channel'][] = ['phone', 'walkin', 'whatsapp', 'email'];

/** Resolve an inbox channel label from the pack strings, falling back to the raw value. */
function channelLabel(channel: string): string {
  const key = `inbox.channel.${channel}`;
  const label = t(key);
  return label === key ? channel : label;
}

function waitingInfo(createdAt: string): { text: string; color: string } {
  const ms = Date.now() - new Date(createdAt).getTime();
  const hours = ms / 3600000;
  let dur: string;
  if (hours < 1) dur = `${Math.max(1, Math.round(ms / 60000))}m`;
  else if (hours < 24) dur = `${Math.round(hours)}h`;
  else dur = `${Math.round(hours / 24)}d`;
  const color = hours > 72 ? T.accent : hours > 24 ? T.gold : T.ink3;
  return { text: `${t('inbox.waiting')} ${dur}`, color };
}

const fieldInput = (hasError = false) => ({
  border: 'none',
  borderBottom: `1px solid ${hasError ? T.accent : T.hairline2}`,
  background: 'transparent',
  outline: 'none',
  width: '100%',
  padding: '4px 0',
  color: T.ink,
});

// ─── List ────────────────────────────────────────────────────────────────

function LeadCard({ lead, onOpen, onDismiss, onOpenClient }: {
  lead: Lead; onOpen: () => void; onDismiss: (e: React.MouseEvent) => void; onOpenClient: (id: number) => void;
}) {
  const clickable = lead.status === 'open';
  const waiting = lead.status === 'open' ? waitingInfo(lead.created_at) : null;
  return (
    <div
      onClick={clickable ? onOpen : undefined}
      style={{
        background: T.vellum, border: `1px solid ${T.hairline}`, borderRadius: 4,
        padding: '14px', marginBottom: 8, cursor: clickable ? 'pointer' : 'default',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', minWidth: 0 }}>
          <Mono size={9} color={T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.8, border: `1px solid ${T.hairline2}`, padding: '2px 7px', borderRadius: 999, flexShrink: 0 }}>
            {channelLabel(lead.channel)}
          </Mono>
          <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 500, color: T.ink }}>
            {lead.name || t('inbox.unknown')}
          </span>
        </div>
        {lead.status === 'open' && (
          <button onClick={onDismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: T.ink3, fontSize: 15, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>
            ×
          </button>
        )}
      </div>
      {(lead.phone || lead.email) && (
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: lead.notes ? 6 : 0 }}>
          {lead.phone && <Mono size={11} color={T.ink2}>{lead.phone}</Mono>}
          {lead.email && <Mono size={11} color={T.ink2}>{lead.email}</Mono>}
        </div>
      )}
      {lead.notes && (
        <div style={{ fontFamily: T.sans, fontSize: 12, color: T.ink2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {lead.notes}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10, minHeight: 14 }}>
        {waiting ? <Mono size={9} color={waiting.color}>{waiting.text}</Mono> : <span />}
        {lead.status === 'converted' && lead.converted_client_id != null && (
          <button
            onClick={e => { e.stopPropagation(); onOpenClient(lead.converted_client_id!); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.6, color: T.accent, padding: 0 }}
          >
            {t('inbox.toClient')}
          </button>
        )}
      </div>
    </div>
  );
}

function LeadList({ px, onNew, onOpen, onOpenClient }: {
  px: number; onNew: () => void; onOpen: (id: number) => void; onOpenClient: (id: number) => void;
}) {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [filter, setFilter] = useState<Filter>('open');

  const reload = () => api.listLeads('all').then(setLeads);
  useEffect(() => { reload(); }, []);

  const openCount = leads.filter(l => l.status === 'open').length;
  // open: oldest first (longest-waiting on top, SLA); others: newest first
  const filtered = leads
    .filter(l => l.status === filter)
    .sort((a, b) => filter === 'open'
      ? a.created_at.localeCompare(b.created_at)
      : b.created_at.localeCompare(a.created_at));

  const dismiss = (id: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLeads(prev => prev.map(l => (l.id === id ? { ...l, status: 'dismissed' } : l)));
    api.patchLead(id, { status: 'dismissed' }).then(reload).catch(reload);
  };

  const chips: { id: Filter; l: string }[] = [
    { id: 'open', l: t('inbox.filterOpen') },
    { id: 'converted', l: t('inbox.filterConverted') },
    { id: 'dismissed', l: t('inbox.filterDismissed') },
  ];

  const plusButton = (
    <button
      onClick={onNew}
      style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        width: 34, height: 34, flexShrink: 0,
        border: `1px solid ${T.hairline2}`, background: T.vellum,
        cursor: 'pointer', borderRadius: 2,
      }}
      title={t('inbox.newLead')}
    >
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke={T.ink2} strokeWidth="1.6" strokeLinecap="round">
        <path d="M7 1v12M1 7h12" />
      </svg>
    </button>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader eyebrow={t('inbox.eyebrow')} title={t('nav.intake')} subtitle={`${openCount}`} right={plusButton} />
      <div style={{ padding: `14px ${px}px 0`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: 6, overflowX: 'auto', scrollbarWidth: 'none' }}>
          {chips.map(c => {
            const on = filter === c.id;
            return (
              <button key={c.id} onClick={() => setFilter(c.id)} style={{
                padding: '4px 12px', flexShrink: 0,
                fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase',
                border: `1px solid ${on ? T.ink : T.hairline}`,
                background: on ? T.ink : 'transparent',
                color: on ? T.paper : T.ink3,
                borderRadius: 2, cursor: 'pointer',
              }}>{c.l}</button>
            );
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `16px ${px}px 32px` }}>
        {filtered.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onOpen={() => onOpen(lead.id)}
            onDismiss={e => dismiss(lead.id, e)}
            onOpenClient={onOpenClient}
          />
        ))}
        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('inbox.empty')}</div>
        )}
      </div>
    </div>
  );
}

// ─── New lead form ───────────────────────────────────────────────────────

function NewLeadForm({ px, mobile, onCancel, onSaved, onOpenClient }: {
  px: number; mobile: boolean; onCancel: () => void;
  onSaved: (leadId: number, convert: boolean) => void;
  onOpenClient: (id: number) => void;
}) {
  const [channel, setChannel] = useState<Lead['channel']>('phone');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [fields, setFields] = useState<Record<string, string>>({});
  const [matches, setMatches] = useState<LeadMatch[]>([]);
  const [submitting, setSubmitting] = useState<'save' | 'convert' | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!phone.trim() && !email.trim()) { setMatches([]); return; }
    const h = setTimeout(() => {
      api.matchLeads({ phone: phone.trim() || undefined, email: email.trim() || undefined })
        .then(setMatches)
        .catch(() => setMatches([]));
    }, 400);
    return () => clearTimeout(h);
  }, [phone, email]);

  const handleSave = async (convert: boolean) => {
    setSubmitting(convert ? 'convert' : 'save');
    setError('');
    try {
      const lead = await api.createLead({
        channel,
        name: name.trim() || undefined,
        phone: phone.trim() || undefined,
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        fields,
      });
      onSaved(lead.id, convert);
    } catch {
      setError(t('newClient.createError'));
      setSubmitting(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', background: T.paper }}>
      <div style={{ padding: `10px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink2, padding: 0 }}>
          ← {t('common.cancel')}
        </button>
        <Label style={{ color: T.ink3 }}>{t('inbox.newLead')}</Label>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `${mobile ? 20 : 28}px ${px}px 40px` }}>
        <div style={{ marginBottom: 24 }}>
          <Label style={{ marginBottom: 10 }}>{t('nav.intake')}</Label>
          <Segment
            options={NEW_LEAD_CHANNELS.map(c => [c, channelLabel(c)] as [string, string])}
            value={channel}
            onChange={v => setChannel(v as Lead['channel'])}
          />
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 12 }}>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('newClient.namePlaceholder')}
            style={{ ...fieldInput(), fontFamily: T.serif, fontSize: mobile ? 22 : 26, fontStyle: 'italic', letterSpacing: -0.5 }} />
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('common.phone')}
            style={{ ...fieldInput(), fontFamily: T.mono, fontSize: 12, color: T.ink2 }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('common.email')} type="email"
            style={{ ...fieldInput(), fontFamily: T.mono, fontSize: 12, color: T.ink2 }} />
        </div>

        {matches.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            {matches.map(m => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, padding: '10px 12px', background: T.paper2, borderLeft: `2px solid ${T.gold}`, marginBottom: 6, flexWrap: 'wrap' }}>
                <Mono size={11} color={T.ink2}>{t('inbox.matches')} {m.name}</Mono>
                <button onClick={() => onOpenClient(m.id)} style={{ background: 'none', border: `1px solid ${T.ink}`, color: T.ink, cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase', padding: '4px 10px', borderRadius: 2 }}>
                  {t('inbox.openProfile')}
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginBottom: 24 }}>
          <Label style={{ marginBottom: 10 }}>{t('common.notes')}</Label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('inbox.notesPlaceholder')}
            rows={4}
            style={{
              width: '100%', border: `1px solid ${T.hairline}`, background: 'transparent',
              outline: 'none', fontFamily: T.sans, fontSize: 13, color: T.ink,
              lineHeight: 1.65, padding: '8px', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        <DynamicFields
          fields={clientFields()}
          fieldsLabel={clientFieldsLabel()}
          editing={true}
          getValue={(f: PackField) => fields[f.key] ?? ''}
          setValue={(f: PackField, v: string) => setFields(prev => ({ ...prev, [f.key]: v }))}
        />

        {error && <Mono size={11} color={T.accent} style={{ marginBottom: 16, display: 'block' }}>{error}</Mono>}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={() => handleSave(false)}
            disabled={submitting !== null}
            style={{
              flex: 1, minWidth: 160, padding: '14px',
              background: 'transparent', border: `1px solid ${T.ink}`, color: T.ink,
              fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
              cursor: submitting !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting === 'save' ? t('common.creating') : t('inbox.saveToInbox')}
          </button>
          <button
            onClick={() => handleSave(true)}
            disabled={submitting !== null}
            style={{
              flex: 1, minWidth: 160, padding: '14px',
              background: submitting === 'convert' ? T.ink3 : T.ink, color: T.paper, border: 'none',
              fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
              cursor: submitting !== null ? 'not-allowed' : 'pointer',
            }}
          >
            {submitting === 'convert' ? t('common.creating') : t('inbox.saveAndConvert')}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Convert view ────────────────────────────────────────────────────────

function ConvertForm({ lead, px, mobile, onBack, onConverted, onDismissed }: {
  lead: Lead; px: number; mobile: boolean;
  onBack: () => void; onConverted: (clientId: number) => void; onDismissed: () => void;
}) {
  const keyDateField = clientFields().find(f => f.isKeyDate);
  const initColumn: Record<string, string> = {};
  const initCustom: Record<string, string> = {};
  for (const f of clientFields()) {
    const v = lead.fields?.[f.key];
    if (v === undefined) continue;
    if (f.storage === 'custom') initCustom[f.key] = v;
    else initColumn[f.key] = v;
  }

  const [name, setName] = useState(lead.name);
  const [phone, setPhone] = useState(lead.phone);
  const [email, setEmail] = useState(lead.email);
  const [status, setStatus] = useState(clientStatuses()[0]?.key ?? '');
  const [fieldVals, setFieldVals] = useState<Record<string, string>>(initColumn);
  const [customVals, setCustomVals] = useState<Record<string, string>>(initCustom);
  const [notes, setNotes] = useState(lead.notes);
  const [consultDate, setConsultDate] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [dismissing, setDismissing] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState(false);

  const s = statusByKey(status);

  const handleConvert = async () => {
    const nErr = !name.trim();
    setNameError(nErr);
    if (nErr) return;

    setSubmitting(true);
    setError('');
    try {
      const client: ClientCreate = {
        name: name.trim(),
        phone,
        email,
        status,
        notes,
        ...fieldVals,
        custom: customVals,
        ...(keyDateField && featureOn('keyDate') && fieldVals[keyDateField.key] ? {
          wedding_date_iso: fieldVals[keyDateField.key],
          wedding_date: formatWeddingDate(fieldVals[keyDateField.key]),
          days_until: computeDaysUntil(fieldVals[keyDateField.key]),
        } : {}),
      };
      const body: LeadConvert = { client };
      if (consultDate) {
        body.appointment = { title: t('inbox.consultationTitle'), date: consultDate };
      }
      const res = await api.convertLead(lead.id, body);
      onConverted(res.client.id);
    } catch {
      setError(t('profile.saveError'));
      setSubmitting(false);
    }
  };

  const handleDismiss = async () => {
    setDismissing(true);
    try {
      await api.patchLead(lead.id, { status: 'dismissed' });
      onDismissed();
    } catch {
      setDismissing(false);
    }
  };

  const sourcePane = (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
        <Mono size={9} color={T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.8, border: `1px solid ${T.hairline2}`, padding: '2px 7px', borderRadius: 999 }}>
          {channelLabel(lead.channel)}
        </Mono>
        <Mono size={10} color={T.ink3}>{formatEventDate(lead.created_at.slice(0, 10))}</Mono>
      </div>
      {lead.notes && (
        <div style={{
          padding: '9px 12px', background: T.paper2, color: T.ink,
          borderRadius: '12px 12px 12px 2px',
          fontFamily: T.sans, fontSize: 13, lineHeight: 1.5, marginBottom: 16,
        }}>
          {lead.notes}
        </div>
      )}
      {Object.keys(lead.fields ?? {}).length > 0 && (
        <div>
          {Object.entries(lead.fields).map(([k, v]) => (
            <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <Mono size={9} color={T.ink3}>{k}</Mono>
              <Mono size={9} color={T.ink}>{v}</Mono>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  const proposedPane = (
    <div>
      <div style={{ marginBottom: 20 }}>
        <input value={name} onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
          placeholder={t('newClient.namePlaceholder')}
          style={{ ...fieldInput(nameError), fontFamily: T.serif, fontSize: mobile ? 26 : 32, fontStyle: 'italic', letterSpacing: -0.5 }} />
        {nameError && <Mono size={9} color={T.accent} style={{ marginTop: 4, display: 'block' }}>{t('newClient.nameRequired')}</Mono>}

        <div style={{ marginTop: 12 }}>
          <select
            value={status}
            onChange={e => setStatus(e.target.value)}
            style={{
              appearance: 'none', WebkitAppearance: 'none',
              border: `1px ${s?.dash ? 'dashed' : 'solid'} ${s?.bd}`,
              background: s?.bg, color: s?.fg,
              fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
              textTransform: 'uppercase', padding: '3px 24px 3px 10px',
              borderRadius: 999, cursor: 'pointer', outline: 'none',
            }}
          >
            {clientStatuses().map(o => (
              <option key={o.key} value={o.key}>{o.shortLabel ?? o.label}</option>
            ))}
          </select>
        </div>

        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <input value={phone} onChange={e => setPhone(e.target.value)} placeholder={t('common.phone')}
            style={{ ...fieldInput(), fontFamily: T.mono, fontSize: 12, color: T.ink2 }} />
          <input value={email} onChange={e => setEmail(e.target.value)} placeholder={t('common.email')} type="email"
            style={{ ...fieldInput(), fontFamily: T.mono, fontSize: 12, color: T.ink2 }} />
        </div>
      </div>

      <DynamicFields
        fields={clientFields()}
        fieldsLabel={clientFieldsLabel()}
        editing={true}
        getValue={(f: PackField) => (f.storage === 'custom' ? customVals[f.key] : fieldVals[f.key]) ?? ''}
        setValue={(f: PackField, v: string) => {
          if (f.storage === 'custom') setCustomVals(prev => ({ ...prev, [f.key]: v }));
          else setFieldVals(prev => ({ ...prev, [f.key]: v }));
        }}
      />

      <div style={{ marginBottom: 24 }}>
        <Label style={{ marginBottom: 10 }}>{t('common.notes')}</Label>
        <textarea
          value={notes}
          onChange={e => setNotes(e.target.value)}
          rows={4}
          style={{
            width: '100%', border: `1px solid ${T.hairline}`, background: 'transparent',
            outline: 'none', fontFamily: T.sans, fontSize: 13, color: T.ink,
            lineHeight: 1.65, padding: '8px', resize: 'vertical', boxSizing: 'border-box',
          }}
        />
      </div>

      <div style={{ marginBottom: 24 }}>
        <Label style={{ marginBottom: 10 }}>{t('inbox.consultation')}</Label>
        <input
          type="date"
          value={consultDate}
          onChange={e => setConsultDate(e.target.value)}
          style={{ ...fieldInput(), fontFamily: T.mono, fontSize: 13, color: T.ink, padding: '6px 0' }}
        />
      </div>

      {error && <Mono size={11} color={T.accent} style={{ marginBottom: 16, display: 'block' }}>{error}</Mono>}

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
        <button
          onClick={handleDismiss}
          disabled={submitting || dismissing}
          style={{
            padding: '14px 18px', background: 'transparent', border: `1px solid ${T.hairline2}`, color: T.ink2,
            fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
            cursor: submitting || dismissing ? 'not-allowed' : 'pointer',
          }}
        >
          {dismissing ? t('common.creating') : t('inbox.dismiss')}
        </button>
        <button
          onClick={handleConvert}
          disabled={submitting || dismissing}
          style={{
            flex: 1, minWidth: 160, padding: '14px',
            background: submitting ? T.ink3 : T.ink, color: T.paper, border: 'none',
            fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
            cursor: submitting || dismissing ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? t('common.creating') : t('inbox.convert')}
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', background: T.paper }}>
      <div style={{ padding: `10px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink2, padding: 0 }}>
          ← {t('common.cancel')}
        </button>
        <Serif size={16} italic style={{ color: T.ink2 }}>{lead.name || t('inbox.unknown')}</Serif>
      </div>

      {mobile ? (
        <div style={{ flex: 1, overflow: 'auto', padding: `20px ${px}px 40px`, display: 'flex', flexDirection: 'column', gap: 28 }}>
          {sourcePane}
          {proposedPane}
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
          <div style={{ flex: '0 0 45%', overflow: 'auto', padding: '28px 32px 40px', borderRight: `1px solid ${T.hairline}` }}>
            {sourcePane}
          </div>
          <div style={{ flex: '0 0 55%', overflow: 'auto', padding: '28px 32px 40px' }}>
            {proposedPane}
          </div>
        </div>
      )}
    </div>
  );
}

function ConvertView({ leadId, cachedLead, px, mobile, onBack, onConverted, onDismissed }: {
  leadId: number; cachedLead: Lead | undefined; px: number; mobile: boolean;
  onBack: () => void; onConverted: (clientId: number) => void; onDismissed: () => void;
}) {
  const [lead, setLead] = useState<Lead | undefined>(cachedLead);

  useEffect(() => {
    if (cachedLead) { setLead(cachedLead); return; }
    api.listLeads('all').then(list => setLead(list.find(l => l.id === leadId)));
  }, [leadId, cachedLead]);

  if (!lead) {
    return <div style={{ padding: 40, fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>{t('common.loading')}</div>;
  }

  return <ConvertForm lead={lead} px={px} mobile={mobile} onBack={onBack} onConverted={onConverted} onDismissed={onDismissed} />;
}

// ─── Main screen ─────────────────────────────────────────────────────────

export function InboxScreen({ onClientCreated, onOpenClient }: Props) {
  const mobile = useIsMobile();
  const px = mobile ? 20 : 40;
  const [mode, setMode] = useState<Mode>('list');
  const [cachedLeads, setCachedLeads] = useState<Lead[]>([]);

  // Keep a light cache around so ConvertView can resolve a lead without a round-trip
  // when it's opened straight from the list (list itself owns its own live copy).
  useEffect(() => {
    if (mode === 'list') api.listLeads('all').then(setCachedLeads);
  }, [mode]);

  if (mode === 'new') {
    return (
      <NewLeadForm
        px={px}
        mobile={mobile}
        onCancel={() => setMode('list')}
        onSaved={(id, convert) => setMode(convert ? id : 'list')}
        onOpenClient={onOpenClient}
      />
    );
  }

  if (typeof mode === 'number') {
    return (
      <ConvertView
        leadId={mode}
        cachedLead={cachedLeads.find(l => l.id === mode)}
        px={px}
        mobile={mobile}
        onBack={() => setMode('list')}
        onConverted={clientId => { setMode('list'); onClientCreated(clientId); }}
        onDismissed={() => setMode('list')}
      />
    );
  }

  return (
    <LeadList
      px={px}
      onNew={() => setMode('new')}
      onOpen={id => setMode(id)}
      onOpenClient={onOpenClient}
    />
  );
}
