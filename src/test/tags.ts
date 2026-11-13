import type { CreateTagResponse, TagResponse } from '../features/tags/tagsApi';

export const createTagResponse: CreateTagResponse = {
  id: '3831c086-af15-4106-a0bc-dfe4d9d1a0c1',
  uid: '1234',
  name: 'Washing Line 01',
  status: 'ACTIVE',
  assigned: false,
  asset_type: null,
  trolley_id: null,
  station_id: null,
  process_id: null,
  machine_id: null,
  storage_area_id: null,
  storage_location_id: null,
  version: 0,
};

export const tagsResponse: TagResponse[] = [
  {
    ...createTagResponse,
    id: '11111111-1111-4111-8111-111111111111',
    name: 'Washing Tag',
    uid: '04:AA:BB',
    status: 'ACTIVE',
    assigned: true,
    asset_type: 'PROCESS',
  },
  {
    ...createTagResponse,
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Available Tag',
    uid: '04:CC:DD',
    status: 'ACTIVE',
    assigned: false,
    asset_type: null,
  },
  {
    ...createTagResponse,
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Deleted Tag',
    uid: '04:EE:FF',
    status: 'DELETED',
    assigned: false,
    asset_type: null,
  },
];
