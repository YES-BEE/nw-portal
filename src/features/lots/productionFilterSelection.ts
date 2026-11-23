import type { ProductionLotFilters as Filters } from '../../api/productionFilters';

export interface Choice {
  id: string;
  label: string;
}
export interface ProductionFilterSelection {
  lots: Choice[];
  styles: Choice[];
  stations: Choice | null;
  processes: Choice | null;
  status: string;
}
export const emptyProductionFilters: ProductionFilterSelection = {
  lots: [],
  styles: [],
  stations: null,
  processes: null,
  status: '',
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
    ...(selection.lots.length && {
      lotIds: selection.lots.map((item) => item.id),
    }),
    ...(selection.styles.length && {
      styleIds: selection.styles.map((item) => item.id),
    }),
    ...(selection.stations && { stationId: selection.stations.id }),
    ...(selection.processes && { processId: selection.processes.id }),
    ...(selection.status && { status: selection.status }),
  };
}
