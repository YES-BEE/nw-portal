import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { storageAreaResponse as area, storageTags } from '../../test/storages';
import { StorageForm } from './StorageForm';
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data: url === 'ui/lookups' ? { tags: storageTags } : area,
  }));
  vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 200, data: area });
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 200, data: area });
});
function setup(storageId?: string) {
  const callbacks = { onClose: vi.fn(), onSaved: vi.fn(), onReload: vi.fn() };
  return {
    user: userEvent.setup(),
    ...callbacks,
    ...renderWithProviders(
      <StorageForm storageId={storageId} {...callbacks} />,
    ),
  };
}
async function fill(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    await screen.findByRole('textbox', { name: /Storage Number/ }),
    ' ST-001 ',
  );
  await user.type(
    screen.getByRole('textbox', { name: /Station Number/ }),
    ' 03 ',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    ' Holding area ',
  );
  await user.click(screen.getByRole('combobox', { name: /NFC Tag/ }));
  expect(
    screen.queryByRole('option', { name: 'Other Asset Tag' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE-FREE-UID')).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('option', { name: 'Available Storage Tag' }),
  );
}
it('validates required fields and submits trimmed storage and station numbers with a registered tag ID', async () => {
  const { user, onSaved } = setup();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Storage' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Save Storage' }));
  expect(screen.getByText('Enter a station number.')).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Save Storage' }));
  await waitFor(() => expect(onSaved).toHaveBeenCalledOnce());
  expect(apiClient.post).toHaveBeenCalledWith(
    'storage-areas',
    {
      storageNumber: 'ST-001',
      stationNumber: '03',
      description: 'Holding area',
      tagId: 'free-tag',
    },
    expect.any(Object),
  );
});
it('loads fresh edit details, retains the current tag by name and preserves the backend name', async () => {
  const { user } = setup(area.id);
  await waitFor(() =>
    expect(screen.getByRole('textbox', { name: /Storage Number/ })).toHaveValue(
      area.storageNumber,
    ),
  );
  expect(screen.getByRole('combobox', { name: /NFC Tag/ })).toHaveTextContent(
    'Holding Area Tag',
  );
  await user.clear(screen.getByRole('textbox', { name: 'Description' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Updated',
  );
  await user.click(screen.getByRole('button', { name: 'Save Storage' }));
  expect(apiClient.put).toHaveBeenCalledWith(
    'storage-areas/area-1',
    {
      storageNumber: area.storageNumber,
      stationNumber: area.stationNumber,
      description: 'Updated',
      name: area.name,
      tagId: 'current-tag',
    },
    expect.any(Object),
  );
});
it('shows backend field errors without an HTTP code and retains the draft', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 409,
    data: {
      code: 'STORAGE_NUMBER_EXISTS',
      detail: 'Storage number already exists',
    },
  });
  const { user, onSaved } = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Save Storage' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Storage number already exists',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
  expect(screen.getByRole('textbox', { name: /Storage Number/ })).toHaveValue(
    ' ST-001 ',
  );
  expect(
    screen.getByRole('textbox', { name: /Storage Number/ }),
  ).toHaveAccessibleDescription('Storage number already exists');
  expect(onSaved).not.toHaveBeenCalled();
});
it('shows the empty-tag message and disables save without available tags', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: { tags: [] },
  });
  setup();
  expect(
    await screen.findByText(
      'No available tags. Add a tag in Tag Management first.',
    ),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Save Storage' })).toBeDisabled();
});
it('blocks saving on a failed edit GET and offers reload for missing records', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: url === 'ui/lookups' ? 200 : 404,
    data:
      url === 'ui/lookups'
        ? { tags: storageTags }
        : { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
  }));
  const { user, onReload } = setup(area.id);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Requested resource was not found',
  );
  expect(screen.getByRole('button', { name: 'Save Storage' })).toBeDisabled();
  await user.click(
    screen.getByRole('button', { name: 'Reload storage areas' }),
  );
  expect(onReload).toHaveBeenCalledOnce();
});
it('prevents duplicate saves and aborts a pending request when unmounted', async () => {
  let resolve!: (value: { status: number; data: unknown }) => void;
  vi.mocked(apiClient.post).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { user, unmount, onSaved } = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Save Storage' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(apiClient.post).toHaveBeenCalledOnce();
  const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ status: 200, data: area }));
  expect(onSaved).not.toHaveBeenCalled();
});
