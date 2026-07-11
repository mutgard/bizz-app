import { useCallback, useEffect, useState } from 'react';
import { T } from '../tokens';
import { usePack, BASE } from '../config';

// Operator backoffice with per-tenant users & roles (no global identity).
// admin: KPIs + errors + config + user management. manager: KPIs only.
// The instance ADMIN_TOKEN remains the bootstrap/break-glass credential.

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
interface UserRow { id: number; email: string; name: string; role: string }
interface Me { kind: string; email: string; name: string; role: string }

export const JWT_KEY = 'admin_jwt';
export const TOKEN_KEY = 'admin_token';

export function authHeader(): Record<string, string> | null {
  const jwt = localStorage.getItem(JWT_KEY);
  if (jwt) return { Authorization: `Bearer ${jwt}` };
  const tok = localStorage.getItem(TOKEN_KEY);
  if (tok) return { 'X-Admin-Token': tok };
  return null;
}

function fmtUptime(s: number): string {
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
}

export function AdminPage() {
  const pack = usePack();
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [tokenInput, setTokenInput] = useState('');
  const [kpis, setKpis] = useState<Kpis | null>(null);
  const [errors, setErrors] = useState<ErrEntry[]>([]);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [showConfig, setShowConfig] = useState(false);
  const [newUser, setNewUser] = useState({ name: '', email: '', password: '', role: 'manager' });

  const authedGet = useCallback(async (path: string) => {
    const hdr = authHeader();
    if (!hdr) throw new Error('401');
    const r = await fetch(`${BASE}${path}`, { headers: hdr });
    if (!r.ok) throw new Error(String(r.status));
    return r.json();
  }, []);

  const loadData = useCallback(async (who: Me) => {
    setKpis(await authedGet('/admin/kpis'));
    if (who.role === 'admin') {
      const [e, c, u] = await Promise.all([
        authedGet('/admin/errors'), authedGet('/admin/config'), authedGet('/auth/users'),
      ]);
      setErrors(e.errors); setConfig(c); setUsers(u);
    }
  }, [authedGet]);

  const establish = useCallback(async () => {
    setError('');
    try {
      const who = (await authedGet('/auth/me')) as Me;
      setMe(who);
      await loadData(who);
    } catch (err) {
      const code = err instanceof Error ? err.message : '';
      setMe(null);
      if (code !== '401') setError('Could not reach the admin API.');
    }
  }, [authedGet, loadData]);

  useEffect(() => { if (authHeader()) void establish(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const signIn = async () => {
    setError('');
    const r = await fetch(`${BASE}/auth/login`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!r.ok) { setError('Invalid email or password.'); return; }
    const body = await r.json();
    localStorage.setItem(JWT_KEY, body.token);
    localStorage.removeItem(TOKEN_KEY);
    await establish();
  };

  const connectToken = async () => {
    setError('');
    localStorage.setItem(TOKEN_KEY, tokenInput);
    localStorage.removeItem(JWT_KEY);
    await establish();
    if (!authHeader()) return;
    setTokenInput('');
  };

  const signOut = () => {
    localStorage.removeItem(JWT_KEY);
    localStorage.removeItem(TOKEN_KEY);
    setMe(null); setKpis(null); setErrors([]); setConfig(null); setUsers([]);
  };

  const addUser = async () => {
    setError('');
    const hdr = authHeader();
    const r = await fetch(`${BASE}/auth/users`, {
      method: 'POST', headers: { ...hdr, 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser),
    });
    if (!r.ok) { setError(r.status === 409 ? 'A user with this email already exists.' : 'Could not create user.'); return; }
    setNewUser({ name: '', email: '', password: '', role: 'manager' });
    setUsers(await authedGet('/auth/users'));
  };

  const removeUser = async (id: number) => {
    const hdr = authHeader();
    await fetch(`${BASE}/auth/users/${id}`, { method: 'DELETE', headers: hdr ?? {} });
    setUsers(await authedGet('/auth/users'));
  };

  const label = { fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase' as const, color: T.ink3 };
  const card = { background: T.vellum, border: `1px solid ${T.hairline}`, padding: '14px 18px', borderRadius: 2 };
  const input = { border: 'none', borderBottom: `1px solid ${T.hairline2}`, background: 'transparent', outline: 'none', fontFamily: T.mono, fontSize: 12, color: T.ink, padding: '6px 0' };

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
          Backoffice · tenant: {pack.id}{me && ` · ${me.name || me.email} · ${me.role}`}
        </span>
        <a href="/" style={{ marginLeft: 'auto', color: T.paper, opacity: 0.75, fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', textDecoration: 'none', padding: '4px 12px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 2 }}>
          Open app →
        </a>
        {me && (
          <>
            <button onClick={() => loadData(me)} style={{ background: 'transparent', color: T.gold, border: `1px solid ${T.gold}`, fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 12px', cursor: 'pointer', borderRadius: 2 }}>
              Refresh
            </button>
            <button onClick={signOut} style={{ background: 'transparent', color: T.paper, opacity: 0.75, border: '1px solid rgba(255,255,255,0.3)', fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', padding: '4px 12px', cursor: 'pointer', borderRadius: 2 }}>
              Sign out
            </button>
          </>
        )}
      </div>

      <div style={{ maxWidth: 1080, margin: '0 auto', padding: '28px 32px 60px' }}>
        {!me ? (
          <div style={{ ...card, maxWidth: 420, margin: '80px auto' }}>
            <div style={{ ...label, marginBottom: 14 }}>Sign in</div>
            <input value={email} onChange={e => setEmail(e.target.value)} placeholder="Email" type="email"
              style={{ ...input, width: '100%', marginBottom: 12 }} />
            <input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
              onKeyDown={e => { if (e.key === 'Enter') void signIn(); }}
              style={{ ...input, width: '100%' }} />
            <button onClick={() => void signIn()}
              style={{ width: '100%', marginTop: 18, padding: '12px', background: T.ink, color: T.paper, border: 'none', fontFamily: T.mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer' }}>
              Sign in
            </button>
            <div style={{ ...label, margin: '22px 0 10px', opacity: 0.7 }}>Or bootstrap with the instance token</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={tokenInput} onChange={e => setTokenInput(e.target.value)} placeholder="ADMIN_TOKEN" type="password"
                onKeyDown={e => { if (e.key === 'Enter') void connectToken(); }}
                style={{ ...input, flex: 1 }} />
              <button onClick={() => void connectToken()}
                style={{ padding: '6px 14px', background: 'transparent', color: T.ink, border: `1px solid ${T.hairline2}`, fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer', borderRadius: 2 }}>
                Connect
              </button>
            </div>
            {error && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, marginTop: 12 }}>{error}</div>}
            {!error && authHeader() === null && <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginTop: 14 }}>admin: KPIs, errors, config, users · manager: KPIs only</div>}
          </div>
        ) : kpis && (
          <>
            {/* KPI tiles — visible to every role */}
            <div style={{ ...label, marginBottom: 10 }}>KPIs</div>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              {tile('Clients', String(kpis.clients_total))}
              {tile('Invoiced', `${kpis.currency}${kpis.revenue_total.toLocaleString()}`)}
              {tile('Collected', `${kpis.currency}${kpis.revenue_paid.toLocaleString()}`)}
              {tile('Outstanding', `${kpis.currency}${kpis.revenue_outstanding.toLocaleString()}`)}
              {tile('Upcoming appts', String(kpis.appointments_upcoming))}
              {tile('Uptime', fmtUptime(kpis.uptime_seconds))}
            </div>

            <div style={{ ...label, margin: '26px 0 10px' }}>Clients by status</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {Object.entries(kpis.clients_by_status).map(([k, v]) => (
                <div key={k} style={{ ...card, padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: T.ink2 }}>{k}</span>
                  <span style={{ fontFamily: T.serif, fontSize: 20, fontStyle: 'italic' }}>{v}</span>
                </div>
              ))}
            </div>

            {me.role !== 'admin' && (
              <div style={{ fontFamily: T.mono, fontSize: 10, color: T.ink3, marginTop: 26 }}>
                Signed in as manager — errors, configuration and user management require the admin role.
              </div>
            )}

            {me.role === 'admin' && (
              <>
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

                {/* Users */}
                <div style={{ ...label, margin: '26px 0 10px' }}>Users ({users.length}) · admin: full access · manager: KPIs only</div>
                <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <tbody>
                      {users.map(u => (
                        <tr key={u.id} style={{ borderBottom: `1px solid ${T.hairline}` }}>
                          <td style={{ padding: '9px 14px', fontFamily: T.sans, fontSize: 12 }}>{u.name || '—'}</td>
                          <td style={{ padding: '9px 10px', fontFamily: T.mono, fontSize: 11, color: T.ink2 }}>{u.email}</td>
                          <td style={{ padding: '9px 10px', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', color: u.role === 'admin' ? T.accent : T.ink3 }}>{u.role}</td>
                          <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                            <button onClick={() => void removeUser(u.id)} title="Delete user"
                              style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>×</button>
                          </td>
                        </tr>
                      ))}
                      <tr>
                        <td style={{ padding: '9px 14px' }}>
                          <input value={newUser.name} onChange={e => setNewUser(u => ({ ...u, name: e.target.value }))} placeholder="Name" style={{ ...input, width: '100%' }} />
                        </td>
                        <td style={{ padding: '9px 10px' }}>
                          <input value={newUser.email} onChange={e => setNewUser(u => ({ ...u, email: e.target.value }))} placeholder="Email" style={{ ...input, width: '100%' }} />
                        </td>
                        <td style={{ padding: '9px 10px', whiteSpace: 'nowrap' }}>
                          <input value={newUser.password} onChange={e => setNewUser(u => ({ ...u, password: e.target.value }))} placeholder="Password" type="password" style={{ ...input, width: 110, marginRight: 8 }} />
                          <select value={newUser.role} onChange={e => setNewUser(u => ({ ...u, role: e.target.value }))}
                            style={{ border: `1px solid ${T.hairline2}`, background: 'transparent', fontFamily: T.mono, fontSize: 10, textTransform: 'uppercase', padding: '3px 6px', borderRadius: 2, cursor: 'pointer', outline: 'none', color: T.ink }}>
                            <option value="manager">manager</option>
                            <option value="admin">admin</option>
                          </select>
                        </td>
                        <td style={{ padding: '9px 14px', textAlign: 'right' }}>
                          <button onClick={() => void addUser()} disabled={!newUser.email || !newUser.password}
                            style={{ background: T.ink, color: T.paper, border: 'none', fontFamily: T.mono, fontSize: 10, letterSpacing: 0.8, textTransform: 'uppercase', padding: '5px 12px', cursor: 'pointer', borderRadius: 2, opacity: !newUser.email || !newUser.password ? 0.5 : 1 }}>
                            Add
                          </button>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
                {error && <div style={{ fontFamily: T.mono, fontSize: 11, color: T.accent, marginTop: 10 }}>{error}</div>}

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
          </>
        )}
      </div>
    </div>
  );
}
