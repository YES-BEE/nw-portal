import { useEffect, useState } from 'react';
import type { ApiPage, ListQuery } from './collections';

type Result<T> =
  { status: 'ready'; data: ApiPage<T> } | { status: 'error'; error: unknown };
export function usePagedList<T>(
  load: (query: ListQuery, signal?: AbortSignal) => Promise<ApiPage<T>>,
  pollIntervalMs = 0,
) {
  const [query, setQuery] = useState<ListQuery>({
    page: 0,
    size: 10,
    search: '',
  });
  const [input, setInput] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [result, setResult] = useState<{
    query: ListQuery;
    attempt: number;
    value: Result<T>;
  } | null>(null);
  useEffect(() => {
    const timer = setTimeout(() => {
      if (input.trim() !== query.search)
        setQuery((current) => ({ ...current, page: 0, search: input.trim() }));
    }, 300);
    return () => clearTimeout(timer);
  }, [input, query.search]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    function refresh() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      void load(query, controller.signal)
        .then(
          (data) => {
            if (controller.signal.aborted) return;
            const lastPage = Math.max(
              0,
              Math.ceil(data.totalElements / query.size) - 1,
            );
            if (query.page > lastPage) {
              setQuery((current) => ({ ...current, page: lastPage }));
              return;
            }
            setResult({ query, attempt, value: { status: 'ready', data } });
          },
          (error: unknown) => {
            if (!controller.signal.aborted)
              setResult({ query, attempt, value: { status: 'error', error } });
          },
        )
        .finally(() => {
          pending = false;
        });
    }
    refresh();
    const timer =
      pollIntervalMs > 0 ? setInterval(refresh, pollIntervalMs) : undefined;
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [query, attempt, load, pollIntervalMs]);
  const state =
    result?.query === query && result.attempt === attempt
      ? result.value
      : { status: 'loading' as const };
  return {
    state,
    query,
    input,
    setInput,
    setPage: (page: number) => setQuery((current) => ({ ...current, page })),
    setSize: (size: number) =>
      setQuery((current) => ({ ...current, page: 0, size })),
    reload: () => setAttempt((value) => value + 1),
    resetSearch: () => {
      setInput('');
      setQuery((current) => ({ ...current, page: 0, search: '' }));
    },
  };
}
