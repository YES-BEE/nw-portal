import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createTagResponse } from '../../test/tags';
import type { TagDetailsResponse } from '../tags/tagsApi';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { TrolleyConfigurationsPage } from './TrolleyConfigurationsPage';
import type { TrolleyResponse } from './types';

const trolley: TrolleyResponse = {
  id: 'trolley-1',
  code: 'TR-01',
  status: 'AVAILABLE',
  active: true,
  version: 0,
};
let records: TrolleyResponse[];
let tagRecords: TagDetailsResponse[];
beforeEach(() => {
  tagRecords = [];
  records = [
    trolley,
    {
      ...trolley,
      id: 'trolley-2',
      code: 'TR-02',
      active: false,
      status: 'IN_USE',
    },
  ];
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
    const assigned = (config?.params as { assigned?: boolean } | undefined)
      ?.assigned;
    if (url === 'nfc-tags')
      return {
        status: 200,
        data: tagRecords.filter(
          (tag) => assigned === undefined || tag.assigned === assigned,
        ),
      };
    if (url.startsWith('nfc-tags/'))
      return {
        status: 200,
        data: tagRecords.find((tag) => url === 'nfc-tags/' + tag.id),
      };
    if (url !== 'trolleys')
      return {
        status: 200,
        data: records.find((record) => `trolleys/${record.id}` === url),
      };
    const { page, size, search } = config!.params as {
      page: number;
      size: number;
      search: string;
    };
    const filtered = records.filter((record) =>
      record.code.toLowerCase().includes(search.toLowerCase()),
    );
    return {
      status: 200,
      data: {
        items: filtered.slice(page * size, (page + 1) * size),
        page,
        size,
        totalElements: filtered.length,
      },
    };
  });
  vi.spyOn(apiClient, 'post').mockImplementation(async (_url, body) => {
    const created = {
      ...trolley,
      id: 'new-trolley',
      code: (body as { code: string }).code.toUpperCase(),
    };
    records.push(created);
    return { status: 200, data: created };
  });
  vi.spyOn(apiClient, 'put').mockImplementation(async (url, body) => {
    const updated = {
      ...trolley,
      code: (body as { code: string }).code.toUpperCase(),
      version: 1,
    };
    records = records.map((record) =>
      `trolleys/${record.id}` === url ? updated : record,
    );
    return { status: 200, data: updated };
  });
  vi.spyOn(apiClient, 'patch').mockImplementation(async (url, body) => {
    const old = records.find(
      (record) => `trolleys/${record.id}/status` === url,
    )!;
    const updated = {
      ...old,
      active: (body as { active: boolean }).active,
      version: old.version + 1,
    };
    records = records.map((record) =>
      record.id === updated.id ? updated : record,
    );
    return { status: 200, data: updated };
  });
});
function setup() {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(<TrolleyConfigurationsPage />),
  };
}

describe('trolley configuration', () => {
  it('lists trolley codes, availability, active state and actions using the paginated API', async () => {
    setup();
    const row = (
      await screen.findByRole('rowheader', { name: 'TR-01' })
    ).closest('tr')!;
    expect(within(row).getByText('Available')).toBeVisible();
    expect(within(row).getByText('Active')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Restore TR-02' })).toBeEnabled();
    expect(apiClient.get).toHaveBeenCalledWith(
      'trolleys',
      expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
    );
    expect(screen.queryByText(trolley.id)).not.toBeInTheDocument();
  });
  it('validates and creates a trolley, then reloads the table', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add Trolley' }));
    await user.click(screen.getByRole('button', { name: 'Save Trolley' }));
    expect(await screen.findByText('Enter a trolley code.')).toBeVisible();
    expect(apiClient.post).not.toHaveBeenCalled();
    await user.type(
      screen.getByRole('textbox', { name: /Trolley Code/ }),
      ' tr-03 ',
    );
    await user.click(screen.getByRole('button', { name: 'Save Trolley' }));
    expect(
      await screen.findByRole('rowheader', { name: 'TR-03' }),
    ).toBeVisible();
    expect(apiClient.post).toHaveBeenCalledWith(
      'trolleys',
      { code: 'tr-03' },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
  it('fetches fresh details for viewing and editing and sends a typed PUT', async () => {
    const { user } = setup();
    await user.click(await screen.findByRole('button', { name: 'View TR-01' }));
    expect(
      await within(screen.getByRole('dialog')).findByText('TR-01'),
    ).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledWith(
      `trolleys/${trolley.id}`,
      expect.anything(),
    );
    expect(
      within(screen.getByRole('dialog')).queryByText(trolley.id),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Edit TR-01' }));
    const code = await screen.findByRole('textbox', { name: /Trolley Code/ });
    expect(code).toHaveValue('TR-01');
    await user.clear(code);
    await user.type(code, 'TR-EDIT');
    await user.click(screen.getByRole('button', { name: 'Save Trolley' }));
    expect(
      await screen.findByRole('rowheader', { name: 'TR-EDIT' }),
    ).toBeVisible();
    expect(apiClient.put).toHaveBeenCalledWith(
      `trolleys/${trolley.id}`,
      { code: 'TR-EDIT' },
      expect.anything(),
    );
  });
  it('requires confirmation before deactivation and can restore inactive trolleys', async () => {
    const { user } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Delete TR-01' }),
    );
    expect(screen.getByRole('dialog')).toHaveTextContent(
      'TR-01 will be made inactive.',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiClient.patch).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Delete TR-01' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await screen.findByRole('button', { name: 'Restore TR-01' });
    expect(apiClient.patch).toHaveBeenCalledWith(
      `trolleys/${trolley.id}/status`,
      { active: false },
      expect.anything(),
    );
    await user.click(screen.getByRole('button', { name: 'Restore TR-01' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Restore',
      }),
    );
    expect(
      await screen.findByRole('button', { name: 'Delete TR-01' }),
    ).toBeEnabled();
    expect(apiClient.patch).toHaveBeenLastCalledWith(
      `trolleys/${trolley.id}/status`,
      { active: true },
      expect.anything(),
    );
  });
  it('uses server paging and resets to the first page when searching', async () => {
    records = Array.from({ length: 12 }, (_, index) => ({
      ...trolley,
      id: `t-${index}`,
      code: `TR-${String(index).padStart(2, '0')}`,
    }));
    const { user } = setup();
    await screen.findByRole('rowheader', { name: 'TR-00' });
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    await screen.findByRole('rowheader', { name: 'TR-11' });
    expect(screen.getAllByRole('rowheader')).toHaveLength(2);
    await user.type(screen.getByRole('searchbox'), 'TR-03');
    expect(
      await screen.findByRole('rowheader', { name: 'TR-03' }),
    ).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledWith(
      'trolleys',
      expect.objectContaining({
        params: { page: 0, size: 10, search: 'TR-03' },
      }),
    );
    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
  });
  it('preserves mutation drafts and backend errors without showing HTTP codes', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 409,
      data: { code: 'DATA_CONFLICT', detail: 'Trolley code already exists' },
    });
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add Trolley' }));
    await user.type(
      screen.getByRole('textbox', { name: /Trolley Code/ }),
      'TR-01',
    );
    await user.click(screen.getByRole('button', { name: 'Save Trolley' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trolley code already exists',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 409');
    expect(screen.getByRole('textbox', { name: /Trolley Code/ })).toHaveValue(
      'TR-01',
    );
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it('shows a successful bare empty array as an empty list', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [] });
    setup();
    expect(await screen.findByText('No trolleys found.')).toBeVisible();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('shows empty and failed list states and permits retrying a transient failure', async () => {
    records = [];
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Trolleys temporarily unavailable' },
    });
    const { user } = setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Trolleys temporarily unavailable',
    );
    expect(screen.queryByText('No trolleys found.')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(await screen.findByText('No trolleys found.')).toBeVisible();
  });
  it('blocks duplicate mutation submissions and aborts when unmounted', async () => {
    let resolve!: (value: { status: number; data: TrolleyResponse }) => void;
    vi.mocked(apiClient.post).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const { user, unmount } = setup();
    await user.click(screen.getByRole('button', { name: 'Add Trolley' }));
    await user.type(
      screen.getByRole('textbox', { name: /Trolley Code/ }),
      'TR-99',
    );
    await user.click(screen.getByRole('button', { name: 'Save Trolley' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
    await act(async () => resolve({ status: 200, data: trolley }));
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });
  it('shows a missing-detail failure and reloads the list instead of editing stale data', async () => {
    const { user } = setup();
    await screen.findByRole('rowheader', { name: 'TR-01' });
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 404,
      data: { detail: 'Requested resource was not found' },
    });
    await user.click(screen.getByRole('button', { name: 'Edit TR-01' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Requested resource was not found',
    );
    expect(
      screen.queryByRole('textbox', { name: /Trolley Code/ }),
    ).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save Trolley' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reload trolleys' }));
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
  });
});

it('shows separate assignment actions inline and hides NFC actions on inactive unassigned trolleys', async () => {
  records.push({ ...trolley, id: 'trolley-3', code: 'TR-03', active: false });
  tagRecords = [
    {
      ...createTagResponse,
      id: 'active-tag',
      name: 'Hidden active tag name',
      assigned: true,
      asset_type: 'TROLLEY',
      trolley_id: trolley.id,
    },
    {
      ...createTagResponse,
      id: 'inactive-tag',
      name: 'Hidden inactive tag name',
      assigned: true,
      asset_type: 'TROLLEY',
      trolley_id: 'trolley-2',
    },
  ];
  const remove = vi
    .spyOn(apiClient, 'delete')
    .mockResolvedValue({ status: 200, data: '' });
  const { user } = setup();
  expect(
    await screen.findByRole('button', { name: 'Replace NFC tag on TR-01' }),
  ).toBeEnabled();
  expect(
    screen.getByRole('button', { name: 'Unassign NFC tag from TR-01' }),
  ).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Assign NFC tag to TR-01' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Replace NFC tag on TR-02' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /NFC tag.*TR-03/ }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByText('Hidden inactive tag name'),
  ).not.toBeInTheDocument();
  await user.click(
    screen.getByRole('button', { name: 'Unassign NFC tag from TR-02' }),
  );
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Retired');
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(remove).toHaveBeenCalledWith(
      'nfc-assignments/inactive-tag',
      expect.objectContaining({ data: { reason: 'Retired' } }),
    ),
  );
});
it('opens the available-tag selector inline from the Assign action', async () => {
  tagRecords = [createTagResponse];
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Assign NFC tag to TR-01' }),
  );
  const select = await screen.findByRole('combobox', {
    name: 'Available NFC tag',
  });
  expect(select).toHaveTextContent('Select an NFC tag');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Assign NFC tag to TR-02' }),
  ).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith(
    'nfc-tags',
    expect.objectContaining({ params: { status: 'ACTIVE', assigned: false } }),
  );
});
