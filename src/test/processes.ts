import type {
  ProcessesResponse,
  ProcessResponse,
} from '../features/processes/types';

export const processResponse: ProcessResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  code: 'WASH',
  name: 'Washing',
  station_id: '22222222-2222-4222-8222-222222222222',
  station_code: '03',
  target_duration_seconds: 120,
  description: 'Main washing process',
  nfc_mode: 'PROCESS',
  quality: false,
  active: true,
  version: 0,
  device_count: 0,
  nfc_uid: 'NFC-WASH',
  stationNumber: '03',
  nfcMode: 'PROCESS',
  nfcUid: 'NFC-WASH',
  deviceCount: 0,
  devices: [],
};

export const processesResponse: ProcessesResponse = [
  processResponse,
  {
    ...processResponse,
    id: '33333333-3333-4333-8333-333333333333',
    code: 'DRY',
    name: 'Drying',
    nfc_mode: 'DEVICES',
    nfcMode: 'DEVICES',
    device_count: 1,
    deviceCount: 1,
    nfc_uid: null,
    nfcUid: null,
    active: false,
    devices: [
      {
        id: '44444444-4444-4444-8444-444444444444',
        process_id: '33333333-3333-4333-8333-333333333333',
        name: 'Dryer 1',
        description: null,
        machine_type: 'DRYER',
        status: 'AVAILABLE',
        nfc_uid: 'NFC-DRYER',
        type: 'DRYER',
        nfcUid: 'NFC-DRYER',
        processId: '33333333-3333-4333-8333-333333333333',
        stationNumber: '03',
      },
    ],
  },
];
