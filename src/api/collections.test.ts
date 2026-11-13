import { describe, expect, it, vi } from 'vitest';
import { collectApiItems, readApiPage } from './collections';

interface Item {
  id: string;
}
const isItem = (value: unknown): value is Item =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  typeof (value as Item).id === 'string';
const invalid = (): never => {
  throw new Error('Invalid collection');
};
const collect = (
  fetch: (params?: { page: number; size: number }) => Promise<unknown>,
) => collectApiItems(fetch, isItem, (item) => item.id, invalid);

describe('API collections', () => {
  it.each([{ data: [] }, { data: [{ id: 'a' }] }])(
    'rejects obsolete bare arrays when reading a single page: %j',
    ({ data }) => {
      expect(() =>
        readApiPage(
          data,
          { page: 0, size: 10, search: '' },
          isItem,
          (row) => row.id,
          invalid,
        ),
      ).toThrow('Invalid collection');
    },
  );
  it.each([{ data: { items: [], page: 0, size: 20, totalElements: 0 } }])(
    'accepts successful empty responses: %j',
    async ({ data }) => {
      await expect(collect(async () => data)).resolves.toEqual([]);
    },
  );
  it('reads every page and keeps the backend page size', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'a' }],
        page: 0,
        size: 1,
        totalElements: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'b' }],
        page: 1,
        size: 1,
        totalElements: 2,
      });
    await expect(collect(fetch)).resolves.toEqual([{ id: 'a' }, { id: 'b' }]);
    expect(fetch).toHaveBeenNthCalledWith(1);
    expect(fetch).toHaveBeenNthCalledWith(2, { page: 1, size: 1 });
  });
  it.each([{ data: [] }, { data: [{ id: 'a' }] }])(
    'rejects obsolete bare-array responses: %j',
    async ({ data }) => {
      await expect(collect(async () => data)).rejects.toThrow(
        'Invalid collection',
      );
    },
  );
  it.each([
    {},
    null,
    { items: [], page: 0, size: 0, totalElements: 0 },
    { items: [], page: 1, size: 20, totalElements: 0 },
    { items: [{}], page: 0, size: 20, totalElements: 1 },
    { items: [], page: 0, size: 20, totalElements: 1 },
    { items: [], page: 0, size: 20, totalElements: -1 },
  ])(
    'rejects malformed responses rather than treating them as empty: %j',
    async (data) => {
      await expect(collect(async () => data)).rejects.toThrow(
        'Invalid collection',
      );
    },
  );
  it('rejects duplicate records between pages', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'a' }],
        page: 0,
        size: 1,
        totalElements: 2,
      })
      .mockResolvedValueOnce({
        items: [{ id: 'a' }],
        page: 1,
        size: 1,
        totalElements: 2,
      });
    await expect(collect(fetch)).rejects.toThrow('Invalid collection');
  });
  it('preserves errors from subsequent requests instead of returning a partial list', async () => {
    const error = new Error('Second page failed');
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        items: [{ id: 'a' }],
        page: 0,
        size: 1,
        totalElements: 2,
      })
      .mockRejectedValueOnce(error);
    await expect(collect(fetch)).rejects.toBe(error);
  });
});
