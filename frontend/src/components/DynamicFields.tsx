import { T } from '../tokens';
import { Label, Mono } from './primitives';
import type { PackField } from '../config';

interface Props {
  fields: PackField[];        // item fields (non-key-date)
  fieldsLabel: string;        // section header
  editing: boolean;
  getValue: (f: PackField) => string;
  setValue: (f: PackField, v: string) => void;
}

const inputStyle = {
  border: 'none', background: 'transparent', outline: 'none',
  fontFamily: T.mono, fontSize: 10, color: T.ink, textAlign: 'right' as const, width: '60%',
};

/** Renders the pack-declared item fields as a KV section (view + edit),
 *  storage-agnostic via the getValue/setValue callbacks. */
export function DynamicFields({ fields, fieldsLabel, editing, getValue, setValue }: Props) {
  const visible = fields.filter(f => {
    if (editing) return f.editable !== false;              // edit mode: editable fields only
    if (f.hideWhenEmpty && !getValue(f)) return false;     // view mode: drop empty optional rows
    return true;
  });
  if (visible.length === 0) return null;

  return (
    <div style={{ marginBottom: 24 }}>
      <Label style={{ marginBottom: 10 }}>{fieldsLabel}</Label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {visible.map(f => {
          const val = getValue(f);
          const canEdit = editing && f.editable !== false;
          return (
            <div key={f.key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: `1px solid ${T.hairline}` }}>
              <Mono size={10} color={T.ink3}>{f.label}</Mono>
              {canEdit ? (
                f.type === 'select' ? (
                  <select value={val} onChange={e => setValue(f, e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value=""></option>
                    {(f.options ?? []).map(o => <option key={o} value={o}>{o}</option>)}
                  </select>
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                    value={val}
                    onChange={e => setValue(f, e.target.value)}
                    placeholder="—"
                    style={inputStyle}
                  />
                )
              ) : (
                val ? <Mono size={10} color={T.ink}>{val}</Mono> : null
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
