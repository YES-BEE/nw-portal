import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { apiPage } from '../../test/apiPage';
import { renderWithProviders } from '../../test/render';
import { storageAreaResponse, storageTags } from '../../test/storages';
import { StorageAreaForm } from './StorageAreaForm';

const stations = [
  { id: 'station-1', code: '03', name: 'Production', active: true },
  { id: 'inactive', code: '04', name: 'Closed', active: false },
];
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => ({
    status: 200,
    data:
      url === 'stations'
        ? apiPage(stations, config?.params, 10)
        : { tags: apiPage(storageTags, undefined, 20) },
  }));
});
function setup() {
  const onSaved = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(
    <StorageAreaForm onClose={vi.fn()} onReload={vi.fn()} onSaved={onSaved} />,
  );
  return { user, onSaved };
}
it('blocks saving when no active stations are available', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => ({
    status: 200,
    data:
      url === 'stations'
        ? apiPage(
            stations.filter((station) => !station.active),
            config?.params,
            10,
          )
        : { tags: apiPage(storageTags, undefined, 20) },
  }));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No active stations are available',
  );
  expect(
    screen.getByRole('combobox', { name: /Station Number/ }),
  ).toHaveAttribute('aria-disabled', 'true');
  expect(
    screen.getByRole('button', { name: 'Save Storage Area' }),
  ).toBeDisabled();
});
it('retries a failed station lookup before enabling creation', async () => {
  const get = vi.mocked(apiClient.get);
  const load = get.getMockImplementation()!;
  get.mockImplementation(async (url, config) =>
    url === 'stations'
      ? { status: 503, data: { detail: 'Station service unavailable' } }
      : load(url, config),
  );
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Station service unavailable',
  );
  expect(
    screen.getByRole('button', { name: 'Save Storage Area' }),
  ).toBeDisabled();
  get.mockImplementation(load);
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(
      screen.getByRole('combobox', { name: /Station Number/ }),
    ).toBeEnabled(),
  );
});
it('requires one available NFC tag and sends the backend area command', async () => {
  const area = {
    ...storageAreaResponse,
    version: 0,
    description: null,
    nfc_uid: 'PRIVATE-FREE-UID',
  };
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 200, data: area });
  const { user, onSaved } = setup();
  const tag = await screen.findByRole('combobox', { name: /Area NFC Tag/ });
  await waitFor(() => expect(tag).toBeEnabled());
  await user.click(screen.getByRole('combobox', { name: /Station Number/ }));
  expect(
    screen.queryByRole('option', { name: /Closed/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Production' }));
  await user.type(
    screen.getByRole('textbox', { name: /Storage Area Number/ }),
    'AREA-001',
  );
  await user.click(screen.getByRole('button', { name: 'Save Storage Area' }));
  expect(post).not.toHaveBeenCalled();
  expect(screen.getByText('This field is required.')).toBeVisible();
  await user.click(tag);
  expect(
    screen.queryByRole('option', { name: 'Other Asset Tag' }),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('option', { name: 'Available Storage Tag' }),
  );
  await user.click(screen.getByRole('button', { name: 'Save Storage Area' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledWith(area));
  expect(post).toHaveBeenCalledWith(
    'storage-areas',
    {
      stationId: 'station-1',
      storageNumber: 'AREA-001',
      name: undefined,
      description: undefined,
      tagId: 'free-tag',
    },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
});
it('blocks area creation when no registered tags are free', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => ({
    status: 200,
    data:
      url === 'stations'
        ? apiPage(stations, config?.params, 10)
        : {
            tags: apiPage(
              storageTags.filter((tag) => tag.assigned),
              undefined,
              20,
            ),
          },
  }));
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'An available registered NFC tag is required',
  );
  expect(
    screen.getByRole('button', { name: 'Save Storage Area' }),
  ).toBeDisabled();
});
it('retains entered area values and shows NFC assignment conflicts', async () => {
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 409,
    data: {
      code: 'NFC_ALREADY_ASSIGNED',
      detail: 'Selected tag is already assigned',
    },
  });
  const { user, onSaved } = setup();
  const tag = await screen.findByRole('combobox', { name: /Area NFC Tag/ });
  await waitFor(() => expect(tag).toBeEnabled());
  await user.click(screen.getByRole('combobox', { name: /Station Number/ }));
  expect(
    screen.queryByRole('option', { name: /Closed/ }),
  ).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'Production' }));
  await user.type(
    screen.getByRole('textbox', { name: /Storage Area Number/ }),
    'AREA-001',
  );
  await user.click(tag);
  await user.click(
    screen.getByRole('option', { name: 'Available Storage Tag' }),
  );
  await user.click(screen.getByRole('button', { name: 'Save Storage Area' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Selected tag is already assigned',
  );
  expect(
    screen.getByRole('textbox', { name: /Storage Area Number/ }),
  ).toHaveValue('AREA-001');
  expect(onSaved).not.toHaveBeenCalled();
});
