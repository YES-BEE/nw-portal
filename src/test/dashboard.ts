import type {
  DashboardResponse,
  DashboardLot,
} from '../features/dashboard/types';
export const dashboardResponse: DashboardResponse = {
  styles: [
    { status: 'IN_PRODUCTION', count: 2 },
    { status: 'COMPLETED', count: 1 },
  ],
  lots: [
    { status: 'READY', count: 2 },
    { status: 'DISPATCHED', count: 1 },
    { status: 'AT_STATION', count: 1 },
    { status: 'IN_PROCESS', count: 1 },
    { status: 'IN_STORAGE', count: 1 },
    { status: 'COMPLETED', count: 2 },
    { status: 'CANCELLED', count: 1 },
  ],
  stations: {
    items: [
      { id: 'station-03', code: '03', name: 'Washing', wip: 4 },
      { id: 'station-04', code: '04', name: 'Drying', wip: 2 },
    ],
    page: 0,
    size: 100,
    totalElements: 2,
  },
  storageOccupancies: 1,
  availableTrolleys: 5,
};
export const dashboardLot: DashboardLot = {
  id: 'lot-id',
  lot_number: 'LOT-001',
  style_id: 'style-id',
  style_number: 'STY-001',
  quantity: 200,
  status: 'IN_PROCESS',
  current_route_sequence: 1,
  current_location_type: 'PROCESS_AREA',
  current_location_id: 'station-03',
  current_station: '03',
  current_process: 'Washing',
  created_at: '2026-11-12T10:00:00Z',
  completed_at: null,
};
export const emptyDashboard: DashboardResponse = {
  styles: [],
  lots: [],
  stations: [],
  storageOccupancies: 0,
  availableTrolleys: 0,
};
