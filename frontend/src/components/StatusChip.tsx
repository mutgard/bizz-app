import { T } from '../tokens';
import { statusByKey } from '../config';

interface Props {
  /** A `PackStatus.key` (see `config.ts`), e.g. `client.status`. */
  statusKey: string;
  size?: 'sm' | 'md';
}

/**
 * Solid, color-coded status chip driven entirely by the active pack's
 * `statusByKey(key)` — bg/bd/fg/dot/dash come straight from the pack config,
 * so the same component renders every vertical's status vocabulary without
 * a hardcoded color map (replaces `T.badge`, see tokens.ts).
 */
export function StatusChip({ statusKey, size = 'md' }: Props) {
  const s = statusByKey(statusKey);
  if (!s) return null;
  const sm = size === 'sm';
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      padding: sm ? '2px 8px' : '3px 10px',
      border: `1px ${s.dash ? 'dashed' : 'solid'} ${s.bd}`,
      background: s.bg, color: s.fg,
      fontFamily: T.mono, fontSize: sm ? 9.5 : 10.5,
      letterSpacing: 0.8, textTransform: 'uppercase',
      borderRadius: 999, whiteSpace: 'nowrap', flexShrink: 0,
    }}>
      <span style={{ fontSize: sm ? 8 : 9 }}>{s.dot}</span>
      <span>{s.label}</span>
    </span>
  );
}
