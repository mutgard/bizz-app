import type { Client } from '../types';
import { T, fabricVariant } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { PageHeader } from '../components/PageHeader';
import { Label, Mono, Serif, Swatch } from '../components/primitives';
import { parseQty, parsePrice } from '../lib/clientHelpers';
import { t } from '../config';

interface Props { clients: Client[]; }

type ShoppingItem = {
  fabricId: number; name: string; use: string; qty: string; price: string;
  supplier: string | null; clientName: string; daysUntil: number;
};

export function ShoppingScreen({ clients }: Props) {
  const mobile = useIsMobile();
  const px = mobile ? 16 : 40;

  const items: ShoppingItem[] = clients.flatMap(c =>
    c.fabrics.filter(f => f.to_buy).map(f => ({
      fabricId: f.id, name: f.name, use: f.use, qty: f.qty, price: f.price,
      supplier: f.supplier || null, clientName: c.name, daysUntil: c.days_until,
    }))
  );

  const totalMetres = items.reduce((s, f) => s + parseQty(f.qty), 0);
  const totalCost = items.reduce((s, f) => s + parsePrice(f.price) * parseQty(f.qty), 0);
  const suppliers = new Set(items.map(f => f.supplier || t('shopping.noSupplier'))).size;

  const bySup: Record<string, ShoppingItem[]> = {};
  items.forEach(f => (bySup[f.supplier || t('shopping.noSupplier')] ||= []).push(f));

  const stats = [
    { l: t('shopping.pieces'), v: String(items.length) },
    { l: t('shopping.metres'), v: `${totalMetres.toFixed(1)} m` },
    { l: t('shopping.costEst'), v: `€${Math.round(totalCost).toLocaleString()}` },
    { l: t('shopping.suppliers'), v: String(suppliers) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader eyebrow={t('shopping.eyebrow')} title={t('nav.shop')} subtitle={items.length > 0 ? `${items.length} ${t('shopping.piecesLower')}` : undefined} />

      {/* Stats strip */}
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.hairline}`, flexShrink: 0 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ flex: 1, padding: mobile ? '12px 14px' : '16px 24px', borderRight: i < stats.length - 1 ? `1px solid ${T.hairline}` : 'none' }}>
            <Label style={{ marginBottom: 6 }}>{s.l}</Label>
            <Serif size={mobile ? 22 : 28}>{s.v}</Serif>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: `16px ${px}px 32px` }}>
        {items.length === 0
          ? <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('shopping.empty')}</div>
          : Object.entries(bySup).map(([sup, fs]) => {
              const urgent = fs.some(f => f.daysUntil > 0 && f.daysUntil < 35);
              return (
                <div key={sup} style={{ marginBottom: 28 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottom: `2px solid ${urgent ? T.accent : T.ink}` }}>
                    <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: urgent ? T.accent : T.ink }}>{sup}</span>
                    <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                      {urgent && <span style={{ fontFamily: T.mono, fontSize: 8, letterSpacing: 0.8, textTransform: 'uppercase', color: T.accent, border: `1px solid ${T.accent}`, padding: '2px 6px' }}>{t('shopping.urgent')}</span>}
                      <Mono size={10} color={T.ink3}>{fs.length} {t('shopping.piece')}{fs.length > 1 ? 's' : ''}</Mono>
                    </div>
                  </div>
                  {fs.map((f, i) => (
                    <div key={i} style={{ display: 'flex', gap: 14, alignItems: 'center', padding: '12px 0', borderBottom: `1px dashed ${T.hairline}` }}>
                      <Swatch size={36} variant={fabricVariant(f.name)} />
                      <div style={{ flex: 1 }}>
                        <div style={{ fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink }}>{f.name}</div>
                        <Mono size={10} color={T.ink3}>{f.qty} · {f.price}</Mono>
                        <div style={{ marginTop: 2 }}>
                          <Mono size={9} color={T.ink3}>
                            {t('shopping.for')} {f.clientName.split(' ')[0]} · {f.daysUntil > 0 ? `${f.daysUntil}d` : `${t('shopping.ago')} ${Math.abs(f.daysUntil)}d`}
                          </Mono>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })
        }
      </div>
    </div>
  );
}
