import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { apiClient } from './client';
import { renderWithProviders } from '../test/render';
import { apiPage } from '../test/apiPage';
import { UserManagementPage } from '../features/access/UserManagementPage';
import { RoleManagementPage } from '../features/access/RoleManagementPage';
import { TagManagementPage } from '../features/tags/TagManagementPage';
import { ProcessConfigurationsPage } from '../features/processes/ProcessConfigurationsPage';
import { userResponse } from '../test/users';
import { accessRolesResponse } from '../test/accessRoles';
import { tagsResponse } from '../test/tags';
import { processResponse } from '../test/processes';

const cases = [
  {
    name: 'Users',
    path: 'users',
    Component: UserManagementPage,
    items: Array.from({ length: 23 }, (_, index) => ({
      ...userResponse,
      id: `user-${index}`,
      username: `User ${index}`,
      enabled: true,
      role: 'raw_ROLE',
    })),
  },
  {
    name: 'Roles',
    path: 'access-roles',
    Component: RoleManagementPage,
    items: Array.from({ length: 23 }, (_, index) => ({
      ...accessRolesResponse[0],
      code: `role-${index}`,
      name: `Role ${index}`,
    })),
  },
  {
    name: 'Tags',
    path: 'nfc-tags',
    Component: TagManagementPage,
    items: Array.from({ length: 23 }, (_, index) => ({
      ...tagsResponse[0],
      id: `tag-${index}`,
      name: `Tag ${index}`,
    })),
  },
  {
    name: 'Processes',
    path: 'processes',
    Component: ProcessConfigurationsPage,
    items: Array.from({ length: 23 }, (_, index) => ({
      ...processResponse,
      id: `process-${index}`,
      name: `Process ${index}`,
      active: true,
    })),
  },
];

describe('server-driven management lists', () => {
  it.each(cases)(
    '$name sends pagination and search to the API and renders its results without local search or pagination',
    async ({ name, path, Component, items }) => {
      vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
        if (url === 'ui/lookups')
          return { status: 200, data: { tags: apiPage([], undefined, 20) } };
        expect(url).toBe(path);
        const query = config?.params as {
          page: number;
          size: number;
          search: string;
        };
        // The selected result intentionally does not contain the search text.
        const matching = query.search ? [items[22]] : items;
        return {
          status: 200,
          data: {
            items: matching.slice(
              query.page * query.size,
              (query.page + 1) * query.size,
            ),
            page: query.page,
            size: query.size,
            totalElements: matching.length,
          },
        };
      });
      const user = userEvent.setup();
      renderWithProviders(
        <MemoryRouter>
          <Component />
        </MemoryRouter>,
      );
      await waitFor(() =>
        expect(screen.getAllByRole('rowheader')).toHaveLength(10),
      );
      expect(
        vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === path),
      ).toHaveLength(1);
      expect(apiClient.get).toHaveBeenCalledWith(
        path,
        expect.objectContaining({
          params: expect.objectContaining({ page: 0, size: 10, search: '' }),
        }),
      );
      await user.click(screen.getByRole('button', { name: 'Go to next page' }));
      await waitFor(() =>
        expect(apiClient.get).toHaveBeenCalledWith(
          path,
          expect.objectContaining({
            params: expect.objectContaining({ page: 1, size: 10, search: '' }),
          }),
        ),
      );
      await screen.findByRole('rowheader', {
        name: new RegExp(
          `^${name === 'Users' ? 'User' : name === 'Roles' ? 'Role' : name === 'Tags' ? 'Tag' : 'Process'} 10\\b`,
        ),
      });
      await user.click(screen.getByRole('combobox', { name: /Rows per page/ }));
      await user.click(screen.getByRole('option', { name: '25' }));
      await waitFor(() =>
        expect(screen.getAllByRole('rowheader')).toHaveLength(23),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        path,
        expect.objectContaining({
          params: expect.objectContaining({ page: 0, size: 25, search: '' }),
        }),
      );
      fireEvent.change(screen.getByRole('searchbox'), {
        target: { value: '  Not A Local Match  ' },
      });
      await waitFor(() =>
        expect(screen.getAllByRole('rowheader')).toHaveLength(1),
      );
      expect(apiClient.get).toHaveBeenCalledWith(
        path,
        expect.objectContaining({
          params: expect.objectContaining({
            page: 0,
            size: 25,
            search: 'Not A Local Match',
          }),
        }),
      );
      expect(
        vi.mocked(apiClient.get).mock.calls.filter(([url]) => url === path),
      ).toHaveLength(4);
      if (path === 'nfc-tags')
        expect(
          vi
            .mocked(apiClient.get)
            .mock.calls.every(
              (call) =>
                (call[1]?.params as { status: string }).status === 'ACTIVE',
            ),
        ).toBe(true);
      if (path === 'users') expect(screen.getByText('raw_ROLE')).toBeVisible();
    },
  );
});
