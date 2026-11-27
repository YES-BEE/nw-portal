import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  collectApiItems,
  readApiPage,
  type ApiPage,
  type ListQuery,
} from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  StorageUnitRecord,
  StorageUnitResponse,
  StorageUnitRequest,
  UpdateStorageUnitRequest,
  StorageUnitStatusRequest,
  StorageAreaOptionResponse,
  StorageTagOptionResponse,
  StorageFailure,
  StorageAreaRequest,
  StorageAreaResponse,
  StorageStationOption,
} from './types';

export class StorageError extends Error {
  readonly failure: StorageFailure;
  constructor(failure: StorageFailure) {
    super(failure.message);
    this.name = 'StorageError';
    this.failure = failure;
  }
}
export function storageFailure(error: unknown): StorageFailure {
  return error instanceof StorageError
    ? error.failure
    : { kind: 'network', action: 'retry' };
}
export function parseStorageFailure(
  data: unknown,
  status: number,
): StorageFailure {
  const { problem, message } = readProblemDetails(data);
  const code = safeApiText(problem?.code);
  const fieldErrors: StorageFailure['fieldErrors'] = {};
  const fields = problem?.fieldErrors;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const field of [
      'code',
      'name',
      'nfcUids',
      'storageAreaId',
      'stationId',
      'stationNumber',
      'storageNumber',
      'description',
      'tagId',
      'nfcUid',
    ] as const) {
      const value = safeApiText((fields as Record<string, unknown>)[field]);
      if (value) fieldErrors[field] = value;
    }
    const tagErrors = Object.entries(fields)
      .filter(([key]) => /^nfcUids\[\d+\]/.test(key))
      .map(([, value]) => safeApiText(value))
      .filter((value): value is string => !!value);
    if (!fieldErrors.nfcUids && tagErrors.length)
      fieldErrors.nfcUids = [...new Set(tagErrors)].join(' ');
  }
  if (message && ['NFC_ALREADY_ASSIGNED', 'NFC_DISABLED'].includes(code ?? ''))
    fieldErrors.nfcUids = message;
  if (message && code === 'STORAGE_NUMBER_EXISTS')
    fieldErrors.storageNumber = message;
  const kind: StorageFailure['kind'] =
    status === 401
      ? 'authentication'
      : status === 403
        ? code === 'ACCESS_DENIED' &&
          problem?.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 404 || (status === 409 && code === 'NOT_FOUND')
          ? 'notFound'
          : status === 400
            ? code === 'VALIDATION_FAILED'
              ? 'validation'
              : 'invalidRequest'
            : status === 409
              ? 'conflict'
              : status >= 500 && status <= 599
                ? 'service'
                : 'http';
  return {
    kind,
    message,
    status,
    code,
    fieldErrors,
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : kind === 'notFound'
          ? 'reload'
          : kind === 'service' || kind === 'http'
            ? 'retry'
            : 'none',
  };
}
async function request(
  send: () => Promise<AxiosResponse<unknown>>,
): Promise<unknown> {
  let response;
  try {
    response = await send();
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new StorageError(
        parseStorageFailure(error.response.data, error.response.status),
      );
    throw new StorageError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new StorageError(parseStorageFailure(response.data, response.status));
  return response.data;
}
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();
function isUnitRecord(value: unknown): value is StorageUnitRecord {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ['id', 'station_id', 'storage_area_id', 'code', 'name'].every((key) =>
      text(row[key]),
    ) &&
    typeof row.active === 'boolean' &&
    typeof row.version === 'number' &&
    Number.isSafeInteger(row.version) &&
    row.version >= 0
  );
}
export function isStorageUnit(value: unknown): value is StorageUnitResponse {
  return (
    isUnitRecord(value) &&
    'station_code' in value &&
    text(value.station_code) &&
    'storage_area_code' in value &&
    text(value.storage_area_code)
  );
}
function invalid(): never {
  throw new StorageError({ kind: 'invalidResponse', action: 'retry' });
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
function unitRecord(data: unknown, id?: string): StorageUnitRecord {
  if (!isUnitRecord(data) || (id && data.id.toLowerCase() !== id.toLowerCase()))
    return invalid();
  return data;
}
function single(data: unknown, id: string): StorageUnitResponse {
  if (!isStorageUnit(data) || data.id.toLowerCase() !== id.toLowerCase())
    return invalid();
  return data;
}
export async function getStorageUnits(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<StorageUnitResponse>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('storage-locations', {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    isStorageUnit,
    (row) => row.id,
    invalid,
  );
}
export async function getStorageUnit(
  id: string,
  signal?: AbortSignal,
): Promise<StorageUnitResponse> {
  return single(
    await request(() =>
      apiClient.get<unknown>(
        `storage-locations/${encodeURIComponent(id)}`,
        options(signal),
      ),
    ),
    id,
  );
}
export async function createStorageUnit(
  areaId: string,
  body: StorageUnitRequest,
  signal?: AbortSignal,
): Promise<StorageUnitRecord> {
  const value = unitRecord(
    await request(() =>
      apiClient.post<unknown>(
        `storage-areas/${encodeURIComponent(areaId)}/units`,
        body,
        options(signal),
      ),
    ),
  );
  if (value.storage_area_id.toLowerCase() !== areaId.toLowerCase())
    return invalid();
  return value;
}
export async function updateStorageUnit(
  id: string,
  body: UpdateStorageUnitRequest,
  signal?: AbortSignal,
): Promise<StorageUnitRecord> {
  return unitRecord(
    await request(() =>
      apiClient.put<unknown>(
        `storage-units/${encodeURIComponent(id)}`,
        body,
        options(signal),
      ),
    ),
    id,
  );
}
export async function setStorageUnitStatus(
  id: string,
  body: StorageUnitStatusRequest,
  signal?: AbortSignal,
): Promise<StorageUnitResponse> {
  const value = single(
    await request(() =>
      apiClient.patch<unknown>(
        `storage-locations/${encodeURIComponent(id)}/status`,
        body,
        options(signal),
      ),
    ),
    id,
  );
  if (value.active !== body.active) return invalid();
  return value;
}
export async function getStorageAreaOptions(
  signal?: AbortSignal,
): Promise<StorageAreaOptionResponse[]> {
  const areas = await collectApiItems(
    (page) =>
      request(() =>
        apiClient.get<unknown>('storage-areas', {
          ...options(signal),
          params: {
            page: page?.page ?? 0,
            size: page?.size ?? 100,
            search: '',
          },
        }),
      ),
    (value): value is StorageAreaOptionResponse => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const row = value as Record<string, unknown>;
      return (
        ['id', 'station_id', 'station_code', 'code', 'name'].every((key) =>
          text(row[key]),
        ) && typeof row.active === 'boolean'
      );
    },
    (row) => row.id,
    invalid,
  );
  return areas.filter((area) => area.active);
}
function isStorageArea(value: unknown): value is StorageAreaOptionResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ['id', 'station_id', 'station_code', 'code', 'name'].every((key) =>
      text(row[key]),
    ) && typeof row.active === 'boolean'
  );
}
export async function getStorageAreas(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<StorageAreaOptionResponse>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('storage-areas', {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    isStorageArea,
    (row) => row.id,
    invalid,
  );
}
export async function createStorageArea(
  body: StorageAreaRequest,
  signal?: AbortSignal,
): Promise<StorageAreaResponse> {
  const data = await request(() =>
    apiClient.post<unknown>('storage-areas', body, options(signal)),
  );
  if (!isStorageArea(data)) return invalid();
  const row = data as StorageAreaResponse;
  if (
    !Number.isSafeInteger(row.version) ||
    row.version < 0 ||
    (row.description !== null && typeof row.description !== 'string') ||
    !text(row.nfc_uid)
  )
    return invalid();
  return row;
}
export async function getStorageTags(
  signal?: AbortSignal,
): Promise<StorageTagOptionResponse[]> {
  return collectApiItems(
    async (page) => {
      const data = await request(() =>
        apiClient.get<unknown>('ui/lookups', {
          ...options(signal),
          ...(page ? { params: page } : {}),
        }),
      );
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return invalid();
      return (data as Record<string, unknown>).tags;
    },
    (value): value is StorageTagOptionResponse => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const tag = value as Record<string, unknown>;
      return (
        ['id', 'name', 'uid'].every(
          (key) => typeof tag[key] === 'string' && !!tag[key].trim(),
        ) &&
        (tag.status === 'ACTIVE' || tag.status === 'DELETED') &&
        typeof tag.assigned === 'boolean'
      );
    },
    (tag) => tag.id,
    invalid,
  );
}
export async function getStorageStations(
  signal?: AbortSignal,
): Promise<StorageStationOption[]> {
  const stations = await collectApiItems(
    (page) =>
      request(() =>
        apiClient.get<unknown>('stations', {
          ...options(signal),
          params: { page: page?.page ?? 0, size: page?.size ?? 10, search: '' },
        }),
      ),
    (value): value is StorageStationOption => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const row = value as Record<string, unknown>;
      return (
        ['id', 'code', 'name'].every((key) => text(row[key])) &&
        typeof row.active === 'boolean'
      );
    },
    (row) => row.id,
    invalid,
  );
  return stations.filter((station) => station.active);
}
