# Operator Backoffice

Review **KPIs, captured errors, and tenant configuration** for each deployed
instance. Phased design.

## Phase 1 — in-tenant (implemented)

Each instance ships its own backoffice; the operator holds one credential per
tenant.

- **Enable**: set env `ADMIN_TOKEN=<secret>` on the instance. Unset → the
  admin API answers `503` (disabled).
- **UI**: open `https://<instance>/admin`, paste the token (stored in
  `localStorage`). The page inherits the tenant's pack theme and shows the
  tenant id in the header.
- **API** (also the remote surface for Phase 2). Auth via
  `X-Admin-Token: <token>` or `Authorization: Bearer <token>`:
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
