import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import { readApiPage, type ApiPage } from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type { JsonValue } from '../lots/types';
import type { LotHistoryEvent, LotHistoryQuery, ReportsFailure } from './types';

export class ReportsError extends Error {
  readonly failure: ReportsFailure;
  constructor(failure: ReportsFailure) {
    super(failure.message);
    this.name = 'ReportsError';
    this.failure = failure;
  }
}
export function reportsFailure(error: unknown): ReportsFailure {
  return error instanceof ReportsError
    ? error.failure
    : { kind: 'network', action: 'retry' };
}
export function parseReportsFailure(
  data: unknown,
  status: number,
): ReportsFailure {
  const { problem, message } = readProblemDetails(data);
  const code = safeApiText(problem?.code);
  const kind: ReportsFailure['kind'] =
    status === 401
      ? 'authentication'
      : status === 403
        ? problem?.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 404 || (status === 409 && code === 'NOT_FOUND')
          ? 'notFound'
          : status === 400
            ? 'invalidRequest'
            : status >= 500
              ? 'service'
              : 'http';
  return {
    kind,
    message,
    status,
    code,
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : ['access', 'invalidRequest', 'notFound'].includes(kind)
          ? 'none'
          : 'retry',
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
      throw new ReportsError(
        parseReportsFailure(error.response.data, error.response.status),
      );
    throw new ReportsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new ReportsError(parseReportsFailure(response.data, response.status));
  return response.data;
}
function invalid(): never {
  throw new ReportsError({ kind: 'invalidResponse', action: 'retry' });
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();
const date = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
function isJson(value: unknown): value is JsonValue {
  return (
    value === null ||
    typeof value === 'string' ||
    typeof value === 'boolean' ||
    (typeof value === 'number' && Number.isFinite(value)) ||
    (Array.isArray(value)
      ? value.every(isJson)
      : typeof value === 'object' && Object.values(value).every(isJson))
  );
}
function isEvent(value: unknown): value is LotHistoryEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    text(row.id) &&
    text(row.location_type) &&
    date(row.occurred_at) &&
    (row.location_id === null || text(row.location_id)) &&
    (row.actor_id === null || text(row.actor_id)) &&
    isJson(row.detail)
  );
}
export async function getLotHistory(
  query: LotHistoryQuery,
  signal?: AbortSignal,
): Promise<ApiPage<LotHistoryEvent>> {
  const { lotId, ...page } = query;
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('reports/lot-history', {
        ...options(signal),
        params: { ...page, lotId },
      }),
    ),
    page,
    isEvent,
    (event) => event.id,
    invalid,
  );
}
