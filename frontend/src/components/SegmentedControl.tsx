import { T } from '../tokens';

export interface SegmentedControlOption {
  key: string;
  label: string;
}

interface Props {
  options: SegmentedControlOption[];
  value: string;
  onChange: (key: string) => void;
}

/** The pill toggle from the mocks (extracted from MaterialsScreen, Task 3). */
export function SegmentedControl({ options, value, onChange }: Props) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {options.map(o => {
        const on = o.key === value;
        return (
          <button
            key={o.key}
            onClick={() => onChange(o.key)}
            style={{
              fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
              padding: '8px 14px', border: 'none', cursor: 'pointer',
              background: on ? T.ink : 'transparent', color: on ? T.paper : T.ink3,
              borderRadius: 999,
            }}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
