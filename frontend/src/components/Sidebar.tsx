import { T } from '../tokens';
import { Label, Mono } from './primitives';
import { t, usePack, navItems } from '../config';

interface Props {
  active: string;
  onNav: (s: string) => void;
  counts: Record<string, number>;
}

export function Sidebar({ active, onNav, counts }: Props) {
  const brand = usePack().brand;
  const items = navItems();

  return (
    <div style={{
      background: T.ink, color: T.paper,
      padding: '28px 20px', display: 'flex', flexDirection: 'column',
      borderRight: `1px solid ${T.hairline}`, height: '100%',
    }}>
      {/* logo */}
      <div style={{ marginBottom: 44, paddingLeft: 4 }}>
        <div style={{ fontFamily: T.serif, fontSize: 28, lineHeight: 1, color: T.paper }}>{brand.wordmark[0]}</div>
        <div style={{ fontFamily: T.serif, fontSize: 28, fontStyle: 'italic', lineHeight: 1, color: T.gold, marginTop: 2 }}>{brand.wordmark[1]}</div>
        <div style={{ height: 1, background: 'rgba(246,241,232,0.2)', margin: '14px 0 10px' }} />
        <div style={{ fontFamily: T.mono, fontSize: 9, color: 'rgba(246,241,232,0.55)', letterSpacing: 1.8, textTransform: 'uppercase' }}>
          {brand.tagline}
        </div>
      </div>

      <Label style={{ color: 'rgba(246,241,232,0.45)', marginBottom: 10, paddingLeft: 4 }}>{t('nav.section')}</Label>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map(it => {
          const on = it.screen === active || (active === 'profile' && it.screen === 'clients');
          const dim = it.sub;
          const count = it.countKey ? counts[it.countKey] : undefined;
          return (
            <div key={it.screen} onClick={() => !dim && onNav(it.screen)} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
              background: on ? 'rgba(246,241,232,0.08)' : 'transparent',
              borderLeft: on ? `2px solid ${T.gold}` : '2px solid transparent',
              cursor: dim ? 'default' : 'pointer', opacity: dim ? 0.55 : 1,
            }}>
              <span style={{ fontFamily: T.mono, fontSize: 10, color: on ? T.gold : 'rgba(246,241,232,0.5)', width: 18 }}>{it.n}</span>
              <span style={{ flex: 1, fontFamily: T.serif, fontStyle: dim ? 'italic' : 'normal', fontSize: 18, color: T.paper }}>{it.label}</span>
              {count !== undefined && (
                <span style={{ fontFamily: T.mono, fontSize: 10, color: it.accent && count ? T.gold : 'rgba(246,241,232,0.5)' }}>
                  {String(count).padStart(2, '0')}
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
          <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.gold, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 14, fontStyle: 'italic' }}>{brand.avatar}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: T.sans, fontSize: 12, color: T.paper }}>{brand.userName}</div>
            <Mono size={9} color="rgba(246,241,232,0.55)">{brand.userRole}</Mono>
          </div>
        </div>
      </div>
    </div>
  );
}
