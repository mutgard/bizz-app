# Operator Backoffice

Review **KPIs, captured errors, and tenant configuration** for each deployed
instance. Phased design.

## Phase 1 — in-tenant (implemented)

Each instance ships its own backoffice; the operator holds one credential per
tenant.

### Users & roles (per tenant, no global identity)

Each instance keeps its own `users` table (SQLite) — there is no cross-tenant
identity. Two roles:

| Role | Access |
|---|---|
| `admin` | KPIs, errors, config, user management |
| `manager` | KPIs only |

- **Bootstrap**: set env `ADMIN_TOKEN=<secret>` on the instance — it always
  acts as `admin` (break-glass, so deleting the last admin user can never
  lock you out). Sign in with it once and create users from the Users
  section (or `POST /auth/users`).
- **Sessions**: `POST /auth/login {email,password}` → 12h JWT (HS256, secret
  = env `AUTH_SECRET`, falling back to `ADMIN_TOKEN`). Passwords are PBKDF2
  (stdlib). Deleting or demoting a user invalidates their JWT immediately —
  the role claim is re-checked against the DB on every request.
- **Auth endpoints**: `POST /auth/login`, `GET /auth/me`,
  `GET|POST /auth/users`, `DELETE /auth/users/{id}` (user management is
  admin-only).
- **UI**: `/admin` shows an email/password sign-in (plus the token bootstrap
  field). Managers see KPIs only; admins see everything incl. the Users
  section.
- **API** (also the remote surface for Phase 2). Auth via
  `Authorization: Bearer <jwt>` — or `X-Admin-Token`/Bearer with the
  instance token:
  - `GET /admin/kpis` — client count, clients by status (pack vocabulary),
    payments count, invoiced / collected / outstanding (parsed with the
    pack's `paidKeyword`), upcoming appointments, uptime.
  - `GET /admin/errors` — ring buffer (last 200) of unhandled exceptions
    (with traceback) and 4xx/5xx responses. In-memory: resets on restart.
    `/admin/*` traffic itself is excluded to avoid self-noise.
  - `GET /admin/config` — full active pack + runtime info (python version,
    database URL, uptime, phase).
- Backend pieces: `backend/monitor.py` (ring buffer + uptime),
  `backend/routes/admin.py` (endpoints + token auth), error-capture
  middleware in `backend/main.py`, UI in `frontend/src/pages/AdminPage.tsx`
  (route `/admin` in `App.tsx`).
- **Navigation (role-based)**: the operator role is *holding a valid
  ADMIN_TOKEN* — no user accounts. After connecting once on `/admin`, the
  token lives in that browser's `localStorage`; the app sidebar then shows a
  gold **Admin** chip (validated against `/admin/kpis` via
  `frontend/src/hooks/useIsOperator.ts`) linking to the backoffice, and the
  backoffice header has **Open app →** linking back. Browsers without a
  valid token (i.e. the tenant's owner) never see the chip; `/admin` stays
  reachable by URL but token-gated.

## Phase 2 — central backoffice (future)

One dashboard on the operator's own instance that fans out to every deployed
instance using the Phase 1 API:

1. A registry of instances: `{ name, base_url, admin_token }` (env/file/DB).
2. An aggregator service polls `/admin/kpis`, `/admin/errors`,
   `/admin/config` per instance and renders a fleet overview (per-tenant
   cards, error feed across tenants, config diffing against the pack repo).
3. Nothing changes on tenant instances — Phase 1 endpoints are already the
   integration contract. Recommended hardening before Phase 2: per-caller
   tokens + TLS-only, persist errors (SQLite table) so restarts don't lose
   history, and add `Retry-After`/rate limiting on `/admin/*`.
