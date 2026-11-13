import type { ApiPage } from '../../api/collections';
export interface DeviceConfiguration {
  id: string;
  name: string;
  description: string;
  tag: string;
}

export interface ProcessConfiguration {
  id: string;
  name: string;
  description: string;
  station: string;
  mode: 'process' | 'devices';
  processTag: string;
  devices: DeviceConfiguration[];
}

// MasterDataController.processView includes SQL columns and UI aliases.
export interface ProcessDeviceResponse {
  id: string;
  process_id: string;
  name: string;
  description: string | null;
  machine_type: string;
  status: string;
  nfc_uid: string | null;
  type: string;
  nfcUid: string | null;
  processId: string;
  stationNumber: string;
}

export interface ProcessResponse {
  id: string;
  code: string;
  name: string;
  station_id: string;
  station_code: string;
  target_duration_seconds: number | null;
  description: string | null;
  nfc_mode: 'PROCESS' | 'DEVICES';
  quality: boolean;
  active: boolean;
  version: number;
  device_count: number;
  nfc_uid: string | null;
  stationNumber: string;
  nfcMode: 'PROCESS' | 'DEVICES';
  nfcUid: string | null;
  deviceCount: number;
  devices: ProcessDeviceResponse[];
}

export interface CreateProcessDeviceRequest {
  name: string;
  description: string;
  nfcUid: string;
  type?: string;
  tagId?: string;
}

export interface CreateProcessRequest {
  name: string;
  description: string;
  stationNumber: string;
  nfcMode: 'PROCESS' | 'DEVICES';
  quality: boolean;
  nfcUid: string | null;
  devices: CreateProcessDeviceRequest[];
  deviceCount: number;
  code?: string;
  stationId?: string;
  targetDurationSeconds?: number;
  tagId?: string;
}

export type CreateProcessResponse = ProcessResponse;

export interface UpdateProcessDeviceRequest extends CreateProcessDeviceRequest {
  id?: string;
}

export interface UpdateProcessRequest extends Omit<
  CreateProcessRequest,
  'devices' | 'targetDurationSeconds'
> {
  devices: UpdateProcessDeviceRequest[];
  targetDurationSeconds: number | null;
}

export type UpdateProcessResponse = ProcessResponse;

export interface DeleteProcessResponse extends ProcessResponse {
  active: false;
}
export interface ProcessTagOptionResponse {
  id: string;
  name: string;
  uid: string;
  status: 'ACTIVE' | 'DELETED';
  assigned: boolean;
}

export interface ProcessLookupResponse {
  id: string;
  name: string;
  station_id: string;
  stationNumber: string;
}

export interface ProcessFormLookupsResponse {
  tags: ApiPage<ProcessTagOptionResponse>;
  processes: ApiPage<ProcessLookupResponse>;
}
export type CreateProcessField =
  | keyof CreateProcessRequest
  | `devices[${number}].${keyof CreateProcessDeviceRequest}`;

export interface ProcessesFailure {
  kind:
    | 'authentication'
    | 'roleChanged'
    | 'access'
    | 'representation'
    | 'service'
    | 'http'
    | 'network'
    | 'invalidResponse'
    | 'validation'
    | 'invalidRequest'
    | 'notFound'
    | 'conflict';
  action: 'signIn' | 'retry' | 'reload' | 'none';
  status?: number;
  code?: string;
  message?: string;
  fieldErrors?: Partial<Record<CreateProcessField, string>>;
}
