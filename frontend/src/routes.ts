// Legacy screen-key <-> URL path mapping. Keeps the pack config's nav items
// (which speak in `screen` keys) working with react-router paths.

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

export function screenForPath(pathname: string): string {
  if (pathname.startsWith('/clients')) return 'clients';
  const hit = Object.entries(SCREEN_PATHS).find(([k, v]) => v === pathname && k !== 'profile');
  return hit ? hit[0] : 'clients';
}
