// Active vertical pack, fetched from the backend GET /config at boot (see main.tsx).
// One pack per deployment; drives branding, theme, strings, nav, statuses, fields.

export interface PackStatus {
  key: string;
  label: string;
  shortLabel?: string;
  bg: string;
  bd: string;
  fg: string;
  dot: string;
  dash: boolean;
  terminal?: boolean;
}

export interface PackField {
  key: string;
  type: 'text' | 'date' | 'select' | 'number' | 'textarea';
  label: string;         // row/form label
  listLabel?: string;    // column header in the client list (defaults to label)
  storage: 'column' | 'custom';
  required?: boolean;
  isKeyDate?: boolean;
  showInList?: boolean;
  editable?: boolean;    // default true; false = view-only (never an input)
  hideWhenEmpty?: boolean; // in view mode, omit the row when the value is blank
  options?: string[];
}

export interface PackEntityFields {
  fieldsLabel: string;   // section header for the item fields (e.g. "Peça")
  fields: PackField[];
}

export interface PackNavItem {
  screen: string;
  labelKey: string;
  mobileLabelKey?: string;
  countKey?: string;
  feature?: string;
  accent?: boolean;
  sub?: boolean;
  desktopOnly?: boolean;
}

export interface ResolvedNavItem extends PackNavItem {
  label: string;
  mobileLabel: string;
  n: string;
}

export interface Pack {
  id: string;
  brand: {
    name: string;
    wordmark: [string, string];
    tagline: string;
    avatar: string;
    userName: string;
    userRole: string;
    faviconEmoji?: string;
    colors: Record<string, string>;
    fonts: { serif: string; mono: string; sans: string; googleUrl?: string };
  };
  locale: {
    code: string;
    numberLocale: string;
    currencySymbol: string;
    paidKeyword: string;
    doneKeywords: string[];
    monthNames: string[];
    dayNames: string[];
  };
  theme: { cssVars: Record<string, string> };
  strings: Record<string, string>;
  nav: PackNavItem[];
  features: Record<string, boolean>;
  statuses: { client: PackStatus[] };
  entities: { client: PackEntityFields };
}

export const BASE: string = import.meta.env.VITE_API_URL ?? '';

let _pack: Pack | null = null;

export async function loadPack(): Promise<Pack> {
  const r = await fetch(`${BASE}/config`);
  if (!r.ok) throw new Error(`GET /config → ${r.status}`);
  _pack = (await r.json()) as Pack;
  return _pack;
}

export function getPack(): Pack {
  if (!_pack) throw new Error('Pack not loaded — loadPack() must run before render');
  return _pack;
}

/** Hook alias; the pack is loaded before first render so this is always populated. */
export const usePack = (): Pack => getPack();

/** Resolve a UI string by key. Falls back to the key itself when missing. */
export function t(key: string): string {
  return getPack().strings[key] ?? key;
}

export function formatCurrency(n: number): string {
  const { currencySymbol, numberLocale } = getPack().locale;
  return `${currencySymbol}${n.toLocaleString(numberLocale)}`;
}

/** Is a named feature enabled in the active pack? Missing flag = disabled. */
export function featureOn(name: string): boolean {
  return !!getPack().features[name];
}

/** The client status vocabulary, in pipeline order. */
export function clientStatuses(): PackStatus[] {
  return getPack().statuses.client;
}

export function statusByKey(key: string): PackStatus | undefined {
  return getPack().statuses.client.find((s) => s.key === key);
}

/** All declared client fields (item + key-date). */
export function clientFields(): PackField[] {
  return getPack().entities.client.fields;
}

/** Item fields shown in the "fields" section — everything except the key-date. */
export function itemFields(): PackField[] {
  return clientFields().filter((f) => !f.isKeyDate);
}

export function clientFieldsLabel(): string {
  return getPack().entities.client.fieldsLabel;
}

/** Fields flagged to appear as columns in the client list. */
export function listFields(): PackField[] {
  return clientFields().filter((f) => f.showInList);
}

/** The enabled nav items, in display order, with resolved labels + step numbers.
 *  `n` is the 1-based index in the FULL nav list (so a screen keeps its number
 *  even when earlier items — e.g. the profile sub-item on mobile — are hidden).
 *  Items gated by a feature flag are dropped when that feature is off.
 *  Pass `{ mobile: true }` to additionally drop `desktopOnly` items (e.g. Agenda,
 *  which only appears as a desktop section, not a mobile tab). */
export function navItems(opts?: { mobile?: boolean }): ResolvedNavItem[] {
  const pack = getPack();
  return pack.nav
    .map((it, i) => ({
      ...it,
      label: t(it.labelKey),
      mobileLabel: t(it.mobileLabelKey ?? it.labelKey),
      n: String(i + 1).padStart(2, '0'),
    }))
    .filter((it) => !it.feature || featureOn(it.feature))
    .filter((it) => !(opts?.mobile && it.desktopOnly));
}

/** Write the pack's CSS custom properties onto :root. Runs at boot, before
 *  App renders, so shadcn components and the mobile design system (which read
 *  these vars) paint with pack values. */
export function applyTheme(pack: Pack): void {
  const root = document.documentElement;
  for (const [name, value] of Object.entries(pack.theme.cssVars)) {
    root.style.setProperty(name, value);
  }
}
