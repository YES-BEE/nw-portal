import { beforeEach, describe, expect, it, vi } from 'vitest';
import { clearDemoStorage } from './browserStorage';
import { SESSION_STORAGE_KEY } from './session';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('prototype browser data cleanup', () => {
  it('clears old portal records from both storage areas and preserves authenticated sessions and unrelated data', () => {
    const keys = [
      'nw-track-session-v1',
      'nw-track-access-v1',
      'nw-track-access-v2',
      'nw-track-process-config-v3',
      'nw-track-process-config-v4',
      'nw-track-storages-v1',
      'nw-track-storages-v2',
      'nw-track-tags-v1',
      'nw-track-tags-v2',
      'nw-track-demo-styles-v1',
      'nw-track-styles-v2',
    ];
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of keys) storage.setItem(key, 'demo records');
      storage.setItem('unrelated-preference', 'keep');
      storage.setItem(SESSION_STORAGE_KEY, 'authenticated session');
    }
    clearDemoStorage();
    for (const storage of [localStorage, sessionStorage]) {
      for (const key of keys) expect(storage.getItem(key)).toBeNull();
      expect(storage.getItem('unrelated-preference')).toBe('keep');
      expect(storage.getItem(SESSION_STORAGE_KEY)).toBe(
        'authenticated session',
      );
      storage.setItem('nw-track-tags-v2', 'new records');
    }
    clearDemoStorage();
    for (const storage of [localStorage, sessionStorage])
      expect(storage.getItem('nw-track-tags-v2')).toBe('new records');
  });
  it('does not block the app when browser storage is unavailable', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Blocked');
    });
    expect(() => clearDemoStorage()).not.toThrow();
  });
});
