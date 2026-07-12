import { T } from '../tokens';
import { t, usePack, navItems } from '../config';
import { useIsOperator } from '../hooks/useIsOperator';
import { GlobalSearch } from './GlobalSearch';
import type { Client } from '../types';

export function TopBar({ active, onNav, counts, onNewClient, clients, onOpenClient }: {
  active: string;
  onNav: (s: string) => void;
  counts: Record<string, number>;
  onNewClient: () => void;
  clients: Client[];
  onOpenClient: (id: number) => void;
}) {
  const brand = usePack().brand;
  const items = navItems().filter(it => !it.sub);
  const isOperator = useIsOperator();

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14,
      background: T.ink, color: T.paper,
      padding: '0 16px', height: 46, flexShrink: 0,
      borderBottom: `1px solid ${T.hairline}`,
    }}>
      {/* wordmark */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, whiteSpace: 'nowrap' }}>
        <span style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 15, lineHeight: 1, color: T.paper }}>{brand.wordmark[0]}</span>
        <span style={{ fontFamily: T.serif, fontWeight: 600, fontSize: 15, lineHeight: 1, fontStyle: 'italic', color: T.gold }}>{brand.wordmark[1]}</span>
      </div>

      {/* nav pills */}
      <nav style={{ display: 'flex', gap: 2, marginLeft: 10 }}>
        {items.map(it => {
          const on = it.screen === active || (active === 'profile' && it.screen === 'clients');
          const count = it.countKey ? counts[it.countKey] : undefined;
          return (
            <button key={it.screen} onClick={() => onNav(it.screen)} style={{
              fontFamily: T.sans, fontWeight: on ? 600 : 500, fontSize: 12.5,
              color: on ? T.paper : 'rgba(246,241,232,0.66)',
              background: on ? 'rgba(246,241,232,0.14)' : 'transparent',
              border: 'none', borderRadius: 7, padding: '8px 12px', cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}>
              {it.label}
              {count !== undefined && count > 0 && (
                <span style={{ fontFamily: T.mono, fontWeight: 500, fontSize: 10, color: T.gold, marginLeft: 5 }}>{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {/* right side: search slot, + Nova, operator-only admin link */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginLeft: 'auto' }}>
        <GlobalSearch clients={clients} onOpen={onOpenClient} />
        <button onClick={onNewClient} style={{
          fontFamily: T.sans, fontWeight: 600, fontSize: 12,
          background: T.gold, color: T.ink, border: 'none', borderRadius: 7,
          padding: '8px 12px', cursor: 'pointer', whiteSpace: 'nowrap',
        }}>
          + {t('common.new')}
        </button>
        {/* Operator-only: visible when the browser holds a valid ADMIN_TOKEN */}
        {isOperator && (
          <a href="/admin" title="Backoffice" style={{ fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.gold, textDecoration: 'none', border: `1px solid rgba(246,241,232,0.25)`, padding: '3px 8px', borderRadius: 2 }}>
            Admin
          </a>
        )}
      </div>
    </div>
  );
}
