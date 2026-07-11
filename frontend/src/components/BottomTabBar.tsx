import React from 'react';
import { T } from '../tokens';
import { navItems } from '../config';

const ICONS: Record<string, React.JSX.Element> = {
  today:     <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9"/></svg>,
  clients:   <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/></svg>,
  materials: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M4 7h16v13H4z"/><path d="M4 7l2.5-3h11L20 7"/><path d="M9.5 11h5"/></svg>,
};

export function BottomTabBar({ active, onNav, counts }: {
  active: string; onNav: (s: string) => void; counts: Record<string, number>;
}) {
  const tabs = navItems({ mobile: true }).filter(it => !it.sub);
  return (
    <nav style={{
      display: 'flex', flexShrink: 0, borderTop: `1px solid ${T.hairline}`,
      background: T.sheet, padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
    }}>
      {tabs.map(it => {
        const on = it.screen === active || (active === 'profile' && it.screen === 'clients');
        const count = it.accent && it.countKey ? counts[it.countKey] : undefined;
        return (
          <button key={it.screen} onClick={() => onNav(it.screen)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            color: on ? T.accent : T.ink3, position: 'relative',
          }}>
            {ICONS[it.screen] ?? ICONS.clients}
            <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 600, position: 'relative' }}>
              {it.mobileLabel}
              {count !== undefined && count > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -14, background: T.gold, color: T.ink, fontFamily: T.mono, fontSize: 8, padding: '1px 5px', borderRadius: 999 }}>{count}</span>
              )}
              {on && <span style={{ position: 'absolute', left: '15%', right: '15%', bottom: -5, height: 2, background: T.gold, borderRadius: 2 }} />}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
