import type { ProcessConfiguration } from './types';
import { loadTags } from '../configurations/tagRegistry';
import { loadStorages } from '../storages/storageData';

export const PROCESS_STORAGE_KEY = 'nw-track-process-config-v4';

function isProcess(value: unknown): value is ProcessConfiguration {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    ['id', 'name', 'description', 'station', 'processTag'].every(
      (key) => typeof record[key] === 'string',
    ) &&
    (record.mode === 'process' || record.mode === 'devices') &&
    Array.isArray(record.devices) &&
    record.devices.every((device: unknown) => {
      if (typeof device !== 'object' || device === null) return false;
      const fields = device as Record<string, unknown>;
      return ['name', 'description', 'tag'].every(
        (key) => typeof fields[key] === 'string',
      );
    })
  );
}

export function loadProcesses(): {
  records: ProcessConfiguration[];
  storageUnavailable: boolean;
} {
  try {
    const stored: unknown = JSON.parse(
      localStorage.getItem(PROCESS_STORAGE_KEY) ?? 'null',
    );
    if (Array.isArray(stored) && stored.every(isProcess)) {
      return {
        records: stored.map((record) => ({
          ...record,
          devices: record.devices.map((device, index) => ({
            ...device,
            id:
              typeof device.id === 'string' && device.id
                ? device.id
                : `${record.id}-device-${index}`,
          })),
        })),
        storageUnavailable: false,
      };
    }
    return {
      records: [],
      storageUnavailable: stored !== null,
    };
  } catch {
    return {
      records: [],
      storageUnavailable: true,
    };
  }
}

export function emptyProcess(): ProcessConfiguration {
  return {
    id: crypto.randomUUID(),
    name: '',
    description: '',
    station: '',
    mode: 'process',
    processTag: '',
    devices: [],
  };
}

export function normalizeProcess(
  record: ProcessConfiguration,
): ProcessConfiguration {
  return {
    ...record,
    name: record.name.trim(),
    description: record.description.trim(),
    station: record.station.trim(),
    processTag: record.mode === 'process' ? record.processTag : '',
    devices:
      record.mode === 'devices'
        ? record.devices.map((device) => ({
            ...device,
            name: device.name.trim(),
            description: device.description.trim(),
            tag: device.tag.trim(),
          }))
        : [],
  };
}

type ProcessFieldError =
  | 'processTag'
  | 'devicesRequired'
  | 'unregistered'
  | 'duplicateTags'
  | 'assignedTag'
  | 'nameRequired'
  | 'stationRequired'
  | 'deviceNameRequired'
  | 'deviceTagRequired';
type ProcessFieldErrors = Partial<Record<string, ProcessFieldError>>;

export function getProcessFieldErrors(
  record: ProcessConfiguration,
  records: ProcessConfiguration[],
): ProcessFieldErrors {
  const errors: ProcessFieldErrors = {};
  if (!record.name.trim()) errors.name = 'nameRequired';
  if (!record.station.trim()) errors.station = 'stationRequired';
  if (record.mode === 'devices' && record.devices.length === 0)
    errors.deviceCount = 'devicesRequired';
  const registered = new Set(loadTags().records.map((tag) => tag.actual));
  const assigned = new Set(
    [
      ...loadStorages().records.map((storage) => storage.tag),
      ...records
        .filter((process) => process.id !== record.id)
        .flatMap((process) =>
          process.mode === 'process'
            ? [process.processTag]
            : process.devices.map((device) => device.tag),
        ),
    ].map((tag) => tag.toUpperCase()),
  );
  if (record.mode === 'process') {
    if (!record.processTag) errors.processTag = 'processTag';
    else if (!registered.has(record.processTag))
      errors.processTag = 'unregistered';
    else if (assigned.has(record.processTag.toUpperCase()))
      errors.processTag = 'assignedTag';
  } else {
    const counts = new Map<string, number>();
    for (const device of record.devices)
      counts.set(
        device.tag.toUpperCase(),
        (counts.get(device.tag.toUpperCase()) ?? 0) + 1,
      );
    for (const device of record.devices) {
      if (!device.name.trim())
        errors[`devices.${device.id}.name`] = 'deviceNameRequired';
      const key = `devices.${device.id}.tag`;
      if (!device.tag) errors[key] = 'deviceTagRequired';
      else if (!registered.has(device.tag)) errors[key] = 'unregistered';
      else if ((counts.get(device.tag.toUpperCase()) ?? 0) > 1)
        errors[key] = 'duplicateTags';
      else if (assigned.has(device.tag.toUpperCase()))
        errors[key] = 'assignedTag';
    }
  }
  return errors;
}
