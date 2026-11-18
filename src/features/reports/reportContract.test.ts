import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import { exportReport, getReportCatalog } from './reportsApi';
import { isReportCategory, reportRequest } from './reportContract';
import type { ReportCategory, ReportExportRequest } from './types';

const report: ReportCategory = {
  id: '00000000-0000-0000-0000-000000000001',
  key: 'trolley-utilization',
  name: 'Trolley utilization',
  description: null,
  displayOrder: 1,
  formats: ['csv', 'pdf', 'xlsx'],
  filters: ['styleId', 'lotId', 'status'],
  requiredParameters: ['from', 'to', 'format'],
};
const query: ReportExportRequest = {
  from: '2026-11-01',
  to: '2026-11-18',
  format: 'pdf',
};
beforeEach(() => vi.restoreAllMocks());

it.each([
  { ...report, id: 'invalid' },
  { ...report, key: 'unknown-report' },
  { ...report, formats: ['pdf', 'pdf', 'xlsx'] },
  { ...report, filters: ['processId'] },
  { ...report, requiredParameters: [] },
  { ...report, displayOrder: 1.5 },
])('rejects invalid catalog contracts', async (item) => {
  expect(isReportCategory(item)).toBe(false);
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data: [item] });
  await expect(getReportCatalog()).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});

it.each([
  { ...query, from: '2026-02-30' },
  { ...query, from: '2026-12-01' },
  { ...query, styleId: 'invalid' },
  { ...query, processId: report.id },
  { ...query, status: 'COMPLETED' },
  { ...query, unexpected: 'value' },
])(
  'blocks unsupported or invalid requests before calling the backend',
  async (params) => {
    const get = vi.spyOn(apiClient, 'get');
    await expect(exportReport(report, params)).rejects.toMatchObject({
      failure: { kind: 'invalidRequest' },
    });
    expect(get).not.toHaveBeenCalled();
  },
);

it('normalizes optional status values and excludes blank parameters', () => {
  expect(
    reportRequest(report, { ...query, status: ' in_use ', lotId: '' }),
  ).toEqual({ ...query, status: 'IN_USE' });
});

it('rejects daily CSV exports', async () => {
  const daily: ReportCategory = {
    ...report,
    key: 'daily-production-summary',
    formats: ['xlsx', 'pdf'],
    filters: ['styleId', 'lotId', 'stationId', 'processId', 'status'],
  };
  await expect(
    exportReport(daily, { ...query, format: 'csv' }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidRequest' } });
});

it.each([
  'application/json',
  'text/html',
  'application/octet-stream',
  'text/csv',
])('rejects unexpected successful export content (%s)', async (type) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: new Blob(['payload'], { type }),
  });
  await expect(exportReport(report, query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});

it.each([400, 401, 403, 404, 409, 500])(
  'preserves backend problem responses for HTTP %s',
  async (status) => {
    const data = new Blob(['problem'], { type: 'application/problem+json' });
    Object.defineProperty(data, 'text', {
      value: async () =>
        JSON.stringify({
          detail: 'Backend report error',
          code: 'REPORT_ERROR',
        }),
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue({ status, data });
    await expect(exportReport(report, query)).rejects.toMatchObject({
      failure: {
        status,
        message: 'Backend report error',
        code: 'REPORT_ERROR',
      },
    });
  },
);

it('validates exposed export IDs and supplies a filename when response headers are not exposed', async () => {
  const data = new Blob(['pdf'], { type: 'application/pdf' });
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data });
  await expect(exportReport(report, query)).resolves.toMatchObject({
    filename: 'nw-track_trolley-utilization_2026-11-01_to_2026-11-18.pdf',
    blob: data,
  });
  get.mockResolvedValue({
    status: 200,
    data,
    headers: { 'x-report-export-id': 'invalid' },
  });
  await expect(exportReport(report, query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});

it('propagates cancellation without reporting a network failure', async () => {
  vi.spyOn(apiClient, 'get').mockRejectedValue(new CanceledError());
  await expect(exportReport(report, query)).rejects.toBeInstanceOf(
    CanceledError,
  );
});
