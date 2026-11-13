import type { ListQuery } from '../../api/collections';
import type { DashboardFailure } from '../dashboard/types';
import type { LotTimelineEvent } from '../lots/types';

// DashboardController.history adds the location event ID to the timeline projection.
export interface LotHistoryEvent extends LotTimelineEvent {
  id: string;
}
export interface LotHistoryQuery extends ListQuery {
  lotId: string;
}
export type ReportsFailure = DashboardFailure;
