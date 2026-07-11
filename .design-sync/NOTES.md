# design-sync notes

- 2026-07-11: This project is **separate from the fundcraft design system** — never reference or sync fundcraft DS assets here (explicit user instruction).
- This run is not a component-library sync: it seeds a Claude Design project with **screenshots of the running whitelabel app + a written brief** (project direction, requirements, UX goals) as design references.
- Scope chosen by user: tenant app main screens + /brief client page; desktop AND mobile viewports; pain points to emphasize: hard to read/scan, hard to navigate.
- Design scope assumption (question skipped): keep per-pack visual identity (paper/ink/accent tokens from backend/packs/*.json), improve UX/readability/navigation.
- App shape: FastAPI backend (backend/, port per backend/main.py) + Vite React frontend (frontend/, `npm run dev`). Pack selected per deployment via GET /config.
- Run recipe: `../.venv/bin/python -m uvicorn main:app --port 8000` from backend/, `VITE_API_URL=http://localhost:8000 npm run dev` from frontend/. API routes are unprefixed (`/clients`, `/config`); only brief is `/api/brief/{token}`. Brief tokens live in backend/data/intake/client_*.json (e.g. tok_aina_a3f9k2).
- Screenshot capture: the Chrome extension's resize_window does NOT change the actual viewport, and save_to_disk returns no path — use puppeteer-core headless with the system Chrome binary instead (script pattern in session scratchpad capture.mjs). Mobile shell needs viewport width < ~768.
- 2026-07-11 upload: project "PoC design" (eadc7f76-ee3b-4502-8db8-92ad8c548696) seeded with README.md, guidelines/app-brief.md, guidelines/screens/{desktop,mobile}-01..08.png (atelier pack, 1440px + 390px).
- UX findings recorded in the brief: mobile tab bar not sticky; one-tap status advance with no confirm/undo (accidentally triggered during audit — reverted via `PATCH /clients/1 {"status":"clienta"}`); screens not URL-addressable; tiny mono labels / low-contrast secondary text; 7 nav sections too many for mobile.
