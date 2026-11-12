import type { ApiCollection } from '../../api/collections';
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
}
export interface DashboardResponse {
  styles: StatusCount[];
  lots: StatusCount[];
  stations: ApiCollection<StationWip>;
  storageOccupancies: number;
  availableTrolleys: number;
}
export interface DashboardSummary extends Omit<DashboardResponse, 'stations'> {
  stations: StationWip[];
}
// DashboardController.LOT_VIEW adds the active station and process, without version.
export interface DashboardLot extends Omit<LotResponse, 'version'> {
  current_station: string | null;
  current_process: string | null;
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
