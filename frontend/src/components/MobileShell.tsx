import { T } from '../tokens';
import { usePack } from '../config';

/**
 * Brand row only. Navigation now lives in the persistent BottomTabBar;
 * this header just stays visible regardless of browser chrome.
 */
export function MobileHeader() {
  const brand = usePack().brand;

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
    </div>
  );
}

