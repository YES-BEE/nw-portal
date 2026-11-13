import { apiPage } from '../../test/apiPage';
import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import { storageAreaResponse as area, storageTags } from '../../test/storages';
import {
  createStorageArea,
  updateStorageArea,
  deleteStorageArea,
  getStorageArea,
  getStorageAreas,
  getStorageTags,
  parseStorageFailure,
  setStorageAreaStatus,
} from './storagesApi';
const query = { page: 0, size: 10, search: 'holding' };
beforeEach(() => vi.restoreAllMocks());
it('uses backend paging and search with strictly validated storage area aliases', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [area], ...query, totalElements: 1 },
  });
  expect((await getStorageAreas(query)).items).toEqual([area]);
  expect(get).toHaveBeenCalledWith(
    'storage-areas',
    expect.objectContaining({ params: query }),
  );
  get.mockResolvedValue({
    status: 200,
    data: {
      items: [{ ...area, stationNumber: 'different' }],
      ...query,
      totalElements: 1,
    },
  });
  await expect(getStorageAreas(query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('accepts empty pages and validates detail response identity', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: apiPage([], undefined, 10) });
  expect((await getStorageAreas(query)).totalElements).toBe(0);
  get.mockResolvedValue({ status: 200, data: area });
  expect(await getStorageArea(area.id)).toEqual(area);
  await expect(getStorageArea('other')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('sends AreaCommand for POST and PUT without UI-only fields', async () => {
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 200, data: area });
  const put = vi.spyOn(apiClient, 'put').mockResolvedValue({
    status: 200,
    data: { ...area, id: 'area/with space' },
  });
  const body = {
    storageNumber: 'ST-001',
    stationNumber: '03',
    description: 'Holding area',
    tagId: 'free-tag',
  };
  expect(await createStorageArea(body)).toEqual(area);
  await updateStorageArea('area/with space', body);
  expect(post).toHaveBeenCalledWith('storage-areas', body, expect.any(Object));
  expect(put).toHaveBeenCalledWith(
    'storage-areas/area%2Fwith%20space',
    body,
    expect.any(Object),
  );
});
it('uses DELETE with no body and checks the inactive response; restore uses PATCH status', async () => {
  const remove = vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: { ...area, active: false, nfcUid: null, nfc_uid: null },
  });
  expect((await deleteStorageArea(area.id)).active).toBe(false);
  expect(remove).toHaveBeenCalledWith(
    'storage-areas/area-1',
    expect.not.objectContaining({ data: expect.anything() }),
  );
  remove.mockResolvedValue({ status: 200, data: area });
  await expect(deleteStorageArea(area.id)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  const patch = vi
    .spyOn(apiClient, 'patch')
    .mockResolvedValue({ status: 200, data: area });
  await setStorageAreaStatus(area.id, { active: true });
  expect(patch).toHaveBeenCalledWith(
    'storage-areas/area-1/status',
    { active: true },
    expect.any(Object),
  );
});
it('collects all tag lookup pages, including retained assigned tags, without requiring Tags management access', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: {
        tags: { items: [storageTags[0]], page: 0, size: 1, totalElements: 2 },
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        tags: { items: [storageTags[1]], page: 1, size: 1, totalElements: 2 },
      },
    });
  expect(await getStorageTags()).toEqual(storageTags.slice(0, 2));
  expect(get).toHaveBeenLastCalledWith(
    'ui/lookups',
    expect.objectContaining({ params: { page: 1, size: 1 } }),
  );
});
it.each([
  [400, 'VALIDATION_FAILED', 'validation', 'none'],
  [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
  [401, 'AUTHENTICATION_FAILED', 'authentication', 'signIn'],
  [403, 'ACCESS_DENIED', 'access', 'none'],
  [404, 'NOT_FOUND', 'notFound', 'reload'],
  [409, 'STORAGE_AREA_IN_USE', 'conflict', 'none'],
  [409, 'NFC_ALREADY_ASSIGNED', 'conflict', 'none'],
  [409, 'DATA_CONFLICT', 'conflict', 'none'],
  [503, undefined, 'service', 'retry'],
])(
  'handles backend status %s and %s with its safe message',
  async (status, code, kind, action) => {
    vi.spyOn(apiClient, 'get').mockResolvedValue({
      status,
      data: { code, detail: 'Backend explanation' },
    });
    await expect(getStorageArea(area.id)).rejects.toMatchObject({
      failure: { kind, action, message: 'Backend explanation' },
    });
  },
);
it('maps field errors and storage number conflicts and recognizes changed roles', () => {
  expect(
    parseStorageFailure(
      {
        code: 'VALIDATION_FAILED',
        fieldErrors: { storageNumber: 'must not be blank', hidden: 'ignored' },
      },
      400,
    ).fieldErrors,
  ).toEqual({ storageNumber: 'must not be blank' });
  expect(
    parseStorageFailure(
      {
        code: 'STORAGE_NUMBER_EXISTS',
        detail: 'Storage number already exists',
      },
      409,
    ).fieldErrors,
  ).toEqual({ storageNumber: 'Storage number already exists' });
  expect(
    parseStorageFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ),
  ).toMatchObject({ kind: 'roleChanged', action: 'signIn' });
});
it('preserves cancellation and provides a network failure for unreachable services', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValue(new Error('offline'));
  await expect(getStorageArea(area.id)).rejects.toMatchObject({
    failure: { kind: 'network', action: 'retry' },
  });
  const cancel = new CanceledError();
  get.mockRejectedValue(cancel);
  await expect(getStorageArea(area.id)).rejects.toBe(cancel);
});
