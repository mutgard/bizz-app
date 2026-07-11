import { T } from '../tokens';
import { usePack, navItems } from '../config';

/**
 * Single compact header: brand row + tab strip.
 * Lives at the top so it's always visible regardless of browser chrome.
 */
export function MobileHeader({ active, onNav, counts }: {
  active: string;
  onNav: (s: string) => void;
  counts: Record<string, number>;
}) {
  const brand = usePack().brand;
  // Tab strip omits sub-screens (e.g. profile — reached by tapping a client).
  const tabs = navItems().filter(it => !it.sub);

  return (
    <div style={{ background: T.ink, color: T.paper, flexShrink: 0 }}>
      {/* Brand row */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 20px 8px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span style={{ fontFamily: T.serif, fontSize: 20, color: T.paper, lineHeight: 1 }}>{brand.wordmark[0]}</span>
          <span style={{ fontFamily: T.serif, fontSize: 20, fontStyle: 'italic', color: T.gold, lineHeight: 1 }}>{brand.wordmark[1]}</span>
        </div>
        <div style={{ width: 28, height: 28, borderRadius: '50%', background: T.gold, color: T.ink, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: T.serif, fontSize: 13, fontStyle: 'italic' }}>{brand.avatar}</div>
      </div>

      {/* Tab strip — indicator at bottom edge, pointing into content */}
      <div style={{ display: 'flex', borderTop: `1px solid rgba(246,241,232,0.12)` }}>
        {tabs.map(tab => {
          const on = tab.screen === active || (active === 'profile' && tab.screen === 'clients');
          // Mobile shows a count badge only for the accent (shop) item.
          const count = tab.accent && tab.countKey ? counts[tab.countKey] : undefined;
          return (
            <div key={tab.screen} onClick={() => onNav(tab.screen)} style={{ flex: 1, textAlign: 'center', padding: '8px 4px 10px', cursor: 'pointer', position: 'relative' }}>
              <div style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, color: on ? T.gold : 'rgba(246,241,232,0.4)', marginBottom: 3 }}>{tab.n}</div>
              <div style={{ fontFamily: T.serif, fontSize: 16, color: on ? T.paper : 'rgba(246,241,232,0.65)', fontStyle: on ? 'italic' : 'normal', position: 'relative', display: 'inline-block' }}>
                {tab.mobileLabel}
                {count !== undefined && count > 0 && (
                  <span style={{ position: 'absolute', top: -4, right: -14, background: T.gold, color: T.ink, fontFamily: T.mono, fontSize: 8, padding: '1px 5px', borderRadius: 999, lineHeight: 1.3 }}>{count}</span>
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

