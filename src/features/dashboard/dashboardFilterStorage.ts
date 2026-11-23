import type { ListQuery } from '../../api/collections';
import {
  emptyProductionFilters,
  type Choice,
  type ProductionFilterSelection,
} from '../lots/productionFilterSelection';

export interface SavedDashboardFilters {
  selection: ProductionFilterSelection;
  query: ListQuery;
}
const defaults = (): SavedDashboardFilters => ({
  selection: { ...emptyProductionFilters },
  query: { page: 0, size: 10, search: '' },
});
export const dashboardFilterKey = (userId: string) =>
  `nw-track-dashboard-filters-v1:${encodeURIComponent(userId)}`;
const choice = (value: unknown): value is Choice | null => {
  if (value === null) return true;
  if (!value || typeof value !== 'object') return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === 'string' &&
    !!row.id.trim() &&
    typeof row.label === 'string'
  );
};
function choices(value: unknown): Choice[] | undefined {
  const items = Array.isArray(value) ? value : value === null ? [] : [value];
  return items.length <= 100 &&
    items.every((item): item is Choice => item !== null && choice(item)) &&
    new Set(items.map((item) => item.id)).size === items.length
    ? items
    : undefined;
}
export function readDashboardFilters(userId?: string): SavedDashboardFilters {
  if (!userId) return defaults();
  try {
    const saved = JSON.parse(
      sessionStorage.getItem(dashboardFilterKey(userId)) || 'null',
    );
    const selection = saved?.selection;
    const query = saved?.query;
    const lots = choices(selection?.lots);
    const styles = choices(selection?.styles);
    if (
      !selection ||
      !query ||
      !lots ||
      !styles ||
      !['stations', 'processes'].every((key) => choice(selection[key])) ||
      typeof selection.status !== 'string' ||
      selection.status.length > 200 ||
      !Number.isSafeInteger(query.page) ||
      query.page < 0 ||
      !Number.isInteger(query.size) ||
      query.size < 1 ||
      query.size > 100 ||
      typeof query.search !== 'string' ||
      query.search.length > 200
    )
      return defaults();
    return {
      selection: {
        lots,
        styles,
        stations: selection.stations,
        processes: selection.processes,
        status: selection.status,
      },
      query: {
        page: query.page,
        size: query.size,
        search: query.search.trim(),
      },
    };
  } catch {
    return defaults();
  }
}
export function saveDashboardFilters(
  userId: string | undefined,
  value: SavedDashboardFilters,
): void {
  if (!userId) return;
  try {
    sessionStorage.setItem(dashboardFilterKey(userId), JSON.stringify(value));
  } catch {
    // Filtering remains available when browser storage is unavailable.
  }
}
