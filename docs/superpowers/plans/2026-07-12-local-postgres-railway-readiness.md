# Local Postgres Dev Env + Railway Readiness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Local development runs against a docker-compose Postgres, and the backend is `DATABASE_URL`-driven so Railway's injected Postgres URL works unchanged at release.

**Architecture:** The FastAPI backend (`backend/`) currently hardcodes `sqlite:///./atelier.db` in `backend/database.py`. We make the engine URL env-driven with a local-Postgres default, normalize Railway-style `postgres://` URLs to the psycopg3 SQLAlchemy dialect, and fix a Postgres-specific bug in the hand-rolled `run_migrations()`. Docker Compose provides the local Postgres. Tests are self-contained (each builds its own SQLite engine and overrides the `get_session` dependency; `TestClient(app)` is never used as a context manager, so the app startup hook — which touches the global engine — never runs under test).

**Tech Stack:** FastAPI 0.111 + SQLModel 0.0.18 (SQLAlchemy 2.x), psycopg3 (`psycopg[binary]`), Postgres 16 (alpine), docker-compose, pytest.

**Spec:** `docs/superpowers/specs/2026-07-12-local-postgres-railway-readiness-design.md`

## Global Constraints

- Default DB URL when `DATABASE_URL` is unset (exact string): `postgresql+psycopg://postgres:postgres@localhost:5432/atelier`
- Postgres driver is psycopg3 via `psycopg[binary]` — never psycopg2.
- Compose image (exact): `postgres:16-alpine`; database `atelier`, user `postgres`, password `postgres`, host port `5432`.
- SQLite URLs must pass through `_normalize_url` untouched (tests depend on SQLite).
- No `railway.toml`, no Alembic, no changes to existing tests.
- The working tree carries unrelated uncommitted changes — stage files explicitly by path; NEVER `git add -A` or `git add .`.
- Backend commands run from `backend/`; tests insert `..` on `sys.path` themselves.

---

### Task 1: Env-driven database URL + Postgres migration fix

**Files:**
- Modify: `backend/requirements.txt`
- Modify: `backend/database.py`
- Test: `backend/tests/test_database_url.py` (create)

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `database._normalize_url(url: str) -> str`; `database.DATABASE_URL` (module constant, env-driven); engine behavior relied on by Task 2's end-to-end check.

- [ ] **Step 1: Add the Postgres driver to requirements**

Append to `backend/requirements.txt` (keep existing lines untouched):

```text
psycopg[binary]==3.1.19
```

- [ ] **Step 2: Install it into the environment that runs pytest**

Run: `cd backend && python -m pip install "psycopg[binary]==3.1.19"`
Expected: `Successfully installed psycopg-3.1.19 psycopg-binary-3.1.19` (or "already satisfied").

- [ ] **Step 3: Write the failing test**

Create `backend/tests/test_database_url.py`:

```python
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from database import _normalize_url


def test_railway_postgres_scheme_rewritten():
    assert (
        _normalize_url("postgres://user:pw@host:5432/db")
        == "postgresql+psycopg://user:pw@host:5432/db"
    )


def test_plain_postgresql_scheme_rewritten():
    assert (
        _normalize_url("postgresql://user:pw@host:5432/db")
        == "postgresql+psycopg://user:pw@host:5432/db"
    )


def test_explicit_psycopg_scheme_untouched():
    url = "postgresql+psycopg://user:pw@host:5432/db"
    assert _normalize_url(url) == url


def test_sqlite_url_untouched():
    url = "sqlite:///./atelier.db"
    assert _normalize_url(url) == url
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd backend && python -m pytest tests/test_database_url.py -v`
Expected: FAIL (collection error) with `ImportError: cannot import name '_normalize_url' from 'database'`.

- [ ] **Step 5: Implement in `backend/database.py`**

Replace the top of the file (the imports, `DATABASE_URL`, and `engine` lines) with:

```python
import os
from sqlmodel import SQLModel, create_engine, Session
from sqlalchemy import text

# Local docker-compose Postgres (see docker-compose.yml). Railway injects its
# own DATABASE_URL in production; tests build their own SQLite engines.
DEFAULT_DATABASE_URL = "postgresql+psycopg://postgres:postgres@localhost:5432/atelier"


def _normalize_url(url: str) -> str:
    """Rewrite postgres:// / postgresql:// to the psycopg3 dialect.

    Railway injects postgres://, which SQLAlchemy 2 rejects, and a bare
    postgresql:// would select the (uninstalled) psycopg2 driver. Non-Postgres
    URLs (sqlite) pass through untouched.
    """
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _normalize_url(os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL))
engine = create_engine(DATABASE_URL, echo=False)
```

Keep `create_db()`, `run_migrations()`, and `get_session()` as they are, except for the fix in Step 6.

- [ ] **Step 6: Fix the aborted-transaction bug in `run_migrations()`**

In the same file, change the `except` clause inside `run_migrations()` from:

```python
            except Exception:
                pass  # column already exists
```

to:

```python
            except Exception:
                # Column already exists. On Postgres the failed statement also
                # aborts the transaction; roll back or every later ALTER on
                # this connection is silently skipped.
                conn.rollback()
```

- [ ] **Step 7: Run the new test to verify it passes**

Run: `cd backend && python -m pytest tests/test_database_url.py -v`
Expected: 4 passed.

- [ ] **Step 8: Run the full backend suite to verify nothing regressed**

Run: `cd backend && python -m pytest tests/ -v`
Expected: all tests pass (same pass count as on `git stash`-free baseline; no new failures). The suite must not require Docker/Postgres — if anything tries to connect to `localhost:5432`, that is a regression in this task.

- [ ] **Step 9: Commit (explicit paths only)**

```bash
git add backend/database.py backend/requirements.txt backend/tests/test_database_url.py
git commit -m "feat(db): env-driven DATABASE_URL with psycopg3, fix run_migrations on Postgres"
```

---

### Task 2: docker-compose Postgres + end-to-end verification

**Files:**
- Create: `docker-compose.yml` (repo root)

**Interfaces:**
- Consumes: the default URL from Task 1 (`postgresql+psycopg://postgres:postgres@localhost:5432/atelier`) — the compose service must match it exactly.
- Produces: a running local Postgres that `uvicorn main:app` connects to with no env vars set; relied on by the docs in Task 3.

- [ ] **Step 1: Write `docker-compose.yml` at the repo root**

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_DB: atelier
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
    ports:
      - "5432:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres -d atelier"]
      interval: 5s
      timeout: 3s
      retries: 10

volumes:
  pgdata:
```

- [ ] **Step 2: Start it and wait for healthy**

Run:

```bash
docker compose up -d
until [ "$(docker compose ps --format '{{.Health}}' postgres)" = "healthy" ]; do sleep 1; done
docker compose ps
```

Expected: `postgres` service shows `Up ... (healthy)`.

- [ ] **Step 3: Boot the backend against it (no env vars — exercises the default)**

Run:

```bash
cd backend && uvicorn main:app --port 8001 &
sleep 5
```

Expected: uvicorn logs `Application startup complete.` with no tracebacks (startup runs `create_db()`, `run_migrations()`, and the first-boot seed against Postgres).

- [ ] **Step 4: Verify the API serves seeded data from Postgres**

Run:

```bash
curl -s http://localhost:8001/clients | head -c 300; echo
docker compose exec postgres psql -U postgres -d atelier -c "select count(*) from client;"
```

Expected: JSON array of seeded clients (non-empty), and a matching non-zero `count` from psql.

- [ ] **Step 5: Verify restart is idempotent (migrations + seed guard on existing data)**

Kill the uvicorn process from Step 3 (`kill %1` in the same shell, or kill the PID), then:

```bash
cd backend && uvicorn main:app --port 8001 &
sleep 5
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:8001/clients
```

Expected: `Application startup complete.` again with no tracebacks (all `ALTER TABLE`s hit the rollback path), HTTP `200`, and the psql `count` from Step 4 unchanged (seed did not run twice). Kill uvicorn when done.

- [ ] **Step 6: Commit**

```bash
git add docker-compose.yml
git commit -m "feat(dev): docker-compose Postgres for local development"
```

---

### Task 3: `.env.example` + deployment docs

**Files:**
- Create: `.env.example` (repo root)
- Create: `docs/deployment.md`

**Interfaces:**
- Consumes: Task 1's default-URL behavior and Task 2's compose service (documents them).
- Produces: nothing consumed by other tasks (docs only).

- [ ] **Step 1: Write `.env.example`**

```bash
# All variables are optional for local development.
# The backend does NOT auto-load this file — export vars in your shell,
# or use it as the reference for Railway service variables at release.

# Database. Unset => local docker-compose Postgres (see docker-compose.yml).
# Railway's Postgres plugin injects DATABASE_URL (postgres://...) automatically;
# the backend rewrites it to the psycopg3 dialect.
#DATABASE_URL=postgresql+psycopg://postgres:postgres@localhost:5432/atelier

# JWT signing secret. Resolution order: AUTH_SECRET, then ADMIN_TOKEN,
# then an insecure dev default. Set AUTH_SECRET in production.
#AUTH_SECRET=change-me

# Vertical pack selecting brand/config (backend/packs/*.json). Default: atelier.
#ACTIVE_PACK=atelier

# Comma-separated CORS origins. Default: http://localhost:5173.
# https://*.railway.app is always allowed via regex.
#CORS_ORIGINS=http://localhost:5173
```

- [ ] **Step 2: Write `docs/deployment.md`**

````markdown
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
````

- [ ] **Step 3: Verify docs match reality**

Run: `grep -n "postgresql+psycopg://postgres:postgres@localhost:5432/atelier" backend/database.py .env.example docs/deployment.md`
Expected: one hit in each of the three files (URLs are consistent).

- [ ] **Step 4: Commit**

```bash
git add .env.example docs/deployment.md
git commit -m "docs: .env.example and local/Railway deployment guide"
```
