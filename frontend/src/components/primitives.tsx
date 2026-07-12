import React from 'react';
import { T, SWATCH_PATTERNS } from '../tokens';

// ─── Typography ──────────────────────────────────────────────

export function Label({ children, style = {}, size = 11 }: {
  children: React.ReactNode; style?: React.CSSProperties; size?: number;
}) {
  return (
    <div style={{
      fontFamily: T.mono, fontSize: size, color: T.ink3,
      textTransform: 'uppercase', letterSpacing: 1.2, ...style,
    }}>{children}</div>
  );
}

export function Mono({ children, size = 13, color = T.ink2, style = {} }: {
  children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties;
}) {
  return (
    <span style={{ fontFamily: T.mono, fontSize: size, color, ...style }}>{children}</span>
  );
}

export function Serif({ children, size = 30, italic = false, style = {} }: {
  children: React.ReactNode; size?: number; italic?: boolean; style?: React.CSSProperties;
}) {
  return (
    <span style={{
      fontFamily: T.serif, fontSize: size, color: T.ink,
      fontStyle: italic ? 'italic' : 'normal',
      letterSpacing: -0.5, lineHeight: 1.0, ...style,
    }}>{children}</span>
  );
}

export function Rule({ dashed = false, color = T.hairline, style = {} }: {
  dashed?: boolean; color?: string; style?: React.CSSProperties;
}) {
  return (
    <div style={{
      height: 1, width: '100%',
      borderTop: `1px ${dashed ? 'dashed' : 'solid'} ${color}`,
      ...style,
    }} />
  );
}

// ─── Navigation affordance ───────────────────────────────────

/** Muted `›` marking a row/card that navigates somewhere on tap. Render it
 * only on elements that actually navigate — the icon must never lie. */
export function NavChevron({ style = {} }: { style?: React.CSSProperties }) {
  return (
    <span aria-hidden style={{
      color: T.ink3, fontSize: 15, lineHeight: 1, flexShrink: 0,
      opacity: 0.7, fontFamily: T.sans, ...style,
    }}>›</span>
  );
}

// ─── Swatch ──────────────────────────────────────────────────

export function Swatch({ size = 44, variant = 'stripe' }: { size?: number; variant?: string }) {
  return (
    <div style={{
      width: size, height: size, flexShrink: 0,
      border: `1px solid ${T.hairline2}`,
      background: SWATCH_PATTERNS[variant] || SWATCH_PATTERNS.solid,
    }} />
  );
}

// ─── Checkbox ────────────────────────────────────────────────

export function Checkbox({ checked, onChange }: { checked: boolean; onChange?: () => void }) {
  return (
    <div onClick={onChange} style={{
      width: 18, height: 18, flexShrink: 0,
      border: `1.5px solid ${checked ? T.accent : T.ink2}`,
      background: checked ? T.accent : 'transparent',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: T.sheet, fontSize: 10, cursor: onChange ? 'pointer' : 'default',
    }}>
      {checked ? '✓' : ''}
    </div>
  );
}

// ─── Segment control ─────────────────────────────────────────

export function Segment({ options, value, onChange }: {
  options: [string, string][];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div style={{ display: 'inline-flex', border: `1px solid ${T.ink}`, borderRadius: 2, overflow: 'hidden' }}>
      {options.map(([v, l]) => {
        const on = v === value;
        return (
          <div key={v} onClick={() => onChange(v)} style={{
            padding: '7px 14px',
            background: on ? T.ink : 'transparent',
            color: on ? T.paper : T.ink,
            fontFamily: T.mono, fontSize: 11, letterSpacing: 0.8, textTransform: 'uppercase',
            cursor: 'pointer',
          }}>{l}</div>
        );
      })}
    </div>
  );
}

// ─── Buttons ─────────────────────────────────────────────────

export function PrimaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 18px', background: T.ink, color: T.paper,
      fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
      cursor: 'pointer', borderRadius: 2, flexShrink: 0,
    }}>{children}</div>
  );
}

export function SecondaryButton({ children, onClick }: { children: React.ReactNode; onClick?: () => void }) {
  return (
    <div onClick={onClick} style={{
      padding: '8px 18px', border: `1px solid ${T.ink}`, color: T.ink,
      fontFamily: T.mono, fontSize: 12, letterSpacing: 0.8, textTransform: 'uppercase',
      cursor: 'pointer', borderRadius: 2, background: 'transparent', flexShrink: 0,
    }}>{children}</div>
  );
}
