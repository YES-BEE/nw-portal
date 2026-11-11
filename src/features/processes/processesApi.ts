import { readApiPage } from '../../api/collections';
import type { ApiPage, ListQuery } from '../../api/collections';
import { collectApiItems } from '../../api/collections';
import type { PageQuery } from '../../api/collections';
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
  UpdateProcessRequest,
  UpdateProcessResponse,
  DeleteProcessResponse,
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
  operation: 'list' | 'create' | 'detail' | 'update' | 'delete' = 'list',
): ProcessesFailure {
  const { problem, message } = readProblemDetails(body);
  const fields = problem?.fieldErrors;
  const validation =
    (operation === 'create' || operation === 'update') &&
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
    (operation === 'detail' ||
      operation === 'update' ||
      operation === 'delete') &&
    (status === 404 || (status === 409 && problem?.code === 'NOT_FOUND'))
      ? 'notFound'
      : (operation === 'detail' || operation === 'delete') && status === 400
        ? 'invalidRequest'
        : (operation === 'create' || operation === 'update') && status === 400
          ? validation
            ? 'validation'
            : 'invalidRequest'
          : operation === 'create' && status === 404
            ? 'invalidRequest'
            : (operation === 'create' ||
                  operation === 'update' ||
                  operation === 'delete') &&
                status === 409
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
        : (operation === 'update' || operation === 'delete') &&
            kind === 'notFound'
          ? 'reload'
          : kind === 'access' ||
              kind === 'representation' ||
              kind === 'validation' ||
              kind === 'invalidRequest' ||
              kind === 'notFound' ||
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
  return collectApiItems(
    (params) => fetchProcesses(params, signal),
    isProcess,
    (item) => item.id,
    () => {
      throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}

export async function getProcess(
  processId: string,
  signal?: AbortSignal,
): Promise<ProcessResponse> {
  let response;
  try {
    response = await apiClient.get<unknown>(
      `processes/${encodeURIComponent(processId)}`,
      { signal, timeout: 10000, validateStatus: () => true },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new ProcessesError(
        parseProcessesFailure(
          error.response.data,
          error.response.status,
          'detail',
        ),
      );
    throw new ProcessesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ProcessesError(
      parseProcessesFailure(response.data, response.status, 'detail'),
    );
  if (
    !isProcess(response.data) ||
    response.data.id.toLowerCase() !== processId.toLowerCase()
  )
    throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
  return response.data;
}

export async function getProcessTags(
  signal?: AbortSignal,
): Promise<ProcessTagOptionResponse[]> {
  const fetchPage = async (params?: PageQuery): Promise<unknown> => {
    let response;
    try {
      response = await apiClient.get<ProcessFormLookupsResponse>('ui/lookups', {
        ...(params ? { params } : {}),
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
    return response.data?.tags;
  };
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
  const tags = await collectApiItems(
    fetchPage,
    isOption,
    (item) => item.id,
    () => {
      throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
  return tags;
}

export async function getProcessTagOptions(
  signal?: AbortSignal,
): Promise<ProcessTagOptionResponse[]> {
  const tags = await getProcessTags(signal);
  return tags.filter((tag) => tag.status === 'ACTIVE' && !tag.assigned);
}

export async function updateProcess(
  processId: string,
  body: UpdateProcessRequest,
  signal?: AbortSignal,
): Promise<UpdateProcessResponse> {
  let response;
  try {
    response = await apiClient.put<unknown>(
      `processes/${encodeURIComponent(processId)}`,
      body,
      { signal, timeout: 10000, validateStatus: () => true },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new ProcessesError(
        parseProcessesFailure(
          error.response.data,
          error.response.status,
          'update',
        ),
      );
    throw new ProcessesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ProcessesError(
      parseProcessesFailure(response.data, response.status, 'update'),
    );
  if (
    !isProcess(response.data) ||
    response.data.id.toLowerCase() !== processId.toLowerCase()
  )
    throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
  return response.data;
}

export async function deleteProcess(
  processId: string,
  signal?: AbortSignal,
): Promise<DeleteProcessResponse> {
  let response;
  try {
    response = await apiClient.delete<unknown>(
      `processes/${encodeURIComponent(processId)}`,
      { signal, timeout: 10000, validateStatus: () => true },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new ProcessesError(
        parseProcessesFailure(
          error.response.data,
          error.response.status,
          'delete',
        ),
      );
    throw new ProcessesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ProcessesError(
      parseProcessesFailure(response.data, response.status, 'delete'),
    );
  const data = response.data;
  if (
    !isProcess(data) ||
    data.id.toLowerCase() !== processId.toLowerCase() ||
    data.active !== false
  )
    throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
  return { ...data, active: false };
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

async function fetchProcesses(
  params?: PageQuery,
  signal?: AbortSignal,
): Promise<unknown> {
  let response;
  try {
    response = await apiClient.get<unknown>('processes', {
      ...(params ? { params } : {}),
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
  return response.data;
}

export async function getProcessesPage(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<ProcessResponse>> {
  return readApiPage(
    await fetchProcesses(query, signal),
    query,
    isProcess,
    (item) => item.id,
    () => {
      throw new ProcessesError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
