# Local Postgres dev environment + Railway readiness — Design

**Date:** 2026-07-12
**Status:** Approved

## Goal

Develop locally against the same database engine we will run in production
(Railway Postgres), while keeping the release itself a later step. Local dev
gets a Docker-managed Postgres; the backend becomes `DATABASE_URL`-driven so
Railway's injected variable works unchanged at release time.

## Decisions

- **Dev topology:** docker-compose runs Postgres only. Backend (`uvicorn
  --reload`) and frontend (`vite dev`) keep running natively for hot reload.
- **Default engine:** when `DATABASE_URL` is unset, the backend defaults to
  the local compose Postgres (`postgresql+psycopg://postgres:postgres@localhost:5432/atelier`),
  not SQLite. Dev/prod parity by default; `docker compose up -d` is a
  prerequisite for running the backend.
- **Tests are unaffected:** the test suite builds its own per-test SQLite
  engines and never touches `database.DATABASE_URL`.

## Changes

### 1. `backend/database.py`

- Read `DATABASE_URL` from the environment with the local-Postgres default
  above.
- Normalize Postgres URLs: rewrite a `postgres://` or `postgresql://` prefix
  to `postgresql+psycopg://` so SQLAlchemy selects the psycopg3 driver
  (Railway injects `postgres://...`). SQLite URLs pass through untouched.
- Fix `run_migrations()` for Postgres: the `except Exception: pass` around
  each `ALTER TABLE ... ADD COLUMN` currently leaves the connection in an
  aborted-transaction state on Postgres, silently skipping all later columns.
  Add `conn.rollback()` in the except handler.

### 2. `backend/requirements.txt`

- Add `psycopg[binary]` (psycopg3).

### 3. `docker-compose.yml` (repo root)

Single service:

- `postgres:16-alpine`, database `atelier`, user/password `postgres`,
  port `5432:5432`, named volume for data persistence, `pg_isready`
  healthcheck.

### 4. `.env.example` + `docs/deployment.md`

- `.env.example` documents `DATABASE_URL` (and its default) plus existing
  runtime env (`ACTIVE_PACK`, `AUTH_SECRET` — falls back to `ADMIN_TOKEN`,
  then an insecure dev default).
- `docs/deployment.md`: local dev flow (compose up → uvicorn/vite) and the
  Railway release checklist — connect repo (Dockerfile auto-detected), add
  the Postgres plugin (injects `DATABASE_URL`), set `AUTH_SECRET` and
  `ACTIVE_PACK`, note that startup seeding only runs on an empty database.
- No `railway.toml` yet — deferred until release.

## Verification

- Backend test suite passes unchanged (self-contained SQLite).
- Manual end-to-end: `docker compose up -d` → backend boots against
  Postgres → startup `create_db()` / `run_migrations()` / seed succeed →
  exercise a couple of endpoints.

## Out of scope

- Alembic (hand-rolled migration list is adequate at current size).
- Running tests against Postgres.
- Railway config files / actual deployment.
