# bizz-app — whitelabel client-management app

One core codebase, whitelabeled per vertical through **packs**, deployed per
client as a pinned Docker image ("client editions"). FastAPI + SQLModel
backend (`backend/`), Vite/React frontend (`frontend/`), packs at `packs/`.

## Pack system

- `packs/<id>/pack.json` — vertical config: brand, locale, theme, strings,
  nav, features, statuses, entities (schema-coupled custom fields). Served
  merged at `GET /config`; the frontend builds theme/strings/nav/fields from
  it at runtime.
- A pack may declare `"extends": "<base>"` (single level, deep-merged, id =
  directory name). Demo packs (`atelier-demo`, `physio-demo`) extend their
  base and own the demo data: `seed.json`, `intake/` fixtures. **Tenant packs
  never carry seed data** — that is what makes demo-data leaks into client
  deployments structurally impossible.
- `ACTIVE_PACK` env selects the pack (default `atelier-demo`, so a bare local
  run gets the seeded demo). Tenant images bake exactly one pack via
  `docker build --build-arg ACTIVE_PACK=<id>`.

## Seeding

`backend/seed.py` is a generic loader for the active pack's `seed.json`;
startup seeds only when the client table is empty (see `main.py`). Seed dates
use evergreen tokens (`{{iso:+25}}`, `{{disp:-3}}`, `{{short:+2}}`,
`{{ts:-12 11:45}}`, `{{days:+25}}`) resolved against today at load time.

## Conventions

- Dates in models: ISO `YYYY-MM-DD`; display strings are pack/locale-owned.
- Tests: `cd backend && python3 -m pytest tests/ -q`. Tests needing a specific
  pack set `ACTIVE_PACK` and call `config.reset_pack_cache()` (see
  `tests/test_physio.py`).
- Never commit client PII or secret values to this repo. Client data lives in
  each tenant's database.

## Deployment

See `docs/deployment.md`. A client edition = pinned core image (pack baked
in) + env (`DATABASE_URL`, `AUTH_SECRET`, `CORS_ORIGINS`). Per-tenant
manifests live in the private `bizz-tenants` repo; secrets live only in
Railway.
