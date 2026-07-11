import { useState } from 'react';
import type { Client } from '../types';
import { api } from '../api';
import { T, fabricVariant } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { PageHeader } from '../components/PageHeader';
import { Label, Mono, Serif, Swatch, Checkbox, Segment } from '../components/primitives';
import { parseQty } from '../lib/clientHelpers';
import { t } from '../config';

interface Props { clients: Client[]; onRefresh: () => void; }

export function FabricsScreen({ clients, onRefresh }: Props) {
  const [groupBy, setGroupBy] = useState<'client' | 'fabric'>('client');
  const mobile = useIsMobile();
  const px = mobile ? 16 : 40;

  const allFabrics = clients.flatMap(c => c.fabrics);
  const toBuy = allFabrics.filter(f => f.to_buy).length;
  const totalMetres = allFabrics.reduce((s, f) => s + parseQty(f.qty), 0);

  const handleToggle = async (fabricId: number, current: boolean) => {
    await api.patchFabric(fabricId, { to_buy: !current });
    onRefresh();
  };

  const agg: Record<string, { name: string; price: string; qty: number; clients: string[]; to_buy: boolean }> = {};
  clients.forEach(c => c.fabrics.forEach(f => {
    if (!agg[f.name]) agg[f.name] = { name: f.name, price: f.price, qty: 0, clients: [], to_buy: false };
    agg[f.name].qty += parseQty(f.qty);
    agg[f.name].clients.push(c.name.split(' ')[0]);
    agg[f.name].to_buy = agg[f.name].to_buy || f.to_buy;
  }));
  const aggList = Object.values(agg);

  const sorted = [...clients].filter(c => c.fabrics.length > 0).sort((a, b) => a.days_until - b.days_until);

  const statsRight = (
    <div style={{ display: 'flex', gap: 20, alignItems: 'flex-end' }}>
      {toBuy > 0 && (
        <div>
          <Serif size={24} style={{ color: T.accent }}>{toBuy}</Serif>
          <Label style={{ marginTop: 2 }}>{t('fabrics.toBuyLabel')}</Label>
        </div>
      )}
      <div>
        <Serif size={24}>{totalMetres.toFixed(1)} m</Serif>
        <Label style={{ marginTop: 2 }}>{t('fabrics.total')}</Label>
      </div>
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader eyebrow={t('fabrics.eyebrow')} title={t('nav.fabrics')} subtitle={`${allFabrics.length} ${t('fabrics.pieces')}`} right={statsRight} />
      <div style={{ padding: `12px ${px}px 0`, flexShrink: 0 }}>
        <Segment
          options={[['client', t('fabrics.byClient')], ['fabric', t('fabrics.byFabric')]]}
          value={groupBy}
          onChange={v => setGroupBy(v as 'client' | 'fabric')}
        />
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: `14px ${px}px 32px` }}>
        {groupBy === 'client'
          ? sorted.map(c => (
            <div key={c.id} style={{ marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottom: `2px solid ${T.ink}` }}>
                <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{c.name}</span>
                <Mono size={10} color={T.ink3}>{t('event.keyDate')} · {c.wedding_date}</Mono>
              </div>
              {c.fabrics.map((f) => (
                <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: `1px dashed ${T.hairline}` }}>
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
          ))
          : aggList.map((f) => (
            <div key={f.name} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <Swatch size={40} variant={fabricVariant(f.name)} />
              <div style={{ flex: 1 }}>
                <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink }}>{f.name}</div>
                <Mono size={9} color={T.ink3}>{f.qty.toFixed(1)} m {t('fabrics.total')} · {f.price}</Mono>
                <div style={{ marginTop: 2 }}><Mono size={9} color={T.ink3}>{f.clients.join(' · ')}</Mono></div>
              </div>
              {f.to_buy && <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: 0.5, textTransform: 'uppercase', color: T.accent, border: `1px solid ${T.accent}`, padding: '2px 5px', flexShrink: 0 }}>{t('common.buy')}</span>}
            </div>
          ))
        }
        {allFabrics.length === 0 && (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('fabrics.empty')}</div>
        )}
      </div>
    </div>
  );
}
