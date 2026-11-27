import { apiPage } from '../../test/apiPage';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  storageAreaResponse as area,
  storageUnitResponse as unit,
  storageTags,
} from '../../test/storages';
import type { StorageUnitResponse } from './types';
import { StorageConfigurationsPage } from './StorageConfigurationsPage';
let records: StorageUnitResponse[];
beforeEach(() => {
  records = [unit];
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
    if (url === 'ui/lookups')
      return {
        status: 200,
        data: { tags: apiPage(storageTags, config?.params, 20) },
      };
    if (url === 'storage-areas')
      return { status: 200, data: apiPage([area], config?.params, 100) };
    if (url !== 'storage-locations')
      return {
        status: 200,
        data: records.find((item) => url === 'storage-locations/' + item.id),
      };
    const query = config!.params as {
      page: number;
      size: number;
      search: string;
    };
    const matches = records.filter((item) => item.code.includes(query.search));
    return {
      status: 200,
      data: {
        items: matches.slice(
          query.page * query.size,
          (query.page + 1) * query.size,
        ),
        ...query,
        totalElements: matches.length,
      },
    };
  });
});
function setup() {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <MemoryRouter>
        <StorageConfigurationsPage />
      </MemoryRouter>,
    ),
  };
}
it('lists backend units and their parent areas without depending on tag lookups', async () => {
  setup();
  const row = (
    await screen.findByRole('rowheader', { name: unit.code })
  ).closest('tr')!;
  expect(within(row).getByText(unit.name)).toBeVisible();
  expect(within(row).getByText(unit.storage_area_code)).toBeVisible();
  expect(within(row).getByText('03')).toBeVisible();
  expect(
    screen.getByRole('link', { name: 'View storage unit ST-001' }),
  ).toHaveAttribute('href', '/configurations/storages/unit-1');
  expect(apiClient.get).toHaveBeenCalledWith(
    'storage-locations',
    expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
  );
});
it('opens unit creation and loads fresh details for unit editing', async () => {
  const { user } = setup();
  await screen.findByRole('rowheader', { name: unit.code });
  await user.click(screen.getByRole('button', { name: 'Add Storage Unit' }));
  expect(
    await screen.findByRole('combobox', { name: /Storage Area/ }),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(
    screen.getByRole('button', { name: 'Edit storage unit ST-001' }),
  );
  await waitFor(() =>
    expect(
      screen.getByRole('textbox', { name: /Storage Unit Code/ }),
    ).toHaveValue(unit.code),
  );
  expect(apiClient.get).toHaveBeenCalledWith(
    'storage-locations/unit-1',
    expect.anything(),
  );
});
it('deactivates and activates a unit using PATCH without deleting its area', async () => {
  const patch = vi
    .spyOn(apiClient, 'patch')
    .mockImplementation(async (_, body) => {
      records = [{ ...unit, active: (body as { active: boolean }).active }];
      return { status: 200, data: records[0] };
    });
  const remove = vi.spyOn(apiClient, 'delete');
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Deactivate storage unit ST-001',
    }),
  );
  expect(patch).not.toHaveBeenCalled();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Deactivate',
    }),
  );
  await user.click(
    await screen.findByRole('button', { name: 'Activate storage unit ST-001' }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Activate',
    }),
  );
  await screen.findByRole('button', { name: 'Deactivate storage unit ST-001' });
  expect(patch).toHaveBeenNthCalledWith(
    1,
    'storage-locations/unit-1/status',
    { active: false },
    expect.anything(),
  );
  expect(patch).toHaveBeenNthCalledWith(
    2,
    'storage-locations/unit-1/status',
    { active: true },
    expect.anything(),
  );
  expect(remove).not.toHaveBeenCalled();
});
it('preserves backend activation errors and keeps the confirmation open', async () => {
  vi.spyOn(apiClient, 'patch').mockResolvedValue({
    status: 409,
    data: {
      code: 'DATA_CONFLICT',
      detail:
        'The operation violates a uniqueness, reference, or state constraint',
    },
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', {
      name: 'Deactivate storage unit ST-001',
    }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Deactivate',
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'The operation violates a uniqueness, reference, or state constraint',
  );
  expect(screen.getByRole('dialog')).toBeVisible();
});
it('uses backend unit paging and debounced search', async () => {
  records = Array.from({ length: 12 }, (_, index) => ({
    ...unit,
    id: `unit-${index}`,
    code: `ST-${String(index).padStart(3, '0')}`,
  }));
  const { user } = setup();
  await screen.findByRole('rowheader', { name: 'ST-000' });
  const units = within(screen.getByRole('region', { name: 'Storage Units' }));
  await user.click(units.getByRole('button', { name: 'Go to next page' }));
  await screen.findByRole('rowheader', { name: 'ST-011' });
  expect(units.getAllByRole('rowheader')).toHaveLength(2);
  await user.type(units.getByRole('searchbox'), 'ST-003');
  await screen.findByRole('rowheader', { name: 'ST-003' });
  expect(apiClient.get).toHaveBeenCalledWith(
    'storage-locations',
    expect.objectContaining({
      params: { page: 0, size: 10, search: 'ST-003' },
    }),
  );
});
it('retries failed unit collections and handles empty results', async () => {
  records = [];
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Maintenance in progress' },
  });
  const { user } = setup();
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByText('No storage units configured')).toBeVisible();
  expect(
    within(screen.getByRole('region', { name: 'Storage Units' })).queryByText(
      'Rows per page:',
    ),
  ).not.toBeInTheDocument();
});
it('starts unit creation under the selected area with its inherited station', async () => {
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Add unit under area AREA-001' }),
  );
  expect(
    await screen.findByRole('combobox', { name: /Storage Area/ }),
  ).toHaveTextContent('Holding Area');
  expect(screen.getByRole('textbox', { name: /Station Number/ })).toHaveValue(
    '03',
  );
});
