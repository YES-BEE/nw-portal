import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import {
  readFilterOptions,
  type FilterOptionMap,
  type FilterOptionType,
  type ProductionLotsQuery,
} from '../../api/productionFilters';
import { type ApiPage } from '../../api/collections';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';

import {
  isReportCategory,
  isUuid,
  reportContentTypes,
  reportRequest,
} from './reportContract';
import type {
  ReportsFailure,
  ReportCategory,
  ReportExportRequest,
  ReportExportResponse,
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
    if (error instanceof ReportsError) throw error;
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
export async function getReportCatalog(
  signal?: AbortSignal,
): Promise<ReportCategory[]> {
  const data = await request(() =>
    apiClient.get<unknown>('reports/catalog', options(signal)),
  );
  if (
    !Array.isArray(data) ||
    !data.every(isReportCategory) ||
    new Set(data.map((row) => row.id.toLowerCase())).size !== data.length ||
    new Set(data.map((row) => row.key)).size !== data.length
  )
    return invalid();
  return [...data].sort((a, b) => a.displayOrder - b.displayOrder);
}
export async function exportReport(
  report: ReportCategory,
  query: ReportExportRequest,
  signal?: AbortSignal,
): Promise<ReportExportResponse> {
  try {
    query = reportRequest(report, query);
  } catch (error) {
    throw new ReportsError({
      kind: 'invalidRequest',
      action: 'none',
      message:
        error instanceof Error ? error.message : 'Invalid report request.',
    });
  }
  let exportId: string | undefined;
  let filename = `nw-track_${report.key}_${query.from}_to_${query.to}.${query.format}`;
  const data = await request(async () => {
    let response: AxiosResponse<unknown>;
    try {
      response = await apiClient.post<Blob>(
        `reports/${encodeURIComponent(report.id)}/export`,
        query,
        {
          signal,
          responseType: 'blob',
          timeout: 120000,
          headers: {
            Accept:
              'application/pdf, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/problem+json',
          },
          validateStatus: () => true,
        },
      );
    } catch (error) {
      if (axios.isAxiosError(error) && error.response)
        response = error.response;
      else throw error;
    }
    if (
      response.data instanceof Blob &&
      (response.status < 200 || response.status >= 300)
    ) {
      let problem: unknown;
      try {
        problem = JSON.parse(await response.data.text());
      } catch {
        problem = undefined;
      }
      throw new ReportsError(parseReportsFailure(problem, response.status));
    }
    if (
      response.status !== 200 &&
      response.status >= 200 &&
      response.status < 300
    )
      return invalid();
    if (response.status === 200) {
      const contentType = String(
        response.headers?.['content-type'] ||
          (response.data instanceof Blob ? response.data.type : ''),
      )
        .split(';')[0]
        .trim()
        .toLowerCase();
      if (contentType !== reportContentTypes[query.format]) return invalid();
      const headerId = response.headers?.['x-report-export-id'];
      if (headerId !== undefined) {
        if (!isUuid(headerId)) return invalid();
        exportId = headerId;
      }
    }
    const disposition = String(response.headers?.['content-disposition'] || '');
    const supplied = /filename="([^"\r\n]+)"/i.exec(disposition)?.[1];
    if (supplied && supplied.toLowerCase().endsWith(`.${query.format}`))
      filename = Array.from(supplied, (character) =>
        character.charCodeAt(0) < 32 || character === '/' || character === '\\'
          ? '_'
          : character,
      ).join('');
    return response;
  });
  if (
    !(data instanceof Blob) ||
    !data.size ||
    /json|text\/html/i.test(data.type)
  )
    return invalid();
  return { blob: data, filename, ...(exportId ? { exportId } : {}) };
}
export async function getReportFilterOptions<K extends FilterOptionType>(
  kind: K,
  query: ProductionLotsQuery,
  signal?: AbortSignal,
): Promise<ApiPage<FilterOptionMap[K]>> {
  return readFilterOptions(
    kind,
    await request(() =>
      apiClient.post<unknown>(
        `reports/filter-options/${kind}`,
        query,
        options(signal),
      ),
    ),
    query,
    invalid,
  );
}
