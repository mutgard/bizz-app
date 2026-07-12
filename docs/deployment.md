# Deployment

## Local development

Prerequisite: Docker.

```bash
docker compose up -d          # Postgres 16 on localhost:5432 (db/user: atelier/postgres)
cd backend && uvicorn main:app --reload   # defaults to the compose Postgres
cd frontend && npm run dev               # Vite on http://localhost:5173
```

No env vars needed: when `DATABASE_URL` is unset the backend uses
`postgresql+psycopg://postgres:postgres@localhost:5432/atelier`. On first
boot against an empty database, startup creates tables, applies column
migrations, and seeds demo data; on later boots the seed is skipped.

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
   production), `ACTIVE_PACK` if not `atelier`, `CORS_ORIGINS` if serving a
   custom domain.
4. Deploy. First boot seeds only if the database is empty.
5. DB access: Railway dashboard → Postgres service → **Data** tab, or
   connect any client (psql/TablePlus) with the public connection string.

Deliberately not set up yet: `railway.toml`, Alembic migrations.
