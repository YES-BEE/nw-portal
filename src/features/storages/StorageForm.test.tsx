import { apiPage } from '../../test/apiPage';
import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  storageAreaResponse as area,
  storageUnitResponse as unit,
  storageTags,
} from '../../test/storages';
import { StorageForm } from './StorageForm';
const extraTag = {
  ...storageTags[1],
  id: 'extra-tag',
  name: 'Second Storage Tag',
  uid: 'PRIVATE-SECOND-UID',
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { tags: apiPage([...storageTags, extraTag], undefined, 20) }
        : url === 'storage-areas'
          ? apiPage([area], config?.params, 100)
          : unit,
  }));
  vi.spyOn(apiClient, 'post').mockResolvedValue({ status: 200, data: unit });
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 200, data: unit });
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
    await screen.findByRole('textbox', { name: /Storage Unit Code/ }),
    ' ST-001 ',
  );
  await user.type(
    screen.getByRole('textbox', { name: /Storage Unit Name/ }),
    ' Holding Unit ',
  );
  await user.click(screen.getByRole('combobox', { name: /Storage Area/ }));
  await user.click(screen.getByRole('option', { name: 'Holding Area' }));
}
it('requires an existing parent, code and name, derives the station, and creates with NFC UIDs', async () => {
  const { user, onSaved } = setup();
  await waitFor(() =>
    expect(
      screen.getByRole('button', { name: 'Save Storage Unit' }),
    ).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Save Storage Unit' }));
  expect(screen.getByText('Select a storage area.')).toBeVisible();
  expect(screen.getByText('Enter a storage unit name.')).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
  await fill(user);
  expect(screen.getByRole('textbox', { name: 'Station Number' })).toHaveValue(
    '03',
  );
  expect(
    screen.getByRole('textbox', { name: 'Station Number' }),
  ).toHaveAttribute('readonly');
  await user.click(screen.getByRole('combobox', { name: 'NFC Tags' }));
  expect(
    screen.queryByRole('option', { name: 'Other Asset Tag' }),
  ).not.toBeInTheDocument();
  expect(screen.queryByText('PRIVATE-FREE-UID')).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('option', { name: 'Available Storage Tag' }),
  );
  await user.click(screen.getByRole('option', { name: 'Second Storage Tag' }));
  await user.keyboard('{Escape}');
  await user.click(screen.getByRole('button', { name: 'Save Storage Unit' }));
  expect(apiClient.post).toHaveBeenCalledExactlyOnceWith(
    'storage-areas/area-1/units',
    {
      code: 'ST-001',
      name: 'Holding Unit',
      nfcUids: [storageTags[1].uid, extraTag.uid],
    },
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledOnce();
});
it('allows creation without optional tags, even when no tags are available', async () => {
  const original = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation((url, config) =>
    url === 'ui/lookups'
      ? Promise.resolve({
          status: 200,
          data: { tags: apiPage([], undefined, 20) },
        })
      : original(url, config),
  );
  const { user } = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Save Storage Unit' }));
  expect(apiClient.post).toHaveBeenCalledWith(
    'storage-areas/area-1/units',
    { code: 'ST-001', name: 'Holding Unit', nfcUids: [] },
    expect.anything(),
  );
});
it('blocks creation when there are no active areas', async () => {
  const original = vi.mocked(apiClient.get).getMockImplementation()!;
  vi.mocked(apiClient.get).mockImplementation((url, config) =>
    url === 'storage-areas'
      ? Promise.resolve({ status: 200, data: apiPage([], config?.params, 100) })
      : original(url, config),
  );
  setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'No active storage areas are available.',
  );
  expect(
    screen.getByRole('button', { name: 'Save Storage Unit' }),
  ).toBeDisabled();
});
it('edits only code and name, with the parent and station read-only', async () => {
  const { user, onSaved } = setup(unit.id);
  const name = await screen.findByRole('textbox', {
    name: /Storage Unit Name/,
  });
  expect(name).toHaveValue(unit.name);
  expect(screen.getByRole('textbox', { name: 'Storage Area' })).toHaveAttribute(
    'readonly',
  );
  expect(
    screen.queryByRole('combobox', { name: 'NFC Tags' }),
  ).not.toBeInTheDocument();
  await user.clear(name);
  await user.type(name, ' Updated Unit ');
  await user.click(screen.getByRole('button', { name: 'Save Storage Unit' }));
  expect(apiClient.put).toHaveBeenCalledExactlyOnceWith(
    'storage-units/unit-1',
    { code: unit.code, name: 'Updated Unit' },
    expect.anything(),
  );
  expect(apiClient.get).toHaveBeenCalledExactlyOnceWith(
    'storage-locations/unit-1',
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledOnce();
});
it.each([
  [
    400,
    {
      code: 'VALIDATION_FAILED',
      fieldErrors: {
        code: 'Review the unit code',
        name: 'Review the unit name',
      },
      detail: 'Request validation failed',
    },
  ],
  [
    409,
    {
      code: 'DATA_CONFLICT',
      detail:
        'The operation violates a uniqueness, reference, or state constraint',
    },
  ],
  [
    409,
    {
      code: 'NFC_ALREADY_ASSIGNED',
      detail: 'Unassign the NFC tag before assigning it to another asset',
    },
  ],
])(
  'preserves the draft and displays backend errors for %s',
  async (status, problem) => {
    vi.mocked(apiClient.post).mockResolvedValue({ status, data: problem });
    const { user, onSaved } = setup();
    await fill(user);
    await user.click(screen.getByRole('button', { name: 'Save Storage Unit' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(problem.detail);
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
    expect(
      screen.getByRole('textbox', { name: /Storage Unit Code/ }),
    ).toHaveValue(' ST-001 ');
    expect(onSaved).not.toHaveBeenCalled();
    if (status === 400)
      expect(
        screen.getByRole('textbox', { name: /Storage Unit Code/ }),
      ).toHaveAccessibleDescription('Review the unit code');
  },
);
it('blocks saving a missing unit and offers reload', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 404,
    data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
  });
  const { user, onReload } = setup(unit.id);
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Requested resource was not found',
  );
  expect(
    screen.getByRole('button', { name: 'Save Storage Unit' }),
  ).toBeDisabled();
  await user.click(
    screen.getByRole('button', { name: 'Reload storage units' }),
  );
  expect(onReload).toHaveBeenCalledOnce();
});
it('blocks duplicate saves and aborts an in-flight create on unmount', async () => {
  let complete!: (value: { status: number; data: unknown }) => void;
  vi.mocked(apiClient.post).mockReturnValue(
    new Promise((resolve) => {
      complete = resolve;
    }),
  );
  const { user, unmount, onSaved } = setup();
  await fill(user);
  await user.click(screen.getByRole('button', { name: 'Save Storage Unit' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  expect(apiClient.post).toHaveBeenCalledOnce();
  const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => complete({ status: 200, data: unit }));
  expect(onSaved).not.toHaveBeenCalled();
});
