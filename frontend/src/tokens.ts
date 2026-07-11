export const T = {
  // surfaces
  paper:    '#f6f1e8',
  paper2:   '#eee6d5',
  paper3:   '#e4dbc6',
  vellum:   '#fbf7ed',
  sheet:    '#ffffff',

  // ink
  ink:      '#2a1f14',
  ink2:     '#5a4a38',
  ink3:     '#8a7a64',
  hairline:  'rgba(42,31,20,0.12)',
  hairline2: 'rgba(42,31,20,0.22)',

  // accent
  accent:  '#8a2a2f',
  accent2: '#b8504e',
  gold:    '#c9a86a',

  // type
  serif: '"Instrument Serif", Georgia, serif',
  mono:  '"IBM Plex Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  sans:  '"Inter", -apple-system, BlinkMacSystemFont, system-ui, sans-serif',

  // badge config
  badge: {
    'prospect':   { bg: 'transparent', bd: '#8a7a64', fg: '#5a4a38', dot: '◌', dash: true },
    'sense-paga': { bg: '#f6efdc',     bd: '#c9a86a', fg: '#6b5420', dot: '◐', dash: false },
    'clienta':    { bg: '#eadad5',     bd: '#8a2a2f', fg: '#6b1f22', dot: '●', dash: false },
    'entregada':  { bg: '#2a1f14',     bd: '#2a1f14', fg: '#f6f1e8', dot: '✓', dash: false },
  } as Record<string, { bg: string; bd: string; fg: string; dot: string; dash: boolean }>,
} as const;

// Fabric swatch patterns
export const SWATCH_PATTERNS: Record<string, string> = {
  stripe: `repeating-linear-gradient(45deg, ${T.ink2}22 0 1px, transparent 1px 7px), ${T.paper3}`,
  dots:   `radial-gradient(${T.ink2}33 1px, transparent 1.5px) 0 0/6px 6px, ${T.paper3}`,
  solid:  T.paper3,
  weave:  `repeating-linear-gradient(0deg, ${T.ink2}1a 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${T.ink2}1a 0 1px, transparent 1px 3px), ${T.paper3}`,
  twill:  `repeating-linear-gradient(135deg, ${T.ink2}22 0 2px, transparent 2px 5px), ${T.paper3}`,
};

const VARIANTS = ['weave', 'stripe', 'dots', 'solid', 'twill'];
export function fabricVariant(name: string): string {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff;
  return VARIANTS[h % VARIANTS.length];
}

// Populate the T singleton + swatch patterns from the active pack. Runs in
// main.tsx BEFORE App is dynamically imported, so every consumer (including
// modules that derive constants from T at import time) sees hydrated values.
import type { Pack } from './config';

export function hydrateTokens(pack: Pack): void {
  const c = pack.brand.colors;
  const f = pack.brand.fonts;
  const m = T as unknown as Record<string, unknown>;
  for (const [k, v] of Object.entries(c)) m[k] = v;
  m.serif = f.serif;
  m.mono = f.mono;
  m.sans = f.sans;

  const badge: Record<string, { bg: string; bd: string; fg: string; dot: string; dash: boolean }> = {};
  for (const s of pack.statuses.client) {
    badge[s.key] = { bg: s.bg, bd: s.bd, fg: s.fg, dot: s.dot, dash: s.dash };
  }
  m.badge = badge;

  // SWATCH_PATTERNS is evaluated at import time (when tokens.ts loads, before
  // this runs) so its baked-in colors must be rewritten in place.
  SWATCH_PATTERNS.stripe = `repeating-linear-gradient(45deg, ${T.ink2}22 0 1px, transparent 1px 7px), ${T.paper3}`;
  SWATCH_PATTERNS.dots = `radial-gradient(${T.ink2}33 1px, transparent 1.5px) 0 0/6px 6px, ${T.paper3}`;
  SWATCH_PATTERNS.solid = T.paper3;
  SWATCH_PATTERNS.weave = `repeating-linear-gradient(0deg, ${T.ink2}1a 0 1px, transparent 1px 3px), repeating-linear-gradient(90deg, ${T.ink2}1a 0 1px, transparent 1px 3px), ${T.paper3}`;
  SWATCH_PATTERNS.twill = `repeating-linear-gradient(135deg, ${T.ink2}22 0 2px, transparent 2px 5px), ${T.paper3}`;
}
