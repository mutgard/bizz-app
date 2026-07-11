import { useState } from 'react';
import type { Client } from '../types';
import { t } from '../config';
import { SegmentedControl } from '../components/SegmentedControl';
import { FabricsScreen } from './FabricsScreen';
import { ShoppingScreen } from './ShoppingScreen';

export function MaterialsScreen({ clients, onRefresh }: { clients: Client[]; onRefresh: () => Promise<void> }) {
  const [view, setView] = useState<'buy' | 'inventory'>('buy');
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div style={{ padding: '12px 20px 0' }}>
        <SegmentedControl
          options={[
            { key: 'buy', label: t('materials.toBuyTab') },
            { key: 'inventory', label: t('materials.inventoryTab') },
          ]}
          value={view}
          onChange={(v) => setView(v as 'buy' | 'inventory')}
        />
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {view === 'buy' ? <ShoppingScreen clients={clients} /> : <FabricsScreen clients={clients} onRefresh={onRefresh} />}
      </div>
    </div>
  );
}
