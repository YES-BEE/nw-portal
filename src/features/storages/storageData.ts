import { loadTags } from '../configurations/tagRegistry';
import type { ProcessConfiguration } from '../processes/types';
import type { StorageConfiguration } from './types';

export const STORAGE_STORAGE_KEY = 'nw-track-storages-v1';

export const sampleStorages: StorageConfiguration[] = [
  {
    id: 'storage-demo-1',
    number: 'ST-001',
    description: 'Intermediate storage bay A',
    tag: 'NFC-STORE-001',
  },
  {
    id: 'storage-demo-2',
    number: 'ST-002',
    description: 'Finished goods holding area',
    tag: 'NFC-STORE-002',
  },
];

function isStorage(value: unknown): value is StorageConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return ['id', 'number', 'description', 'tag'].every(
    (key) => typeof record[key] === 'string',
  );
}

export function loadStorages(): {
  records: StorageConfiguration[];
  storageUnavailable: boolean;
} {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(STORAGE_STORAGE_KEY) ?? 'null',
    );
    if (Array.isArray(stored) && stored.every(isStorage))
      return { records: stored, storageUnavailable: false };
    return {
      records: structuredClone(sampleStorages),
      storageUnavailable: stored !== null,
    };
  } catch {
    return {
      records: structuredClone(sampleStorages),
      storageUnavailable: true,
    };
  }
}

export function emptyStorage(): StorageConfiguration {
  return { id: crypto.randomUUID(), number: '', description: '', tag: '' };
}

export function normalizeStorage(
  record: StorageConfiguration,
): StorageConfiguration {
  return {
    ...record,
    number: record.number.trim(),
    description: record.description.trim(),
    tag: record.tag.trim(),
  };
}

export function processTags(processes: ProcessConfiguration[]): string[] {
  return processes.flatMap((process) =>
    process.mode === 'process'
      ? [process.processTag]
      : process.devices.map((device) => device.tag),
  );
}

export type StorageFieldError =
  | 'duplicateNumber'
  | 'unregistered'
  | 'assignedTag'
  | 'numberRequired'
  | 'tagRequired';
export type StorageFieldErrors = Partial<
  Record<'number' | 'tag', StorageFieldError>
>;

export function getStorageFieldErrors(
  record: StorageConfiguration,
  records: StorageConfiguration[],
  processes: ProcessConfiguration[],
): StorageFieldErrors {
  const errors: StorageFieldErrors = {};
  if (!record.number.trim()) errors.number = 'numberRequired';
  else if (
    records.some(
      (storage) =>
        storage.id !== record.id &&
        storage.number.trim().toUpperCase() ===
          record.number.trim().toUpperCase(),
    )
  )
    errors.number = 'duplicateNumber';
  const assigned = [
    ...records
      .filter((storage) => storage.id !== record.id)
      .map((storage) => storage.tag),
    ...processTags(processes),
  ].map((tag) => tag.toUpperCase());
  if (!record.tag.trim()) errors.tag = 'tagRequired';
  else if (!loadTags().records.some((tag) => tag.actual === record.tag))
    errors.tag = 'unregistered';
  else if (assigned.includes(record.tag.toUpperCase()))
    errors.tag = 'assignedTag';
  return errors;
}
