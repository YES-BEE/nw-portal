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
  StyleResponse,
  CreateStyleRequest,
  StyleRouteEntry,
  StyleRouteProcess,
  StyleRouteResponse,
  StyleProcessOption,
  StyleRevisionRequest,
  StyleRevisionResponse,
  RevisionScope,
  StylesFailure,
  StyleLookupsResponse,
  UpdateStyleProcessesRequest,
  StyleRevisionHistoryItem,
} from './types';
export class StylesError extends Error {
  readonly failure: StylesFailure;
  constructor(failure: StylesFailure) {
    super(failure.message);
    this.name = 'StylesError';
    this.failure = failure;
  }
}
export function stylesFailure(error: unknown): StylesFailure {
  return error instanceof StylesError
    ? error.failure
    : { kind: 'network', action: 'retry' };
}
export function parseStylesFailure(
  data: unknown,
  status: number,
): StylesFailure {
  const { problem, message } = readProblemDetails(data);
  const code = safeApiText(problem?.code);
  const kind: StylesFailure['kind'] =
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
  const fieldErrors: StylesFailure['fieldErrors'] = {};
  const fields = problem?.fieldErrors;
  if (fields && typeof fields === 'object' && !Array.isArray(fields)) {
    for (const field of [
      'styleNumber',
      'description',
      'processIds',
      'quantity',
      'lotCount',
      'reason',
    ] as const) {
      const value = safeApiText((fields as Record<string, unknown>)[field]);
      if (value) fieldErrors[field] = value;
    }
    if (!fieldErrors.processIds) {
      const messages = Object.entries(fields)
        .filter(([key]) => /^processIds\[\d+\]/.test(key))
        .map(([, value]) => safeApiText(value))
        .filter((value): value is string => !!value);
      if (messages.length)
        fieldErrors.processIds = [...new Set(messages)].join(' ');
    }
  }
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
          : ['service', 'http'].includes(kind)
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
      throw new StylesError(
        parseStylesFailure(error.response.data, error.response.status),
      );
    throw new StylesError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new StylesError(parseStylesFailure(response.data, response.status));
  return response.data;
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();
const nonnegative = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
function invalid(): never {
  throw new StylesError({ kind: 'invalidResponse', action: 'retry' });
}
function isStyle(value: unknown): value is StyleResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    text(row.id) &&
    text(row.style_number) &&
    (row.description === null || typeof row.description === 'string') &&
    ['DRAFT', 'RELEASED', 'IN_PRODUCTION', 'COMPLETED'].includes(
      String(row.status),
    ) &&
    (row.released_at === null || date(row.released_at)) &&
    date(row.created_at) &&
    (row.created_by === null || text(row.created_by)) &&
    nonnegative(row.version) &&
    nonnegative(row.lot_count) &&
    row.lot_count <= 1000 &&
    (row.lot_quantity === null ||
      (nonnegative(row.lot_quantity) && row.lot_quantity > 0))
  );
}
function single(data: unknown, id?: string): StyleResponse {
  if (!isStyle(data) || (id && data.id.toLowerCase() !== id.toLowerCase()))
    return invalid();
  return data;
}
function isRouteProcess(value: unknown): value is StyleRouteProcess {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    ['processId', 'processCode', 'stationId', 'stationCode'].every((key) =>
      text(row[key]),
    ) &&
    nonnegative(row.sequence) &&
    row.sequence > 0
  );
}
function isEntry(value: unknown): value is StyleRouteEntry {
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    nonnegative(row.sequence) &&
    row.sequence > 0 &&
    text(row.stationId) &&
    text(row.stationCode) &&
    Array.isArray(row.processes) &&
    row.processes.length > 0 &&
    row.processes.every(isRouteProcess)
  );
}
function route(data: unknown): StyleRouteResponse {
  if (!Array.isArray(data) || !data.every(isEntry)) return invalid();
  let index = 0;
  const seen = new Set<string>();
  for (const [entryIndex, entry] of data.entries()) {
    if (entry.sequence !== entryIndex + 1) return invalid();
    for (const process of entry.processes) {
      if (
        process.sequence <= index ||
        process.stationId !== entry.stationId ||
        process.stationCode !== entry.stationCode ||
        seen.has(process.processId)
      )
        return invalid();
      index = process.sequence;
      seen.add(process.processId);
    }
  }
  return data;
}
export async function getStyles(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<StyleResponse>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('styles', { ...options(signal), params: query }),
    ),
    query,
    isStyle,
    (row) => row.id,
    invalid,
  );
}
export async function getStyle(
  id: string,
  signal?: AbortSignal,
): Promise<StyleResponse> {
  return single(
    await request(() =>
      apiClient.get<unknown>(
        `styles/${encodeURIComponent(id)}`,
        options(signal),
      ),
    ),
    id,
  );
}
export async function createStyle(
  body: CreateStyleRequest,
  signal?: AbortSignal,
): Promise<StyleResponse> {
  return single(
    await request(() =>
      apiClient.post<unknown>('styles', body, options(signal)),
    ),
  );
}
export async function getStyleRoute(
  id: string,
  signal?: AbortSignal,
): Promise<StyleRouteResponse> {
  try {
    return route(
      await request(() =>
        apiClient.get<unknown>(
          `styles/${encodeURIComponent(id)}/derived-route`,
          options(signal),
        ),
      ),
    );
  } catch (error: unknown) {
    if (
      error instanceof StylesError &&
      error.failure.status === 409 &&
      error.failure.code === 'STYLE_PROCESS_REQUIRED'
    )
      return [];
    throw error;
  }
}
export async function releaseStyle(
  id: string,
  signal?: AbortSignal,
): Promise<StyleResponse> {
  const value = single(
    await request(() =>
      apiClient.post<unknown>(
        `styles/${encodeURIComponent(id)}/release`,
        undefined,
        { ...options(signal), timeout: 120000 },
      ),
    ),
    id,
  );
  if (value.status === 'DRAFT') return invalid();
  return value;
}
export async function updateStyleProcesses(
  id: string,
  body: UpdateStyleProcessesRequest,
  signal?: AbortSignal,
): Promise<StyleRouteResponse> {
  return route(
    await request(() =>
      apiClient.put<unknown>(
        `styles/${encodeURIComponent(id)}/processes`,
        body,
        options(signal),
      ),
    ),
  );
}
export async function getStyleRevisions(
  id: string,
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<StyleRevisionHistoryItem>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>(`styles/${encodeURIComponent(id)}/revisions`, {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    (value): value is StyleRevisionHistoryItem => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const row = value as Record<string, unknown>;
      return (
        ['id', 'actor_id', 'actor_role', 'reason'].every((key) =>
          text(row[key]),
        ) &&
        nonnegative(row.revision_no) &&
        row.revision_no > 0 &&
        nonnegative(row.affected_lot_count) &&
        date(row.created_at)
      );
    },
    (row) => row.id,
    invalid,
  );
}
export async function reviseStyle(
  id: string,
  scope: RevisionScope,
  body: StyleRevisionRequest,
  signal?: AbortSignal,
): Promise<StyleRevisionResponse> {
  const value = await request(() =>
    apiClient.post<unknown>(
      `styles/${encodeURIComponent(id)}/revisions/${scope}`,
      body,
      options(signal),
    ),
  );
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return invalid();
  const row = value as Record<string, unknown>;
  if (
    !text(row.revisionId) ||
    !nonnegative(row.revisionNumber) ||
    row.revisionNumber < 1 ||
    !nonnegative(row.affectedLots) ||
    row.scope !== (scope === 'unstarted' ? 'UNSTARTED' : 'ALL_IN_PROGRESS')
  )
    return invalid();
  return {
    revisionId: row.revisionId,
    revisionNumber: row.revisionNumber,
    affectedLots: row.affectedLots,
    scope: scope === 'unstarted' ? 'UNSTARTED' : 'ALL_IN_PROGRESS',
  };
}
export async function getStyleProcessOptions(
  signal?: AbortSignal,
): Promise<StyleProcessOption[]> {
  return collectApiItems(
    async (page) => {
      const data = await request(() =>
        apiClient.get<StyleLookupsResponse>('ui/lookups', {
          ...options(signal),
          ...(page ? { params: page } : {}),
        }),
      );
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return invalid();
      return (data as Record<string, unknown>).processes;
    },
    (value): value is StyleProcessOption => {
      if (!value || typeof value !== 'object') return false;
      const row = value as Record<string, unknown>;
      return ['id', 'name', 'station_id', 'stationNumber'].every((key) =>
        text(row[key]),
      );
    },
    (row) => row.id,
    invalid,
  );
}
