import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  sampleProcesses,
  getProcessFieldErrors,
} from '../processes/processData';
import {
  loadStorages,
  normalizeStorage,
  sampleStorages,
  STORAGE_STORAGE_KEY,
  getStorageFieldErrors,
} from './storageData';

beforeEach(() => {
  localStorage.clear();
});

describe('storage validation', () => {
  it('allows editing a storage without changing its own tag', () => {
    expect(
      getStorageFieldErrors(sampleStorages[0], sampleStorages, sampleProcesses),
    ).toEqual({});
  });
  it.each([
    { changes: { number: ' ' }, expected: 'numberRequired' },
    { changes: { tag: '' }, expected: 'tagRequired' },
    { changes: { number: ' st-002 ' }, expected: 'duplicateNumber' },
    { changes: { tag: 'unknown-tag' }, expected: 'unregistered' },
    { changes: { tag: 'NFC-STORE-002' }, expected: 'assignedTag' },
    { changes: { tag: 'NFC-PROC-001' }, expected: 'assignedTag' },
    { changes: { tag: 'NFC-DEV-001' }, expected: 'assignedTag' },
  ])(
    'rejects an invalid storage: $expected ($changes)',
    ({ changes, expected }) => {
      expect(
        Object.values(
          getStorageFieldErrors(
            { ...sampleStorages[0], ...changes },
            sampleStorages,
            sampleProcesses,
          ),
        ),
      ).toContain(expected);
    },
  );
  it('trims input without mutating the original record', () => {
    const record = {
      id: 'new',
      number: ' ST-003 ',
      description: ' Holding area ',
      tag: ' NFC-STORE-003 ',
    };
    expect(normalizeStorage(record)).toEqual({
      id: 'new',
      number: 'ST-003',
      description: 'Holding area',
      tag: 'NFC-STORE-003',
    });
    expect(record.number).toBe(' ST-003 ');
  });
  it('blocks process assignment to a saved storage tag and releases it after deletion', () => {
    const storage = {
      id: 'custom-storage',
      number: 'ST-003',
      description: '',
      tag: 'NFC-PROC-002',
    };
    const process = { ...sampleProcesses[0], processTag: 'NFC-PROC-002' };
    localStorage.setItem(STORAGE_STORAGE_KEY, JSON.stringify([storage]));
    expect(getProcessFieldErrors(process, sampleProcesses)).toMatchObject({
      processTag: 'assignedTag',
    });
    localStorage.setItem(STORAGE_STORAGE_KEY, '[]');
    expect(getProcessFieldErrors(process, sampleProcesses)).toEqual({});
  });
});

describe('storage persistence', () => {
  it('preserves a saved empty list', () => {
    localStorage.setItem(STORAGE_STORAGE_KEY, '[]');
    expect(loadStorages()).toEqual({ records: [], storageUnavailable: false });
  });
  it.each(['{invalid', '[{"number":"ST-003"}]'])(
    'recovers invalid data without overwriting it: %s',
    (stored) => {
      localStorage.setItem(STORAGE_STORAGE_KEY, stored);
      expect(loadStorages()).toEqual({
        records: sampleStorages,
        storageUnavailable: true,
      });
      expect(localStorage.getItem(STORAGE_STORAGE_KEY)).toBe(stored);
    },
  );
  it('reports unavailable browser storage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('Storage denied');
    });
    expect(loadStorages()).toEqual({
      records: sampleStorages,
      storageUnavailable: true,
    });
  });
});
