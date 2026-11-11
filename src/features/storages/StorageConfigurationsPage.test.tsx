import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { storageAreaResponse as area, storageTags } from '../../test/storages';
import type { StorageAreaResponse } from './types';
import { StorageConfigurationsPage } from './StorageConfigurationsPage';
let records: StorageAreaResponse[];
beforeEach(() => {
  records = [area];
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
    if (url === 'ui/lookups')
      return { status: 200, data: { tags: storageTags } };
    if (url !== 'storage-areas')
      return {
        status: 200,
        data: records.find((record) => url === 'storage-areas/' + record.id),
      };
    const query = config!.params as {
      page: number;
      size: number;
      search: string;
    };
    const matches = records.filter((record) =>
      record.storageNumber.includes(query.search),
    );
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
it('lists API storage areas and tag names without reading or writing browser-local storage records', async () => {
  localStorage.setItem(
    'nw-track-storages-v2',
    JSON.stringify([{ id: 'old', number: 'Local only' }]),
  );
  setup();
  const row = (
    await screen.findByRole('rowheader', { name: 'ST-001' })
  ).closest('tr')!;
  expect(within(row).getByText('03')).toBeVisible();
  expect(await within(row).findByText('Holding Area Tag')).toBeVisible();
  expect(screen.queryByText('PRIVATE-STORAGE-UID')).not.toBeInTheDocument();
  expect(screen.queryByText('Local only')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'View storage ST-001' }),
  ).toHaveAttribute('href', '/configurations/storages/area-1');
  expect(apiClient.get).toHaveBeenCalledWith(
    'storage-areas',
    expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
  );
});
it('opens backend creation and loads a fresh edit record', async () => {
  const { user } = setup();
  await screen.findByRole('rowheader', { name: 'ST-001' });
  await user.click(screen.getByRole('button', { name: 'Add New Storage' }));
  await screen.findByRole('textbox', { name: /Station Number/ });
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  await user.click(screen.getByRole('button', { name: 'Edit storage ST-001' }));
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: /Storage Number/ })).toHaveValue(
      'ST-001',
    ),
  );
  expect(apiClient.get).toHaveBeenCalledWith(
    'storage-areas/area-1',
    expect.any(Object),
  );
});
it('confirms DELETE, releases tags according to the backend response, and restores using PATCH', async () => {
  const remove = vi.spyOn(apiClient, 'delete').mockImplementation(async () => {
    records = [{ ...area, active: false, nfcUid: null, nfc_uid: null }];
    return { status: 200, data: records[0] };
  });
  const patch = vi.spyOn(apiClient, 'patch').mockImplementation(async () => {
    records = [{ ...records[0], active: true }];
    return { status: 200, data: records[0] };
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Delete storage ST-001' }),
  );
  expect(remove).not.toHaveBeenCalled();
  expect(screen.getByRole('dialog')).toHaveTextContent(
    'its units will become inactive',
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
  );
  await user.click(
    await screen.findByRole('button', { name: 'Restore storage ST-001' }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Restore' }),
  );
  await screen.findByRole('button', { name: 'Delete storage ST-001' });
  expect(remove).toHaveBeenCalledWith(
    'storage-areas/area-1',
    expect.any(Object),
  );
  expect(patch).toHaveBeenCalledWith(
    'storage-areas/area-1/status',
    { active: true },
    expect.any(Object),
  );
});
it('preserves an in-use deletion failure and shows the backend explanation without HTTP codes', async () => {
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 409,
    data: {
      code: 'STORAGE_AREA_IN_USE',
      detail: 'Retrieve all lots before deleting the storage area',
    },
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Delete storage ST-001' }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', { name: 'Delete' }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Retrieve all lots before deleting the storage area',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
  expect(screen.getByRole('dialog')).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(screen.getByRole('rowheader', { name: 'ST-001' })).toBeVisible();
});
it('uses server paging, page size and debounced search', async () => {
  records = Array.from({ length: 12 }, (_, index) => ({
    ...area,
    id: 'area-' + index,
    code: 'ST-' + String(index).padStart(3, '0'),
    storageNumber: 'ST-' + String(index).padStart(3, '0'),
    storage_number: 'ST-' + String(index).padStart(3, '0'),
  }));
  const { user } = setup();
  await screen.findByRole('rowheader', { name: 'ST-000' });
  await user.click(screen.getByRole('button', { name: 'Go to next page' }));
  await screen.findByRole('rowheader', { name: 'ST-011' });
  expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  await user.type(screen.getByRole('searchbox'), 'ST-003');
  await screen.findByRole('rowheader', { name: 'ST-003' });
  expect(apiClient.get).toHaveBeenCalledWith(
    'storage-areas',
    expect.objectContaining({
      params: { page: 0, size: 10, search: 'ST-003' },
    }),
  );
});
it('hides pagination on an empty collection and retries a failed list request', async () => {
  records = [];
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Maintenance in progress' },
  });
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Maintenance in progress',
  );
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByText('No storages configured. Click Add New Storage.'),
  ).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
});
