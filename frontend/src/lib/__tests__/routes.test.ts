import { describe, it, expect } from 'vitest';
import { pathForScreen, screenForPath } from '../../routes';

describe('pathForScreen', () => {
  it('maps current and legacy screen keys to paths', () => {
    expect(pathForScreen('clients')).toBe('/clients');
    expect(pathForScreen('agenda')).toBe('/agenda');
    expect(pathForScreen('materials')).toBe('/materials');
    expect(pathForScreen('fabrics')).toBe('/materials');
    expect(pathForScreen('finances')).toBe('/caixa');
    expect(pathForScreen('today')).toBe('/');
  });
  it('falls back to /clients for unknown keys', () => {
    expect(pathForScreen('nope')).toBe('/clients');
  });
});

describe('screenForPath', () => {
  it('maps /clients and /clients/:id to the clients screen', () => {
    expect(screenForPath('/clients')).toBe('clients');
    expect(screenForPath('/clients/42')).toBe('clients');
  });
  it('maps other known paths back to their canonical screen key', () => {
    expect(screenForPath('/agenda')).toBe('agenda');
    expect(screenForPath('/materials')).toBe('materials');
    expect(screenForPath('/caixa')).toBe('caixa');
  });
});
