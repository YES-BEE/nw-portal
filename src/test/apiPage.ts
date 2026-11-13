import type { ApiPage } from '../api/collections';

// Build the current wire envelope from test records and request pagination.
export function apiPage<T>(
  records: readonly T[],
  query?: unknown,
  defaultSize = 10,
): ApiPage<T> {
  const params =
    query && typeof query === 'object'
      ? (query as Record<string, unknown>)
      : {};
  const page = typeof params.page === 'number' ? params.page : 0;
  const size = typeof params.size === 'number' ? params.size : defaultSize;
  return {
    items: records.slice(page * size, (page + 1) * size),
    page,
    size,
    totalElements: records.length,
  };
}
