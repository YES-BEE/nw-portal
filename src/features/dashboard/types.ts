import type { ApiPage } from '../../api/collections';
import type { LotResponse } from '../lots/types';

export interface StatusCount {
  status: string;
  count: number;
}
export interface StationWip {
  id: string;
  code: string;
  name: string;
  wip: number;
  share_percent: number;
}
export type StationWorkload = Omit<StationWip, 'share_percent'>;
export interface DashboardMetricsResponse {
  totalLots: number;
  openLots: number;
  completedLots: number;
  stylesWithLots: number;
  storedLots: number;
  availableTrolleys: number;
  completedSharePercent: number;
  inTransitLots: number;
  readyToStartLots: number;
  totalStationLotVisits: number;
  highestStationWorkloadCount: number;
  highestStationWorkload: StationWorkload | null;
}
export interface DashboardResponse {
  snapshotAt: string;
  refreshIntervalSeconds: number;
  metrics: DashboardMetricsResponse;
  styles: StatusCount[];
  lots: StatusCount[];
  stations: ApiPage<StationWip>;
  storageOccupancies: number;
  availableTrolleys: number;
}
export interface DashboardSummary extends Omit<DashboardResponse, 'stations'> {
  stations: StationWip[];
}
// DashboardController.LOT_VIEW adds the active station and process, without version.
export interface DashboardLot extends Omit<
  LotResponse,
  'version' | 'trolley_id' | 'trolley_code'
> {
  current_station: string | null;
  current_process: string | null;
  current_process_id: string | null;
  current_process_status: string | null;
  location_label: string | null;
}
export interface DashboardFailure {
  kind:
    | 'authentication'
    | 'roleChanged'
    | 'access'
    | 'notFound'
    | 'invalidRequest'
    | 'service'
    | 'network'
    | 'invalidResponse'
    | 'http';
  action: 'signIn' | 'retry' | 'none';
  message?: string;
  code?: string;
  status?: number;
}
