import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  collectApiItems,
  readApiPage,
  type ApiPage,
  type ListQuery,
  type PageQuery,
} from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  DashboardFailure,
  DashboardLot,
  DashboardResponse,
  DashboardSummary,
  StationWip,
  StatusCount,
} from './types';

export class DashboardError extends Error {
  readonly failure: DashboardFailure;
  constructor(failure: DashboardFailure) {
    super(failure.message);
    this.name = 'DashboardError';
    this.failure = failure;
  }
}
export function dashboardFailure(error: unknown): DashboardFailure {
  return error instanceof DashboardError
    ? error.failure
    : { kind: 'network', action: 'retry' };
}
export function parseDashboardFailure(
  data: unknown,
  status: number,
): DashboardFailure {
  const { problem, message } = readProblemDetails(data);
  const code = safeApiText(problem?.code);
  const kind: DashboardFailure['kind'] =
    status === 401
      ? 'authentication'
      : status === 403
        ? code === 'ACCESS_DENIED' &&
          problem?.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 404
          ? 'notFound'
          : status === 400
            ? 'invalidRequest'
            : status >= 500 && status <= 599
              ? 'service'
              : 'http';
  return {
    kind,
    message,
    code,
    status,
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : kind === 'access' || kind === 'invalidRequest'
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
      throw new DashboardError(
        parseDashboardFailure(error.response.data, error.response.status),
      );
    throw new DashboardError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new DashboardError(
      parseDashboardFailure(response.data, response.status),
    );
  return response.data;
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();
const count = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) =>
  value === null || typeof value === 'string';
function invalid(): never {
  throw new DashboardError({ kind: 'invalidResponse', action: 'retry' });
}
function isCounts(value: unknown): value is StatusCount[] {
  return (
    Array.isArray(value) &&
    value.every(
      (row: unknown) =>
        !!row &&
        typeof row === 'object' &&
        !Array.isArray(row) &&
        text((row as StatusCount).status) &&
        count((row as StatusCount).count),
    ) &&
    new Set(value.map((row: StatusCount) => row.status)).size === value.length
  );
}
function isStation(value: unknown): value is StationWip {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    text(row.id) &&
    text(row.code) &&
    typeof row.name === 'string' &&
    count(row.wip)
  );
}
async function summaryPage(
  query: PageQuery,
  signal?: AbortSignal,
): Promise<DashboardResponse> {
  const data = await request(() =>
    apiClient.get<unknown>('dashboard', { ...options(signal), params: query }),
  );
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return invalid();
  const row = data as Record<string, unknown>;
  if (
    !isCounts(row.styles) ||
    !isCounts(row.lots) ||
    !count(row.storageOccupancies) ||
    !count(row.availableTrolleys)
  )
    return invalid();
  const stations = readApiPage(
    row.stations,
    { ...query, search: '' },
    isStation,
    (station) => station.id,
    invalid,
  );
  return {
    styles: row.styles,
    lots: row.lots,
    storageOccupancies: row.storageOccupancies,
    availableTrolleys: row.availableTrolleys,
    stations,
  };
}
export async function getDashboard(
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  const first = await summaryPage({ page: 0, size: 100 }, signal);
  const stations = await collectApiItems(
    async (query) =>
      query ? (await summaryPage(query, signal)).stations : first.stations,
    isStation,
    (station) => station.id,
    invalid,
  );
  return { ...first, stations };
}
function isLot(value: unknown): value is DashboardLot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ['id', 'lot_number', 'status', 'style_id', 'style_number'].every((key) =>
      text(row[key]),
    ) &&
    (row.quantity === null || (count(row.quantity) && row.quantity > 0)) &&
    (row.current_route_sequence === null ||
      count(row.current_route_sequence)) &&
    [
      'current_location_type',
      'current_location_id',
      'current_station',
      'current_process',
    ].every((key) => nullableText(row[key])) &&
    date(row.created_at) &&
    (row.completed_at === null || date(row.completed_at))
  );
}
export async function getDashboardLots(
  query: ListQuery,
  signal?: AbortSignal,
  status?: string,
): Promise<ApiPage<DashboardLot>> {
  const page = readApiPage(
    await request(() =>
      apiClient.get<unknown>('dashboard/lots', {
        ...options(signal),
        params: { ...query, ...(status ? { status } : {}) },
      }),
    ),
    query,
    isLot,
    (row) => row.id,
    invalid,
  );
  if (status && page.items.some((row) => row.status !== status))
    return invalid();
  return page;
}
