import { T } from '../tokens';
import { Label, Mono } from './primitives';
import { t } from '../config';

type Screen = 'clients' | 'profile' | 'fabrics' | 'shop' | 'roadmap' | 'intake' | 'finances';

interface Props {
  active: Screen;
  onNav: (s: Screen) => void;
  fabricsToBuy: number;
  totalClients: number;
  totalFabrics: number;
}

export function Sidebar({ active, onNav, fabricsToBuy, totalClients, totalFabrics }: Props) {
  const items: { id: Screen; n: string; label: string; count: number | null; accent?: boolean; sub?: boolean }[] = [
    { id: 'clients', n: '01', label: t('nav.clients'), count: totalClients },
    { id: 'profile', n: '02', label: t('nav.profile'), count: null, sub: true },
    { id: 'fabrics', n: '03', label: t('nav.fabrics'), count: totalFabrics },
    { id: 'shop',    n: '04', label: t('nav.shop'),    count: fabricsToBuy, accent: true },
    { id: 'roadmap', n: '05', label: t('nav.roadmap'), count: null },
    { id: 'intake',  n: '06', label: t('nav.intake'),  count: null },
    { id: 'finances', n: '07', label: t('nav.finances'), count: null },
  ];

  return (
    <div style={{
      background: T.ink, color: T.paper,
      padding: '28px 20px', display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${T.hairline}`, height: '100%',
    }}>
      {/* logo */}
      <div style={{ marginBottom: 44, paddingLeft: 4 }}>
        <div style={{ fontFamily: T.serif, fontSize: 28, lineHeight: 1, color: T.paper }}>Juliette</div>
        <div style={{ fontFamily: T.serif, fontSize: 28, fontStyle: 'italic', lineHeight: 1, color: T.gold, marginTop: 2 }}>Atelier</div>
        <div style={{ height: 1, background: 'rgba(246,241,232,0.2)', margin: '14px 0 10px' }} />
        <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(246,241,232,0.55)', letterSpacing: 1.8, textTransform: 'uppercase' }}>
          Est. 2026 · Girona
        </div>
      </div>

      <Label style={{ color: 'rgba(246,241,232,0.45)', marginBottom: 10, paddingLeft: 4 }}>{t('nav.section')}</Label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(it => {
          const on = it.id === active || (active === 'profile' && it.id === 'clients');
          const dim = it.sub;
          return (
            <div key={it.id} onClick={() => !dim && onNav(it.id)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: on ? 'rgba(246,241,232,0.08)' : 'transparent',
              borderLeft: on ? `2px solid ${T.gold}` : '2px solid transparent',
              cursor: dim ? 'default' : 'pointer', opacity: dim ? 0.55 : 1,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: on ? T.gold : 'rgba(246,241,232,0.5)', width: 18 }}>{it.n}</span>
              <span style={{ flex: 1, fontFamily: T.serif, fontStyle: dim ? 'italic' : 'normal', fontSize: 18, color: T.paper }}>{it.label}</span>
              {it.count !== null && (
                <span style={{ fontFamily: T.mono, fontSize: 10, color: it.accent && it.count ? T.gold : 'rgba(246,241,232,0.5)' }}>
                  {String(it.count).padStart(2, '0')}
                </span>
              )}
            </div>
          );
        })}
      </div>

      <div style={{ flex: 1 }} />

      {/* footer */}
      <div style={{ borderTop: '1px solid rgba(246,241,232,0.14)', paddingTop: 16, marginTop: 20 }}>
        <Label style={{ color: 'rgba(246,241,232,0.45)', marginBottom: 8 }}>{t('common.thisWeek')}</Label>
        <div style={{ display: 'flex', gap: 16 }}>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 24, color: T.paper }}>3</div>
            <Mono size={9} color="rgba(246,241,232,0.55)">{t('common.fittings')}</Mono>
          </div>
          <div>
            <div style={{ fontFamily: T.serif, fontSize: 24, color: T.paper }}>2</div>
            <Mono size={9} color="rgba(246,241,232,0.55)">{t('common.deliveries')}</Mono>
          </div>
        </div>
        <div style={{ marginTop: 16, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 10, background: 'rgba(246,241,232,0.06)' }}>
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.gold, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 14, fontStyle: 'italic' }}>J</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.paper }}>Juliette M.</div>
            <Mono size={9} color="rgba(246,241,232,0.55)">Modista</Mono>
          </div>
        </div>
      </div>
    </div>
  );
}
