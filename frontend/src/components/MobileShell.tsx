import { T } from '../tokens';
import { t } from '../config';

type Screen = 'clients' | 'profile' | 'fabrics' | 'shop' | 'roadmap' | 'intake' | 'finances';

/**
 * Single compact header: brand row + tab strip.
 * Lives at the top so it's always visible regardless of browser chrome.
 */
export function MobileHeader({ active, onNav, fabricsToBuy }: {
  active: Screen;
  onNav: (s: Screen) => void;
  fabricsToBuy: number;
}) {
  const tabs: { id: Screen; n: string; label: string; count?: number }[] = [
    { id: 'clients', n: '01', label: t('nav.clients') },
    { id: 'fabrics', n: '03', label: t('nav.fabrics') },
    { id: 'shop',    n: '04', label: t('common.buy'), count: fabricsToBuy },
    { id: 'roadmap', n: '05', label: t('nav.roadmap') },
    { id: 'intake',   n: '06', label: t('nav.intake') },
    { id: 'finances', n: '07', label: t('nav.finances') },
  ];

  return (
    <div style={{ background: T.ink, color: T.paper, flexShrink: 0 }}>
      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: T.serif, fontSize: 20, color: T.paper, lineHeight: 1 }}>Juliette</span>
          <span style={{ fontFamily: T.serif, fontSize: 20, fontStyle: 'italic', color: T.gold, lineHeight: 1 }}>Atelier</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.gold, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 13, fontStyle: 'italic' }}>J</div>
      </div>

      {/* Tab strip — indicator at bottom edge, pointing into content */}
      <div style={{ display: 'flex', borderTop: `1px solid rgba(246,241,232,0.12)` }}>
        {tabs.map(tab => {
          const on = tab.id === active || (active === 'profile' && tab.id === 'clients');
          return (
            <div key={tab.id} onClick={() => onNav(tab.id)} style={{ flex: 1, textAlign: 'center', padding: '8px 4px 10px', cursor: 'pointer', position: 'relative' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, color: on ? T.gold : 'rgba(246,241,232,0.4)', marginBottom: 3 }}>{tab.n}</div>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: on ? T.paper : 'rgba(246,241,232,0.65)', fontStyle: on ? 'italic' : 'normal', position: 'relative', display: 'inline-block' }}>
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -14, background: T.gold, color: T.ink, fontFamily: T.mono, fontSize: 8, padding: '1px 5px', borderRadius: 999, lineHeight: 1.3 }}>{tab.count}</span>
                )}
              </div>
              {on && <div style={{ position: 'absolute', bottom: 0, left: '25%', right: '25%', height: 2, background: T.gold }} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}

