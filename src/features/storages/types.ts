// AssetAdministrationController.UnitCommand and unit(id).
export interface StorageUnitRecord {
  id: string;
  station_id: string;
  storage_area_id: string;
  code: string;
  name: string;
  active: boolean;
  version: number;
}
// MasterDataController.STORAGE_SELECT (storage-locations list/detail/status).
export interface StorageUnitResponse extends StorageUnitRecord {
  station_code: string;
  storage_area_code: string;
}
export interface StorageUnitRequest {
  code: string;
  name: string;
  nfcUids?: string[];
}
export type UpdateStorageUnitRequest = Pick<
  StorageUnitRequest,
  'code' | 'name'
>;
export interface StorageUnitStatusRequest {
  active: boolean;
}
export interface StorageAreaOptionResponse {
  id: string;
  station_id: string;
  station_code: string;
  code: string;
  name: string;
  active: boolean;
}
export interface StorageAreaResponse extends StorageAreaOptionResponse {
  description: string | null;
  version: number;
  nfc_uid: string | null;
}
export interface StorageAreaRequest {
  stationId: string;
  storageNumber: string;
  name?: string;
  description?: string;
  tagId: string;
}
export interface StorageStationOption {
  id: string;
  code: string;
  name: string;
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
  fieldErrors?: Partial<
    Record<
      | 'code'
      | 'name'
      | 'nfcUids'
      | 'storageAreaId'
      | 'stationId'
      | 'stationNumber'
      | 'storageNumber'
      | 'description'
      | 'tagId'
      | 'nfcUid',
      string
    >
  >;
}
