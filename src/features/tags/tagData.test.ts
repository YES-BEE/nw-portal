import { beforeEach, describe, expect, it } from 'vitest';
import {
  defaultTags,
  loadTags,
  TAG_STORAGE_KEY,
} from '../configurations/tagRegistry';
import {
  sampleProcesses,
  getProcessFieldErrors,
} from '../processes/processData';
import { sampleStorages, getStorageFieldErrors } from '../storages/storageData';
import {
  collectTagAssignments,
  normalizeTag,
  getTagFieldErrors,
} from './tagData';

beforeEach(() => {
  localStorage.clear();
});

describe('tag validation', () => {
  const newTag = { id: 'new-tag', name: 'Factory Tag', actual: '04:AA:BB:CC' };

  it.each([
    { change: { name: ' ' }, expected: 'nameRequired' },
    { change: { actual: '' }, expected: 'actualRequired' },
    { change: { name: 'lot preparation tag' }, expected: 'duplicateName' },
    { change: { actual: 'nfc-proc-001' }, expected: 'duplicateId' },
  ])('rejects $expected ($change)', ({ change, expected }) => {
    expect(
      Object.values(
        getTagFieldErrors({ ...newTag, ...change }, defaultTags, new Set()),
      ),
    ).toContain(expected);
  });

  it('allows renaming an assigned tag while preserving its NFC ID', () => {
    expect(
      getTagFieldErrors(
        { ...defaultTags[0], name: 'Renamed tag' },
        defaultTags,
        new Set(['NFC-PROC-001']),
      ),
    ).toEqual({});
  });

  it('rejects NFC ID changes on assigned tags, including case-only changes', () => {
    expect(
      getTagFieldErrors(
        { ...defaultTags[0], actual: 'nfc-proc-001' },
        defaultTags,
        new Set(['NFC-PROC-001']),
      ),
    ).toMatchObject({ actual: 'assignedId' });
  });

  it('locks NFC ID changes when assignments cannot be verified', () => {
    expect(
      getTagFieldErrors(
        { ...defaultTags[6], actual: 'NEW-ID' },
        defaultTags,
        new Set(),
        true,
      ),
    ).toMatchObject({ actual: 'assignmentsUnavailable' });
  });

  it('trims input without changing the original tag', () => {
    const tag = { ...newTag, name: ' Factory Tag ', actual: ' 04:AA:BB:CC ' };
    expect(normalizeTag(tag)).toEqual(newTag);
    expect(tag.name).toBe(' Factory Tag ');
  });

  it('finds process, device, and storage assignments and their detail links', () => {
    const assignments = collectTagAssignments(sampleProcesses, sampleStorages);
    expect(assignments.get('NFC-PROC-001')).toMatchObject({
      type: 'process',
      name: 'Lot Preparation',
      path: '/configurations/processes/demo-1',
    });
    expect(assignments.get('NFC-DEV-001')).toMatchObject({
      type: 'device',
      name: 'Washer 01',
      process: 'Washing',
    });
    expect(assignments.get('NFC-STORE-001')).toMatchObject({
      type: 'storage',
      name: 'ST-001',
      path: '/configurations/storages/storage-demo-1',
    });
  });

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
        records: defaultTags,
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
