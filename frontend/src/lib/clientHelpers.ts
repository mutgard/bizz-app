import type { Fabric, Payment } from '../types';
import { getPack } from '../config';

export function initials(name: string): string {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('');
}

export function parseQty(qty: string): number {
  return parseFloat(qty) || 0;
}

export function parsePrice(price: string): number {
  return parseFloat(price.replace(/[€$]/g, '').replace('/m', '').trim()) || 0;
}

export function parsePayments(payments: Payment[]): { priceTotal: number | null; paid: number } {
  if (!payments.length) return { priceTotal: null, paid: 0 };
  let paid = 0;
  let total = 0;
  for (const p of payments) {
    const m = p.value.match(/€([\d.,]+)/);
    if (!m) continue;
    const amount = parseFloat(m[1].replace('.', '').replace(',', '.'));
    if (isNaN(amount)) continue;
    total += amount;
    if (p.value.toLowerCase().includes(getPack().locale.paidKeyword)) paid += amount;
  }
  return { priceTotal: total > 0 ? total : null, paid };
}

export function fabricsToBuyCount(fabrics: Fabric[]): number {
  return fabrics.filter(f => f.to_buy).length;
}

export function computeDaysUntil(iso: string): number {
  return Math.round((new Date(iso).getTime() - Date.now()) / 86400000);
}

export function formatWeddingDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}
