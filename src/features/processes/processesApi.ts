import axios from 'axios';
import { apiClient } from '../../api/client';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  ProcessDeviceResponse,
  ProcessResponse,
  ProcessesResponse,
  ProcessesFailure,
  CreateProcessRequest,
  CreateProcessResponse,
  CreateProcessField,
  ProcessTagOptionResponse,
  ProcessFormLookupsResponse,
} from './types';

export class ProcessesError extends Error {
  readonly failure: ProcessesFailure;
  constructor(failure: ProcessesFailure) {
    super(failure.message);
    this.name = 'ProcessesError';
    this.failure = failure;
  }
}

export function parseProcessesFailure(
  body: unknown,
  status: number,
  operation: 'list' | 'create' = 'list',
): ProcessesFailure {
  const { problem, message } = readProblemDetails(body);
  const fields = problem?.fieldErrors;
  const validation =
    operation === 'create' &&
    status === 400 &&
    problem?.code === 'VALIDATION_FAILED' &&
    fields &&
    typeof fields === 'object' &&
    !Array.isArray(fields);
  const fieldErrors: Partial<Record<CreateProcessField, string>> = {};
  if (validation)
    for (const [field, value] of Object.entries(fields)) {
      if (
        ![
          'name',
          'description',
          'stationNumber',
          'nfcMode',
          'quality',
          'nfcUid',
          'devices',
          'deviceCount',
          'code',
          'stationId',
          'targetDurationSeconds',
          'tagId',
        ].includes(field) &&
        !/^devices\[\d+\]\.(name|description|nfcUid|type|tagId)$/.test(field)
      )
        continue;
      const text = safeApiText(value);
      if (text) fieldErrors[field as CreateProcessField] = text;
    }
  const roleChanged =
    status === 403 &&
    problem?.status === 403 &&
    problem.code === 'ACCESS_DENIED' &&
    problem.detail === 'Role changed; log in again' &&
    typeof problem.type === 'string' &&
    typeof problem.title === 'string' &&
    (problem.instance === undefined || typeof problem.instance === 'string');
  const kind: ProcessesFailure['kind'] =
    operation === 'create' && status === 400
      ? validation
        ? 'validation'
        : 'invalidRequest'
      : operation === 'create' && status === 404
        ? 'invalidRequest'
        : operation === 'create' && status === 409
          ? 'conflict'
          : status === 401
            ? 'authentication'
            : status === 403
              ? roleChanged
                ? 'roleChanged'
                : 'access'
              : status === 406
                ? 'representation'
                : status >= 500 && status <= 599
                  ? 'service'
                  : 'http';
  return {
    kind,
    status,
    message,
    code: safeApiText(problem?.code),
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : kind === 'access' ||
            kind === 'representation' ||
            kind === 'validation' ||
            kind === 'invalidRequest' ||
            kind === 'conflict'
          ? 'none'
          : 'retry',
  };
}

const nullableText = (value: unknown) =>
  value === null || typeof value === 'string';
const nonnegativeInteger = (value: unknown) =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;

function isDevice(value: unknown): value is ProcessDeviceResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const device = value as Record<string, unknown>;
  return (
    [
      'id',
      'process_id',
      'name',
      'machine_type',
      'status',
      'type',
      'processId',
      'stationNumber',
    ].every((key) => typeof device[key] === 'string' && !!device[key].trim()) &&
    ['description', 'nfc_uid', 'nfcUid'].every((key) =>
      nullableText(device[key]),
    )
  );
}

function isProcess(value: unknown): value is ProcessResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const process = value as Record<string, unknown>;
  return (
    ['id', 'code', 'name', 'station_id', 'station_code', 'stationNumber'].every(
      (key) => typeof process[key] === 'string' && !!process[key].trim(),
    ) &&
    ['nfc_mode', 'nfcMode'].every(
      (key) => process[key] === 'PROCESS' || process[key] === 'DEVICES',
    ) &&
    ['description', 'nfc_uid', 'nfcUid'].every((key) =>
      nullableText(process[key]),
    ) &&
    ['quality', 'active'].every((key) => typeof process[key] === 'boolean') &&
    ['version', 'device_count', 'deviceCount'].every((key) =>
      nonnegativeInteger(process[key]),
    ) &&
    (process.target_duration_seconds === null ||
      nonnegativeInteger(process.target_duration_seconds)) &&
    Array.isArray(process.devices) &&
    process.devices.every(isDevice) &&
    new Set(process.devices.map((device) => device.id)).size ===
      process.devices.length
  );
}

export async function getProcesses(
  signal?: AbortSignal,
): Promise<ProcessesResponse> {
  let response;
  try {
    response = await apiClient.get<unknown>('processes', {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    });
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new ProcessesError(
        parseProcessesFailure(error.response.data, error.response.status),
      );
    throw new ProcessesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ProcessesError(
      parseProcessesFailure(response.data, response.status),
    );
  const data = response.data;
  if (
    !Array.isArray(data) ||
    !data.every(isProcess) ||
    new Set(data.map((process) => process.id)).size !== data.length
  )
    throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

export async function getProcessTagOptions(
  signal?: AbortSignal,
): Promise<ProcessTagOptionResponse[]> {
  let response;
  try {
    response = await apiClient.get<ProcessFormLookupsResponse>('ui/lookups', {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    });
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new ProcessesError(
        parseProcessesFailure(error.response.data, error.response.status),
      );
    throw new ProcessesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ProcessesError(
      parseProcessesFailure(response.data, response.status),
    );
  const isOption = (value: unknown): value is ProcessTagOptionResponse => {
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
  };
  const tags = response.data?.tags;
  if (
    !Array.isArray(tags) ||
    !tags.every(isOption) ||
    new Set(tags.map((tag) => tag.id)).size !== tags.length
  )
    throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
  return tags.filter((tag) => tag.status === 'ACTIVE' && !tag.assigned);
}

export async function createProcess(
  body: CreateProcessRequest,
  signal?: AbortSignal,
): Promise<CreateProcessResponse> {
  let response;
  try {
    response = await apiClient.post<unknown>('processes', body, {
      signal,
      timeout: 10000,
      validateStatus: () => true,
    });
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new ProcessesError(
        parseProcessesFailure(
          error.response.data,
          error.response.status,
          'create',
        ),
      );
    throw new ProcessesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ProcessesError(
      parseProcessesFailure(response.data, response.status, 'create'),
    );
  if (!isProcess(response.data))
    throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
  return response.data;
}
