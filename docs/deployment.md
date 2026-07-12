# Deployment

## Local development

Prerequisite: Docker.

```bash
docker compose up -d          # Postgres 16 on localhost:5432 (db/user: atelier/postgres)
cd backend && uvicorn main:app --reload   # defaults to the compose Postgres
cd frontend && npm run dev               # Vite on http://localhost:5173
```

No env vars needed: when `DATABASE_URL` is unset the backend uses
`postgresql+psycopg://postgres:postgres@localhost:5432/atelier`. On first boot
against an empty database, startup creates tables and applies
column migrations; demo data is seeded only when the active pack is a demo
pack (`atelier-demo`, the default, or `physio-demo`) — tenant packs contain
no seed data at all.

No Docker available? Set DATABASE_URL=sqlite:///./atelier.db to run against
a local SQLite file instead.

Data persists in the `pgdata` Docker volume. `docker compose down -v` wipes it.

Inspect the DB: `docker compose exec postgres psql -U postgres -d atelier`.

Tests do not need Docker — the suite builds its own SQLite engines:
`cd backend && python -m pytest tests/`.

## Release to Railway

1. Create a Railway project and connect this repo — the root `Dockerfile`
   (frontend build + uvicorn serving static + API) is auto-detected.
2. Add the **Postgres** database service and reference it from the app
   service; Railway injects `DATABASE_URL` (`postgres://...`), which the
   backend rewrites to the psycopg3 dialect automatically.
3. Set service variables (see `.env.example`): `AUTH_SECRET` (required in
   production), `CORS_ORIGINS` if serving a custom domain, and `ACTIVE_PACK`
   set to the tenant's pack (e.g. `atelier`). Railway exposes service
   variables to the Docker build, so the `ACTIVE_PACK` build arg bakes that
   one pack into the image and the same value is set at runtime.
4. Deploy. First boot seeds only if the database is empty.
5. DB access: Railway dashboard → Postgres service → **Data** tab, or
   connect any client (psql/TablePlus) with the public connection string.

Deliberately not set up yet: `railway.toml`, Alembic migrations.

## Client editions

A tenant deployment ("client edition") is fully described by three things:

1. **Pinned core image** — built from a tagged commit with the pack baked in:
   `docker build --build-arg ACTIVE_PACK=atelier -t bizz-app:<version>-atelier .`
   The image contains only that pack (a demo pack also carries its base);
   tenant images contain no `seed.json`, so demo data cannot leak into a
   client deployment.
2. **Pack id** — determines schema custom fields, strings, theme, and nav.
3. **Env** — `DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS`. The tenant's
   Postgres is the system of record for all client data; nothing
   client-specific lives in git.

Per-tenant manifests (core version pin, pack id, Railway project ref, env var
*names*) live in the private `bizz-tenants` repo — one small YAML per tenant:

```yaml
# bizz-tenants/juliette.yaml
core: v1.4.2
pack: atelier
railway: juliette-prod
env: [DATABASE_URL, AUTH_SECRET, CORS_ORIGINS]   # names only, values in Railway
```

Upgrading a tenant = bump `core:` in its manifest, redeploy the matching
image tag in Railway. Secret values live only in Railway, never in git.
