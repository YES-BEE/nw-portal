import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { storageUnitResponse as unit } from '../../test/storages';
import { StorageDetailsPage } from './StorageDetailsPage';
beforeEach(() =>
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data: unit }),
);
function setup() {
  renderWithProviders(
    <MemoryRouter initialEntries={['/configurations/storages/unit-1']}>
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
it('shows unit details and parent/station codes without inventing area-only fields', async () => {
  setup();
  expect(await screen.findByRole('heading', { name: unit.code })).toBeVisible();
  expect(screen.getByText(unit.name)).toBeVisible();
  expect(screen.getByText(unit.station_code)).toBeVisible();
  expect(screen.getByText(unit.storage_area_code)).toBeVisible();
  expect(screen.queryByText(unit.id)).not.toBeInTheDocument();
  expect(screen.queryByText(unit.storage_area_id)).not.toBeInTheDocument();
  expect(screen.queryByText('No tag assigned')).not.toBeInTheDocument();
  expect(
    screen.getByRole('link', { name: 'Back to Storage Units' }),
  ).toHaveAttribute('href', '/configurations/storages');
  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(
    'storage-locations/unit-1',
    expect.anything(),
  );
});
it.each([404, 403])('shows backend detail failures for %s', async (status) => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status,
    data: { detail: 'Storage unit is unavailable' },
  });
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Storage unit is unavailable',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
});
it('retries service errors', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Maintenance in progress' },
  });
  const user = setup();
  await screen.findByRole('alert');
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(await screen.findByRole('heading', { name: unit.code })).toBeVisible();
});
it('rejects incomplete detail responses', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: {} });
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'unexpected response',
  );
});
