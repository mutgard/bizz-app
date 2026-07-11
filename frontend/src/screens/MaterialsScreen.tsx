import { useState } from 'react';
import type { Client } from '../types';
import { T } from '../tokens';
import { t } from '../config';
import { FabricsScreen } from './FabricsScreen';
import { ShoppingScreen } from './ShoppingScreen';

export function MaterialsScreen({ clients, onRefresh }: { clients: Client[]; onRefresh: () => Promise<void> }) {
  const [view, setView] = useState<'buy' | 'inventory'>('buy');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 2, padding: '12px 20px 0' }}>
        {(['buy', 'inventory'] as const).map(v => (
          <button key={v} onClick={() => setView(v)} style={{
            fontFamily: T.mono, fontSize: 10, letterSpacing: 1, textTransform: 'uppercase',
            padding: '8px 14px', border: 'none', cursor: 'pointer',
            background: view === v ? T.ink : 'transparent', color: view === v ? T.paper : T.ink3, borderRadius: 999,
          }}>{t(v === 'buy' ? 'materials.toBuyTab' : 'materials.inventoryTab')}</button>
        ))}
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'buy' ? <ShoppingScreen clients={clients} /> : <FabricsScreen clients={clients} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}
