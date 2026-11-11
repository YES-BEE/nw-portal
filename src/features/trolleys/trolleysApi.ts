import axios from 'axios';
import type { AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type {
  TrolleyResponse,
  TrolleyRequest,
  TrolleyStatusRequest,
  TrolleysResponse,
  TrolleysQuery,
  TrolleysFailure,
} from './types';

export class TrolleysError extends Error {
  readonly failure: TrolleysFailure;
  constructor(failure: TrolleysFailure) {
    super(failure.message);
    this.name = 'TrolleysError';
    this.failure = failure;
  }
}
function failure(data: unknown, status: number): TrolleysFailure {
  const { problem, message } = readProblemDetails(data);
  const codeError =
    problem?.code === 'VALIDATION_FAILED' &&
    problem.fieldErrors &&
    typeof problem.fieldErrors === 'object'
      ? safeApiText((problem.fieldErrors as Record<string, unknown>).code)
      : undefined;
  const kind: TrolleysFailure['kind'] =
    status === 401
      ? 'authentication'
      : status === 403
        ? problem?.code === 'ACCESS_DENIED' &&
          problem.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 404 || (status === 409 && problem?.code === 'NOT_FOUND')
          ? 'notFound'
          : status === 400
            ? problem?.code === 'VALIDATION_FAILED'
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
    codeError,
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
      throw new TrolleysError(
        failure(error.response.data, error.response.status),
      );
    throw new TrolleysError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new TrolleysError(failure(response.data, response.status));
  return response.data;
}
function isTrolley(value: unknown): value is TrolleyResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return (
    ['id', 'code', 'status'].every(
      (key) => typeof row[key] === 'string' && !!row[key].trim(),
    ) &&
    typeof row.active === 'boolean' &&
    typeof row.version === 'number' &&
    Number.isSafeInteger(row.version) &&
    row.version >= 0
  );
}
function invalid(): never {
  throw new TrolleysError({ kind: 'invalidResponse', action: 'retry' });
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});
function single(data: unknown, id?: string): TrolleyResponse {
  if (!isTrolley(data) || (id && data.id.toLowerCase() !== id.toLowerCase()))
    return invalid();
  return data;
}
export async function getTrolleys(
  query: TrolleysQuery,
  signal?: AbortSignal,
): Promise<TrolleysResponse> {
  const data = await request(() =>
    apiClient.get<unknown>('trolleys', { ...options(signal), params: query }),
  );
  if (Array.isArray(data) && data.length === 0)
    return { items: [], page: query.page, size: query.size, totalElements: 0 };
  if (!data || typeof data !== 'object' || Array.isArray(data))
    return invalid();
  const page = data as Record<string, unknown>;
  if (
    !Array.isArray(page.items) ||
    !page.items.every(isTrolley) ||
    new Set(page.items.map((item) => item.id)).size !== page.items.length ||
    page.page !== query.page ||
    page.size !== query.size ||
    typeof page.totalElements !== 'number' ||
    !Number.isSafeInteger(page.totalElements) ||
    page.totalElements < 0 ||
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
export async function getTrolley(
  id: string,
  signal?: AbortSignal,
): Promise<TrolleyResponse> {
  return single(
    await request(() =>
      apiClient.get<unknown>(
        `trolleys/${encodeURIComponent(id)}`,
        options(signal),
      ),
    ),
    id,
  );
}
export async function createTrolley(
  body: TrolleyRequest,
  signal?: AbortSignal,
): Promise<TrolleyResponse> {
  return single(
    await request(() =>
      apiClient.post<unknown>(
        'trolleys',
        { code: body.code.trim() },
        options(signal),
      ),
    ),
  );
}
export async function updateTrolley(
  id: string,
  body: TrolleyRequest,
  signal?: AbortSignal,
): Promise<TrolleyResponse> {
  return single(
    await request(() =>
      apiClient.put<unknown>(
        `trolleys/${encodeURIComponent(id)}`,
        { code: body.code.trim() },
        options(signal),
      ),
    ),
    id,
  );
}
export async function setTrolleyStatus(
  id: string,
  body: TrolleyStatusRequest,
  signal?: AbortSignal,
): Promise<TrolleyResponse> {
  const data = single(
    await request(() =>
      apiClient.patch<unknown>(
        `trolleys/${encodeURIComponent(id)}/status`,
        { active: body.active },
        options(signal),
      ),
    ),
    id,
  );
  if (data.active !== body.active) return invalid();
  return data;
}
