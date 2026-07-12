import { useEffect, useMemo, useRef, useState } from 'react';
import type { Client, ShoppingItem } from '../types';
import { api } from '../api';
import { t, getPack } from '../config';
import { T, fabricVariant } from '../tokens';
import { useIsMobile } from '../hooks/useIsMobile';
import { useUndoable, UndoToast } from '../hooks/useUndoable';
import { PageHeader } from '../components/PageHeader';
import { SegmentedControl } from '../components/SegmentedControl';
import { Label, Mono, Serif, Swatch, Checkbox } from '../components/primitives';
import { parseQty, parsePrice } from '../lib/clientHelpers';
import { groupBySupplier, totals, type ShoppingItemWithDays } from '../lib/materials';

const UNDO_MS = 10000;
const URGENT_DAYS = 45;

interface Props { clients: Client[]; onRefresh: () => Promise<void>; }

export function MaterialsScreen({ clients, onRefresh }: Props) {
  const mobile = useIsMobile();
  const px = mobile ? 16 : 40;
  const [view, setView] = useState<'buy' | 'inventory'>('buy');

  // Buy-list source of truth: GET /shopping (to_buy fabrics joined with client_id/client_name).
  const [shopping, setShopping] = useState<ShoppingItem[]>([]);
  useEffect(() => { api.getShopping().then(setShopping); }, [clients]);

  // Rows the operator just checked off: kept visible (struck through) for the
  // undo window even after the backend — and thus the /shopping refetch above —
  // no longer reports them as to_buy.
  const [justBought, setJustBought] = useState<Record<number, ShoppingItem>>({});
  const [undoingId, setUndoingId] = useState<number | null>(null);
  const pendingRef = useRef<ShoppingItem | null>(null);

  const undoable = useUndoable(
    async () => {
      const item = pendingRef.current;
      if (!item) return;
      await api.patchFabric(item.id, { to_buy: false });
      await onRefresh();
    },
    async () => {
      const item = pendingRef.current;
      if (!item) return;
      await api.patchFabric(item.id, { to_buy: true });
      await onRefresh();
      setJustBought(prev => { const { [item.id]: _drop, ...rest } = prev; return rest; });
      setUndoingId(null);
    },
    UNDO_MS,
  );

  const handleBuy = (item: ShoppingItem) => {
    pendingRef.current = item;
    setUndoingId(item.id);
    setJustBought(prev => ({ ...prev, [item.id]: item }));
    undoable.fire();
    setTimeout(() => {
      setJustBought(prev => { const { [item.id]: _drop, ...rest } = prev; return rest; });
    }, UNDO_MS);
  };

  const clientById = useMemo(() => new Map(clients.map(c => [c.id, c])), [clients]);
  const withDays = (item: ShoppingItem): ShoppingItemWithDays => ({
    ...item, days_until: clientById.get(item.client_id)?.days_until ?? 0,
  });

  const buyItems: ShoppingItemWithDays[] = useMemo(() => {
    const fresh = shopping.map(withDays);
    const stillBought = Object.values(justBought)
      .filter(b => !shopping.some(s => s.id === b.id))
      .map(withDays);
    return [...fresh, ...stillBought];
  }, [shopping, justBought, clientById]);

  const groups = useMemo(() => groupBySupplier(buyItems), [buyItems]);
  const buyTotals = useMemo(() => totals(buyItems), [buyItems]);

  const allFabrics = clients.flatMap(c => c.fabrics);
  const inventoryClients = [...clients]
    .filter(c => c.fabrics.some(f => !f.to_buy))
    .sort((a, b) => a.days_until - b.days_until);
  const inventoryCount = allFabrics.length - buyItems.length;

  const stats = [
    { l: t('shopping.metres'), v: `${buyTotals.metres.toFixed(1)} m` },
    { l: t('shopping.costEst'), v: `€${Math.round(buyTotals.cost).toLocaleString()}` },
    { l: t('shopping.suppliers'), v: String(buyTotals.suppliers) },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <PageHeader
        eyebrow={t('nav.materials')}
        title={view === 'buy' ? t('materials.toBuyTab') : t('materials.inventoryTab')}
        subtitle={view === 'buy'
          ? `${buyItems.length} ${t('shopping.piecesLower')}`
          : `${inventoryCount} ${t('fabrics.pieces')}`}
      />

      <div style={{ padding: '12px 20px 0', flexShrink: 0 }}>
        <SegmentedControl
          options={[
            { key: 'buy', label: `${t('materials.toBuyTab')} · ${buyItems.length}` },
            { key: 'inventory', label: `${t('materials.inventoryTab')} · ${inventoryCount}` },
          ]}
          value={view}
          onChange={(v) => setView(v as 'buy' | 'inventory')}
        />
      </div>

      {view === 'buy'
        ? <BuyView
            mobile={mobile} px={px} groups={groups} stats={stats}
            justBought={justBought} undoingId={undoingId}
            onBuy={handleBuy} onUndo={() => undoable.undoNow()}
          />
        : <InventoryView px={px} clients={inventoryClients} />}

      <UndoToast pending={undoable.pending} onUndo={undoable.undoNow} label={t('common.done')} />
    </div>
  );
}

// ─── Buy view ────────────────────────────────────────────────

function BuyView({ mobile, px, groups, stats, justBought, undoingId, onBuy, onUndo }: {
  mobile: boolean; px: number;
  groups: ReturnType<typeof groupBySupplier>;
  stats: { l: string; v: string }[];
  justBought: Record<number, ShoppingItem>;
  undoingId: number | null;
  onBuy: (item: ShoppingItem) => void;
  onUndo: () => void;
}) {
  const empty = groups.length === 0;
  const currency = getPack().locale.currencySymbol;

  return (
    <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ display: 'flex', borderBottom: `1px solid ${T.hairline}`, flexShrink: 0 }}>
        {stats.map((s, i) => (
          <div key={i} style={{ flex: 1, padding: mobile ? '12px 14px' : '14px 24px', borderRight: i < stats.length - 1 ? `1px solid ${T.hairline}` : 'none' }}>
            <Label style={{ marginBottom: 6 }}>{s.l}</Label>
            <Serif size={mobile ? 20 : 24}>{s.v}</Serif>
          </div>
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: empty ? 0 : `16px ${px}px 32px` }}>
        {empty ? (
          <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('shopping.empty')}</div>
        ) : mobile ? (
          groups.map(g => (
            <SupplierGroupMobile key={g.supplier || '—'} group={g} justBought={justBought} onBuy={onBuy} />
          ))
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {['', t('materials.colFabric'), t('materials.colUse'), t('shopping.metres'), `${currency}/m`, t('materials.colEst'), t('common.client'), t('common.days'), ''].map((h, i) => (
                  <th key={i} style={{ textAlign: i >= 3 && i <= 7 ? 'right' : 'left', padding: '6px 10px 6px 0', fontFamily: T.mono, fontSize: 9, letterSpacing: 1, textTransform: 'uppercase', color: T.ink3, borderBottom: `1px solid ${T.hairline}`, fontWeight: 400 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <SupplierGroupDesktop key={g.supplier || '—'} group={g} justBought={justBought} undoingId={undoingId} onBuy={onBuy} onUndo={onUndo} />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function SupplierGroupMobile({ group, justBought, onBuy }: {
  group: ReturnType<typeof groupBySupplier>[number];
  justBought: Record<number, ShoppingItem>;
  onBuy: (item: ShoppingItem) => void;
}) {
  const label = group.supplier || t('shopping.noSupplier');
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 4, marginBottom: 8 }}>
        <Serif size={17}>{label}</Serif>
        <Mono size={10} color={T.ink3}>{group.items.length} {group.items.length > 1 ? t('shopping.pieces').toLowerCase() : t('shopping.piece')} · €{Math.round(group.subtotal).toLocaleString()}</Mono>
      </div>
      {group.items.map(item => {
        const bought = !!justBought[item.id];
        const soon = item.days_until > 0 && item.days_until < URGENT_DAYS;
        return (
          <div key={item.id} style={{
            display: 'flex', gap: 12, alignItems: 'center',
            background: T.sheet, border: `1px solid ${T.hairline}`, borderRadius: 12,
            padding: '12px 14px', marginTop: 8, opacity: bought ? 0.55 : 1,
          }}>
            <Checkbox checked={bought} onChange={bought ? undefined : () => onBuy(item)} />
            <Swatch size={34} variant={fabricVariant(item.name)} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontFamily: T.sans, fontSize: 14.5, fontWeight: 600, color: T.ink, textDecoration: bought ? 'line-through' : 'none' }}>{item.name}</div>
              <Mono size={12} color={T.ink3}>{item.use} · {item.qty} · {item.price}{bought ? ` · ${t('shopping.boughtToday')}` : ''}</Mono>
            </div>
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <Mono size={12.5} color={T.ink2} style={{ fontWeight: 600 }}>{item.client_name.split(' ')[0]}</Mono>
              {!bought && (
                <div>
                  <Mono size={12.5} color={soon ? T.accent : T.ink2} style={{ fontWeight: 600 }}>
                    {item.days_until > 0 ? `${item.days_until}d` : `${t('shopping.ago')} ${Math.abs(item.days_until)}d`}
                  </Mono>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SupplierGroupDesktop({ group, justBought, undoingId, onBuy, onUndo }: {
  group: ReturnType<typeof groupBySupplier>[number];
  justBought: Record<number, ShoppingItem>;
  undoingId: number | null;
  onBuy: (item: ShoppingItem) => void;
  onUndo: () => void;
}) {
  const label = group.supplier || t('shopping.noSupplier');
  return (
    <>
      <tr>
        <td colSpan={9} style={{ padding: '14px 0 6px', borderBottom: `2px solid ${T.ink}` }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
            <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{label}</span>
            <Mono size={10} color={T.ink3}>{group.items.length} {group.items.length > 1 ? t('shopping.pieces').toLowerCase() : t('shopping.piece')} · €{Math.round(group.subtotal).toLocaleString()}</Mono>
          </div>
        </td>
      </tr>
      {group.items.map(item => {
        const bought = !!justBought[item.id];
        const soon = item.days_until > 0 && item.days_until < URGENT_DAYS;
        const est = parseQty(item.qty) * parsePrice(item.price);
        return (
          <tr key={item.id} style={{ opacity: bought ? 0.55 : 1, borderBottom: `1px dashed ${T.hairline}` }}>
            <td style={{ padding: '10px 10px 10px 0' }}><Checkbox checked={bought} onChange={bought ? undefined : () => onBuy(item)} /></td>
            <td style={{ padding: '10px 10px 10px 0', fontFamily: T.sans, fontSize: 13, fontWeight: 500, color: T.ink, textDecoration: bought ? 'line-through' : 'none' }}>{item.name}</td>
            <td style={{ padding: '10px 10px 10px 0' }}><Mono size={11} color={T.ink3}>{item.use}</Mono></td>
            <td style={{ padding: '10px 10px 10px 0', textAlign: 'right' }}><Mono size={11}>{parseQty(item.qty).toFixed(1)}</Mono></td>
            <td style={{ padding: '10px 10px 10px 0', textAlign: 'right' }}><Mono size={11} color={T.ink3}>{item.price.replace('/m', '')}</Mono></td>
            <td style={{ padding: '10px 10px 10px 0', textAlign: 'right' }}><Mono size={11}>€{Math.round(est)}</Mono></td>
            <td style={{ padding: '10px 10px 10px 0' }}><Mono size={11}>{item.client_name}</Mono></td>
            <td style={{ padding: '10px 10px 10px 0', textAlign: 'right' }}>
              {bought
                ? <Mono size={11} color={T.ink3}>—</Mono>
                : <Mono size={11} color={soon ? T.accent : T.ink2}>{item.days_until}</Mono>}
            </td>
            <td style={{ padding: '10px 0', textAlign: 'right' }}>
              {bought && undoingId === item.id && (
                <button
                  onClick={onUndo}
                  style={{
                    fontFamily: T.mono, fontSize: 10, letterSpacing: 0.6, textTransform: 'uppercase',
                    color: T.accent, background: 'transparent', border: `1px solid ${T.accent}`,
                    borderRadius: 999, padding: '3px 10px', cursor: 'pointer',
                  }}
                >{t('common.undo')}</button>
              )}
              {bought && undoingId !== item.id && (
                <Mono size={10} color={T.ink3} style={{ textTransform: 'uppercase', letterSpacing: 0.6 }}>{t('common.done')}</Mono>
              )}
            </td>
          </tr>
        );
      })}
    </>
  );
}

// ─── Inventory view ──────────────────────────────────────────

function InventoryView({ px, clients }: { px: number; clients: Client[] }) {
  const empty = clients.length === 0;
  return (
    <div style={{ flex: 1, overflow: 'auto', padding: empty ? 0 : `16px ${px}px 32px` }}>
      {empty ? (
        <div style={{ textAlign: 'center', padding: '60px 0', fontFamily: T.serif, fontSize: 22, fontStyle: 'italic', color: T.ink3 }}>{t('fabrics.empty')}</div>
      ) : clients.map(c => {
        const owned = c.fabrics.filter(f => !f.to_buy);
        if (owned.length === 0) return null;
        return (
          <div key={c.id} style={{ marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', paddingBottom: 8, borderBottom: `2px solid ${T.ink}` }}>
              <span style={{ fontFamily: T.sans, fontSize: 14, fontWeight: 600, color: T.ink }}>{c.name}</span>
              <Mono size={10} color={T.ink3}>{owned.length} {owned.length > 1 ? t('fabrics.pieces') : t('shopping.piece')}</Mono>
            </div>
            {owned.map(f => (
              <div key={f.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 0', borderBottom: `1px dashed ${T.hairline}` }}>
                <Swatch size={32} variant={fabricVariant(f.name)} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: T.sans, fontSize: 12, fontWeight: 500, color: T.ink }}>{f.name}</div>
                  <Mono size={9} color={T.ink3}>{f.use} · {f.qty} · {f.price}</Mono>
                </div>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}
