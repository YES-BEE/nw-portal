import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { storageAreaResponse as area, storageTags } from '../../test/storages';
import { StorageDetailsPage } from './StorageDetailsPage';
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data: url === 'ui/lookups' ? { tags: storageTags } : area,
  }));
});
function setup() {
  renderWithProviders(
    <MemoryRouter initialEntries={['/configurations/storages/area-1']}>
      <Routes>
        <Route
          path="/configurations/storages/:storageId"
          element={<StorageDetailsPage />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}
it('loads a fresh storage area on direct navigation and displays names without UUIDs or UIDs', async () => {
  setup();
  expect(await screen.findByRole('heading', { name: 'ST-001' })).toBeVisible();
  expect(screen.getByText('03')).toBeVisible();
  expect(screen.getByText('Holding Area Tag')).toBeVisible();
  expect(screen.queryByText(area.id)).not.toBeInTheDocument();
  expect(screen.queryByText(area.nfcUid!)).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Back to Storages' }),
  ).toHaveAttribute('href', '/configurations/storages');
});
it.each([
  [404, 'notFound', 'Requested resource was not found'],
  [403, 'access', 'Missing module access: storage'],
])('shows a backend failure for status %s', async (status, _kind, detail) => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: url === 'ui/lookups' ? 200 : status,
    data: url === 'ui/lookups' ? { tags: storageTags } : { detail },
  }));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(detail);
  expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
});
it('retries service failures', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Maintenance in progress' },
  });
  const user = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Maintenance in progress',
  );
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: 'ST-001' })).toBeVisible();
});
it('rejects an incomplete 200 response instead of presenting invented storage details', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: {} });
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'unexpected response',
  );
});
