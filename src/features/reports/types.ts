import type { DashboardFailure, DashboardLot } from '../dashboard/types';
import type { StyleResponse } from '../styles/types';

// DashboardController.LOT_VIEW is shared by dashboard and lot progress reports.
export type LotProgressResponse = DashboardLot;
export type ReportsFailure = DashboardFailure;

// DashboardController.styleProgress: unweighted mean progress of visible lots.
export interface StyleProgressResponse extends Pick<
  StyleResponse,
  'id' | 'style_number' | 'status' | 'created_at' | 'released_at'
> {
  lot_count: number;
  completed_lots: number;
  progress_percent: number;
}
