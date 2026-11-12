import type { ProcessConfiguration } from './types';

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
  tagState: { registered: ReadonlySet<string>; assigned: ReadonlySet<string> },
): ProcessFieldErrors {
  const errors: ProcessFieldErrors = {};
  if (!record.name.trim()) errors.name = 'nameRequired';
  if (!record.station.trim()) errors.station = 'stationRequired';
  if (record.mode === 'devices' && record.devices.length === 0)
    errors.deviceCount = 'devicesRequired';
  const { registered, assigned } = tagState;
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
