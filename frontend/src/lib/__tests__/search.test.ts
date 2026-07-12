import { describe, it, expect } from 'vitest';
import { searchClients } from '../search';
import type { Client } from '../../types';

function client(overrides: Partial<Client>): Client {
  return {
    id: 1,
    name: 'Aina Puig',
    wedding_date: '17.05.2026',
    days_until: 25,
    status: 'clienta',
    garment: 'Vestit a mida',
    garment_style: 'princesa',
    measurements_date: '',
    phone: '',
    email: '',
    notes: '',
    fabrics: [],
    appointments: [],
    payments: [],
    ...overrides,
  };
}

describe('searchClients', () => {
  const aina = client({ id: 1, name: 'Aina Puig', phone: '+34 639 42 18 05', garment: 'Vestit a mida' });
  const berta = client({ id: 2, name: 'Berta Soler', phone: '612 88 31 04', garment: 'Vestit + vel' });
  const nuria = client({ id: 3, name: 'Núria Bosch', phone: '', garment: 'Consulta inicial' });
  const fina = client({ id: 4, name: 'Fina Batlle', phone: '611 34 90 27', garment: 'Vestit sirena' });
  const clients = [aina, berta, nuria, fina];

  it('matches by partial, case-insensitive name', () => {
    expect(searchClients(clients, 'ber').map(c => c.id)).toEqual([2]);
  });

  it('matches phone regardless of formatting on either side (digits-only compare)', () => {
    expect(searchClients(clients, '639421805').map(c => c.id)).toEqual([1]);
    expect(searchClients(clients, '639 42 18 05').map(c => c.id)).toEqual([1]);
  });

  it('matches by garment', () => {
    expect(searchClients(clients, 'sirena').map(c => c.id)).toEqual([4]);
  });

  it('is diacritic-insensitive on name', () => {
    expect(searchClients(clients, 'nuria').map(c => c.id)).toEqual([3]);
  });

  it('returns all clients when query is empty', () => {
    expect(searchClients(clients, '')).toEqual(clients);
    expect(searchClients(clients, '   ')).toEqual(clients);
  });

  it('returns no matches for an unrelated query', () => {
    expect(searchClients(clients, 'zzz-no-match')).toEqual([]);
  });
});
