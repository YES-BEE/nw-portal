import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  collectApiItems,
  readApiPage,
  type ApiPage,
} from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  LotResponse,
  CreateLotsRequest,
  CancelLotRequest,
  CancelLotResponse,
  LotTimelineEvent,
  LotStyleOption,
  LotLookupsResponse,
  LotsFailure,
  LotsQuery,
  JsonValue,
  LotQcResponse,
  CreateLotsResponse,
  LotTrolleyRequest,
  UpdateLotRequest,
} from './types';
import type { TrolleyResponse } from '../trolleys/types';
export class LotsError extends Error {
  readonly failure: LotsFailure;
  constructor(failure: LotsFailure) {
    super(failure.message);
    this.name = 'LotsError';
    this.failure = failure;
  }
}
export function lotsFailure(error: unknown): LotsFailure {
  return error instanceof LotsError
    ? error.failure
    : { kind: 'network', action: 'retry' };
}
export function parseLotsFailure(data: unknown, status: number): LotsFailure {
  const { problem, message } = readProblemDetails(data);
  const code = safeApiText(problem?.code);
  const kind: LotsFailure['kind'] =
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
  const fieldErrors: LotsFailure['fieldErrors'] = {};
  const fields = problem?.fieldErrors;
  if (fields && typeof fields === 'object' && !Array.isArray(fields))
    for (const field of [
      'lotCount',
      'quantity',
      'reason',
      'trolleyId',
    ] as const) {
      const text = safeApiText((fields as Record<string, unknown>)[field]);
      if (text) fieldErrors[field] = text;
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
      throw new LotsError(
        parseLotsFailure(error.response.data, error.response.status),
      );
    throw new LotsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new LotsError(parseLotsFailure(response.data, response.status));
  return response.data;
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
const text = (value: unknown): value is string =>
  typeof value === 'string' && !!value.trim();
const integer = (value: unknown): value is number =>
  typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string =>
  text(value) && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value === null || text(value);
function invalid(): never {
  throw new LotsError({ kind: 'invalidResponse', action: 'retry' });
}
function isLot(value: unknown): value is LotResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ['id', 'style_id', 'style_number', 'lot_number', 'status'].every((key) =>
      text(row[key]),
    ) &&
    (row.quantity === null || (integer(row.quantity) && row.quantity > 0)) &&
    nullableText(row.trolley_id) &&
    nullableText(row.trolley_code) &&
    (row.trolley_id === null) === (row.trolley_code === null) &&
    (row.current_route_sequence === null ||
      integer(row.current_route_sequence)) &&
    nullableText(row.current_location_type) &&
    nullableText(row.current_location_id) &&
    date(row.created_at) &&
    (row.completed_at === null || date(row.completed_at)) &&
    integer(row.version)
  );
}
function single(data: unknown, id?: string): LotResponse {
  if (!isLot(data) || (id && data.id.toLowerCase() !== id.toLowerCase()))
    return invalid();
  return data;
}
export async function getLots(
  query: LotsQuery,
  signal?: AbortSignal,
  styleId?: string,
): Promise<ApiPage<LotResponse>> {
  const path = styleId ? `styles/${encodeURIComponent(styleId)}/lots` : 'lots';
  const page = readApiPage(
    await request(() =>
      apiClient.get<unknown>(path, { ...options(signal), params: query }),
    ),
    query,
    isLot,
    (row) => row.id,
    invalid,
  );
  if (
    styleId &&
    page.items.some(
      (row) => row.style_id.toLowerCase() !== styleId.toLowerCase(),
    )
  )
    return invalid();
  return page;
}
export async function getLot(
  id: string,
  signal?: AbortSignal,
): Promise<LotResponse> {
  return single(
    await request(() =>
      apiClient.get<unknown>(`lots/${encodeURIComponent(id)}`, options(signal)),
    ),
    id,
  );
}
export async function createLots(
  styleId: string,
  body: CreateLotsRequest,
  signal?: AbortSignal,
): Promise<CreateLotsResponse> {
  const data = await request(() =>
    apiClient.post<unknown>(
      `styles/${encodeURIComponent(styleId)}/lots`,
      {
        ...(body.lotCount !== undefined ? { lotCount: body.lotCount } : {}),
        ...(body.quantity !== undefined ? { quantity: body.quantity } : {}),
      },
      { ...options(signal), timeout: 120000 },
    ),
  );
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return invalid();
  const batch = data as Record<string, unknown>;
  if (
    !integer(batch.createdCount) ||
    batch.createdCount !== (body.lotCount ?? 1) ||
    !Array.isArray(batch.items) ||
    batch.items.length !== batch.createdCount ||
    !batch.items.every(isLot) ||
    new Set(batch.items.map((row) => row.id)).size !== batch.items.length ||
    new Set(batch.items.map((row) => row.lot_number)).size !==
      batch.items.length ||
    batch.items.some(
      (row) =>
        row.style_id.toLowerCase() !== styleId.toLowerCase() ||
        row.quantity !== (body.quantity ?? null),
    )
  )
    return invalid();
  return { createdCount: batch.createdCount, items: batch.items };
}
export async function updateLot(
  id: string,
  body: UpdateLotRequest,
  signal?: AbortSignal,
): Promise<LotResponse> {
  const lot = single(
    await request(() =>
      apiClient.put<unknown>(
        `lots/${encodeURIComponent(id)}`,
        { quantity: body.quantity, reason: body.reason },
        options(signal),
      ),
    ),
    id,
  );
  if (lot.quantity !== body.quantity) return invalid();
  return lot;
}
export async function getLotQc(
  id: string,
  signal?: AbortSignal,
): Promise<LotQcResponse | null> {
  let data: unknown;
  try {
    data = await request(() =>
      apiClient.get<unknown>(
        `lots/${encodeURIComponent(id)}/qc`,
        options(signal),
      ),
    );
  } catch (error: unknown) {
    // The backend uses NOT_FOUND when queryForMap finds no inspection.
    if (
      error instanceof LotsError &&
      error.failure.status === 404 &&
      error.failure.code === 'NOT_FOUND'
    )
      return null;
    throw error;
  }
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return invalid();
  const row = data as Record<string, unknown>;
  if (
    !text(row.id) ||
    !text(row.lot_id) ||
    row.lot_id.toLowerCase() !== id.toLowerCase() ||
    !['PASS', 'PARTIAL_REJECT', 'REJECT'].includes(String(row.outcome)) ||
    !integer(row.inspected_quantity) ||
    row.inspected_quantity <= 0 ||
    !integer(row.good_quantity) ||
    !integer(row.rejected_quantity) ||
    row.good_quantity + row.rejected_quantity !== row.inspected_quantity ||
    !(row.reason === null || typeof row.reason === 'string') ||
    !nullableText(row.operator_id) ||
    !(row.completed_at === null || date(row.completed_at))
  )
    return invalid();
  return {
    id: row.id,
    lot_id: row.lot_id,
    outcome: row.outcome as LotQcResponse['outcome'],
    inspected_quantity: row.inspected_quantity,
    good_quantity: row.good_quantity,
    rejected_quantity: row.rejected_quantity,
    reason: row.reason,
    operator_id: row.operator_id as string | null,
    completed_at: row.completed_at as string | null,
  };
}
export async function cancelLot(
  id: string,
  body: CancelLotRequest,
  signal?: AbortSignal,
): Promise<CancelLotResponse> {
  const value = single(
    await request(() =>
      apiClient.post<unknown>(
        `lots/${encodeURIComponent(id)}/cancel`,
        body,
        options(signal),
      ),
    ),
    id,
  );
  if (value.status !== 'CANCELLED') return invalid();
  return { ...value, status: 'CANCELLED' };
}
function isJson(value: unknown, depth = 0): value is JsonValue {
  if (depth > 32) return false;
  if (value === null || typeof value === 'string' || typeof value === 'boolean')
    return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value))
    return value.every((item) => isJson(item, depth + 1));
  return (
    !!value &&
    typeof value === 'object' &&
    Object.values(value).every((item) => isJson(item, depth + 1))
  );
}
function isEvent(value: unknown): value is LotTimelineEvent {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    text(row.location_type) &&
    nullableText(row.location_id) &&
    nullableText(row.actor_id) &&
    date(row.occurred_at) &&
    isJson(row.detail)
  );
}
export async function getLotTimeline(
  id: string,
  query: LotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<LotTimelineEvent>> {
  const data = await request(() =>
    apiClient.get<unknown>(`lots/${encodeURIComponent(id)}/timeline`, {
      ...options(signal),
      params: query,
    }),
  );
  if (!data || typeof data !== 'object') return invalid();
  const page = data as Record<string, unknown>;
  // Timeline entries have no IDs and identical projected events are valid.
  if (
    !Array.isArray(page.items) ||
    !page.items.every(isEvent) ||
    page.page !== query.page ||
    page.size !== query.size ||
    !integer(page.totalElements) ||
    page.items.length > query.size ||
    page.totalElements < page.items.length
  )
    return invalid();
  return {
    items: page.items,
    page: query.page,
    size: query.size,
    totalElements: page.totalElements,
  };
}
export async function getLotStyleOptions(
  signal?: AbortSignal,
): Promise<LotStyleOption[]> {
  return collectApiItems(
    async (page) => {
      const data = await request(() =>
        apiClient.get<LotLookupsResponse>('ui/lookups', {
          ...options(signal),
          ...(page ? { params: page } : {}),
        }),
      );
      if (!data || typeof data !== 'object' || Array.isArray(data))
        return invalid();
      return (data as Record<string, unknown>).styles;
    },
    (value): value is LotStyleOption => {
      if (!value || typeof value !== 'object') return false;
      const row = value as Record<string, unknown>;
      return (
        text(row.id) &&
        text(row.style_number) &&
        (row.description === null || typeof row.description === 'string') &&
        (row.status === 'RELEASED' ||
          row.status === 'IN_PRODUCTION' ||
          row.status === 'COMPLETED')
      );
    },
    (row) => row.id,
    invalid,
  );
}
export async function getAvailableLotTrolleys(
  signal?: AbortSignal,
): Promise<TrolleyResponse[]> {
  return collectApiItems(
    async (query) =>
      request(() =>
        apiClient.get<unknown>('trolleys/available', {
          ...options(signal),
          params: query || { page: 0, size: 100 },
        }),
      ),
    (value): value is TrolleyResponse => {
      if (!value || typeof value !== 'object' || Array.isArray(value))
        return false;
      const row = value as Record<string, unknown>;
      return (
        text(row.id) &&
        text(row.code) &&
        text(row.status) &&
        row.active === true &&
        integer(row.version)
      );
    },
    (row) => row.id,
    invalid,
  );
}
export async function assignLotTrolley(
  id: string,
  body: LotTrolleyRequest,
  signal?: AbortSignal,
): Promise<LotResponse> {
  const lot = single(
    await request(() =>
      apiClient.put<unknown>(
        `lots/${encodeURIComponent(id)}/trolley`,
        body,
        options(signal),
      ),
    ),
    id,
  );
  if (lot.trolley_id !== body.trolleyId) return invalid();
  return lot;
}
export async function unassignLotTrolley(
  id: string,
  signal?: AbortSignal,
): Promise<LotResponse> {
  const lot = single(
    await request(() =>
      apiClient.delete<unknown>(
        `lots/${encodeURIComponent(id)}/trolley`,
        options(signal),
      ),
    ),
    id,
  );
  if (lot.trolley_id !== null) return invalid();
  return lot;
}
