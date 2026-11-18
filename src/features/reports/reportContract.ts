import type {
  ReportCategory,
  ReportExportRequest,
  ReportFilter,
  ReportKey,
} from './types';

// Mirrors ReportModels.Type and ReportService.prepare in nw-track-api.
const base: ReportFilter[] = [
  'styleId',
  'lotId',
  'stationId',
  'processId',
  'status',
];
export const reportFilterContract: Record<ReportKey, ReportFilter[]> = {
  'style-lot-production': base,
  'station-processing-time': [...base, 'operatorId'],
  'delay-bottleneck': [...base, 'operatorId'],
  'lot-movement-traceability': [
    'styleId',
    'lotId',
    'stationId',
    'operatorId',
    'status',
  ],
  'storage-waiting-time': [
    'styleId',
    'lotId',
    'stationId',
    'operatorId',
    'status',
  ],
  'trolley-utilization': ['styleId', 'lotId', 'status'],
  'operator-activity': [...base, 'operatorId'],
  'daily-production-summary': base,
};
export const reportStatuses: Partial<Record<ReportKey, string[]>> = {
  'style-lot-production': [
    'DRAFT',
    'READY',
    'DISPATCHED',
    'AT_STATION',
    'IN_STORAGE',
    'IN_PROCESS',
    'READY_FOR_DISPATCH',
    'AT_QC',
    'COMPLETED',
    'CANCELLED',
  ],
  'daily-production-summary': [
    'DRAFT',
    'READY',
    'DISPATCHED',
    'AT_STATION',
    'IN_STORAGE',
    'IN_PROCESS',
    'READY_FOR_DISPATCH',
    'AT_QC',
    'COMPLETED',
    'CANCELLED',
  ],
  'station-processing-time': [
    'PENDING',
    'IN_PROGRESS',
    'PAUSED',
    'BLOCKED',
    'SKIPPED',
    'COMPLETED',
  ],
  'operator-activity': [
    'PENDING',
    'IN_PROGRESS',
    'PAUSED',
    'BLOCKED',
    'SKIPPED',
    'COMPLETED',
  ],
  'lot-movement-traceability': [
    'EXPECTED',
    'DISPATCHED',
    'RECEIVED',
    'ACTIVE',
    'READY_FOR_DISPATCH',
    'COMPLETED',
  ],
  'storage-waiting-time': ['WAITING', 'RETRIEVED'],
  'trolley-utilization': ['AVAILABLE', 'IN_USE', 'INACTIVE'],
  'delay-bottleneck': ['ON_TIME', 'DELAYED'],
};
export const reportContentTypes = {
  csv: 'text/csv',
  pdf: 'application/pdf',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
} as const;
export const isUuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(value);
const sameSet = (
  value: unknown,
  expected: readonly string[],
): value is string[] =>
  Array.isArray(value) &&
  value.length === expected.length &&
  expected.every((item) => value.includes(item));
export function isReportCategory(value: unknown): value is ReportCategory {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (
    typeof row.key !== 'string' ||
    !Object.hasOwn(reportFilterContract, row.key)
  )
    return false;
  const key = row.key as ReportKey;
  return (
    isUuid(row.id) &&
    typeof row.name === 'string' &&
    !!row.name.trim() &&
    (row.description === null || typeof row.description === 'string') &&
    Number.isSafeInteger(row.displayOrder) &&
    sameSet(
      row.formats,
      key === 'daily-production-summary'
        ? ['pdf', 'xlsx']
        : ['csv', 'pdf', 'xlsx'],
    ) &&
    sameSet(row.filters, reportFilterContract[key]) &&
    sameSet(row.requiredParameters, ['from', 'to', 'format'])
  );
}
function isDate(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return (
    Number.isFinite(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}
export function reportRequest(
  report: ReportCategory,
  query: ReportExportRequest,
): ReportExportRequest {
  const fail = (message: string): never => {
    throw new Error(message);
  };
  if (!isReportCategory(report))
    fail('The selected report is invalid. Reload the report catalog.');
  if (!isDate(query.from) || !isDate(query.to) || query.from > query.to)
    fail('Choose a valid date range.');
  if (!report.formats.includes(query.format))
    fail('This format is not supported by the selected report.');
  const request: ReportExportRequest = {
    from: query.from,
    to: query.to,
    format: query.format,
  };
  for (const key of Object.keys(query)) {
    if (['from', 'to', 'format'].includes(key)) continue;
    if (!report.filters.includes(key as ReportFilter))
      fail(`Unsupported report filter: ${key}`);
    const filter = key as ReportFilter;
    const value = query[filter];
    if (value === undefined || value === '') continue;
    if (typeof value !== 'string') fail(`Invalid ${key} filter.`);
    if (filter === 'status') {
      const normalized = value.trim().toUpperCase();
      if (!normalized) continue;
      if (
        reportStatuses[report.key] &&
        !reportStatuses[report.key]!.includes(normalized)
      )
        fail('Choose a supported status for this report.');
      request.status = normalized;
    } else {
      if (!isUuid(value)) fail(`Invalid ${key}: select a valid record.`);
      request[filter] = value;
    }
  }
  return request;
}
