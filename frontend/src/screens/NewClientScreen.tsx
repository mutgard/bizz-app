import { useState } from 'react';
import type { ClientStatus } from '../types';
import { api } from '../api';
import { T } from '../tokens';
import { Label, Mono } from '../components/primitives';
import { useIsMobile } from '../hooks/useIsMobile';
import { initials } from '../lib/clientHelpers';
import { t } from '../config';

interface Props {
  onCancel: () => void;
  onSuccess: (clientId: number) => void;
}

const STATUS_OPTIONS: { value: ClientStatus; label: string }[] = [
  { value: 'prospect',   label: 'Prospect' },
  { value: 'sense-paga', label: 'Sense paga' },
  { value: 'clienta',    label: 'Clienta' },
  { value: 'entregada',  label: 'Entregada' },
];

function computeDaysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

function formatWeddingDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

export function NewClientScreen({ onCancel, onSuccess }: Props) {
  const mobile = useIsMobile();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [weddingDateISO, setWeddingDateISO] = useState('');
  const [status, setStatus] = useState<ClientStatus>('prospect');
  const [garment, setGarment] = useState('');
  const [garmentStyle, setGarmentStyle] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [nameError, setNameError] = useState(false);
  const [dateError, setDateError] = useState(false);

  const px = mobile ? 20 : 40;
  const s = T.badge[status];

  const fieldInput = (hasError = false) => ({
    border: 'none',
    borderBottom: `1px solid ${hasError ? T.accent : T.hairline2}`,
    background: 'transparent',
    outline: 'none',
    width: '100%',
    padding: '4px 0',
    color: T.ink,
  });

  const handleSubmit = async () => {
    const nErr = !name.trim();
    const dErr = !weddingDateISO;
    setNameError(nErr);
    setDateError(dErr);
    if (nErr || dErr) return;

    setSubmitting(true);
    setError('');
    try {
      const newClient = await api.createClient({
        name: name.trim(),
        phone,
        email,
        wedding_date: formatWeddingDate(weddingDateISO),
        wedding_date_iso: weddingDateISO,
        days_until: computeDaysUntil(weddingDateISO),
        status,
        garment,
        garment_style: garmentStyle,
        notes,
      });
      onSuccess(newClient.id);
    } catch {
      setError(t('newClient.createError'));
      setSubmitting(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0, overflow: 'hidden', background: T.paper }}>

      {/* Nav bar */}
      <div style={{ padding: `10px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onCancel} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink2, padding: 0 }}>
          ← {t('common.cancel')}
        </button>
        <Label style={{ color: T.ink3 }}>{t('newClient.title')}</Label>
      </div>

      {/* Scrollable body */}
      <div style={{ flex: 1, overflow: 'auto', padding: `${mobile ? 20 : 28}px ${px}px 40px` }}>

        {/* Hero: avatar + name + status + contact */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 28 }}>
          <div style={{
            width: mobile ? 52 : 68, height: mobile ? 52 : 68, borderRadius: '50%',
            background: T.paper3, border: `1px solid ${T.hairline}`, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: T.serif, fontStyle: 'italic', fontSize: mobile ? 20 : 26, color: T.ink2,
          }}>
            {name.trim() ? initials(name.trim()) : '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <input
              value={name}
              onChange={e => { setName(e.target.value); if (e.target.value.trim()) setNameError(false); }}
              placeholder={t('newClient.namePlaceholder')}
              style={{ ...fieldInput(nameError), fontFamily: T.serif, fontSize: mobile ? 28 : 36, fontStyle: 'italic', letterSpacing: -0.5 }}
            />
            {nameError && <Mono size={9} color={T.accent} style={{ marginTop: 4, display: 'block' }}>{t('newClient.nameRequired')}</Mono>}

            <div style={{ marginTop: 12 }}>
              <select
                value={status}
                onChange={e => setStatus(e.target.value as ClientStatus)}
                style={{
                  appearance: 'none', WebkitAppearance: 'none',
                  border: `1px ${s.dash ? 'dashed' : 'solid'} ${s.bd}`,
                  background: s.bg, color: s.fg,
                  fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8,
                  textTransform: 'uppercase', padding: '3px 24px 3px 10px',
                  borderRadius: 999, cursor: 'pointer', outline: 'none',
                }}
              >
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value}>{o.label}</option>
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
        </div>

        {/* Boda */}
        <div style={{ marginBottom: 24 }}>
          <Label style={{ marginBottom: 10 }}>{t('event.keyDate')}</Label>
          <input
            type="date"
            value={weddingDateISO}
            onChange={e => { setWeddingDateISO(e.target.value); if (e.target.value) setDateError(false); }}
            style={{ ...fieldInput(dateError), fontFamily: T.mono, fontSize: 13, color: T.ink, padding: '6px 0' }}
          />
          {dateError && <Mono size={9} color={T.accent} style={{ marginTop: 4, display: 'block' }}>{t('newClient.dateRequired')}</Mono>}
        </div>

        {/* Peça */}
        <div style={{ marginBottom: 24 }}>
          <Label style={{ marginBottom: 10 }}>{t('common.garment')}</Label>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <Mono size={10} color={T.ink3}>{t('common.type')}</Mono>
              <input value={garment} onChange={e => setGarment(e.target.value)} placeholder="—"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink, textAlign: 'right', width: '60%' }} />
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <Mono size={10} color={T.ink3}>{t('common.style')}</Mono>
              <input value={garmentStyle} onChange={e => setGarmentStyle(e.target.value)} placeholder="—"
                style={{ border: 'none', background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 10, color: T.ink, textAlign: 'right', width: '60%' }} />
            </div>
          </div>
        </div>

        {/* Notes */}
        <div style={{ marginBottom: 32 }}>
          <Label style={{ marginBottom: 10 }}>{t('common.notes')}</Label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder={t('common.notesPlaceholder')}
            rows={4}
            style={{
              width: '100%', border: `1px solid ${T.hairline}`, background: 'transparent',
              outline: 'none', fontFamily: T.sans, fontSize: 13, color: T.ink,
              lineHeight: 1.65, padding: '8px', resize: 'vertical', boxSizing: 'border-box',
            }}
          />
        </div>

        {error && (
          <Mono size={11} color={T.accent} style={{ marginBottom: 16, display: 'block' }}>{error}</Mono>
        )}

        <button
          onClick={handleSubmit}
          disabled={submitting}
          style={{
            width: '100%', padding: '14px',
            background: submitting ? T.ink3 : T.ink,
            color: T.paper, border: 'none',
            fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8,
            textTransform: 'uppercase',
            cursor: submitting ? 'not-allowed' : 'pointer',
          }}
        >
          {submitting ? t('common.creating') : t('newClient.submit')}
        </button>
      </div>
    </div>
  );
}
