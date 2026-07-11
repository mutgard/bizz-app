import { describe, it, expect } from 'vitest';
import { pathForScreen, screenForPath } from '../../routes';

describe('pathForScreen', () => {
  it('maps legacy screen keys to paths', () => {
    expect(pathForScreen('clients')).toBe('/clients');
    expect(pathForScreen('roadmap')).toBe('/agenda');
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
  it('maps other known paths back to their screen key', () => {
    expect(screenForPath('/agenda')).toBe('roadmap');
  });
});
