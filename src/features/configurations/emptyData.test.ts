import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadProcesses } from '../processes/processData';
import { loadStorages } from '../storages/storageData';
import { loadStyles } from '../styles/styleData';
import { loadTags } from './tagRegistry';

beforeEach(() => localStorage.clear());
const loaders = [loadProcesses, loadStorages, loadStyles, loadTags];

describe('configuration data without frontend seeds', () => {
  it.each(loaders)('starts empty when no records are saved: %s', (load) => {
    expect(load()).toEqual({ records: [], storageUnavailable: false });
    expect(localStorage.length).toBe(0);
  });
  it('ignores all previously persisted demo namespaces', () => {
    for (const key of [
      'nw-track-process-config-v3',
      'nw-track-storages-v1',
      'nw-track-tags-v1',
      'nw-track-demo-styles-v1',
    ]) {
      localStorage.setItem(key, JSON.stringify([{ id: 'old-demo' }]));
    }
    for (const load of loaders)
      expect(load()).toEqual({ records: [], storageUnavailable: false });
  });
  it.each(loaders)(
    'does not fabricate records when browser storage is unavailable: %s',
    (load) => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('Unavailable');
      });
      expect(load()).toEqual({ records: [], storageUnavailable: true });
    },
  );
});
