import type { PageQuery } from './collections';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import {
  getAccessRolesPage,
  getAccessRoleOptions,
  getModules,
} from '../features/access/accessRolesApi';
import {
  getUsersPage,
  getUserProcessOptions,
} from '../features/access/usersApi';
import { getTagsPage } from '../features/tags/tagsApi';
import {
  getProcessesPage,
  getProcessTags,
} from '../features/processes/processesApi';
import {
  accessRolesResponse,
  accessRoleOptionsResponse,
} from '../test/accessRoles';
import { usersResponse } from '../test/users';
import { tagsResponse } from '../test/tags';
import { processesResponse } from '../test/processes';
import { modulesResponse } from '../test/modules';

const pageCases = [
  {
    name: 'roles',
    path: 'access-roles',
    get: getAccessRolesPage,
    items: accessRolesResponse.slice(0, 2),
  },
  {
    name: 'users',
    path: 'users',
    get: getUsersPage,
    items: usersResponse.slice(0, 2),
  },
  {
    name: 'tags',
    path: 'nfc-tags',
    get: getTagsPage,
    items: tagsResponse.slice(0, 2),
  },
  {
    name: 'processes',
    path: 'processes',
    get: getProcessesPage,
    items: processesResponse.slice(0, 2),
  },
];
const cases = [
  {
    name: 'role options',
    path: 'access-roles/options',
    get: getAccessRoleOptions,
    items: accessRoleOptionsResponse.slice(0, 2),
  },
  {
    name: 'modules',
    path: 'modules',
    get: getModules,
    items: modulesResponse.slice(0, 2),
  },
];
describe('paginated list integrations', () => {
  it.each(cases)(
    'accepts empty backend pages for $name',
    async ({ path, get }) => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { items: [], page: 0, size: 20, totalElements: 0 },
      });
      await expect(get()).resolves.toEqual([]);
      expect(apiClient.get).toHaveBeenCalledWith(path, expect.anything());
    },
  );
  it.each(cases)(
    'loads all backend pages for $name with the same cancellation signal',
    async ({ path, get, items }) => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
        const index =
          (config?.params as Partial<PageQuery> | undefined)?.page ?? 0;
        return {
          status: 200,
          data: {
            items: [items[index]],
            page: index,
            size: 1,
            totalElements: 2,
          },
        };
      });
      const controller = new AbortController();
      await expect(get(controller.signal)).resolves.toEqual(items);
      expect(apiClient.get).toHaveBeenLastCalledWith(
        path,
        expect.objectContaining({
          signal: controller.signal,
          params: expect.objectContaining({ page: 1, size: 1 }),
        }),
      );
    },
  );
  it.each(['processes', 'tags'] as const)(
    'accepts nested empty pages for %s lookups',
    async (field) => {
      vi.spyOn(apiClient, 'get').mockResolvedValue({
        status: 200,
        data: { [field]: { items: [], page: 0, size: 20, totalElements: 0 } },
      });
      await expect(
        field === 'processes' ? getUserProcessOptions() : getProcessTags(),
      ).resolves.toEqual([]);
    },
  );
  it('loads all process lookup options across nested pages', async () => {
    const options = [
      { id: 'p1', name: 'Washing', station_id: 's1', stationNumber: '01' },
      { id: 'p2', name: 'Drying', station_id: 's2', stationNumber: '02' },
    ];
    vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
      const page =
        (config?.params as Partial<PageQuery> | undefined)?.page ?? 0;
      return {
        status: 200,
        data: {
          processes: {
            items: [options[page]],
            page,
            size: 1,
            totalElements: 2,
          },
        },
      };
    });
    await expect(getUserProcessOptions()).resolves.toEqual(options);
  });
  it('loads all tag lookup pages with assignment states', async () => {
    const tags = [
      { id: 't1', name: 'Tag 1', uid: 'ABC', status: 'ACTIVE', assigned: true },
      {
        id: 't2',
        name: 'Tag 2',
        uid: 'DEF',
        status: 'ACTIVE',
        assigned: false,
      },
    ];
    vi.spyOn(apiClient, 'get').mockImplementation(async (_url, config) => {
      const page =
        (config?.params as Partial<PageQuery> | undefined)?.page ?? 0;
      return {
        status: 200,
        data: {
          tags: { items: [tags[page]], page, size: 1, totalElements: 2 },
        },
      };
    });
    await expect(getProcessTags()).resolves.toEqual(tags);
  });
});

describe('server-paged module list APIs', () => {
  it.each(pageCases)(
    'accepts an empty backend page for $name',
    async ({ get }) => {
      const data = { items: [], page: 0, size: 20, totalElements: 0 };
      vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data });
      expect(await get({ page: 0, size: 20, search: '' })).toEqual(data);
    },
  );
  it.each(pageCases)(
    'fetches only the requested page for $name',
    async ({ get, path, items }) => {
      const data = { items: [items[0]], page: 0, size: 1, totalElements: 2 };
      vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data });
      const controller = new AbortController();
      expect(
        await get({ page: 0, size: 1, search: 'lookup' }, controller.signal),
      ).toEqual(data);
      expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(
        path,
        expect.objectContaining({
          signal: controller.signal,
          params: expect.objectContaining({
            page: 0,
            size: 1,
            search: 'lookup',
          }),
        }),
      );
    },
  );
});
