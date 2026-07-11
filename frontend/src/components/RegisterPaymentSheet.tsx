import { useState } from 'react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { T } from '../tokens';
import { api } from '../api';
import type { Client } from '../types';
import { parsePayments } from '../lib/clientHelpers';
import { t, getPack } from '../config';

interface Props {
  client: Client;
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
}

/**
 * Registers money received against a client's outstanding balance.
 *
 * `parsePayments` (clientHelpers.ts) sums every `€`-tagged payment row into
 * the client's total, and only rows whose value contains the pack's
 * `paidKeyword` count toward `paid` — so a still-pending row (e.g. "Saldo
 * €1.800 pendent") is exactly what makes up `outstanding`. Simply POSTing a
 * new paid row for that same amount would double count it (total AND paid
 * both grow by the same figure, leaving outstanding unchanged). So before
 * recording the new receipt we retire the pending row(s) that make up the
 * amount being collected — deleting the ones fully covered, shrinking the
 * one that's only partially covered — then create one payment (the actual
 * "money in" record) for the amount received.
 */
export function RegisterPaymentSheet({ client, open, onClose, onSaved }: Props) {
  const { priceTotal, paid } = parsePayments(client.payments);
  const outstanding = Math.max(0, (priceTotal ?? 0) - paid);
  const paidKeyword = getPack().locale.paidKeyword;

  const [label, setLabel] = useState(t('finances.paymentLabel'));
  const [amount, setAmount] = useState(outstanding > 0 ? String(Math.round(outstanding)) : '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async () => {
    const amt = Math.round(parseFloat(amount));
    if (!amt || amt <= 0) { setError(t('event.dateRequired')); return; }
    setSaving(true);
    setError('');
    try {
      let remaining = amt;
      for (const p of client.payments) {
        if (remaining <= 0) break;
        const m = p.value.match(/€([\d.,]+)/);
        if (!m) continue;
        if (p.value.toLowerCase().includes(paidKeyword)) continue; // already settled
        const lineAmount = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
        if (isNaN(lineAmount) || lineAmount <= 0) continue;
        if (lineAmount <= remaining + 0.01) {
          await api.deletePayment(p.id);
          remaining -= lineAmount;
        } else {
          const newAmount = Math.round(lineAmount - remaining);
          await api.updatePayment(p.id, { value: p.value.replace(m[0], `€${newAmount}`) });
          remaining = 0;
        }
      }
      await api.createPayment({
        client_id: client.id,
        label: label.trim() || t('finances.paymentLabel'),
        value: `€${amt} · ${paidKeyword}`,
      });
      onSaved();
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
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent style={{
        background: T.paper, border: `1px solid ${T.hairline2}`,
        borderRadius: 2, maxWidth: 380,
      }}>
        <DialogHeader>
          <DialogTitle style={{
            fontFamily: T.serif, fontSize: 22, color: T.ink, fontWeight: 'normal',
          }}>
            {t('finances.registerPayment')}
          </DialogTitle>
        </DialogHeader>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 8 }}>
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span style={labelStyle}>{client.name}</span>
            </div>
          </div>

          <div>
            <label style={labelStyle}>{t('common.amount')}</label>
            <input
              type="number" min="0" step="1" value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ ...inputStyle, fontFamily: T.mono, fontVariantNumeric: 'tabular-nums' }}
            />
          </div>

          <div>
            <label style={labelStyle}>{t('profile.paymentConcept')}</label>
            <input
              type="text" value={label}
              onChange={(e) => setLabel(e.target.value)}
              style={inputStyle}
            />
          </div>

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
            {saving ? t('event.saving') : t('common.save')}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
