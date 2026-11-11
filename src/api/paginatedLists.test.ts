import type { PageQuery } from './collections';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import {
  getAccessRoles,
  getAccessRoleOptions,
  getModules,
} from '../features/access/accessRolesApi';
import { getUsers, getUserProcessOptions } from '../features/access/usersApi';
import { getTags } from '../features/tags/tagsApi';
import {
  getProcesses,
  getProcessTagOptions,
} from '../features/processes/processesApi';
import {
  accessRolesResponse,
  accessRoleOptionsResponse,
} from '../test/accessRoles';
import { usersResponse } from '../test/users';
import { tagsResponse } from '../test/tags';
import { processesResponse } from '../test/processes';
import { modulesResponse } from '../test/modules';

const cases = [
  {
    name: 'roles',
    path: 'access-roles',
    get: getAccessRoles,
    items: accessRolesResponse.slice(0, 2),
  },
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
  {
    name: 'users',
    path: 'users',
    get: getUsers,
    items: usersResponse.slice(0, 2),
  },
  {
    name: 'tags',
    path: 'nfc-tags',
    get: getTags,
    items: tagsResponse.slice(0, 2),
  },
  {
    name: 'processes',
    path: 'processes',
    get: getProcesses,
    items: processesResponse.slice(0, 2),
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
      if (path === 'nfc-tags')
        expect(
          vi
            .mocked(apiClient.get)
            .mock.calls.every(
              (call) =>
                (call[1]?.params as { status?: string } | undefined)?.status ===
                'ACTIVE',
            ),
        ).toBe(true);
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
        field === 'processes'
          ? getUserProcessOptions()
          : getProcessTagOptions(),
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
  it('loads all tag lookup pages before filtering assigned tags', async () => {
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
    await expect(getProcessTagOptions()).resolves.toEqual([tags[1]]);
  });
});
