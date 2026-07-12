import { useEffect, useRef, useState } from 'react';
import type { Client } from '../types';
import { T } from '../tokens';
import { t } from '../config';
import { searchClients } from '../lib/search';
import { StatusChip } from './StatusChip';
import { NavChevron } from './primitives';

interface Props {
  clients: Client[];
  onOpen: (id: number) => void;
}

const MAX_RESULTS = 8;

/** Global omni-search mounted in `TopBar`'s slot (desktop only). ⌘K/Ctrl-K
 *  focuses the input from anywhere; typing filters a dropdown of matching
 *  clients (name, phone, garment — see `lib/search.ts`); ↑↓ moves the
 *  selection, Enter opens the client's profile, Esc clears + blurs. */
export function GlobalSearch({ clients, onOpen }: Props) {
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const matches = searchClients(clients, query).slice(0, MAX_RESULTS);
  const open = focused && matches.length > 0;

  useEffect(() => { setSelected(0); }, [query]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const openMatch = (id: number) => {
    onOpen(id);
    setQuery('');
    inputRef.current?.blur();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setQuery('');
      inputRef.current?.blur();
      return;
    }
    if (!open) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelected(s => Math.min(s + 1, matches.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelected(s => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const m = matches[selected];
      if (m) openMatch(m.id);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        background: 'rgba(246,241,232,0.12)', borderRadius: 7,
        padding: '7px 10px', minWidth: 230,
      }}>
        <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="rgba(246,241,232,0.6)" strokeWidth="1.5">
          <circle cx="5" cy="5" r="3.5"/><path d="M8 8l2.5 2.5" strokeLinecap="round"/>
        </svg>
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          onKeyDown={handleKeyDown}
          placeholder={t('search.placeholder')}
          style={{
            border: 'none', background: 'none', outline: 'none',
            color: T.paper, fontFamily: T.sans, fontSize: 12.5,
            width: '100%',
          }}
        />
        {!query && (
          <kbd style={{
            fontFamily: T.mono, fontWeight: 600, fontSize: 10, lineHeight: 1,
            background: 'rgba(246,241,232,0.15)', color: 'rgba(246,241,232,0.8)',
            border: 'none', borderRadius: 4, padding: '3px 5px', flexShrink: 0,
          }}>⌘K</kbd>
        )}
      </div>

      {open && (
        <div style={{
          position: 'absolute', top: '100%', right: 0, minWidth: 340, marginTop: 6,
          background: T.sheet, border: `1px solid ${T.hairline2}`, borderRadius: 6,
          boxShadow: '0 8px 24px rgba(0,0,0,0.24)', overflow: 'hidden', zIndex: 200,
        }}>
          {matches.map((c, i) => (
            <div
              key={c.id}
              onMouseDown={e => { e.preventDefault(); openMatch(c.id); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '8px 12px', cursor: 'pointer',
                background: i === selected ? T.paper2 : 'transparent',
              }}
            >
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink,
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{c.name}</div>
                <div style={{ fontFamily: T.mono, fontSize: 10.5, color: T.ink3, marginTop: 1, whiteSpace: 'nowrap' }}>{c.phone || '—'}</div>
              </div>
              <StatusChip statusKey={c.status} size="sm" />
              <NavChevron />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
