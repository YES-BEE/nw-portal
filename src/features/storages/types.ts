// AssetAdministrationController.AREA_SELECT and areaView aliases.
export interface StorageAreaResponse {
  id: string;
  station_id: string;
  station_code: string;
  code: string;
  name: string;
  description: string | null;
  active: boolean;
  version: number;
  storage_number: string;
  station_number: string;
  nfc_uid: string | null;
  storageNumber: string;
  stationNumber: string;
  nfcUid: string | null;
}
// AreaCommand supports station reference or UUID, and registered tag UID or UUID.
export interface StorageAreaRequest {
  storageNumber: string;
  stationNumber?: string | null;
  stationId?: string | null;
  name?: string | null;
  description?: string | null;
  nfcUid?: string | null;
  tagId?: string | null;
  nfcUids?: string[] | null;
}
export type CreateStorageAreaResponse = StorageAreaResponse;
export type UpdateStorageAreaResponse = StorageAreaResponse;
export interface DeleteStorageAreaResponse extends StorageAreaResponse {
  active: false;
}
export interface StorageAreaStatusRequest {
  active: boolean;
}
export interface StorageTagOptionResponse {
  id: string;
  name: string;
  uid: string;
  status: 'ACTIVE' | 'DELETED';
  assigned: boolean;
}
export interface StorageFailure {
  kind:
    | 'authentication'
    | 'roleChanged'
    | 'access'
    | 'validation'
    | 'invalidRequest'
    | 'notFound'
    | 'conflict'
    | 'service'
    | 'network'
    | 'invalidResponse'
    | 'http';
  action: 'signIn' | 'retry' | 'reload' | 'none';
  message?: string;
  status?: number;
  code?: string;
  fieldErrors?: Partial<Record<keyof StorageAreaRequest, string>>;
}
