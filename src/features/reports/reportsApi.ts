import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  readFilterOptions,
  type FilterOptionMap,
  type FilterOptionType,
  type ProductionLotsQuery,
} from '../../api/productionFilters';
import {
  readApiPage,
  type ApiPage,
  type ListQuery,
} from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import { isDashboardLot } from '../dashboard/dashboardApi';
import type {
  LotProgressResponse,
  ReportsFailure,
  StyleProgressResponse,
} from './types';

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
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
function isStyleProgress(value: unknown): value is StyleProgressResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    text(row.id) &&
    text(row.style_number) &&
    typeof row.status === 'string' &&
    ['DRAFT', 'RELEASED', 'IN_PRODUCTION', 'COMPLETED'].includes(row.status) &&
    date(row.created_at) &&
    (row.released_at === null || date(row.released_at)) &&
    count(row.lot_count) &&
    count(row.completed_lots) &&
    row.completed_lots <= row.lot_count &&
    typeof row.progress_percent === 'number' &&
    Number.isFinite(row.progress_percent) &&
    row.progress_percent >= 0 &&
    row.progress_percent <= 100 &&
    (row.lot_count !== 0 || row.progress_percent === 0)
  );
}
export async function getStyleProgress(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<StyleProgressResponse>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('reports/style-progress', {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    isStyleProgress,
    (style) => style.id,
    invalid,
  );
}
export async function getLotProgress(
  query: ProductionLotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<LotProgressResponse>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('reports/lot-progress', {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    isDashboardLot,
    (lot) => lot.id,
    invalid,
  );
}
export async function getReportFilterOptions<K extends FilterOptionType>(
  kind: K,
  query: ProductionLotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<FilterOptionMap[K]>> {
  return readFilterOptions(
    kind,
    await request(() =>
      apiClient.get<unknown>(`reports/filter-options/${kind}`, {
        ...options(signal),
        params: query,
      }),
    ),
    query,
    invalid,
  );
}
