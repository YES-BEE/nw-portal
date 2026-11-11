// Backend ApiPage<T>. Older deployments return a bare array instead.
export interface ApiPage<T> {
  items: T[];
  page: number;
  size: number;
  totalElements: number;
}
export type ApiCollection<T> = T[] | ApiPage<T>;
export interface PageQuery {
  page: number;
  size: number;
}
export interface ListQuery extends PageQuery {
  search: string;
}

export function readApiPage<T>(
  data: unknown,
  query: ListQuery,
  isItem: (value: unknown) => value is T,
  key: (item: T) => string,
  invalid: () => never,
): ApiPage<T> {
  // Some deployments still return arrays; treat them as the returned page.
  if (Array.isArray(data)) {
    if (!data.every(isItem) || new Set(data.map(key)).size !== data.length)
      return invalid();
    return {
      items: data,
      page: query.page,
      size: query.size,
      totalElements: data.length ? query.page * query.size + data.length : 0,
    };
  }
  if (!data || typeof data !== 'object') return invalid();
  const value = data as Record<string, unknown>;
  if (
    !Array.isArray(value.items) ||
    !value.items.every(isItem) ||
    new Set(value.items.map(key)).size !== value.items.length ||
    value.page !== query.page ||
    value.size !== query.size ||
    typeof value.totalElements !== 'number' ||
    !Number.isSafeInteger(value.totalElements) ||
    value.totalElements < 0 ||
    value.items.length > query.size ||
    value.totalElements < value.items.length
  )
    return invalid();
  return {
    items: value.items,
    page: query.page,
    size: query.size,
    totalElements: value.totalElements,
  };
}

export async function collectApiItems<T>(
  fetchPage: (query?: PageQuery) => Promise<unknown>,
  isItem: (value: unknown) => value is T,
  key: (item: T) => string,
  invalid: () => never,
): Promise<T[]> {
  const first = await fetchPage();
  const result: T[] = [];
  const keys = new Set<string>();
  function append(items: unknown): void {
    if (!Array.isArray(items) || !items.every(isItem)) return invalid();
    for (const item of items) {
      const id = key(item);
      if (keys.has(id)) return invalid();
      keys.add(id);
      result.push(item);
    }
  }
  if (Array.isArray(first)) {
    append(first);
    return result;
  }
  function page(
    value: unknown,
    expected: number,
    size?: number,
    total?: number,
  ): Pick<ApiPage<T>, 'size' | 'totalElements'> {
    if (!value || typeof value !== 'object' || Array.isArray(value))
      return invalid();
    const data = value as Record<string, unknown>;
    if (
      data.page !== expected ||
      typeof data.size !== 'number' ||
      !Number.isInteger(data.size) ||
      data.size < 1 ||
      data.size > 100 ||
      (size !== undefined && data.size !== size) ||
      typeof data.totalElements !== 'number' ||
      !Number.isSafeInteger(data.totalElements) ||
      data.totalElements < 0 ||
      (total !== undefined && data.totalElements !== total) ||
      !Array.isArray(data.items) ||
      data.items.length !==
        Math.min(
          data.size,
          Math.max(0, data.totalElements - expected * data.size),
        )
    )
      return invalid();
    append(data.items);
    return {
      size: data.size,
      totalElements: data.totalElements,
    };
  }
  const initial = page(first, 0);
  for (let index = 1; result.length < initial.totalElements; index++) {
    page(
      await fetchPage({ page: index, size: initial.size }),
      index,
      initial.size,
      initial.totalElements,
    );
  }
  return result;
}
