import {
  defaultTags,
  sampleProcesses,
  sampleStorages,
  seedTestData,
} from '../../test/fixtures';
import { beforeEach, describe, expect, it } from 'vitest';
import { loadTags, TAG_STORAGE_KEY } from './tagRegistry';
import { getProcessFieldErrors } from '../processes/processData';
import { getStorageFieldErrors } from '../storages/storageData';

beforeEach(() => {
  seedTestData();
});

describe('registered tags for configuration validation', () => {
  const newTag = { id: 'new-tag', name: 'Factory Tag', actual: '04:AA:BB:CC' };

  it('uses saved tag registrations for both process and storage validation', () => {
    localStorage.setItem(
      TAG_STORAGE_KEY,
      JSON.stringify([...defaultTags, newTag]),
    );
    const process = { ...sampleProcesses[0], processTag: newTag.actual };
    const storage = { ...sampleStorages[0], tag: newTag.actual };
    expect(getProcessFieldErrors(process, sampleProcesses)).toEqual({});
    expect(
      getStorageFieldErrors(storage, sampleStorages, sampleProcesses),
    ).toEqual({});
    localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(defaultTags));
    expect(getProcessFieldErrors(process, sampleProcesses)).toMatchObject({
      processTag: 'unregistered',
    });
    expect(
      getStorageFieldErrors(storage, sampleStorages, sampleProcesses),
    ).toMatchObject({ tag: 'unregistered' });
  });
});

describe('tag registry persistence', () => {
  it('preserves an empty registry', () => {
    localStorage.setItem(TAG_STORAGE_KEY, '[]');
    expect(loadTags()).toEqual({ records: [], storageUnavailable: false });
  });

  it.each(['{invalid', '[{"name":"incomplete"}]'])(
    'recovers invalid data without overwriting it: %s',
    (stored) => {
      localStorage.setItem(TAG_STORAGE_KEY, stored);
      expect(loadTags()).toEqual({
        records: [],
        storageUnavailable: true,
      });
      expect(localStorage.getItem(TAG_STORAGE_KEY)).toBe(stored);
    },
  );

  it('supports a legacy registry without record IDs', () => {
    localStorage.setItem(
      TAG_STORAGE_KEY,
      JSON.stringify([{ name: 'Legacy tag', actual: 'LEGACY-ID' }]),
    );
    expect(loadTags()).toEqual({
      records: [{ id: 'tag-1', name: 'Legacy tag', actual: 'LEGACY-ID' }],
      storageUnavailable: false,
    });
  });
});
