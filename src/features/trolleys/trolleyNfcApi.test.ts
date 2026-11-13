import { apiPage } from '../../test/apiPage';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import {
  assignTrolleyNfcTag,
  getTrolleyNfcTags,
  unassignTrolleyNfcTag,
} from './trolleyNfcApi';
import type { TagDetailsResponse } from '../tags/tagsApi';
export const tag: TagDetailsResponse = {
  id: 'tag-1',
  name: 'Tag One',
  uid: 'ABC',
  status: 'ACTIVE',
  assigned: false,
  asset_type: null,
  trolley_id: null,
  station_id: null,
  process_id: null,
  machine_id: null,
  storage_area_id: null,
  storage_location_id: null,
  version: 0,
};
const body = {
  assetType: 'TROLLEY' as const,
  assetId: 'trolley-1',
  reason: 'Initial setup',
};
beforeEach(() => {
  vi.restoreAllMocks();
});
describe('trolley NFC API', () => {
  it('reads all pages with complete tag details and accepts an empty collection', async () => {
    const get = vi
      .spyOn(apiClient, 'get')
      .mockResolvedValueOnce({
        status: 200,
        data: { items: [tag], page: 0, size: 1, totalElements: 2 },
      })
      .mockResolvedValueOnce({
        status: 200,
        data: {
          items: [{ ...tag, id: 'tag-2' }],
          page: 1,
          size: 1,
          totalElements: 2,
        },
      });
    expect(await getTrolleyNfcTags()).toHaveLength(2);
    expect(get.mock.calls[1][1]?.params).toEqual({
      status: 'ACTIVE',
      page: 1,
      size: 1,
    });
    get.mockResolvedValueOnce({
      status: 200,
      data: apiPage([], undefined, 10),
    });
    expect(await getTrolleyNfcTags()).toEqual([]);
  });
  it('assigns using the backend model and validates the returned asset', async () => {
    const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
      status: 200,
      data: {
        ...tag,
        assigned: true,
        asset_type: 'TROLLEY',
        trolley_id: body.assetId,
      },
    });
    await assignTrolleyNfcTag(tag.id, body);
    expect(put).toHaveBeenCalledWith(
      'nfc-assignments/tag-1',
      body,
      expect.any(Object),
    );
    put.mockResolvedValueOnce({
      status: 200,
      data: { ...tag, assigned: true, asset_type: 'MACHINE' },
    });
    await expect(assignTrolleyNfcTag(tag.id, body)).rejects.toMatchObject({
      failure: { kind: 'invalidResponse' },
    });
  });
  it('sends the required DELETE reason and accepts an empty success body', async () => {
    const remove = vi
      .spyOn(apiClient, 'delete')
      .mockResolvedValue({ status: 200, data: '' });
    await expect(
      unassignTrolleyNfcTag(tag.id, { reason: body.reason }),
    ).resolves.toBeUndefined();
    expect(remove).toHaveBeenCalledWith(
      'nfc-assignments/tag-1',
      expect.objectContaining({ data: { reason: body.reason } }),
    );
  });
  it('preserves backend business errors and access failures', async () => {
    vi.spyOn(apiClient, 'put').mockResolvedValue({
      status: 409,
      data: {
        detail: 'Only ACTIVE tags can be assigned',
        code: 'NFC_DISABLED',
      },
    });
    await expect(assignTrolleyNfcTag(tag.id, body)).rejects.toMatchObject({
      failure: {
        kind: 'conflict',
        message: 'Only ACTIVE tags can be assigned',
      },
    });
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      status: 403,
      data: { detail: 'Access denied' },
    });
    await expect(getTrolleyNfcTags()).rejects.toMatchObject({
      failure: { kind: 'access', message: 'Access denied' },
    });
  });
});
