import type {
  StyleResponse,
  StyleRouteResponse,
  StyleProcessOption,
  StyleRevisionResponse,
} from '../features/styles/types';
export const styleResponse: StyleResponse = {
  id: '11111111-1111-4111-8111-111111111111',
  style_number: 'STY-1001',
  description: 'Denim wash style',
  status: 'DRAFT',
  released_at: null,
  created_at: '2026-11-01T10:00:00Z',
  created_by: 'actor-1',
  version: 0,
};
export const styleProcessOptions: StyleProcessOption[] = [
  {
    id: '22222222-2222-4222-8222-222222222222',
    name: 'Washing',
    station_id: 'station-03',
    stationNumber: '03',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    name: 'Drying',
    station_id: 'station-04',
    stationNumber: '04',
  },
];
export const styleRouteResponse: StyleRouteResponse = [
  {
    sequence: 1,
    stationId: 'station-03',
    stationCode: '03',
    processes: [
      {
        processId: styleProcessOptions[0].id,
        processCode: 'WASH',
        sequence: 1,
        stationId: 'station-03',
        stationCode: '03',
      },
    ],
  },
];
export const styleRevisionResponse: StyleRevisionResponse = {
  revisionId: 'revision-1',
  revisionNumber: 1,
  affectedLots: 2,
  scope: 'UNSTARTED',
};
