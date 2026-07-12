// Legacy screen-key <-> URL path mapping. Keeps the pack config's nav items
// (which speak in `screen` keys) working with react-router paths.

// Canonical screen keys (matching current nav `screen` values) are listed
// first so screenForPath's reverse lookup resolves to them; legacy aliases
// resolve to the same path for pathForScreen but must not win the reverse
// lookup (nav highlighting keys off the canonical screen name).
export const SCREEN_PATHS: Record<string, string> = {
  today: '/',
  clients: '/clients',
  profile: '/clients',      // sub-screen; row click appends /:id
  materials: '/materials',
  agenda: '/agenda',
  intake: '/intake',
  caixa: '/caixa',
  fabrics: '/materials',    // still called via nav('fabrics') — ProfileScreen's "view all" fabrics link
  finances: '/caixa',       // legacy alias — no current caller, kept for back-compat
};

export function pathForScreen(screen: string): string {
  return SCREEN_PATHS[screen] ?? '/clients';
}

export function screenForPath(pathname: string): string {
  if (pathname.startsWith('/clients')) return 'clients';
  const hit = Object.entries(SCREEN_PATHS).find(([k, v]) => v === pathname && k !== 'profile');
  return hit ? hit[0] : 'clients';
}
