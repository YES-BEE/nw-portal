import {
  sampleProcesses,
  seedTestData,
  defaultTags,
} from '../../test/fixtures';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  normalizeProcess,
  getProcessFieldErrors as validateProcess,
} from './processData';
import type { ProcessConfiguration } from './types';

function getProcessFieldErrors(
  record: ProcessConfiguration,
  records: ProcessConfiguration[],
) {
  return validateProcess(record, {
    registered: new Set(defaultTags.map((tag) => tag.actual)),
    assigned: new Set([
      'NFC-STORE-001',
      ...records
        .filter((item) => item.id !== record.id)
        .flatMap((item) =>
          item.mode === 'process'
            ? [item.processTag]
            : item.devices.map((device) => device.tag),
        ),
    ]),
  });
}
beforeEach(() => {
  seedTestData();
});

describe('process validation', () => {
  it('allows an existing process to retain its own tag', () => {
    expect(getProcessFieldErrors(sampleProcesses[0], sampleProcesses)).toEqual(
      {},
    );
  });

  it.each([
    { change: { name: '   ' }, expected: 'nameRequired' },
    { change: { station: '' }, expected: 'stationRequired' },
    { change: { processTag: '' }, expected: 'processTag' },
    { change: { processTag: 'UNREGISTERED' }, expected: 'unregistered' },
    { change: { processTag: 'NFC-DEV-001' }, expected: 'assignedTag' },
    { change: { processTag: 'NFC-STORE-001' }, expected: 'assignedTag' },
    { change: { mode: 'devices', devices: [] }, expected: 'devicesRequired' },
    {
      change: {
        mode: 'devices',
        devices: [
          { id: 'new', name: ' ', description: '', tag: 'NFC-DEV-001' },
        ],
      },
      expected: 'deviceNameRequired',
    },
  ] as const)(
    'rejects invalid configuration: $expected ($change)',
    ({ change, expected }) => {
      const record = {
        ...sampleProcesses[0],
        ...structuredClone(change),
      } as ProcessConfiguration;
      expect(
        Object.values(getProcessFieldErrors(record, sampleProcesses)),
      ).toContain(expected);
    },
  );

  it('rejects duplicate device tags within a process', () => {
    const record = structuredClone(sampleProcesses[1]);
    record.devices[1].tag = record.devices[0].tag;
    expect(getProcessFieldErrors(record, sampleProcesses)).toMatchObject({
      'devices.washer-1.tag': 'duplicateTags',
      'devices.washer-2.tag': 'duplicateTags',
    });
  });

  it('does not let a new process reuse a tag belonging to an existing process', () => {
    expect(
      getProcessFieldErrors(
        { ...sampleProcesses[0], id: 'new-process' },
        sampleProcesses,
      ),
    ).toMatchObject({ processTag: 'assignedTag' });
  });

  it('clears device tags when saving process-level tracking', () => {
    const record = {
      ...structuredClone(sampleProcesses[1]),
      mode: 'process' as const,
      name: ' Washing ',
      processTag: 'NFC-PROC-001',
    };
    expect(normalizeProcess(record)).toMatchObject({
      name: 'Washing',
      devices: [],
      processTag: 'NFC-PROC-001',
    });
    expect(record.devices).toHaveLength(2);
  });

  it('clears the process tag and trims device input when saving device-level tracking', () => {
    const record = structuredClone(sampleProcesses[1]);
    record.processTag = 'NFC-PROC-001';
    record.devices[0].name = ' Washer 01 ';
    expect(normalizeProcess(record)).toMatchObject({
      processTag: '',
      devices: [{ ...record.devices[0], name: 'Washer 01' }, record.devices[1]],
    });
  });
});
