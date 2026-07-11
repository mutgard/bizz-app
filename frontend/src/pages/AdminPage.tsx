import { useCallback, useEffect, useState } from 'react';
import { T } from '../tokens';
import { usePack, BASE } from '../config';

// Operator backoffice (Phase 1: in-tenant). Reached at /admin, token-gated via
// the instance's ADMIN_TOKEN. Operator-facing, so copy is intentionally plain
// English rather than pack strings — the chrome still inherits the tenant theme.

interface Kpis {
  pack: string;
  clients_total: number;
  clients_by_status: Record<string, number>;
  payments_count: number;
  revenue_total: number;
  revenue_paid: number;
  revenue_outstanding: number;
  currency: string;
  appointments_upcoming: number;
  uptime_seconds: number;
}
interface ErrEntry { ts: string; method: string; path: string; status: number; detail: string }

const TOKEN_KEY = 'admin_token';

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function AdminPage() {
  const pack = usePack();
  const [token, setToken] = useState(() => localStorage.getItem(TOKEN_KEY) ?? '');
  const [input, setInput] = useState('');
  const [authed, setAuthed] = useState(false);
  const [error, setError] = useState('');
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [errors, setErrors] = useState<ErrEntry[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [showConfig, setShowConfig] = useState(false);

  const load = useCallback(async (tok: string) => {
    setError('');
    const get = async (path: string) => {
      const r = await fetch(`${BASE}${path}`, { headers: { 'X-Admin-Token': tok } });
      if (!r.ok) throw new Error(String(r.status));
      return r.json();
    };
    try {
      const [k, e, c] = await Promise.all([get('/admin/kpis'), get('/admin/errors'), get('/admin/config')]);
      setKpis(k); setErrors(e.errors); setConfig(c);
      setAuthed(true);
      localStorage.setItem(TOKEN_KEY, tok);
    } catch (err) {
      setAuthed(false);
      const code = err instanceof Error ? err.message : '';
      setError(code === '503' ? 'Admin API disabled on this instance (ADMIN_TOKEN not set).'
        : code === '401' ? 'Invalid admin token.'
        : 'Could not reach the admin API.');
    }
  }, []);

  useEffect(() => { if (token) void load(token); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const label = { fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' as const, color: T.ink3 };
  const card = { background: T.vellum, border: `1px solid ${T.hairline}`, padding: '14px 18px', borderRadius: 2 };

  const tile = (l: string, v: string) => (
    <div key={l} style={{ ...card, minWidth: 150, flex: '1 1 150px' }}>
      <div style={label}>{l}</div>
      <div style={{ fontFamily: T.serif, fontSize: 30, fontStyle: 'italic', color: T.ink, marginTop: 6 }}>{v}</div>
    </div>
  );

  return (
    <div style={{ height: '100%', overflow: 'auto', background: T.paper, color: T.ink, fontFamily: T.sans }}>
      {/* Header */}
      <div style={{ background: T.ink, color: T.paper, padding: '18px 32px', display: 'flex', alignItems: 'baseline', gap: 12 }}>
        <span style={{ fontFamily: T.serif, fontSize: 24 }}>{pack.brand.wordmark[0]}</span>
        <span style={{ fontFamily: T.serif, fontSize: 24, fontStyle: 'italic', color: T.gold }}>{pack.brand.wordmark[1]}</span>
        <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', opacity: 0.6, marginLeft: 8 }}>
          Backoffice · tenant: {pack.id}
        </span>
        <a href="/" style={{ marginLeft: 'auto', color: T.paper, opacity: 0.75, fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 2 }}>
          Open app →
        </a>
        {authed && (
          <button onClick={() => load(token)} style={{ background: 'transparent', color: T.gold, border: `1px solid ${T.gold}`, fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 12px', cursor: 'pointer', borderRadius: 2 }}>
            Refresh
          </button>
        )}
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px 60px' }}>
        {!authed ? (
          <div style={{ ...card, maxWidth: 420, margin: '80px auto' }}>
            <div style={{ ...label, marginBottom: 12 }}>Admin token</div>
            <input
              type="password"
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') { setToken(input); void load(input); } }}
              placeholder="Paste this instance's ADMIN_TOKEN"
              style={{ width: '100%', border: 'none', borderBottom: `1px solid ${T.hairline2}`, background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 13, color: T.ink, padding: '6px 0' }}
            />
            <button
              onClick={() => { setToken(input); void load(input); }}
              style={{ width: '100%', marginTop: 18, padding: '12px', background: T.ink, color: T.paper, border: 'none', fontFamily: T.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}
            >
              Connect
            </button>
            {error && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, marginTop: 12 }}>{error}</div>}
          </div>
        ) : kpis && (
          <>
            {/* KPI tiles */}
            <div style={{ ...label, marginBottom: 10 }}>KPIs</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {tile('Clients', String(kpis.clients_total))}
              {tile('Invoiced', `${kpis.currency}${kpis.revenue_total.toLocaleString()}`)}
              {tile('Collected', `${kpis.currency}${kpis.revenue_paid.toLocaleString()}`)}
              {tile('Outstanding', `${kpis.currency}${kpis.revenue_outstanding.toLocaleString()}`)}
              {tile('Upcoming appts', String(kpis.appointments_upcoming))}
              {tile('Uptime', fmtUptime(kpis.uptime_seconds))}
            </div>

            {/* Status distribution */}
            <div style={{ ...label, margin: '26px 0 10px' }}>Clients by status</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(kpis.clients_by_status).map(([k, v]) => (
                <div key={k} style={{ ...card, padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink2 }}>{k}</span>
                  <span style={{ fontFamily: T.serif, fontSize: 20, fontStyle: 'italic' }}>{v}</span>
                </div>
              ))}
            </div>

            {/* Errors */}
            <div style={{ ...label, margin: '26px 0 10px' }}>Captured errors ({errors.length})</div>
            <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
              {errors.length === 0 ? (
                <div style={{ padding: '16px 18px', fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>No errors captured since startup.</div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <tbody>
                    {errors.slice(0, 50).map((e, i) => (
                      <tr key={i} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                        <td style={{ padding: '8px 14px', fontFamily: T.mono, fontSize: 10, color: T.ink3, whiteSpace: 'nowrap' }}>{e.ts}</td>
                        <td style={{ padding: '8px 10px', fontFamily: T.mono, fontSize: 10, color: e.status >= 500 ? T.accent : T.ink2 }}>{e.status}</td>
                        <td style={{ padding: '8px 10px', fontFamily: T.mono, fontSize: 10, color: T.ink }}>{e.method} {e.path}</td>
                        <td style={{ padding: '8px 14px', fontFamily: T.mono, fontSize: 9, color: T.ink3, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.detail}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Tenant configuration */}
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, margin: '26px 0 10px' }}>
              <div style={label}>Tenant configuration</div>
              <button onClick={() => setShowConfig(s => !s)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 9, letterSpacing: 0.8, textTransform: 'uppercase', color: T.accent, padding: 0 }}>
                {showConfig ? 'Hide' : 'Show'} full pack JSON
              </button>
            </div>
            {config && (
              <div style={card}>
                <div style={{ fontFamily: T.mono, fontSize: 11, color: T.ink2, display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                  <span>pack: <b>{String((config as { pack_id?: string }).pack_id)}</b></span>
                  <span>python: {String((config.runtime as Record<string, unknown>)?.python)}</span>
                  <span>db: {String((config.runtime as Record<string, unknown>)?.database_url)}</span>
                  <span>phase: {String((config.runtime as Record<string, unknown>)?.backoffice_phase)}</span>
                </div>
                {showConfig && (
                  <pre style={{ marginTop: 14, fontFamily: T.mono, fontSize: 10, lineHeight: 1.6, color: T.ink2, overflow: 'auto', maxHeight: 420, background: T.sheet, padding: 14, border: `1px solid ${T.hairline}` }}>
                    {JSON.stringify(config.pack, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
