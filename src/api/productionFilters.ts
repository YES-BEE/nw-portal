import { readApiPage, type ApiPage, type ListQuery } from './collections';

export type RouteScope = 'CURRENT' | 'ANY';
export interface ProductionLotFilters {
  lotId?: string;
  styleId?: string;
  stationId?: string;
  processId?: string;
  status?: string;
  routeScope?: RouteScope;
}
export type ProductionLotsQuery = ListQuery & ProductionLotFilters;
export interface LotFilterOption {
  id: string;
  lot_number: string;
  style_id: string;
  style_number: string;
}
export interface StyleFilterOption {
  id: string;
  style_number: string;
}
export interface StationFilterOption {
  id: string;
  code: string;
  name?: string;
}
export interface ProcessFilterOption {
  id: string;
  name: string;
  code?: string;
}
export interface FilterOptionMap {
  lots: LotFilterOption;
  styles: StyleFilterOption;
  stations: StationFilterOption;
  processes: ProcessFilterOption;
}
export type FilterOptionType = keyof FilterOptionMap;
export type ProductionFilterOption = FilterOptionMap[FilterOptionType];
export type FilterOptionsLoader = (
  kind: FilterOptionType,
  query: ProductionLotsQuery,
  signal?: AbortSignal,
) => Promise<ApiPage<ProductionFilterOption>>;
const text = (value: unknown) => typeof value === 'string' && !!value.trim();
export function isFilterOption<K extends FilterOptionType>(
  kind: K,
  scope: RouteScope,
  value: unknown,
): value is FilterOptionMap[K] {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  if (!text(row.id)) return false;
  switch (kind) {
    case 'lots':
      return (
        text(row.lot_number) && text(row.style_id) && text(row.style_number)
      );
    case 'styles':
      return text(row.style_number);
    case 'stations':
      return (
        text(row.code) &&
        (scope === 'ANY'
          ? typeof row.name === 'string'
          : row.name === undefined || typeof row.name === 'string')
      );
    case 'processes':
      return (
        text(row.name) &&
        (scope === 'ANY'
          ? text(row.code)
          : row.code === undefined || text(row.code))
      );
  }
}
export function readFilterOptions<K extends FilterOptionType>(
  kind: K,
  data: unknown,
  query: ProductionLotsQuery,
  invalid: () => never,
): ApiPage<FilterOptionMap[K]> {
  return readApiPage(
    data,
    query,
    (value): value is FilterOptionMap[K] =>
      isFilterOption(kind, query.routeScope ?? 'CURRENT', value),
    (row) => row.id,
    invalid,
  );
}
