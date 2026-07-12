# Client editions restructure — Design

**Date:** 2026-07-12
**Status:** Approved
**Related:** `2026-07-12-local-postgres-railway-readiness-design.md` (Postgres/compose work — separate, already specced)

## Goal

Turn the whitelabel pack system into a full "client editions" model: one core codebase,
per-tenant Docker images that bake in exactly one pack, demo data that structurally
cannot leak into a tenant deployment, and a clean home for per-tenant deployment
config. Retire the legacy file-based ops workspace (`atelier/`).

## Decisions

1. **Core + config bundles, never code forks.** All tenants run the same core image
   lineage; a tenant differs only by pack, image tag, and env.
2. **Packs stay in the core repo** (schema-coupled via `entities`), but move to the
   **repo root** (`packs/`, out of `backend/`) — required for clean Docker copies (§ Docker).
3. **Demo data lives in demo-variant packs** (`atelier-demo`, `physio-demo`), never in
   tenant packs. A tenant image contains no seed file at all, so auto-seeding an empty
   tenant DB is structurally impossible.
4. **Client data lives in the tenant's database** (Railway Postgres, backed up) — the
   system of record. No PII in any git repo.
5. **The file-based ops workspace is retired.** The app + DB supersede the markdown
   assistant prototype. `atelier/` is deleted after salvage.
6. **Per-tenant deployment manifests live in one shared private repo** (`bizz-tenants`):
   PII-free config only. Secret values live only in Railway.
7. **Default `ACTIVE_PACK` becomes `atelier-demo`** — bare local runs get the full demo;
   tenant deploys always name their pack explicitly (baked at image build).

## Pack layout

```
packs/
├── atelier/
│   └── pack.json              # tenant-safe: config only, no seed
├── atelier-demo/
│   ├── pack.json              # {"extends": "atelier"}
│   ├── seed.json              # demo clients, leads, appointments
│   └── intake/client_*.json   # demo intake fixtures (from backend/data/intake/)
├── physio/
│   └── pack.json
└── physio-demo/
    ├── pack.json              # {"extends": "physio"}
    └── seed.json
```

### `config.py`

- `get_pack()` loads `packs/<id>/pack.json`. If it declares `"extends": "<base>"`,
  load the base pack and deep-merge (extending pack's values win; dicts merge
  recursively, lists and scalars replace). **Single level only** — a base that itself
  extends is a hard error.
- The merged pack's `id` is always set to the directory name (any `id` in the JSON is
  overridden).
- New helper `pack_dir() -> Path` returns the active pack's directory, for the seed
  loader and intake routes.
- `PACKS_DIR` resolution: `PACKS_DIR` env var if set; otherwise `/app/packs` in the
  container and `<repo>/packs` in dev (first existing of the two candidate paths
  relative to `config.py`).
- `active_pack_id()` default changes `"atelier"` → `"atelier-demo"`.
- `GET /config` is unchanged — it serves the merged pack.

## Seed system

`backend/seed.py` becomes a **generic loader** with zero pack-specific content. The
current `ATELIER_SEED` / `PHYSIO_SEED` / lead seeds / `_today_appointments` move into
the demo packs' `seed.json`.

### Loader behavior

- `main.py` startup guard stays: seed only when the client table is empty. The loader
  additionally requires `seed.json` to exist in the active pack dir — **no file → no-op**.
- `seed.json` sections map to models:
  - `clients[]` — each entry: `client` kwargs plus nested `fabrics[]`, `appointments[]`,
    `payments[]`, `deliveries[]`, `notes[]` (all kwargs for the existing models;
    `custom` dicts pass through).
  - `leads[]` — kwargs for `Lead`.
  - `today_appointments[]` — appointments attached to the first client (preserves the
    current day-plan demo behavior, including booking provenance/`context`).
  - `meta.monthAbbrev` — month abbreviations used by date-display tokens (seed display
    text is locale-owned data, so it lives in the seed file, not the pack config).

### Date tokens

Relative dates (the evergreen-demo mechanism) become tokens resolved at load time,
replacing `_iso/_disp/_short/_ts` in `seed.py`:

| Token | Example | Resolves to |
|---|---|---|
| `{{iso:+25}}` | | `2026-08-06` (today + 25 days, ISO) |
| `{{disp:+25}}` | | `06 Ago 2026` (via `meta.monthAbbrev`) |
| `{{short:-40}}` | | `02 Jun` |
| `{{ts:-12 11:45}}` | | `2026-06-30T11:45:00` |
| `{{days:+25}}` | | int `25` |

- Tokens embed inside strings: `"{{short:-40}} — feta"` interpolates.
- A value that is *exactly one* token keeps its native type (`days_until` stays int).
- Absolute values remain legal — tokens are opt-in (physio seed keeps literal dates).

### Intake fixtures

`backend/data/intake/client_*.json` are demo data: move to `packs/atelier-demo/intake/`.
`routes/brief.py` and `routes/intake.py` read them via `pack_dir() / "intake"`; a
missing dir behaves like today's empty/404 path. `backend/data/` is then removed.

## Docker build

**Correction to the prior discussion:** ".dockerignore on `backend/packs/`" cannot
work — `.dockerignore` removes files from the build context entirely, so the selective
`COPY` of the active pack would have nothing to copy. Moving `packs/` to the repo root
solves it: `COPY backend/ ./` never touches packs, and an explicit copy brings in only
the selected pack.

```dockerfile
# ── Build frontend ──────────────────────────────────────────
FROM node:20-alpine AS fe-build
# ... unchanged ...

# ── Pack selection ──────────────────────────────────────────
FROM python:3.12-slim AS pack-select
ARG ACTIVE_PACK=atelier-demo
COPY packs/ /all-packs/
RUN python -c "…"   # inline one-liner: copy /all-packs/${ACTIVE_PACK} → /pack/, and,
                    # if its pack.json declares "extends", also copy that base pack

# ── Backend + serve static ──────────────────────────────────
FROM python:3.12-slim
ARG ACTIVE_PACK=atelier-demo
WORKDIR /app
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt
COPY backend/ ./                          # packs no longer under backend/
COPY --from=pack-select /pack ./packs/    # active pack (+ extends base) only
COPY --from=fe-build /app/frontend/dist ./static
ENV ACTIVE_PACK=${ACTIVE_PACK}
EXPOSE 8000
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

- The `pack-select` stage exists so `extends` resolves generically — a demo image
  needs its base pack too. Intermediate stages are not shipped, so the final image's
  layers contain exactly the packs it uses. This is **not** the copy-then-delete
  antipattern (which leaves data in earlier layers of the same image).
- Tenant build: `docker build --build-arg ACTIVE_PACK=atelier -t bizz-app:<version>-atelier .`
- A `.dockerignore` is created for junk, not pack selection: `backend/atelier.db`,
  `__pycache__`, `frontend/node_modules`, `docs/`, `.git`, test artifacts.

## Client edition = image + pack + env

A tenant deployment is fully described by:

1. **Pinned core image tag** — e.g. `bizz-app:v1.4.2-atelier` (pack baked in).
2. **Pack id** — determines schema fields, strings, theme, nav.
3. **Env** — `DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS` (values in Railway only).

The tenant's Railway Postgres is the system of record for all client data.

### `bizz-tenants` repo (new, private)

```
bizz-tenants/
├── README.md          # deploy/upgrade runbook
├── juliette.yaml
└── <tenant>.yaml
```

Each manifest holds: core image tag, pack id, Railway project ref, list of env var
**names** (never values), and any tenant-specific notes (domain, contacts). Upgrading
a tenant = one-line manifest diff + Railway redeploy. No PII, no secrets — the repo is
safe to share with any collaborator who deploys.

## Legacy migration

1. Salvage durable knowledge from `atelier/wiki/` (`workflows.md`, `intake-research/`)
   into `docs/business/`.
2. `git rm -r atelier/` — git history preserves the rest.
3. Rewrite root `CLAUDE.md` as a dev guide: architecture, pack system, seed/demo
   conventions, deploy model. The operations-assistant persona retires with the
   workspace.
4. Convert `ATELIER_SEED`/`PHYSIO_SEED`/lead seeds to `seed.json` via a one-off script
   that runs the current Python structures and emits JSON with tokens (offsets are
   already the source of truth); hand-check the token conversion, then delete the
   Python seed data and `backend/data/`.

## Testing & verification

- **Unit:** token resolver (each token type, embedded vs full-value, native-type
  preservation, invalid token → error); `extends` merge (override precedence, id from
  dir name, chained-extends error); loader no-op when `seed.json` absent.
- **Existing suite:** tests assuming default pack `atelier` set `ACTIVE_PACK`
  explicitly (pattern already used by `test_physio.py`); `reset_pack_cache()` keeps
  working.
- **End-to-end:**
  - Fresh DB + `ACTIVE_PACK=atelier-demo` → seeded state matches today's demo
    (spot-check dashboard, leads inbox, today's appointments).
  - Fresh DB + `ACTIVE_PACK=atelier` → boots **empty**.
  - `docker build --build-arg ACTIVE_PACK=atelier` → image contains `packs/atelier/`
    only, no `seed.json` anywhere (`docker run --rm <img> find packs`).
  - `docker build --build-arg ACTIVE_PACK=atelier-demo` → contains `atelier-demo/` +
    `atelier/`, boots seeded.

## Out of scope

- Shared-DB multi-tenancy (one DB per tenant stands).
- Alembic / migration tooling.
- Postgres/compose local env (specced separately, see Related).
- Actual creation of the `bizz-tenants` repo content beyond its shape (done at first
  real tenant onboarding).
