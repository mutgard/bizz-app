import type { Client } from '../types';
import { T } from '../tokens';
import { Label, Mono, Serif } from '../components/primitives';
import { useIsMobile } from '../hooks/useIsMobile';
import { parsePayments } from '../lib/clientHelpers';
import { initials } from '../lib/clientHelpers';
import { t, formatCurrency, featureOn } from '../config';

interface Props {
  clients: Client[];
  onOpen: (id: number) => void;
}

interface ClientFinance {
  client: Client;
  priceTotal: number;
  paid: number;
  outstanding: number;
  pct: number;
}

function buildFinances(clients: Client[]): ClientFinance[] {
  return clients
    .map(client => {
      const { priceTotal, paid } = parsePayments(client.payments);
      const total = priceTotal ?? 0;
      const outstanding = Math.max(0, total - paid);
      const pct = total > 0 ? Math.min(100, Math.round((paid / total) * 100)) : 0;
      return { client, priceTotal: total, paid, outstanding, pct };
    })
    .filter(f => f.priceTotal > 0)
    .sort((a, b) => b.outstanding - a.outstanding);
}

export function FinancesScreen({ clients, onOpen }: Props) {
  const mobile = useIsMobile();
  const px = mobile ? 20 : 40;
  const finances = buildFinances(clients);

  const totalOutstanding = finances.reduce((s, f) => s + f.outstanding, 0);
  const totalPaid = finances.reduce((s, f) => s + f.paid, 0);
  const grandTotal = finances.reduce((s, f) => s + f.priceTotal, 0);
  const overallPct = grandTotal > 0 ? Math.min(100, Math.round((totalPaid / grandTotal) * 100)) : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* Header */}
      <div style={{ padding: `${mobile ? 20 : 28}px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0 }}>
        <Mono size={9} color={T.ink3} style={{ letterSpacing: 1.2, textTransform: 'uppercase', display: 'block', marginBottom: 4 }}>{t('finances.eyebrow')}</Mono>
        <Serif size={mobile ? 32 : 40} italic>{t('common.payments')}</Serif>
        <Mono size={10} color={T.ink3} style={{ display: 'block', marginTop: 4 }}>{finances.length} {t('finances.activeOrders')}</Mono>
      </div>

      {/* Summary card */}
      <div style={{ padding: `16px ${px}px`, borderBottom: `1px solid ${T.hairline}`, flexShrink: 0 }}>
        <div style={{ display: 'flex', gap: mobile ? 20 : 40, flexWrap: 'wrap' }}>
          <div>
            <Label style={{ marginBottom: 4 }}>{t('finances.totalInvoiced')}</Label>
            <Serif size={28} italic>{formatCurrency(grandTotal)}</Serif>
          </div>
          <div>
            <Label style={{ marginBottom: 4 }}>{t('common.paid')}</Label>
            <Serif size={28} italic style={{ color: T.accent }}>{formatCurrency(totalPaid)}</Serif>
          </div>
          <div>
            <Label style={{ marginBottom: 4 }}>{t('common.pending')}</Label>
            <Serif size={28} italic style={{ color: totalOutstanding > 0 ? T.gold : T.ink3 }}>
              {formatCurrency(totalOutstanding)}
            </Serif>
          </div>
        </div>
        <div style={{ marginTop: 12, height: 5, background: T.hairline, borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${overallPct}%`, background: overallPct >= 100 ? T.accent : T.gold, borderRadius: 3, transition: 'width 0.3s' }} />
        </div>
        <Mono size={9} color={T.ink3} style={{ marginTop: 4, display: 'block' }}>{overallPct}% {t('finances.collected')}</Mono>
      </div>

      {/* Client list */}
      <div style={{ flex: 1, overflow: 'auto', padding: `0 ${px}px 40px` }}>
        {finances.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 20, fontStyle: 'italic', color: T.ink3 }}>
            {t('finances.empty')}
          </div>
        )}

        {!mobile && finances.length > 0 && (
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 16 }}>
            <thead>
              <tr>
                {[t('common.client'), ...(featureOn('keyDate') ? [t('event.keyDate')] : []), t('common.total'), t('common.paid'), t('common.pending'), t('finances.progress')].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '8px 12px 8px 0', fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.ink3, borderBottom: `1px solid ${T.hairline}`, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {finances.map(({ client: c, priceTotal, paid, outstanding, pct }) => (
                <tr key={c.id} onClick={() => onOpen(c.id)} style={{ cursor: 'pointer', borderBottom: `1px solid ${T.hairline}` }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.background = T.paper2; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <td style={{ padding: '13px 12px 13px 0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <div style={{ width: 32, height: 32, borderRadius: '50%', background: T.paper3, border: `1px solid ${T.hairline}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 13, fontStyle: 'italic', color: T.ink2, flexShrink: 0 }}>
                        {initials(c.name)}
                      </div>
                      <span style={{ fontFamily: T.sans, fontSize: 13, color: T.ink, fontWeight: 500 }}>{c.name}</span>
                    </div>
                  </td>
                  {featureOn('keyDate') && <td style={{ padding: '13px 12px 13px 0' }}><Mono size={11}>{c.wedding_date}</Mono></td>}
                  <td style={{ padding: '13px 12px 13px 0' }}><Mono size={11}>{formatCurrency(priceTotal)}</Mono></td>
                  <td style={{ padding: '13px 12px 13px 0' }}><Mono size={11} color={T.accent}>{formatCurrency(paid)}</Mono></td>
                  <td style={{ padding: '13px 12px 13px 0' }}>
                    <Mono size={11} color={outstanding > 0 ? T.gold : T.ink3}>
                      {outstanding > 0 ? formatCurrency(outstanding) : '✓'}
                    </Mono>
                  </td>
                  <td style={{ padding: '13px 0', width: 120 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 4, background: T.hairline, borderRadius: 2 }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? T.accent : T.gold, borderRadius: 2 }} />
                      </div>
                      <Mono size={9} color={T.ink3} style={{ width: 28, flexShrink: 0 }}>{pct}%</Mono>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {mobile && finances.map(({ client: c, priceTotal, paid, outstanding, pct }) => (
          <div key={c.id} onClick={() => onOpen(c.id)} style={{ background: T.vellum, border: `1px solid ${T.hairline}`, borderRadius: 4, padding: '14px', marginTop: 10, cursor: 'pointer' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 500, color: T.ink }}>{c.name}</div>
                {featureOn('keyDate') && <Mono size={10} color={T.ink3}>{c.wedding_date}</Mono>}
              </div>
              <div style={{ textAlign: 'right' }}>
                <Mono size={10} color={outstanding > 0 ? T.gold : T.ink3} style={{ display: 'block' }}>
                  {outstanding > 0 ? `${t('common.pending')} ${formatCurrency(outstanding)}` : t('finances.paidStatus')}
                </Mono>
                <Mono size={9} color={T.ink3}>{t('common.total')} {formatCurrency(priceTotal)}</Mono>
              </div>
            </div>
            <div style={{ height: 4, background: T.hairline, borderRadius: 2 }}>
              <div style={{ height: '100%', width: `${pct}%`, background: pct >= 100 ? T.accent : T.gold, borderRadius: 2 }} />
            </div>
            <Mono size={9} color={T.ink3} style={{ marginTop: 4, display: 'block' }}>{pct}% {t('finances.collected')} · {formatCurrency(paid)} {t('finances.of')} {formatCurrency(priceTotal)}</Mono>
          </div>
        ))}
      </div>
    </div>
  );
}
