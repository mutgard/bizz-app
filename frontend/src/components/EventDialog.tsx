import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { T } from '../tokens';
import { api } from '../api';
import { Segment } from './primitives';
import type { AtelierEvent, EventType, Client } from '../types';
import { t, featureOn } from '../config';

interface Props {
  event?: AtelierEvent;         // undefined → create mode
  defaultDate?: string;         // ISO pre-fill
  defaultTime?: string;         // "HH:MM" pre-fill (e.g. from an hour-grid slot click)
  defaultClientId?: number;     // locked when provided
  clients: Client[];
  onSuccess: () => void;
  onClose: () => void;
}

const DURATION_OPTIONS = [30, 45, 60, 90];

export function EventDialog({
  event, defaultDate, defaultTime, defaultClientId, clients, onSuccess, onClose,
}: Props) {
  const isEdit = Boolean(event);
  const [type, setType] = useState<EventType>(event?.type ?? 'appointment');
  const [date, setDate] = useState(event?.date ?? defaultDate ?? '');
  const [title, setTitle] = useState(event?.title ?? '');
  const [clientId, setClientId] = useState<number | ''>(
    event?.client_id ?? defaultClientId ?? ''
  );
  const [orderId, setOrderId] = useState<string>(event?.order_id ?? '');
  const [supplier, setSupplier] = useState<string>(event?.supplier ?? '');
  const [time, setTime] = useState<string>(event?.time ?? defaultTime ?? '');
  const [durationMin, setDurationMin] = useState<number>(event?.duration_min ?? 60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const clientLocked =
    defaultClientId !== undefined ||
    (isEdit && event?.client_id !== null && event?.client_id !== undefined);

  const validate = (): string => {
    if (!date) return t('event.dateRequired');
    if (type !== 'wedding' && !title.trim()) return t('event.titleRequired');
    if (type === 'delivery' && !supplier.trim()) return t('event.supplierRequired');
    if (type === 'wedding' && clientId === '') return t('event.clientRequired');
    return '';
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    try {
      const cid = clientId !== '' ? (clientId as number) : null;
      if (isEdit && event) {
        if (type === 'appointment') {
          await api.updateAppointment(event.id, {
            title, date, order_id: orderId || null,
            time: time || null, duration_min: durationMin,
          });
        } else if (type === 'delivery') {
          await api.updateDelivery(event.id, {
            description: title, expected_date: date, supplier,
          });
        } else if (type === 'wedding' && cid !== null) {
          const display = new Date(date + 'T00:00:00').toLocaleDateString(
            'ca-ES', { day: 'numeric', month: 'short', year: 'numeric' }
          );
          await api.patchClient(cid, { wedding_date_iso: date, wedding_date: display });
        }
      } else {
        if (type === 'appointment') {
          await api.createAppointment({
            title, date, client_id: cid, order_id: orderId || null,
            time: time || null, duration_min: durationMin,
          });
        } else if (type === 'delivery') {
          await api.createDelivery({
            supplier, description: title, expected_date: date, client_id: cid,
          });
        } else if (type === 'wedding' && cid !== null) {
          const display = new Date(date + 'T00:00:00').toLocaleDateString(
            'ca-ES', { day: 'numeric', month: 'short', year: 'numeric' }
          );
          await api.patchClient(cid, { wedding_date_iso: date, wedding_date: display });
        }
      }
      onSuccess();
    } catch {
      setError(t('event.saveError'));
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '8px 10px',
    border: `1px solid ${T.hairline2}`,
    background: T.sheet, fontFamily: T.sans, fontSize: 13, color: T.ink,
    borderRadius: 2, outline: 'none',
  };

  const labelStyle: React.CSSProperties = {
    fontFamily: T.mono, fontSize: 10, color: T.ink3,
    textTransform: 'uppercase', letterSpacing: 1.2,
    display: 'block', marginBottom: 5,
  };

  return (
    <Dialog open onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent style={{
        background: T.paper, border: `1px solid ${T.hairline2}`,
        borderRadius: 2, maxWidth: 420,
      }}>
        <DialogHeader>
          <DialogTitle style={{
            fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 'normal',
          }}>
            {isEdit ? t('event.editTitle') : t('event.newTitle')}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>

          {/* Type selector — hidden in edit mode */}
          {!isEdit && (
            <div>
              <span style={labelStyle}>{t('common.type')}</span>
              <Segment
                options={[
                  ['appointment', t('event.typeAppointment')],
                  ...(featureOn('deliveries') ? [['delivery', t('event.typeDelivery')] as [string, string]] : []),
                  ...(featureOn('keyDate') ? [['wedding', t('event.keyDate')] as [string, string]] : []),
                ]}
                value={type}
                onChange={(v) => {
                  setType(v as EventType);
                  setTitle(''); setOrderId(''); setSupplier('');
                }}
              />
            </div>
          )}

          {/* Date */}
          <div>
            <label style={labelStyle}>{t('common.date')}</label>
            <input
              type="date" value={date}
              onChange={(e) => setDate(e.target.value)}
              style={inputStyle}
            />
          </div>

          {/* Title / Description — hidden for wedding */}
          {type !== 'wedding' && (
            <div>
              <label style={labelStyle}>
                {type === 'delivery' ? t('event.description') : t('event.title')}
              </label>
              <input
                type="text" value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={type === 'delivery' ? t('event.deliveryPlaceholder') : t('event.titlePlaceholder')}
                style={inputStyle}
              />
            </div>
          )}

          {/* Client selector */}
          <div>
            <label style={labelStyle}>{t('common.client')}</label>
            {clientLocked ? (
              <div style={{ ...inputStyle, color: T.ink2 }}>
                {clients.find((c) => c.id === clientId)?.name ?? '—'}
              </div>
            ) : (
              <select
                value={clientId}
                onChange={(e) =>
                  setClientId(e.target.value !== '' ? Number(e.target.value) : '')
                }
                style={{ ...inputStyle, cursor: 'pointer' }}
              >
                <option value="">{t('event.noClient')}</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            )}
          </div>

          {/* Supplier — delivery only */}
          {type === 'delivery' && (
            <div>
              <label style={labelStyle}>{t('event.supplier')}</label>
              <input
                type="text" value={supplier}
                onChange={(e) => setSupplier(e.target.value)}
                placeholder={t('event.supplierPlaceholder')}
                style={inputStyle}
              />
            </div>
          )}

          {/* Time + duration — appointment only */}
          {type === 'appointment' && (
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t('event.time')}</label>
                <input
                  type="time" value={time}
                  onChange={(e) => setTime(e.target.value)}
                  style={inputStyle}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={labelStyle}>{t('event.duration')}</label>
                <select
                  value={durationMin}
                  onChange={(e) => setDurationMin(Number(e.target.value))}
                  style={{ ...inputStyle, cursor: 'pointer' }}
                >
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d} min</option>
                  ))}
                </select>
              </div>
            </div>
          )}

          {/* Order ID — appointment only */}
          {type === 'appointment' && (
            <div>
              <label style={labelStyle}>{t('event.order')}</label>
              <input
                type="text" value={orderId ?? ''}
                onChange={(e) => setOrderId(e.target.value)}
                placeholder={t('event.orderPlaceholder')}
                style={inputStyle}
              />
            </div>
          )}

          {error && (
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.accent }}>
              {error}
            </div>
          )}
        </div>

        <DialogFooter style={{ paddingTop: 16, gap: 8 }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px', border: `1px solid ${T.ink}`,
              background: 'transparent', color: T.ink,
              fontFamily: T.mono, fontSize: 11, letterSpacing: 0.8,
              textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2,
            }}
          >
            {t('common.cancel')}
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{
              padding: '8px 18px', background: T.ink, color: T.paper,
              fontFamily: T.mono, fontSize: 11, letterSpacing: 0.8,
              textTransform: 'uppercase', borderRadius: 2,
              cursor: saving ? 'not-allowed' : 'pointer',
              opacity: saving ? 0.6 : 1,
              border: 'none',
            }}
          >
            {saving ? t('event.saving') : isEdit ? t('common.save') : t('common.create')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
