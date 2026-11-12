import type { ApiCollection, ListQuery } from '../../api/collections';
// ProductionController.LOT_SELECT, shared by list, detail, create and cancel.
export interface LotResponse {
  id: string;
  style_id: string;
  style_number: string;
  lot_number: string;
  quantity: number;
  status: string;
  current_route_sequence: number | null;
  current_location_type: string | null;
  current_location_id: string | null;
  created_at: string;
  completed_at: string | null;
  version: number;
}
export interface CreateLotRequest {
  lotNumber: string;
  quantity: number;
}
export interface CancelLotRequest {
  reason: string;
}
export interface CancelLotResponse extends LotResponse {
  status: 'CANCELLED';
}
// QcController.GET /lots/{id}/qc projection.
export interface LotQcResponse {
  id: string;
  lot_id: string;
  outcome: 'PASS' | 'PARTIAL_REJECT' | 'REJECT';
  inspected_quantity: number;
  good_quantity: number;
  rejected_quantity: number;
  reason: string | null;
  operator_id: string | null;
  completed_at: string | null;
}
export type JsonValue =
  string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };
// The timeline projection deliberately does not include an event ID.
export interface LotTimelineEvent {
  location_type: string;
  location_id: string | null;
  actor_id: string | null;
  occurred_at: string;
  detail: JsonValue;
}
export interface LotStyleOption {
  id: string;
  style_number: string;
  description: string | null;
  status: 'RELEASED' | 'IN_PRODUCTION';
}
export interface LotLookupsResponse {
  styles: ApiCollection<LotStyleOption>;
}
export interface LotsFailure {
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
    Record<keyof CreateLotRequest | keyof CancelLotRequest, string>
  >;
}
export type LotsQuery = ListQuery;
