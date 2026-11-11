import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { usePagedList } from './usePagedList';
import type { ApiPage, ListQuery } from './collections';

describe('server list requests', () => {
  it('resets search to the first page, cancels obsolete requests and ignores their late responses', async () => {
    let complete!: (value: ApiPage<{ id: string }>) => void;
    const load = vi.fn(
      async (
        query: ListQuery,
        _signal?: AbortSignal,
      ): Promise<ApiPage<{ id: string }>> => {
        void _signal;
        if (query.page === 2)
          return new Promise((resolve) => {
            complete = resolve;
          });
        return {
          items: [{ id: query.search || 'initial' }],
          page: query.page,
          size: query.size,
          totalElements: query.search ? 1 : 30,
        };
      },
    );
    const { result, unmount } = renderHook(() => usePagedList(load));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(2));
    const signal = load.mock.calls[1][1];
    act(() => result.current.setInput('  new search  '));
    await waitFor(() => expect(result.current.query.search).toBe('new search'));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.query.page).toBe(0);
    expect(signal?.aborted).toBe(true);
    await act(async () =>
      complete({
        items: [{ id: 'obsolete' }],
        page: 2,
        size: 10,
        totalElements: 30,
      }),
    );
    expect(result.current.state).toMatchObject({
      status: 'ready',
      data: { items: [{ id: 'new search' }] },
    });
    const latestSignal = load.mock.calls.at(-1)![1];
    unmount();
    expect(latestSignal?.aborted).toBe(true);
  });
  it('reloads a valid page if the requested page disappears after a deletion', async () => {
    const load = vi.fn(
      async (query: ListQuery): Promise<ApiPage<{ id: string }>> => ({
        items: query.page ? [] : [{ id: 'remaining' }],
        page: query.page,
        size: query.size,
        totalElements: 1,
      }),
    );
    const { result } = renderHook(() => usePagedList(load));
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    act(() => result.current.setPage(2));
    await waitFor(() => expect(load).toHaveBeenCalledTimes(3));
    expect(load.mock.calls[1][0].page).toBe(2);
    expect(load.mock.calls[2][0].page).toBe(0);
    await waitFor(() => expect(result.current.state.status).toBe('ready'));
    expect(result.current.query.page).toBe(0);
  });
});
