import type {
  LotResponse,
  LotStyleOption,
  LotTimelineEvent,
  LotQcResponse,
} from '../features/lots/types';

export const lotResponse: LotResponse = {
  id: 'lot-id',
  style_id: 'style-id',
  style_number: 'STY-001',
  lot_number: 'LOT-001',
  quantity: 200,
  status: 'READY',
  current_route_sequence: 1,
  current_location_type: 'TRANSIT',
  current_location_id: null,
  created_at: '2026-11-12T09:00:00Z',
  completed_at: null,
  version: 0,
  trolley_id: null,
  trolley_code: null,
};
export const lotStyleOption: LotStyleOption = {
  id: lotResponse.style_id,
  style_number: lotResponse.style_number,
  description: null,
  status: 'RELEASED',
};
export const lotBatchResponse = { createdCount: 1, items: [lotResponse] };
export const lotEvent: LotTimelineEvent = {
  location_type: 'PROCESS_AREA',
  location_id: 'hidden-location-id',
  actor_id: 'hidden-actor-id',
  occurred_at: lotResponse.created_at,
  detail: { qcOutcome: 'PASS' },
};
export const lotQcResponse: LotQcResponse = {
  id: 'hidden-qc-id',
  lot_id: lotResponse.id,
  outcome: 'PARTIAL_REJECT',
  inspected_quantity: 200,
  good_quantity: 198,
  rejected_quantity: 2,
  reason: 'Two damaged pieces',
  operator_id: 'hidden-qc-operator-id',
  completed_at: '2026-11-12T11:30:00Z',
};
