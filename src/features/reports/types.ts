import type { DashboardFailure } from '../dashboard/types';

export type ReportsFailure = DashboardFailure;

export type ReportFormat = 'csv' | 'xlsx' | 'pdf';
export type ReportKey =
  | 'style-lot-production'
  | 'station-processing-time'
  | 'delay-bottleneck'
  | 'lot-movement-traceability'
  | 'storage-waiting-time'
  | 'trolley-utilization'
  | 'operator-activity'
  | 'daily-production-summary';
export type ReportFilter =
  'styleId' | 'lotId' | 'stationId' | 'processId' | 'operatorId' | 'status';
export interface ReportCategory {
  id: string;
  key: ReportKey;
  name: string;
  description: string | null;
  displayOrder: number;
  formats: ReportFormat[];
  filters: ReportFilter[];
  requiredParameters: ('from' | 'to' | 'format')[];
}
export interface ReportExportResponse {
  blob: Blob;
  filename: string;
  exportId?: string;
}
export interface ReportExportRequest extends Partial<
  Record<ReportFilter, string>
> {
  format: ReportFormat;
  from: string;
  to: string;
}
