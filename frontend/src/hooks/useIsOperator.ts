import { useEffect, useState } from 'react';
import { BASE } from '../config';

// "Role" without user accounts: the operator is whoever holds this instance's
// ADMIN_TOKEN (entered once on /admin, kept in localStorage). We validate it
// against the admin API so a stale/wrong token doesn't grant the role.
let cached: boolean | null = null;

export function useIsOperator(): boolean {
  const [isOp, setIsOp] = useState(cached === true);

  useEffect(() => {
    if (cached !== null) { setIsOp(cached); return; }
    const token = localStorage.getItem('admin_token');
    if (!token) { cached = false; return; }
    fetch(`${BASE}/admin/kpis`, { headers: { 'X-Admin-Token': token } })
      .then(r => { cached = r.ok; setIsOp(r.ok); })
      .catch(() => { cached = false; });
  }, []);

  return isOp;
}
