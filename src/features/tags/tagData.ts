import type { RegisteredTag } from '../configurations/tagRegistry';
import { loadProcesses } from '../processes/processData';
import type { ProcessConfiguration } from '../processes/types';
import { loadStorages } from '../storages/storageData';
import type { StorageConfiguration } from '../storages/types';

interface TagAssignment {
  type: 'process' | 'device' | 'storage';
  name: string;
  process?: string;
  path: string;
}

export function collectTagAssignments(
  processes: ProcessConfiguration[],
  storages: StorageConfiguration[],
): Map<string, TagAssignment> {
  const assignments = new Map<string, TagAssignment>();
  for (const process of processes) {
    const path = `/configurations/processes/${encodeURIComponent(process.id)}`;
    if (process.mode === 'process')
      assignments.set(process.processTag.toUpperCase(), {
        type: 'process',
        name: process.name,
        path,
      });
    else
      for (const device of process.devices)
        assignments.set(device.tag.toUpperCase(), {
          type: 'device',
          name: device.name,
          process: process.name,
          path,
        });
  }
  for (const storage of storages)
    assignments.set(storage.tag.toUpperCase(), {
      type: 'storage',
      name: storage.number,
      path: `/configurations/storages/${encodeURIComponent(storage.id)}`,
    });
  return assignments;
}

export function loadTagAssignments() {
  const processes = loadProcesses();
  const storages = loadStorages();
  return {
    assignments: collectTagAssignments(processes.records, storages.records),
    unavailable: processes.storageUnavailable || storages.storageUnavailable,
  };
}

export function emptyTag(): RegisteredTag {
  return { id: crypto.randomUUID(), name: '', actual: '' };
}

export function normalizeTag(tag: RegisteredTag): RegisteredTag {
  return { ...tag, name: tag.name.trim(), actual: tag.actual.trim() };
}

type TagFieldError =
  | 'duplicateName'
  | 'duplicateId'
  | 'assignedId'
  | 'assignmentsUnavailable'
  | 'nameRequired'
  | 'actualRequired';
type TagFieldErrors = Partial<Record<'name' | 'actual', TagFieldError>>;

export function getTagFieldErrors(
  tag: RegisteredTag,
  records: RegisteredTag[],
  assignedIds: ReadonlySet<string>,
  assignmentsUnavailable = false,
): TagFieldErrors {
  const errors: TagFieldErrors = {};
  if (!tag.name.trim()) errors.name = 'nameRequired';
  else if (
    records.some(
      (record) =>
        record.id !== tag.id &&
        record.name.trim().toLowerCase() === tag.name.trim().toLowerCase(),
    )
  )
    errors.name = 'duplicateName';
  if (!tag.actual.trim()) errors.actual = 'actualRequired';
  else if (
    records.some(
      (record) =>
        record.id !== tag.id &&
        record.actual.trim().toUpperCase() === tag.actual.trim().toUpperCase(),
    )
  )
    errors.actual = 'duplicateId';
  const previous = records.find((record) => record.id === tag.id);
  if (!errors.actual && previous && previous.actual !== tag.actual) {
    if (assignmentsUnavailable) errors.actual = 'assignmentsUnavailable';
    else if (assignedIds.has(previous.actual.toUpperCase()))
      errors.actual = 'assignedId';
  }
  return errors;
}
