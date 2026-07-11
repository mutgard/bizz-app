# App Redesign v1 (3-tab IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure the whitelabel frontend to the approved redesign: URL routing, a 3-tab mobile IA (Avui · Clientes · Materials), a 4-section receptionist desktop (＋ Agenda week view), with Agenda/Finances/Ingrés folded into the new "Avui" home and safe (confirm + undo) state changes.

**Architecture:** Frontend restructure of `frontend/` (React 19 + Vite + Tailwind tokens-in-JS via `T`), keeping the existing FastAPI API and adding two small backend pieces (a `Note` model for the interaction log; a computed `GET /todos` queue). Navigation stays pack-driven: the pack JSON declares sections, the code declares screens. Old sections (Teles, Per comprar, Agenda-as-nav, Ingrés, Finances) collapse per the design docs.

**Design sources (read before starting, they carry the rationale):**
- `docs/design/proposal-v1.html` — mobile mockups (open in a browser)
- `docs/design/proposal-v1-desktop.html` — desktop mockups
- `docs/design/app-brief.md` — product context and constraints

**Tech Stack:** React 19, TypeScript, Vite, react-router-dom v7, Radix (alert-dialog/dialog/popover already installed), vitest (added in Task 1), FastAPI + SQLModel + pytest (backend).

## Global Constraints

- **Pack-driven everything**: colors/fonts/strings/statuses/nav come from `GET /config` (`backend/packs/atelier.json`, `physio.json`). Zero hardcoded brand values or Catalan strings in components — always `t('key')` and `T`/pack tokens. Every UI task must be spot-checked with `ACTIVE_PACK=physio`.
- **Desktop = receptionist workstation**: dense (≈44px rows), keyboard-first, visible actions. **Mobile = owner between fittings**: big type, thumb-reachable, calm.
- **Safe actions**: no bare one-tap irreversible action; status changes and deletes go through `ConfirmSheet` (Task 5) with a ~10s undo.
- **Run commands** — backend: `cd backend && ../.venv/bin/python -m uvicorn main:app --port 8000`; frontend: `cd frontend && VITE_API_URL=http://localhost:8000 npm run dev`; backend tests: `cd backend && ../.venv/bin/python -m pytest tests/ -q`; frontend typecheck+build: `cd frontend && npm run build`; frontend unit tests: `cd frontend && npx vitest run`.
- **Per-phase review**: after each task's final commit, the coordinating session dispatches an Opus review agent on the task's diff before starting the next task (user's standing workflow).
- Commit after every green step; message prefix `feat(redesign):` / `test(redesign):` / `refactor(redesign):`.
- **Stage explicitly** (`git add <paths you touched>`), never `git add -A` — a parallel design session shares this working tree (`.design-sync/`, `docs/design/`).
- The existing seed DB may hold demo data; `backend/atelier.db` (SQLite) is recreated by seed when empty — never hand-edit it.

---

### Task 1: Frontend unit-test infra (vitest)

**Files:**
- Modify: `frontend/package.json` (devDependency + script)
- Create: `frontend/vitest.config.ts`
- Create: `frontend/src/lib/__tests__/smoke.test.ts`

**Interfaces:**
- Produces: `npm run test:unit` (alias for `vitest run`) used by every later task.

- [ ] **Step 1: Install vitest**

```bash
cd frontend && npm i -D vitest
```

- [ ] **Step 2: Create `frontend/vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'node',
  },
});
```

- [ ] **Step 3: Add script to `frontend/package.json`** — in `"scripts"`, add `"test:unit": "vitest run"`.

- [ ] **Step 4: Write smoke test `frontend/src/lib/__tests__/smoke.test.ts`**

```ts
import { describe, it, expect } from 'vitest';

describe('vitest wiring', () => {
  it('runs', () => { expect(1 + 1).toBe(2); });
});
```

- [ ] **Step 5: Run and verify** — `cd frontend && npm run test:unit` → 1 passed. Then `npm run build` → clean.

- [ ] **Step 6: Commit** — `git add frontend && git commit -m "test(redesign): add vitest unit-test infra"`

---

### Task 2: URL routing foundation (no visual change)

Replaces the state-only `Screen` switching in `frontend/src/App.tsx:20-99` with react-router-dom. All existing screens stay mounted 1:1; deep links and browser back start working.

**Files:**
- Modify: `frontend/package.json` (add `react-router-dom@^7`)
- Create: `frontend/src/routes.ts`
- Create: `frontend/src/lib/__tests__/routes.test.ts`
- Modify: `frontend/src/App.tsx` (full rewrite of `AtelierApp` into route components)
- Modify: `frontend/src/main.tsx` (wrap in `<BrowserRouter>`)

**Interfaces:**
- Produces: `pathForScreen(screen: string): string` and `SCREEN_PATHS: Record<string, string>` from `frontend/src/routes.ts`. Route table: `/` (redirect → `/clients` until Task 8), `/clients`, `/clients/:id`, `/fabrics`, `/shop`, `/agenda`, `/intake`, `/caixa`, `/brief/:token`, `/admin`. Old `finances` screen key maps to `/caixa`, `roadmap` → `/agenda`.
- Consumes: existing screens/components unchanged; `Sidebar`/`MobileHeader` keep their `onNav(screen)` signature — App adapts it to `navigate(pathForScreen(screen))`.

- [ ] **Step 1: Install** — `cd frontend && npm i react-router-dom`

- [ ] **Step 2: Write failing test `frontend/src/lib/__tests__/routes.test.ts`**

```ts
import { describe, it, expect } from 'vitest';
import { pathForScreen } from '../../routes';

describe('pathForScreen', () => {
  it('maps legacy screen keys to paths', () => {
    expect(pathForScreen('clients')).toBe('/clients');
    expect(pathForScreen('roadmap')).toBe('/agenda');
    expect(pathForScreen('finances')).toBe('/caixa');
    expect(pathForScreen('today')).toBe('/');
  });
  it('falls back to /clients for unknown keys', () => {
    expect(pathForScreen('nope')).toBe('/clients');
  });
});
```

Run: `npx vitest run src/lib/__tests__/routes.test.ts` → FAIL (module not found).

- [ ] **Step 3: Create `frontend/src/routes.ts`**

```ts
export const SCREEN_PATHS: Record<string, string> = {
  today: '/',
  clients: '/clients',
  profile: '/clients',      // sub-screen; row click appends /:id
  fabrics: '/fabrics',      // legacy — collapses into /materials in Task 3
  shop: '/shop',            // legacy — collapses into /materials in Task 3
  materials: '/materials',
  roadmap: '/agenda',
  agenda: '/agenda',
  intake: '/intake',
  finances: '/caixa',
  caixa: '/caixa',
};

export function pathForScreen(screen: string): string {
  return SCREEN_PATHS[screen] ?? '/clients';
}
```

- [ ] **Step 4: Verify test passes** — `npx vitest run src/lib/__tests__/routes.test.ts` → PASS.

- [ ] **Step 5: Rewrite `frontend/src/App.tsx`** — keep the `/brief/` and `/admin` early returns; convert `AtelierApp` to routes. Shape (complete except unchanged imports):

```tsx
// App.tsx — routing shell. Screens receive the same props as before.
import { Routes, Route, Navigate, useNavigate, useParams } from 'react-router-dom';
import { pathForScreen } from './routes';
// ...existing screen imports stay...

export default function App() {
  const pathname = window.location.pathname;
  if (pathname.startsWith('/brief/')) return <BriefPage token={pathname.slice('/brief/'.length)} />;
  if (pathname === '/admin') return <AdminPage />;
  return <AtelierApp />;
}

function AtelierApp() {
  const mobile = useIsMobile();
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [creating, setCreating] = useState(false);
  const refresh = () => api.listClients().then(setClients);
  useEffect(() => { refresh(); }, []);

  const fabricsToBuy = clients.flatMap(c => c.fabrics).filter(f => f.to_buy).length;
  const counts: Record<string, number> = {
    totalClients: clients.length,
    totalFabrics: clients.flatMap(c => c.fabrics).length,
    fabricsToBuy,
  };
  const nav = (s: string) => { setCreating(false); navigate(pathForScreen(s)); };
  const openClient = (id: number) => navigate(`/clients/${id}`);
  const handleCreateSuccess = (id: number) => { setCreating(false); refresh().then(() => openClient(id)); };

  const routes = (
    <Routes>
      <Route path="/" element={<Navigate to="/clients" replace />} />
      <Route path="/clients" element={
        creating && mobile
          ? <NewClientScreen onCancel={() => setCreating(false)} onSuccess={handleCreateSuccess} />
          : <ClientsScreen clients={clients} onOpen={openClient} onCreate={() => setCreating(true)} />
      } />
      <Route path="/clients/:id" element={<ProfileRoute clients={clients} onRefresh={refresh} />} />
      {featureOn('fabrics') && <Route path="/fabrics" element={<FabricsScreen clients={clients} onRefresh={refresh} />} />}
      {featureOn('shopping') && <Route path="/shop" element={<ShoppingScreen clients={clients} />} />}
      <Route path="/agenda" element={<RoadmapScreen clients={clients} onRefresh={refresh} />} />
      {featureOn('intake') && <Route path="/intake" element={
        <InboxScreen onClientCreated={(id) => refresh().then(() => openClient(id))} onOpenClient={openClient} />
      } />}
      <Route path="/caixa" element={<FinancesScreen clients={clients} onOpen={openClient} />} />
      <Route path="*" element={<Navigate to="/clients" replace />} />
    </Routes>
  );
  // ...unchanged mobile/desktop shells from the old file, with `content` → `routes`,
  // active screen for Sidebar/MobileHeader derived from location:
  // const active = screenForPath(useLocation().pathname)  — inline helper below.
}

function ProfileRoute({ clients, onRefresh }: { clients: Client[]; onRefresh: () => Promise<void> }) {
  const { id } = useParams();
  const navigate = useNavigate();
  const client = clients.find(c => c.id === Number(id));
  if (!clients.length) return null;              // still loading
  if (!client) return <Navigate to="/clients" replace />;
  return (
    <ProfileScreen client={client} onBack={() => navigate('/clients')}
      onOpenFabrics={() => navigate('/fabrics')} onRefresh={onRefresh} allClients={clients} />
  );
}
```

Also add to `routes.ts` (and cover in the Step 2 test file with 2 more asserts):

```ts
export function screenForPath(pathname: string): string {
  if (pathname.startsWith('/clients')) return 'clients';
  const hit = Object.entries(SCREEN_PATHS).find(([k, v]) => v === pathname && k !== 'profile');
  return hit ? hit[0] : 'clients';
}
```

- [ ] **Step 6: Wrap router in `frontend/src/main.tsx`** — import `BrowserRouter` from `react-router-dom` and wrap `<App />`.

- [ ] **Step 7: Verify** — `npm run build` clean; `npx vitest run` green; runtime: open `http://localhost:5173/clients/1` directly → Aina's profile renders; browser back returns to wherever you were; sidebar/tab nav still works on both viewports.

- [ ] **Step 8: Commit** — `git commit -m "feat(redesign): URL routing foundation with react-router"`

---

### Task 3: Pack nav rework — 3 mobile tabs / 4 desktop sections

**Files:**
- Modify: `backend/packs/atelier.json` (`nav`, `strings`)
- Modify: `backend/packs/physio.json` (same shape, physio wording)
- Modify: `frontend/src/config.ts:35-49` (`PackNavItem` + `navItems`)
- Modify: `frontend/src/routes.ts` (drop `fabrics`/`shop` paths → `/materials`)
- Create: `frontend/src/screens/TodayScreen.tsx` (placeholder shell)
- Create: `frontend/src/screens/MaterialsScreen.tsx` (segmented wrapper around existing Fabrics/Shopping screens)
- Modify: `frontend/src/App.tsx` (routes for `/`, `/materials`; remove `/fabrics`, `/shop`)
- Test: `backend/tests/test_config.py` (adjust nav assertions), `frontend/src/lib/__tests__/routes.test.ts`

**Interfaces:**
- Produces: nav config shape `{screen, labelKey, mobileLabelKey?, countKey?, feature?, sub?, desktopOnly?}`; `navItems(opts?: { mobile?: boolean })` filters `desktopOnly` items when `opts.mobile`. New screen keys: `today`, `materials`, `agenda`.
- New string keys both packs MUST define: `nav.today`, `nav.materials`, `nav.agenda`, `materials.toBuyTab`, `materials.inventoryTab`, `avui.greeting`, `avui.todaySection`, `avui.urgentSection`, `avui.glanceSection`, `avui.inboxSection`, `avui.caixaSection`, `avui.todo`, `caixa.title` (translate per pack locale; atelier Catalan, physio English — follow each pack's existing string style).

- [ ] **Step 1: New nav arrays.** Atelier `nav` becomes:

```json
[
  {"screen": "today",     "labelKey": "nav.today",     "countKey": "todosOpen"},
  {"screen": "clients",   "labelKey": "nav.clients",   "countKey": "totalClients"},
  {"screen": "profile",   "labelKey": "nav.profile",   "sub": true},
  {"screen": "materials", "labelKey": "nav.materials", "feature": "fabrics", "accent": true, "countKey": "fabricsToBuy"},
  {"screen": "agenda",    "labelKey": "nav.agenda",    "desktopOnly": true}
]
```

Physio: same array (own `labelKey` translations; physio has no fabrics feature → `materials` item drops automatically via the existing feature filter — verify `physio.json` `features`; if `fabrics` is false there, mobile physio gets 2 tabs, which is correct behavior, not a bug).

- [ ] **Step 2: `config.ts`** — add `desktopOnly?: boolean` to `PackNavItem` (after line 42) and change `navItems()`:

```ts
export function navItems(opts?: { mobile?: boolean }): ResolvedNavItem[] {
  const pack = getPack();
  return pack.nav
    .map((it, i) => ({ ...it, label: t(it.labelKey), mobileLabel: t(it.mobileLabelKey ?? it.labelKey), n: String(i + 1).padStart(2, '0') }))
    .filter(it => !it.feature || featureOn(it.feature))
    .filter(it => !(opts?.mobile && it.desktopOnly));
}
```

Callers: `Sidebar.tsx:14` → `navItems()`; `MobileShell.tsx:15` → `navItems({ mobile: true }).filter(it => !it.sub)`.

- [ ] **Step 3: Placeholder screens.**

`frontend/src/screens/TodayScreen.tsx` (replaced in Task 8 — minimal now):

```tsx
import { T } from '../tokens';
import { Serif } from '../components/primitives';
import { t } from '../config';

export function TodayScreen() {
  return (
    <div style={{ padding: 32 }}>
      <Serif size={32} italic>{t('nav.today')}</Serif>
      <div style={{ marginTop: 8, fontFamily: T.mono, fontSize: 11, color: T.ink3 }}>—</div>
    </div>
  );
}
```

`frontend/src/screens/MaterialsScreen.tsx` — a segmented wrapper so `/materials` works today (rebuilt in Task 11):

```tsx
import { useState } from 'react';
import type { Client } from '../types';
import { T } from '../tokens';
import { t } from '../config';
import { FabricsScreen } from './FabricsScreen';
import { ShoppingScreen } from './ShoppingScreen';

export function MaterialsScreen({ clients, onRefresh }: { clients: Client[]; onRefresh: () => Promise<void> }) {
  const [view, setView] = useState<'buy' | 'inventory'>('buy');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '12px 20px 0' }}>
        {(['buy', 'inventory'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
            padding: '8px 14px', border: 'none', cursor: 'pointer',
            background: view === v ? T.ink : 'transparent', color: view === v ? T.paper : T.ink3, borderRadius: 999,
          }}>{t(v === 'buy' ? 'materials.toBuyTab' : 'materials.inventoryTab')}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'buy' ? <ShoppingScreen clients={clients} /> : <FabricsScreen clients={clients} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Routes** — in `routes.ts` set `fabrics: '/materials'`, `shop: '/materials'`; in `App.tsx` replace the two routes with `{featureOn('fabrics') && <Route path="/materials" element={<MaterialsScreen clients={clients} onRefresh={refresh} />} />}` and `/` now renders `<TodayScreen />` (drop the redirect). Update `routes.test.ts` expectations accordingly.

- [ ] **Step 5: Backend config test** — run `cd backend && ../.venv/bin/python -m pytest tests/test_config.py -q`; if it asserts the old nav, update assertions to the new arrays (nav length 5 for atelier, screens `today/clients/profile/materials/agenda`).

- [ ] **Step 6: Verify runtime, both packs** — atelier: mobile strip shows Avui·Clientes·Materials (Agenda absent), desktop sidebar shows all 5 minus sub; `ACTIVE_PACK=physio ../.venv/bin/python -m uvicorn main:app --port 8000` → physio labels render, no missing-string keys visible (a raw `nav.today` on screen = missing string). `npm run build` + `npx vitest run` green. Backend tests green.

- [ ] **Step 7: Commit** — `git commit -m "feat(redesign): pack-driven 3-tab/4-section nav, materials merge shell"`

---

### Task 4: New shells — mobile bottom tab bar + desktop top bar

Replaces `MobileHeader`'s top tab strip with a bottom bar, and the desktop `Sidebar` with the compact 46px top bar (design: desktop proposal §Avui annotations).

**Files:**
- Create: `frontend/src/components/BottomTabBar.tsx`
- Create: `frontend/src/components/TopBar.tsx`
- Modify: `frontend/src/App.tsx` (shells)
- Modify: `frontend/src/components/MobileShell.tsx` (brand-only header; drop tab strip)
- Delete: `frontend/src/components/TabBar.tsx` (dead legacy), `frontend/src/components/Sidebar.tsx` (after TopBar lands)

**Interfaces:**
- Consumes: `navItems({mobile})` (Task 3), `pathForScreen`/`screenForPath` (Task 2), `usePack()`, `counts` from App.
- Produces: `<BottomTabBar active onNav counts />` and `<TopBar active onNav counts onNewClient />` — same `onNav(screen)` contract as before. TopBar renders brand wordmark, nav pills, a search slot (`children` prop, filled in Task 10), and a gold "+ Nova" button calling `onNewClient`.

- [ ] **Step 1: `BottomTabBar.tsx`** — pack-driven port of the mock (mobile proposal, any phone's bottom bar). Real code:

```tsx
import { T } from '../tokens';
import { navItems } from '../config';

const ICONS: Record<string, JSX.Element> = {
  today:     <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M3 11.5 12 4l9 7.5"/><path d="M5.5 10v9h13v-9"/></svg>,
  clients:   <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><circle cx="12" cy="8" r="3.4"/><path d="M5 20c1.2-3.6 4-5.4 7-5.4s5.8 1.8 7 5.4"/></svg>,
  materials: <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round"><path d="M4 7h16v13H4z"/><path d="M4 7l2.5-3h11L20 7"/><path d="M9.5 11h5"/></svg>,
};

export function BottomTabBar({ active, onNav, counts }: {
  active: string; onNav: (s: string) => void; counts: Record<string, number>;
}) {
  const tabs = navItems({ mobile: true }).filter(it => !it.sub);
  return (
    <nav style={{
      display: 'flex', flexShrink: 0, borderTop: `1px solid ${T.hairline}`,
      background: T.sheet, padding: '8px 6px calc(8px + env(safe-area-inset-bottom))',
    }}>
      {tabs.map(it => {
        const on = it.screen === active || (active === 'profile' && it.screen === 'clients');
        const count = it.accent && it.countKey ? counts[it.countKey] : undefined;
        return (
          <button key={it.screen} onClick={() => onNav(it.screen)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
            background: 'none', border: 'none', cursor: 'pointer', padding: '4px 0',
            color: on ? T.accent : T.ink3, position: 'relative',
          }}>
            {ICONS[it.screen] ?? ICONS.clients}
            <span style={{ fontFamily: T.sans, fontSize: 10, fontWeight: 600, position: 'relative' }}>
              {it.mobileLabel}
              {count !== undefined && count > 0 && (
                <span style={{ position: 'absolute', top: -6, right: -14, background: T.gold, color: T.ink, fontFamily: T.mono, fontSize: 8, padding: '1px 5px', borderRadius: 999 }}>{count}</span>
              )}
              {on && <span style={{ position: 'absolute', left: '15%', right: '15%', bottom: -5, height: 2, background: T.gold, borderRadius: 2 }} />}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
```

- [ ] **Step 2: `TopBar.tsx`** — port of the desktop mock's `.topbar` (46px, ink background, wordmark, pill nav with counts, search slot, gold + Nova). Use `navItems().filter(it => !it.sub)`; active pill = `rgba(246,241,232,0.14)` background; counts in gold mono. Accept `children` rendered between nav and the button (search mounts here in Task 10). `+ Nova` label: reuse existing string `t('clients.new')` if present in packs, else add `common.new` to both packs.

- [ ] **Step 3: Wire shells in `App.tsx`** — mobile: `<MobileHeader>` (brand row only — remove the tab strip block, `MobileShell.tsx:28-47`) on top, `routes` in the middle, `<BottomTabBar active={active} onNav={nav} counts={counts} />` at the bottom of the flex column. Desktop: replace the `232px 1fr` grid with a column: `<TopBar active={active} onNav={nav} counts={counts} onNewClient={() => setCreating(true)} />` + content. Delete `Sidebar.tsx` and `TabBar.tsx`; keep the operator `/admin` link — move it into TopBar's right side (same `useIsOperator()` gate, see `Sidebar.tsx:80-85`).

- [ ] **Step 4: Verify** — `npm run build`; runtime both viewports: bottom bar persistent while scrolling a long client list (the core bug this fixes); desktop nav switches sections; physio pack spot-check. `npx vitest run` green.

- [ ] **Step 5: Commit** — `git commit -m "feat(redesign): bottom tab bar (mobile) and compact top bar (desktop)"`

---

### Task 5: Shared primitives — StatusChip, SegmentedControl, ConfirmSheet + undo

**Files:**
- Create: `frontend/src/components/StatusChip.tsx`
- Create: `frontend/src/components/SegmentedControl.tsx`
- Create: `frontend/src/components/ConfirmSheet.tsx`
- Create: `frontend/src/hooks/useUndoable.ts`
- Test: `frontend/src/hooks/__tests__/useUndoable.test.ts`

**Interfaces:**
- Produces:
  - `<StatusChip statusKey={string} />` — solid color-coded chip from `statusByKey(key)` (pack `bg/bd/fg/dot/dash`); dashed border when `dash`, solid fill otherwise. Small caps mono, 10.5px.
  - `<SegmentedControl options={{key,label}[]} value onChange />` — the pill toggle from the mocks.
  - `<ConfirmSheet open title body confirmLabel onConfirm onCancel />` — Radix AlertDialog on desktop, bottom-sheet styling on mobile (via `useIsMobile`). Confirm button uses `T.accent`.
  - `useUndoable(action: () => Promise<void>, undo: () => Promise<void>, ms = 10000)` returns `{ fire, undoNow, pending }`: `fire()` runs `action` immediately and opens an undo window; calling `undoNow()` within `ms` runs `undo`. (Optimistic-with-undo — simpler and safer than delayed commit, and the API change is already applied if the app closes.)
- Consumes: `statusByKey` from `config.ts:120`, Radix `@radix-ui/react-alert-dialog` (installed).

- [ ] **Step 1: Failing test `useUndoable.test.ts`**

```ts
import { describe, it, expect, vi } from 'vitest';
import { makeUndoable } from '../useUndoable';

describe('makeUndoable core', () => {
  it('runs action immediately and allows undo within window', async () => {
    vi.useFakeTimers();
    const action = vi.fn().mockResolvedValue(undefined);
    const undo = vi.fn().mockResolvedValue(undefined);
    const u = makeUndoable(action, undo, 10000);
    await u.fire();
    expect(action).toHaveBeenCalledOnce();
    expect(u.pending()).toBe(true);
    await u.undoNow();
    expect(undo).toHaveBeenCalledOnce();
    expect(u.pending()).toBe(false);
    vi.useRealTimers();
  });
  it('closes the window after the timeout', async () => {
    vi.useFakeTimers();
    const u = makeUndoable(async () => {}, async () => {}, 10000);
    await u.fire();
    vi.advanceTimersByTime(10001);
    expect(u.pending()).toBe(false);
    vi.useRealTimers();
  });
});
```

Run → FAIL (module not found).

- [ ] **Step 2: Implement `useUndoable.ts`** — a framework-free core (`makeUndoable`) + a thin React hook wrapper (`useUndoable`) that mirrors `pending` into state so components re-render; hook also exposes `UndoToast` — a fixed-position pill ("Fet · Desfés" → labels via `t('common.done')`/`t('common.undo')`, add both strings to both packs) shown while pending.

- [ ] **Step 3: Test green** — `npx vitest run` → both tests pass.

- [ ] **Step 4: Implement the three components** (visual spec: mobile proposal Fitxa sheet; desktop `.ra` buttons). No tests — verified at first use (Task 8+). Build clean.

- [ ] **Step 5: Adopt StatusChip immediately** in `ClientsScreen.tsx` and `ProfileScreen.tsx` wherever the old `T.badge` map is used (`tokens.ts:29-34` stays for now; delete in Task 14). Verify chips render identically-or-better on both packs.

- [ ] **Step 6: Commit** — `git commit -m "feat(redesign): StatusChip, SegmentedControl, ConfirmSheet, undoable actions"`

---

### Task 6: Backend — Note model + routes (interaction log)

**Files:**
- Modify: `backend/models.py` (add `Note`)
- Create: `backend/routes/notes.py`
- Modify: `backend/main.py` (include router)
- Test: `backend/tests/test_notes.py`

**Interfaces:**
- Produces: `Note {id, client_id, ts (ISO str), text}`; `POST /notes {client_id, text}` → 201 note; `GET /clients/{id}/notes` → newest-first list; `DELETE /notes/{id}` → 204. Frontend api additions (Task 8/13): `api.listNotes(clientId)`, `api.createNote({client_id, text})`.

- [ ] **Step 1: Failing tests `backend/tests/test_notes.py`** (mirror the style of `backend/tests/test_payments.py` — same fixtures/client setup):

```python
def test_create_and_list_note(client, seeded_client_id):
    r = client.post("/notes", json={"client_id": seeded_client_id, "text": "Truca: vol moure la prova"})
    assert r.status_code == 201
    note = r.json()
    assert note["text"].startswith("Truca")
    r = client.get(f"/clients/{seeded_client_id}/notes")
    assert r.status_code == 200
    assert r.json()[0]["id"] == note["id"]

def test_note_requires_existing_client(client):
    r = client.post("/notes", json={"client_id": 99999, "text": "x"})
    assert r.status_code == 404

def test_delete_note(client, seeded_client_id):
    nid = client.post("/notes", json={"client_id": seeded_client_id, "text": "t"}).json()["id"]
    assert client.delete(f"/notes/{nid}").status_code == 204
```

(Adapt fixture names to what `test_payments.py` actually uses — copy its imports/fixtures verbatim.) Run → FAIL.

- [ ] **Step 2: Implement.** `models.py`:

```python
class Note(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    client_id: int = Field(foreign_key="client.id", index=True)
    ts: str = Field(default_factory=lambda: datetime.now().isoformat(timespec="seconds"))
    text: str
```

`routes/notes.py`: APIRouter (no prefix, matching siblings) with the three endpoints; 404 when client missing; list ordered by `ts` desc. Register in `main.py` next to `payments_router`. Add the table to `create_db`/migrations the same way the newest existing model did (check `database.py:run_migrations` for the pattern).

- [ ] **Step 3: Green** — `../.venv/bin/python -m pytest tests/test_notes.py -q` → pass; full suite still green.

- [ ] **Step 4: Commit** — `git commit -m "feat(redesign): Note model + /notes routes for interaction log"`

---

### Task 7: Backend — GET /todos work queue

**Files:**
- Create: `backend/routes/todos.py`
- Modify: `backend/main.py` (include router)
- Test: `backend/tests/test_todos.py`

**Interfaces:**
- Produces: `GET /todos` → `[{type, client_id, client_name, detail, days_until}]`, pack-agnostic rules:
  1. `schedule_fitting`: client whose `days_until` is 0–45, status not terminal (`terminal` flag from pack statuses via `config.get_pack()`), and no appointment row containing a future ISO date — keep it simple: no `Appointment` rows at all with `value` ≥ today (appointments store display strings; parse ISO from `Client.wedding_date_iso` era format only if present, otherwise fall back to "has zero appointments").
  2. `collect_deposit`: client with `priceTotal > 0` and `paid == 0` (parse the same way the frontend's `parsePayments` does — port the minimal parsing: a payment row whose `value` contains the pack's `paidKeyword` counts as paid) and status not terminal.
  3. `review_lead`: one entry per open `Lead`.
- Sorted: `schedule_fitting` by `days_until` asc, then `collect_deposit`, then `review_lead`.

- [ ] **Step 1: Failing tests** — seed via the API in-test (create client with near key date and no appointments → expect `schedule_fitting`; create client + payment marked paid → NOT in `collect_deposit`; create open lead → `review_lead` present). 4 tests. Run → FAIL.

- [ ] **Step 2: Implement `routes/todos.py`** — single GET, no new tables; read `get_pack()["statuses"]["client"]` for terminal keys and `get_pack()["locale"]["paidKeyword"]`. Keep the whole route under ~80 lines.

- [ ] **Step 3: Green** — `pytest tests/test_todos.py -q`; full suite green; also `ACTIVE_PACK=physio pytest tests/ -q` (there is precedent: `test_physio.py`).

- [ ] **Step 4: Commit** — `git commit -m "feat(redesign): GET /todos derived work queue"`

---

### Task 8: Avui — mobile home (timeline + inbox + caixa)

Design: mobile proposal sections 1 ("Avui") and 5 ("Avui ampliat") — the shipped screen is those two merged: greeting + urgent card, then day-grouped timeline, intake inbox card, caixa summary.

**Files:**
- Create: `frontend/src/lib/timeline.ts` + `frontend/src/lib/__tests__/timeline.test.ts`
- Create: `frontend/src/lib/finance.ts` (move `buildFinances` out of `FinancesScreen.tsx:22-33`) + `frontend/src/lib/__tests__/finance.test.ts`
- Rewrite: `frontend/src/screens/TodayScreen.tsx`
- Modify: `frontend/src/api.ts` (add `listNotes`, `createNote`, `getTodos`)
- Modify: `frontend/src/screens/FinancesScreen.tsx` (import `buildFinances` from lib)

**Interfaces:**
- Produces: `groupEventsByDay(events: AtelierEvent[], locale: Pack['locale']): { dayLabel: string; iso: string; isToday: boolean; events: AtelierEvent[] }[]` (sorted asc, empty days omitted); `buildFinances(clients)` (exact current shape, exported); `api.getTodos(): Promise<Todo[]>` with `Todo` added to `types.ts`.
- Consumes: `api.listEvents(from, to)` (`api.ts:55`), `api.listLeads('open')`, `StatusChip`, strings from Task 3.

- [ ] **Step 1: Failing tests.** `timeline.test.ts`: three events across two days (one today) → 2 groups, today first flagged `isToday`, day labels use `locale.dayNames`/`monthNames`; empty input → `[]`. `finance.test.ts`: port one representative expectation for `buildFinances` using a stub client with payments (copy a realistic payments array shape from `backend/seed.py`). Run → FAIL.

- [ ] **Step 2: Implement libs; green.** Move `buildFinances` (and its `ClientFinance` interface) to `lib/finance.ts`; re-import in `FinancesScreen`. `npx vitest run` green; `npm run build` green.

- [ ] **Step 3: Rewrite `TodayScreen.tsx`.** Props: `{ clients, onOpenClient }` (wire in App). Data: `useEffect` fetching `api.listEvents(todayISO, +30d)`, `api.listLeads('open')`; caixa from `buildFinances(clients)`. Layout top→bottom (all styling from `T`, all copy via `t()`):
  1. Greeting: `t('avui.greeting')` + `brand.userName` first name, serif 32; sub-line with `{fittings this week} · {nearest key date}` counts.
  2. Urgent card (`avui.urgentSection`): client with smallest positive `days_until` and outstanding > 0 → name, big days count in `T.accent`, outstanding; tap → `onOpenClient`.
  3. Timeline (`avui.todaySection`): `groupEventsByDay` render — day header row (mono, uppercase, accent when today), event rows (time, title, client), event tap → client profile when `client_id` present.
  4. Inbox card (`avui.inboxSection`, only when leads.length > 0): lead name, ago, preview; tap → navigate `/intake` (InboxScreen remains the detail surface).
  5. Caixa card (`avui.caixaSection`): cobrat-mes / pendent / % with progress bar (reuse the bar pattern from `FinancesScreen.tsx:73-76`); tap → `/caixa`.
- [ ] **Step 4: Verify runtime** — mobile viewport: `/` shows all five blocks with seed data; event tap opens profile; lead card opens inbox; physio spot-check (no fabrics strings leak). Desktop `/` also renders this screen for now (replaced next task).

- [ ] **Step 5: Commit** — `git commit -m "feat(redesign): Avui mobile home — timeline, inbox, caixa"`

---

### Task 9: Avui — desktop work-queue variant + RegisterPaymentSheet

Design: desktop proposal §1. Same route `/`, `useIsMobile()` picks the variant.

**Files:**
- Create: `frontend/src/screens/TodayDeskScreen.tsx`
- Create: `frontend/src/components/RegisterPaymentSheet.tsx`
- Modify: `frontend/src/screens/TodayScreen.tsx` (delegate: `if (!mobile) return <TodayDeskScreen …/>`)

**Interfaces:**
- Produces: `<RegisterPaymentSheet client open onClose onSaved />` — dialog with amount input **pre-filled with the outstanding balance** (`buildFinances`), label defaulting to `t('finances.paymentLabel')` (add string both packs); submit → `api.createPayment({client_id, label, value})` matching the value format `parsePayments` reads (inspect `frontend/src/lib/clientHelpers.ts` and mirror exactly — e.g. `"€500 · rebut"`), then `onSaved()` → refresh.
- Consumes: `api.getTodos()`, `groupEventsByDay`, `buildFinances`, `api.createNote`, `ConfirmSheet`/`useUndoable` (delete-note undo not needed; used from Task 13).

- [ ] **Step 1: Build `TodayDeskScreen`** — grid per mock: stats strip (4 tiles: today's event count, pendent € in accent, materials-to-buy count, key dates < 45), two columns: left = "Cites d'avui" dense table (rows: time, title, client + StatusChip, row actions: Fitxa → profile) + "Per fer" table from `api.getTodos()` (row actions per type: `schedule_fitting` → "+ Cita" (opens existing `EventDialog` — check its props in `frontend/src/components/EventDialog.tsx` and reuse), `collect_deposit` → WhatsApp link (`https://wa.me/${phone}`), `review_lead` → navigate `/intake`); right = "Cobraments pendents" (top-3 outstanding from `buildFinances`, Registrar button → `RegisterPaymentSheet`) + "Registrar interacció" box (client picker `<select>` over clients + text input + Desa → `api.createNote`).
- [ ] **Step 2: Table row density** — rows ≈44px, labels mono 10px uppercase `T.ink3`, numerics `fontVariantNumeric: 'tabular-nums'` right-aligned. Only `T.accent` (money/urgency) and `T.gold` (commercial risk) carry color.
- [ ] **Step 3: Verify runtime** — desktop `/`: register a payment on a seed client → outstanding drops everywhere (Avui tile, /caixa); log an interaction → `GET /clients/{id}/notes` shows it (curl); todos rows render with working actions. `npm run build` green.
- [ ] **Step 4: Commit** — `git commit -m "feat(redesign): Avui desktop work queue + register-payment sheet"`

---

### Task 10: Clientes — mobile cards, desktop dense table, ⌘K search, keyboard nav

Design: mobile proposal §2, desktop proposal §2.

**Files:**
- Create: `frontend/src/lib/search.ts` + `frontend/src/lib/__tests__/search.test.ts`
- Rewrite: `frontend/src/screens/ClientsScreen.tsx`
- Create: `frontend/src/components/GlobalSearch.tsx` (mounted in TopBar's slot)
- Modify: `frontend/src/components/TopBar.tsx` (render `<GlobalSearch clients onOpen />` via new props)

**Interfaces:**
- Produces: `searchClients(clients: Client[], q: string): Client[]` — case/diacritic-insensitive match on `name`, `phone` (digits-only compare), `garment`; empty q → all. `<GlobalSearch>`: input in TopBar, ⌘K/Ctrl-K focuses it, typing filters a dropdown of matches, ↑↓ moves selection, Enter navigates to `/clients/:id`, Esc clears.
- Consumes: `StatusChip`, `useUndoable` not needed here.

- [ ] **Step 1: Failing tests `search.test.ts`** — "ber" matches "Berta Soler"; "639421805" and "639 42 18 05" both match Aina's phone; "sirena" matches by garment; diacritics: "nuria" matches "Núria". Run → FAIL.
- [ ] **Step 2: Implement `search.ts`; green.** (normalize: `s.normalize('NFD').replace(/\p{Diacritic}/gu,'').toLowerCase()`; phones compare on `\D`-stripped strings.)
- [ ] **Step 3: Rewrite `ClientsScreen`** — mobile: card list per mock (serif 18 name, StatusChip + outstanding € in accent when > 0, right column big days number — accent < 45 — with small date; terminal-status clients `opacity: .55` and sorted last). Desktop: dense table (columns: Clienta+phone sub-line, pack `listFields()` columns as today, Estat chip, Boda (muted), Dies (big serif, accent <45), Pendent (accent, `—` when none), row-actions cell shown on the keyboard-selected/hovered row: Fitxa, WhatsApp, +Cita). Keyboard: table listens for ↑↓/Enter when GlobalSearch is not focused; selected row `background: T.paper2` with 3px accent inset on first cell. Keep the status filter chips (larger targets, per mock).
- [ ] **Step 4: Verify runtime** — desktop: ⌘K, type "ber", Enter → Berta's profile without touching the mouse; mobile: cards scannable, delivered dimmed at bottom; physio pack: list fields come from its pack config, no atelier leakage. Build + unit tests green.
- [ ] **Step 5: Commit** — `git commit -m "feat(redesign): Clientes cards/table, global search, keyboard nav"`

---

### Task 11: Materials — real merged screen

Design: mobile proposal §4, desktop proposal §4. Replaces the Task 3 wrapper; then `FabricsScreen`/`ShoppingScreen` are deleted.

**Files:**
- Create: `frontend/src/lib/materials.ts` + `frontend/src/lib/__tests__/materials.test.ts`
- Rewrite: `frontend/src/screens/MaterialsScreen.tsx`
- Delete: `frontend/src/screens/ShoppingScreen.tsx`, `frontend/src/screens/FabricsScreen.tsx` (fold what's reusable — `FabricSwatch` stays)

**Interfaces:**
- Produces: `groupBySupplier(items: ShoppingItem[]): { supplier: string; items: ShoppingItem[]; subtotal: number; metres: number }[]` (supplier `''` → `t('shopping.noSupplier')`, sorted by earliest client key date inside); `totals(items): { metres, cost, suppliers }`. Cost = `qty × price` parsed from the display strings the same way `ShoppingScreen.tsx` does today (port that parsing into the lib and test it).
- Consumes: `api.getShopping()`, `api.patchFabric(id, {to_buy})`, `useUndoable`, `SegmentedControl`, days-until from the joined client (`ShoppingItem.client_id` → clients prop).

- [ ] **Step 1: Failing tests** — grouping produces supplier buckets with correct subtotal/metres from realistic strings (`qty: "3.2 m"`, `price: "€48/m"` — confirm exact formats in `backend/seed.py` first and use those); empty-supplier bucket labeled correctly. Run → FAIL.
- [ ] **Step 2: Implement lib; green.**
- [ ] **Step 3: Rewrite screen** — segmented Per comprar | Inventari; buy view: totals strip, supplier groups (header: name + subtotal, desktop also address if the data ever has one — it doesn't; omit), item rows with checkbox; **check = `useUndoable`** firing `patchFabric(id, {to_buy: false})` with undo re-patching `true`; row shows client name + days (accent < 45); just-bought rows stay visible strikethrough while the undo window is open, then drop. Inventory view: current FabricsScreen content (by-client grouping, swatches) rebuilt lean in the same file. Desktop: same data as a dense table with a `tr.grp` supplier row (see mock).
- [ ] **Step 4: Verify runtime** — check a fabric → it strikes through, undo pill appears, undo restores it (confirm via `GET /shopping`); totals update; physio (`fabrics` feature off) → no Materials tab at all, `/materials` redirects to `/clients` (add a `featureOn` guard route). Build + tests green.
- [ ] **Step 5: Commit** — `git commit -m "feat(redesign): merged Materials screen with buy-check undo"`

---

### Task 12: Agenda — desktop week view

Design: desktop proposal §5. Desktop-only nav item (mobile keeps the Avui timeline).

**Files:**
- Create: `frontend/src/lib/week.ts` + `frontend/src/lib/__tests__/week.test.ts`
- Create: `frontend/src/screens/AgendaScreen.tsx`
- Modify: `frontend/src/App.tsx` (route `/agenda` → AgendaScreen desktop; on mobile `/agenda` redirects `/`)
- Delete: `frontend/src/screens/RoadmapScreen.tsx` **only after** its month grid is embedded as the secondary view (see Step 3)

**Interfaces:**
- Produces: `weekOf(date: Date): { start: string; end: string; days: string[] }` — ISO Monday-start week (7 ISO date strings); `shiftWeek(week, ±1)`.
- Consumes: `api.listEvents(start, end)`, `EventDialog` (create with prefilled day — reuse the component's existing create-mode props), `SegmentedControl` (Setmana | Mes), pack `locale.dayNames`.

- [ ] **Step 1: Failing tests `week.test.ts`** — `weekOf(new Date('2026-07-11'))` (a Saturday) → start `2026-07-06`, 7 days, contains `2026-07-11`; `shiftWeek` moves ±7 days. Run → FAIL.
- [ ] **Step 2: Implement; green.**
- [ ] **Step 3: Build `AgendaScreen`** — header: range label (serif), ‹ › week arrows, Avui button, Setmana|Mes segmented, "+ Cita" (opens EventDialog blank). Week grid: 7 columns, today outlined in `T.accent`; events as small blocks color-coded by event type (left border: appointment `T.ink2`, delivery `T.gold`, key date `T.accent` — check `AtelierEvent`'s type field name in `types.ts` and `EventChip.tsx` for the existing type vocabulary and reuse it); clicking an event → client profile; **each day gets a trailing "+ lliure" dashed slot** that opens EventDialog with that date prefilled. Mes view: mount the existing `RoadmapScreen` month grid (lift the grid part into this file, then delete `RoadmapScreen.tsx` and its route).
- [ ] **Step 4: Verify runtime** — desktop `/agenda`: seed events appear in the right columns; "+ lliure" creates an appointment on that date (verify in Avui timeline too); week arrows navigate; mobile: `/agenda` bounces to `/`. Build + tests green.
- [ ] **Step 5: Commit** — `git commit -m "feat(redesign): desktop Agenda week view with free-slot booking"`

---

### Task 13: Fitxa — single screen, pinned facts, activity feed, safe status advance

Design: mobile proposal §3, desktop proposal §3. This task touches the biggest file (`ProfileScreen.tsx`, 568 lines) — restructure, don't rewrite blindly: the payments editor, DynamicFields, fabrics list and EventDialog wiring all already work.

**Files:**
- Create: `frontend/src/lib/activity.ts` + `frontend/src/lib/__tests__/activity.test.ts`
- Rewrite: `frontend/src/screens/ProfileScreen.tsx` (structure per mocks; reuse existing sub-editors)
- Modify: `frontend/src/components/IntakeTab.tsx` → becomes an inline collapsible section, not a tab

**Interfaces:**
- Produces: `buildActivity({events, payments, notes}): { ts: string; kind: 'event'|'payment'|'note'; title: string; detail?: string }[]` sorted desc — notes have ISO `ts`; payments/events carry display strings, so accept an optional ISO and sort unknowns last, stable.
- Consumes: `api.listNotes`, `api.createNote`, `RegisterPaymentSheet` (Task 9), `ConfirmSheet` + `useUndoable` (Task 5), `clientStatuses()`/`statusByKey()` for pipeline order, `EventDialog`.

- [ ] **Step 1: Failing tests `activity.test.ts`** — mixed inputs sort newest-first; a note today outranks yesterday's event; entries without ISO timestamps land after dated ones. Run → FAIL.
- [ ] **Step 2: Implement; green.**
- [ ] **Step 3: Restructure `ProfileScreen`:**
  - Sticky header (both formats): back, name (serif), StatusChip, phone/email (desktop), actions right: WhatsApp (`wa.me` link), `+ Cita` (EventDialog), `+ Pagament` (RegisterPaymentSheet), **`Avançar estat…`** — accent-outlined; opens `ConfirmSheet` (title: `t('status.advanceConfirmTitle')` with the target status label; body: `t('status.advanceConfirmBody')`; add strings both packs) whose confirm runs `useUndoable(fire: patchClient({status: next}), undo: patchClient({status: current}))`. Next status = the item after the current key in `clientStatuses()`; hide the button on terminal.
  - Facts strip: 4 tiles — key-date countdown (accent), pendent (from `buildFinances` for this client) with mini progress bar, garment (from pack `itemFields` primary), last measurement date + "next unscheduled" warning when no future appointment.
  - Two columns (desktop) / stacked (mobile): left = Activity feed (`buildActivity`) + always-visible note input (`api.createNote` → refresh feed); right = payments editor (existing rows/editors moved in), fabrics summary (link → `/materials`), garment/DynamicFields section, intake (collapsed `<details>`-style section using existing `IntakeTab` content).
  - Delete the Fitxa/Ingrés tab bar.
- [ ] **Step 4: Verify runtime** — advance a seed client's status → confirm sheet → undo within 10s restores it (this is the exact accidental-tap scenario from the audit — verify on mobile viewport that the advance button is no longer a bare tap in the scroll path); note appears in feed instantly; payment via sheet updates facts strip; physio pack: statuses/fields all pack-correct. Build + tests + backend suite green.
- [ ] **Step 5: Commit** — `git commit -m "feat(redesign): single-screen Fitxa with activity feed and safe status advance"`

---

### Task 14: Caixa report, cleanup, and physio sweep

**Files:**
- Rename: `frontend/src/screens/FinancesScreen.tsx` → `frontend/src/screens/CaixaScreen.tsx` (route `/caixa`; reachable from Avui caixa card only — not in nav)
- Modify: `frontend/src/screens/CaixaScreen.tsx` (add per-row Registrar button → `RegisterPaymentSheet`; month-collected figure)
- Delete: `frontend/src/screens/IntakeDemoScreen.tsx` **if unreferenced** (check imports first — `grep -rn IntakeDemoScreen frontend/src`), `frontend/src/tokens.ts:28-34` `badge` map (StatusChip replaced it), any now-unused strings in both packs (grep each `strings` key against `frontend/src`)
- Modify: `CLAUDE.md`-adjacent docs NOT touched; update `docs/design/app-brief.md` only if the shipped IA diverged

**Interfaces:** consumes everything prior; produces the final state.

- [ ] **Step 1: CaixaScreen** — keep the existing summary + table, add Registrar per row, add `cobrat aquest mes` (payments whose row parses as paid this month — reuse `parsePayments`; if month attribution isn't derivable from display strings, show total collected only and note it).
- [ ] **Step 2: Dead-code sweep** — delete unreferenced screens/components (`RoadmapScreen`, `ShoppingScreen`, `FabricsScreen`, `TabBar`, `Sidebar` should all be gone by now — verify with `grep -rn`), drop `SCREEN_PATHS` legacy keys (`fabrics`, `shop`, `roadmap`, `finances` keep→`/caixa`), fix `routes.test.ts`.
- [ ] **Step 3: Full verification matrix** —
  - `cd frontend && npm run build && npx vitest run` → clean.
  - `cd backend && ../.venv/bin/python -m pytest tests/ -q` → green; again with `ACTIVE_PACK=physio`.
  - Runtime sweep, atelier, BOTH viewports: every nav destination, deep-link each route directly, browser back through a 5-screen trail, register payment, buy fabric + undo, advance status + undo, create note, create appointment from Agenda free slot and from Fitxa.
  - Runtime sweep, physio (`ACTIVE_PACK=physio`): nav renders its pack's sections/labels; no raw string keys anywhere; statuses/fields/theme all physio.
- [ ] **Step 4: Commit** — `git commit -m "feat(redesign): caixa report, remove folded screens, physio sweep"`

---

## Self-review notes (already applied)

- Spec coverage: routing→T2, 3-tab/4-section nav→T3/T4, Avui absorb (timeline/inbox/caixa/todos/log)→T7-T9, Clientes→T10, Materials→T11, Agenda→T12, Fitxa+safe actions→T5/T13, Caixa page + old-screen removal→T14. Pack-driven + physio checks are embedded per task and in T14's matrix.
- Type consistency: `navItems({mobile})` (T3) is what T4 consumes; `useUndoable`/`makeUndoable` (T5) consumed by T11/T13; `buildFinances` moved in T8 and consumed by T9/T10/T13/T14; `RegisterPaymentSheet` defined T9, consumed T13/T14.
- Known judgment calls the implementer may revisit with the reviewer: (a) undo = optimistic-with-revert, not delayed-commit; (b) physio without `fabrics` feature legitimately shows 2 mobile tabs; (c) payments/appointments store display strings — all parsing goes through the shared libs, never inline.
