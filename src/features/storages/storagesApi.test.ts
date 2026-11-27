import { apiPage } from '../../test/apiPage';
import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import {
  storageAreaResponse as area,
  storageUnitResponse as unit,
  storageTags,
} from '../../test/storages';
import {
  createStorageUnit,
  createStorageArea,
  getStorageAreas,
  getStorageStations,
  updateStorageUnit,
  getStorageUnit,
  getStorageUnits,
  getStorageTags,
  getStorageAreaOptions,
  parseStorageFailure,
  setStorageUnitStatus,
} from './storagesApi';
const query = { page: 0, size: 10, search: 'holding' };
const record = {
  id: unit.id,
  station_id: unit.station_id,
  storage_area_id: unit.storage_area_id,
  code: unit.code,
  name: unit.name,
  active: unit.active,
  version: unit.version,
};
beforeEach(() => vi.restoreAllMocks());
it('fetches all station pages and offers only active stations', async () => {
  const stations = Array.from({ length: 12 }, (_, index) => ({
    id: `station-${index}`,
    code: String(index),
    name: `Station ${index}`,
    active: index !== 11,
  }));
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (_url, config) => ({
      status: 200,
      data: apiPage(stations, config?.params, 10),
    }));
  expect(await getStorageStations()).toEqual(stations.slice(0, 11));
  expect(get).toHaveBeenCalledTimes(2);
  expect(get).toHaveBeenLastCalledWith(
    'stations',
    expect.objectContaining({ params: { page: 1, size: 10, search: '' } }),
  );
  get.mockResolvedValue({
    status: 200,
    data: apiPage([{ ...stations[0], active: 'true' }], undefined, 10),
  });
  await expect(getStorageStations()).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('loads paginated areas and validates area creation responses', async () => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: apiPage([area], query),
  });
  expect((await getStorageAreas(query)).items).toEqual([area]);
  const body = {
    stationId: 'station-1',
    storageNumber: 'AREA-001',
    tagId: 'free-tag',
  };
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: { ...area, version: 0, description: null, nfc_uid: 'UID' },
  });
  expect((await createStorageArea(body)).id).toBe(area.id);
  expect(post).toHaveBeenCalledWith('storage-areas', body, expect.anything());
  post.mockResolvedValue({
    status: 200,
    data: { ...area, version: 0, description: null, nfc_uid: null },
  });
  await expect(createStorageArea(body)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('lists units using the storage-locations projection and server paging/search', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [unit], ...query, totalElements: 1 },
  });
  expect((await getStorageUnits(query)).items).toEqual([unit]);
  expect(get).toHaveBeenCalledWith(
    'storage-locations',
    expect.objectContaining({ params: query }),
  );
  get.mockResolvedValue({ status: 200, data: apiPage([], query) });
  expect((await getStorageUnits(query)).totalElements).toBe(0);
});
it.each([
  { ...unit, station_code: undefined },
  { ...unit, storage_area_id: null },
  { ...unit, storage_area_code: undefined },
  { ...unit, name: '' },
  { ...unit, version: -1 },
])('rejects incomplete unit projections', async (item) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [item], ...query, totalElements: 1 },
  });
  await expect(getStorageUnits(query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('reads joined unit details with an encoded ID and validates identity', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { ...unit, id: 'unit/with space' },
  });
  expect((await getStorageUnit('unit/with space')).name).toBe(unit.name);
  expect(get).toHaveBeenCalledWith(
    'storage-locations/unit%2Fwith%20space',
    expect.anything(),
  );
  await expect(getStorageUnit('different')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('creates under an existing area using UnitCommand, accepting the unjoined response', async () => {
  const body = {
    code: 'ST-001',
    name: 'Holding Unit',
    nfcUids: [storageTags[1].uid],
  };
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: { ...record, storage_area_id: 'area/with space' },
  });
  const signal = new AbortController().signal;
  expect(await createStorageUnit('area/with space', body, signal)).toEqual({
    ...record,
    storage_area_id: 'area/with space',
  });
  expect(post).toHaveBeenCalledExactlyOnceWith(
    'storage-areas/area%2Fwith%20space/units',
    body,
    expect.objectContaining({ signal }),
  );
  post.mockResolvedValue({
    status: 200,
    data: { ...record, storage_area_id: 'other' },
  });
  await expect(createStorageUnit(area.id, body)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('updates only unit code and name through storage-units', async () => {
  const put = vi
    .spyOn(apiClient, 'put')
    .mockResolvedValue({ status: 200, data: record });
  expect(
    await updateStorageUnit(unit.id, { code: unit.code, name: unit.name }),
  ).toEqual(record);
  expect(put).toHaveBeenCalledExactlyOnceWith(
    'storage-units/unit-1',
    { code: unit.code, name: unit.name },
    expect.anything(),
  );
});
it('deactivates and activates using unit status PATCH, validating the returned state', async () => {
  const patch = vi
    .spyOn(apiClient, 'patch')
    .mockResolvedValue({ status: 200, data: { ...unit, active: false } });
  expect((await setStorageUnitStatus(unit.id, { active: false })).active).toBe(
    false,
  );
  expect(patch).toHaveBeenCalledWith(
    'storage-locations/unit-1/status',
    { active: false },
    expect.anything(),
  );
  await expect(
    setStorageUnitStatus(unit.id, { active: true }),
  ).rejects.toMatchObject({ failure: { kind: 'invalidResponse' } });
  patch.mockResolvedValue({ status: 200, data: unit });
  expect((await setStorageUnitStatus(unit.id, { active: true })).active).toBe(
    true,
  );
});
it('collects area pages and excludes inactive parents', async () => {
  const areas = Array.from({ length: 101 }, (_, index) => ({
    ...area,
    id: `area-${index}`,
    active: index < 100,
  }));
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: {
        items: areas.slice(0, 100),
        page: 0,
        size: 100,
        totalElements: 101,
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: { items: areas.slice(100), page: 1, size: 100, totalElements: 101 },
    });
  expect(await getStorageAreaOptions()).toEqual(areas.slice(0, 100));
  expect(get).toHaveBeenLastCalledWith(
    'storage-areas',
    expect.objectContaining({ params: { page: 1, size: 100, search: '' } }),
  );
});
it('collects registered tags through lookups without requiring tag-management access', async () => {
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
  [409, 'NOT_FOUND', 'notFound', 'reload'],
  [409, 'NFC_ALREADY_ASSIGNED', 'conflict', 'none'],
  [409, 'NFC_DISABLED', 'conflict', 'none'],
  [409, 'DATA_CONFLICT', 'conflict', 'none'],
  [503, undefined, 'service', 'retry'],
])('handles backend status %s and %s', async (status, code, kind, action) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status,
    data: { code, detail: 'Backend explanation' },
  });
  await expect(getStorageUnit(unit.id)).rejects.toMatchObject({
    failure: { kind, action, message: 'Backend explanation' },
  });
});
it('maps unit and indexed NFC validation errors without guessing generic constraint conflicts', () => {
  expect(
    parseStorageFailure(
      {
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          code: 'Required code',
          name: 'Required name',
          'nfcUids[0]': 'Invalid tag',
          hidden: 'ignored',
        },
      },
      400,
    ).fieldErrors,
  ).toEqual({
    code: 'Required code',
    name: 'Required name',
    nfcUids: 'Invalid tag',
  });
  expect(
    parseStorageFailure(
      {
        code: 'NFC_ALREADY_ASSIGNED',
        detail: 'Unassign the NFC tag before assigning it to another asset',
      },
      409,
    ).fieldErrors,
  ).toEqual({
    nfcUids: 'Unassign the NFC tag before assigning it to another asset',
  });
  expect(
    parseStorageFailure(
      {
        code: 'DATA_CONFLICT',
        detail:
          'The operation violates a uniqueness, reference, or state constraint',
      },
      409,
    ).fieldErrors,
  ).toEqual({});
  expect(
    parseStorageFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ),
  ).toMatchObject({ kind: 'roleChanged', action: 'signIn' });
});
it('preserves cancellation and reports transport failures', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValue(new Error('Offline'));
  await expect(getStorageUnit(unit.id)).rejects.toMatchObject({
    failure: { kind: 'network', action: 'retry' },
  });
  const cancelled = new CanceledError();
  get.mockRejectedValue(cancelled);
  await expect(getStorageUnit(unit.id)).rejects.toBe(cancelled);
});
