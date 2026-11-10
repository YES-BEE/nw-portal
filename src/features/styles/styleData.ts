import type { AuthSession } from '../auth/session';
import type { ProcessConfiguration } from '../processes/types';

export const STYLE_STORAGE_KEY = 'nw-track-styles-v2';
export type StyleMode = 'management' | 'own';
export interface StyleRecord {
  id: string;
  number: string;
  created: string;
  description: string;
  client: string;
  garments: number;
  lots: number;
  weight: number;
  avg: number;
  delivery: string;
  steps: string[];
  createdBy?: string;
  createdById?: string;
}
export type StyleDraft = Omit<
  StyleRecord,
  'garments' | 'lots' | 'weight' | 'avg'
> & {
  garments: string;
  lots: string;
  weight: string;
  avg: string;
};

export function isDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00Z');
  return (
    Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value
  );
}
const positive = (value: number) => Number.isFinite(value) && value > 0;

function parseStyle(value: unknown): StyleRecord | null {
  if (!value || typeof value !== 'object') return null;
  const record = value as Record<string, unknown>;
  const number = record.number ?? record.code;
  if (
    typeof number !== 'string' ||
    !number.trim() ||
    number.length > 60 ||
    !['id', 'created', 'description', 'client', 'delivery'].every(
      (key) => typeof record[key] === 'string',
    ) ||
    !record.id ||
    !(record.client as string).trim() ||
    (record.client as string).length > 120 ||
    !isDate(record.created as string) ||
    !isDate(record.delivery as string) ||
    String(record.delivery) < String(record.created) ||
    !Number.isSafeInteger(record.garments) ||
    !positive(record.garments as number) ||
    !Number.isSafeInteger(record.lots) ||
    !positive(record.lots as number) ||
    typeof record.weight !== 'number' ||
    !positive(record.weight) ||
    typeof record.avg !== 'number' ||
    !positive(record.avg) ||
    !Array.isArray(record.steps) ||
    !record.steps.length ||
    !record.steps.every((step) => typeof step === 'string' && step.trim()) ||
    (record.createdBy !== undefined && typeof record.createdBy !== 'string') ||
    (record.createdById !== undefined && typeof record.createdById !== 'string')
  )
    return null;
  return {
    id: record.id as string,
    number,
    created: record.created as string,
    description: record.description as string,
    client: record.client as string,
    garments: record.garments as number,
    lots: record.lots as number,
    weight: record.weight,
    avg: record.avg,
    delivery: record.delivery as string,
    steps: record.steps as string[],
    createdBy: record.createdBy as string | undefined,
    createdById: record.createdById as string | undefined,
  };
}

export function loadStyles(): {
  records: StyleRecord[];
  storageUnavailable: boolean;
} {
  try {
    const raw = localStorage.getItem(STYLE_STORAGE_KEY);
    if (raw === null)
      return {
        records: [],
        storageUnavailable: false,
      };
    const values: unknown = JSON.parse(raw);
    if (!Array.isArray(values)) throw new Error('Invalid styles');
    const records = values.map(parseStyle);
    if (records.some((record) => !record))
      throw new Error('Invalid style record');
    const valid = records as StyleRecord[];
    if (
      new Set(valid.map((record) => record.id)).size !== valid.length ||
      new Set(valid.map((record) => record.number.trim().toLowerCase()))
        .size !== valid.length
    )
      throw new Error('Duplicate styles');
    return { records: valid, storageUnavailable: false };
  } catch {
    return { records: [], storageUnavailable: true };
  }
}

export function toStyleDraft(record: StyleRecord): StyleDraft {
  return {
    ...record,
    garments: String(record.garments),
    lots: String(record.lots),
    weight: String(record.weight),
    avg: String(record.avg),
    steps: [...record.steps],
  };
}
export function emptyStyle(): StyleDraft {
  const today = new Date();
  const created = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return {
    id: crypto.randomUUID(),
    number: '',
    created,
    description: '',
    client: '',
    garments: '',
    lots: '',
    weight: '',
    avg: '',
    delivery: '',
    steps: [],
  };
}
export function normalizeStyle(draft: StyleDraft): StyleRecord {
  return {
    ...draft,
    number: draft.number.trim(),
    client: draft.client.trim(),
    description: draft.description.trim(),
    garments: Number(draft.garments),
    lots: Number(draft.lots),
    weight: Number(draft.weight),
    avg: Number(draft.avg),
    steps: [...draft.steps],
  };
}

export function getStyleErrors(
  draft: StyleDraft,
  records: StyleRecord[],
  processes: ProcessConfiguration[],
) {
  const fields: Partial<
    Record<
      | 'number'
      | 'created'
      | 'client'
      | 'garments'
      | 'lots'
      | 'weight'
      | 'avg'
      | 'delivery',
      | 'numberRequired'
      | 'numberDuplicate'
      | 'dateRequired'
      | 'clientRequired'
      | 'positiveInteger'
      | 'positiveWeight'
      | 'deliveryOrder'
    >
  > = {};
  if (!draft.number.trim()) fields.number = 'numberRequired';
  else if (
    records.some(
      (record) =>
        record.id !== draft.id &&
        record.number.trim().toLowerCase() ===
          draft.number.trim().toLowerCase(),
    )
  )
    fields.number = 'numberDuplicate';
  if (!isDate(draft.created)) fields.created = 'dateRequired';
  if (!draft.client.trim()) fields.client = 'clientRequired';
  for (const key of ['garments', 'lots'] as const)
    if (
      !Number.isSafeInteger(Number(draft[key])) ||
      !positive(Number(draft[key]))
    )
      fields[key] = 'positiveInteger';
  for (const key of ['weight', 'avg'] as const)
    if (!positive(Number(draft[key]))) fields[key] = 'positiveWeight';
  if (!isDate(draft.delivery)) fields.delivery = 'dateRequired';
  else if (isDate(draft.created) && draft.delivery < draft.created)
    fields.delivery = 'deliveryOrder';
  const steps = draft.steps.map(
    (id) => !processes.some((process) => process.id === id),
  );
  return {
    fields,
    steps,
    sequenceRequired: !draft.steps.length,
    valid:
      !Object.keys(fields).length &&
      draft.steps.length > 0 &&
      !steps.some(Boolean),
  };
}

export function ownsStyle(record: StyleRecord, session: AuthSession) {
  return record.createdById
    ? record.createdById === session.user.id
    : record.createdBy === session.user.username;
}
export function canViewStyle(
  record: StyleRecord,
  session: AuthSession | null,
  mode: StyleMode,
) {
  return Boolean(
    session &&
    (mode === 'management'
      ? session.modules.includes('styles')
      : session.modules.includes('newstyle') && ownsStyle(record, session)),
  );
}

export function saveStyleRecord(
  records: StyleRecord[],
  candidate: StyleRecord,
  editing: boolean,
  mode: StyleMode,
  session: AuthSession | null,
): StyleRecord[] | null {
  if (
    !session ||
    !session.modules.includes(mode === 'management' ? 'styles' : 'newstyle')
  )
    return null;
  if (editing) {
    if (mode !== 'management') return null;
    const original = records.find((record) => record.id === candidate.id);
    if (!original) return null;
    return records.map((record) =>
      record.id === candidate.id
        ? {
            ...candidate,
            createdBy: original.createdBy,
            createdById: original.createdById,
          }
        : record,
    );
  }
  if (records.some((record) => record.id === candidate.id)) return null;
  return [
    {
      ...candidate,
      createdBy: session.user.username,
      createdById: session.user.id,
    },
    ...records,
  ];
}
