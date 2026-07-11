// Active vertical pack, fetched from the backend GET /config at boot (see main.tsx).
// One pack per deployment; drives branding, theme, strings, nav, statuses, fields.

export interface PackStatus {
  key: string;
  label: string;
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
  label: string;
  storage: 'column' | 'custom';
  required?: boolean;
  isKeyDate?: boolean;
  showInList?: boolean;
  options?: string[];
}

export interface PackNavItem {
  screen: string;
  labelKey: string;
  feature?: string;
  accent?: boolean;
  sub?: boolean;
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
  };
  strings: Record<string, string>;
  nav: PackNavItem[];
  features: Record<string, boolean>;
  statuses: { client: PackStatus[] };
  entities: { client: { fields: PackField[] } };
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
