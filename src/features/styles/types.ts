import type { ApiCollection } from '../../api/collections';
export type StyleMode = 'management' | 'own';
export type StyleStatus = 'DRAFT' | 'RELEASED' | 'IN_PRODUCTION' | 'COMPLETED';
export interface StyleResponse {
  id: string;
  style_number: string;
  description: string | null;
  status: StyleStatus;
  released_at: string | null;
  created_at: string;
  created_by: string | null;
  version: number;
}
export interface CreateStyleRequest {
  styleNumber: string;
  description?: string | null;
  processIds?: string[] | null;
}
export interface StyleRouteProcess {
  processId: string;
  processCode: string;
  sequence: number;
  stationId: string;
  stationCode: string;
}
export interface StyleRouteEntry {
  sequence: number;
  stationId: string;
  stationCode: string;
  processes: StyleRouteProcess[];
}
export type StyleRouteResponse = StyleRouteEntry[];
export type RevisionScope = 'unstarted' | 'in-progress';
export interface StyleRevisionRequest {
  description?: string | null;
  processIds: string[];
  quantity?: number | null;
  reason: string;
}
export interface StyleRevisionResponse {
  revisionId: string;
  revisionNumber: number;
  affectedLots: number;
  scope: 'UNSTARTED' | 'ALL_IN_PROGRESS';
}
export interface StyleProcessOption {
  id: string;
  name: string;
  station_id: string;
  stationNumber: string;
}
export interface StyleLookupsResponse {
  processes: ApiCollection<StyleProcessOption>;
}
export interface StylesFailure {
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
      'styleNumber' | 'description' | 'processIds' | 'quantity' | 'reason',
      string
    >
  >;
}
