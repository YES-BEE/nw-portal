import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  readFilterOptions,
  type FilterOptionMap,
  type FilterOptionType,
  type ProductionLotsQuery,
} from '../../api/productionFilters';
import {
  collectApiItems,
  readApiPage,
  type ApiPage,
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
  DashboardMetricsResponse,
  StationWorkload,
  ProductionTrend,
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
function isWorkload(value: unknown): value is StationWorkload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    text(row.id) &&
    text(row.code) &&
    typeof row.name === 'string' &&
    count(row.wip)
  );
}
const percent = (value: unknown): value is number =>
  typeof value === 'number' &&
  Number.isFinite(value) &&
  value >= 0 &&
  value <= 100;
function isStation(value: unknown): value is StationWip {
  return (
    isWorkload(value) &&
    'share_percent' in value &&
    percent(value.share_percent)
  );
}
function isMetrics(value: unknown): value is DashboardMetricsResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    [
      'totalLots',
      'openLots',
      'completedLots',
      'stylesWithLots',
      'storedLots',
      'availableTrolleys',
      'inTransitLots',
      'readyToStartLots',
      'totalStationLotVisits',
      'highestStationWorkloadCount',
    ].every((key) => count(row[key])) &&
    percent(row.completedSharePercent) &&
    (row.highestStationWorkload === null ||
      isWorkload(row.highestStationWorkload))
  );
}
function isProductionTrend(
  value: unknown,
  snapshotAt: string,
): value is ProductionTrend {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(row.date) ||
    !text(row.timezone) ||
    row.interval !== 'HOUR' ||
    !Array.isArray(row.points) ||
    !row.points.length
  )
    return false;
  try {
    new Intl.DateTimeFormat('en-GB', { timeZone: row.timezone });
  } catch {
    return false;
  }
  let previousEnd: number | undefined;
  for (const point of row.points) {
    if (!point || typeof point !== 'object' || Array.isArray(point))
      return false;
    const item = point as Record<string, unknown>;
    if (
      !date(item.bucket_start) ||
      !date(item.bucket_end) ||
      !count(item.completed) ||
      !count(item.in_progress)
    )
      return false;
    const start = Date.parse(item.bucket_start),
      end = Date.parse(item.bucket_end);
    if (
      end < start ||
      end - start > 3600000 ||
      end > Date.parse(snapshotAt) ||
      (previousEnd !== undefined && start !== previousEnd)
    )
      return false;
    previousEnd = end;
  }
  return previousEnd === Date.parse(snapshotAt);
}
async function summaryPage(
  query: PageQuery,
  signal?: AbortSignal,
  path = 'dashboard',
): Promise<DashboardResponse> {
  const data = await request(() =>
    apiClient.get<unknown>(path, { ...options(signal), params: query }),
  );
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return invalid();
  const row = data as Record<string, unknown>;
  if (
    !isCounts(row.styles) ||
    !date(row.snapshotAt) ||
    !count(row.refreshIntervalSeconds) ||
    row.refreshIntervalSeconds < 1 ||
    row.refreshIntervalSeconds * 1000 > 2147483647 ||
    !isMetrics(row.metrics) ||
    !isCounts(row.lots) ||
    !count(row.storageOccupancies) ||
    !count(row.availableTrolleys) ||
    !isProductionTrend(row.productionTrend, row.snapshotAt)
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
    snapshotAt: row.snapshotAt,
    refreshIntervalSeconds: row.refreshIntervalSeconds,
    metrics: row.metrics,
    styles: row.styles,
    lots: row.lots,
    storageOccupancies: row.storageOccupancies,
    availableTrolleys: row.availableTrolleys,
    stations,
    productionTrend: row.productionTrend,
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
export function isDashboardLot(value: unknown): value is DashboardLot {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ['id', 'lot_number', 'status', 'style_id', 'style_number'].every((key) =>
      text(row[key]),
    ) &&
    percent(row.progress_percent) &&
    count(row.completed_processes) &&
    count(row.total_processes) &&
    row.completed_processes <= row.total_processes &&
    (row.quantity === null || (count(row.quantity) && row.quantity > 0)) &&
    (row.current_route_sequence === null ||
      count(row.current_route_sequence)) &&
    [
      'current_location_type',
      'current_location_id',
      'current_station',
      'current_station_id',
      'current_process',
      'current_process_id',
      'current_process_status',
      'location_label',
    ].every((key) => row[key] === null || typeof row[key] === 'string') &&
    date(row.created_at) &&
    (row.completed_at === null || date(row.completed_at))
  );
}
export async function getFactoryDisplay(
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  const first = await summaryPage(
    { page: 0, size: 100 },
    signal,
    'displays/factory-summary',
  );
  const stations = await collectApiItems(
    async (query) =>
      query
        ? (await summaryPage(query, signal, 'displays/factory-summary'))
            .stations
        : first.stations,
    isStation,
    (station) => station.id,
    invalid,
  );
  return { ...first, stations };
}
export async function getDisplayLots(
  query: ProductionLotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<DashboardLot>> {
  return readApiPage(
    await request(() =>
      apiClient.get<unknown>('displays/lots', {
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
export async function getDashboardLots(
  query: ProductionLotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<DashboardLot>> {
  const page = readApiPage(
    await request(() =>
      apiClient.post<unknown>('dashboard/lots', query, options(signal)),
    ),
    query,
    isDashboardLot,
    (row) => row.id,
    invalid,
  );
  const selectedStatus = query.status;
  if (selectedStatus && page.items.some((row) => row.status !== selectedStatus))
    return invalid();
  return page;
}
export async function getDashboardFilterOptions<K extends FilterOptionType>(
  kind: K,
  query: ProductionLotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<FilterOptionMap[K]>> {
  return readFilterOptions(
    kind,
    await request(() =>
      apiClient.post<unknown>(
        `dashboard/filter-options/${kind}`,
        query,
        options(signal),
      ),
    ),
    query,
    invalid,
  );
}
