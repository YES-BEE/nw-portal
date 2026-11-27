import type {
  StorageAreaOptionResponse,
  StorageUnitResponse,
  StorageTagOptionResponse,
} from '../features/storages/types';
export const storageAreaResponse: StorageAreaOptionResponse = {
  id: 'area-1',
  station_id: 'station-1',
  station_code: '03',
  code: 'AREA-001',
  name: 'Holding Area',
  active: true,
};
export const storageUnitResponse: StorageUnitResponse = {
  id: 'unit-1',
  station_id: 'station-1',
  station_code: '03',
  storage_area_id: 'area-1',
  storage_area_code: 'AREA-001',
  code: 'ST-001',
  name: 'Holding Unit',
  active: true,
  version: 0,
};
export const storageTags: StorageTagOptionResponse[] = [
  {
    id: 'current-tag',
    name: 'Holding Unit Tag',
    uid: 'PRIVATE-STORAGE-UID',
    status: 'ACTIVE',
    assigned: true,
  },
  {
    id: 'free-tag',
    name: 'Available Storage Tag',
    uid: 'PRIVATE-FREE-UID',
    status: 'ACTIVE',
    assigned: false,
  },
  {
    id: 'other-tag',
    name: 'Other Asset Tag',
    uid: 'PRIVATE-OTHER-UID',
    status: 'ACTIVE',
    assigned: true,
  },
];
