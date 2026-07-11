import { useEffect, useState } from 'react';
import { BASE } from '../config';

// Backoffice role detection: valid when the browser holds a working credential
// for THIS tenant — a user JWT (from /auth/login) or the instance ADMIN_TOKEN.
// Validated against /auth/me so stale credentials don't grant the role.
let cached: boolean | null = null;

export function useIsOperator(): boolean {
  const [isOp, setIsOp] = useState(cached === true);

  useEffect(() => {
    if (cached !== null) { setIsOp(cached); return; }
    const jwt = localStorage.getItem('admin_jwt');
    const tok = localStorage.getItem('admin_token');
    if (!jwt && !tok) { cached = false; return; }
    const headers: Record<string, string> = jwt
      ? { Authorization: `Bearer ${jwt}` }
      : { 'X-Admin-Token': tok! };
    fetch(`${BASE}/auth/me`, { headers })
      .then(r => { cached = r.ok; setIsOp(r.ok); })
      .catch(() => { cached = false; });
  }, []);

  return isOp;
}
