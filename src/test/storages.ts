import type {
  StorageAreaResponse,
  StorageTagOptionResponse,
} from '../features/storages/types';
export const storageAreaResponse: StorageAreaResponse = {
  id: 'area-1',
  station_id: 'station-1',
  station_code: '03',
  code: 'ST-001',
  name: 'Holding Area',
  description: 'Intermediate holding area',
  active: true,
  version: 0,
  storage_number: 'ST-001',
  station_number: '03',
  nfc_uid: 'PRIVATE-STORAGE-UID',
  storageNumber: 'ST-001',
  stationNumber: '03',
  nfcUid: 'PRIVATE-STORAGE-UID',
};
export const storageTags: StorageTagOptionResponse[] = [
  {
    id: 'current-tag',
    name: 'Holding Area Tag',
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
