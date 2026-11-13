import type {
  ProductionLotFilters as Filters,
  RouteScope,
} from '../../api/productionFilters';

export interface Choice {
  id: string;
  label: string;
}
export interface ProductionFilterSelection {
  lots: Choice | null;
  styles: Choice | null;
  stations: Choice | null;
  processes: Choice | null;
  status: string;
  routeScope: RouteScope;
}
export const emptyProductionFilters: ProductionFilterSelection = {
  lots: null,
  styles: null,
  stations: null,
  processes: null,
  status: '',
  routeScope: 'CURRENT',
};
export const lotStatuses = [
  'READY',
  'DISPATCHED',
  'AT_STATION',
  'IN_PROCESS',
  'READY_FOR_DISPATCH',
  'IN_STORAGE',
  'COMPLETED',
  'CANCELLED',
];
export function productionFilterParams(
  selection: ProductionFilterSelection,
): Filters {
  return {
    ...(selection.lots && { lotId: selection.lots.id }),
    ...(selection.styles && { styleId: selection.styles.id }),
    ...(selection.stations && { stationId: selection.stations.id }),
    ...(selection.processes && { processId: selection.processes.id }),
    ...(selection.status && { status: selection.status }),
    ...(selection.routeScope === 'ANY' && { routeScope: 'ANY' as const }),
  };
}
