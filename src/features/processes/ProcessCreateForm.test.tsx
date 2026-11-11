import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { processResponse } from '../../test/processes';
import { createTagResponse } from '../../test/tags';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'processes' ? [] : { tags: [createTagResponse], processes: [] },
  }));
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: processResponse,
  });
});

async function openForm() {
  const user = userEvent.setup();
  const view = renderWithProviders(<ProcessConfigurationsPage />);
  const add = screen.getByRole('button', { name: 'Create Process' });
  await waitFor(() => expect(add).toBeEnabled());
  await user.click(add);
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Process' })).toBeEnabled(),
  );
  return { user, ...view };
}
async function fillBase(user: ReturnType<typeof userEvent.setup>) {
  await user.type(
    screen.getByRole('textbox', { name: /Process Name/ }),
    ' QC Washing ',
  );
  await user.type(
    screen.getByRole('textbox', { name: /Station Number/ }),
    ' 03 ',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    ' Final inspection ',
  );
}
async function selectTag(
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
) {
  await user.click(screen.getByRole('combobox', { name: label }));
  await user.click(
    screen.getByRole('option', { name: 'Washing Line 01 (1234)' }),
  );
}

describe('backend process creation', () => {
  it('maps form fields, physical NFC UID, and checked QC flag to POST and refreshes the list', async () => {
    const { user } = await openForm();
    await fillBase(user);
    expect(
      screen.getByRole('checkbox', { name: 'Quality control (QC) process' }),
    ).not.toBeChecked();
    await user.click(
      screen.getByRole('checkbox', { name: 'Quality control (QC) process' }),
    );
    await selectTag(user, /Process-level NFC Tag ID/);
    expect(apiClient.get).toHaveBeenCalledWith(
      'ui/lookups',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: [{ ...processResponse, name: 'QC Washing', quality: true }],
    });
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'processes',
      {
        name: 'QC Washing',
        description: 'Final inspection',
        stationNumber: '03',
        nfcMode: 'PROCESS',
        quality: true,
        nfcUid: '1234',
        devices: [],
        deviceCount: 0,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findByRole('rowheader', { name: /QC Washing/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save Process' }),
    ).not.toBeInTheDocument();
    expect(screen.getByText('Process saved successfully.')).toBeVisible();
    expect(localStorage.length).toBe(0);
  });

  it('maps device tracking without sending UI-generated device IDs or a process tag', async () => {
    const { user } = await openForm();
    await fillBase(user);
    await user.click(
      screen.getByRole('radio', { name: /Device-level tracking/ }),
    );
    await user.click(screen.getByRole('button', { name: 'Add Device' }));
    await user.type(
      screen.getByRole('textbox', { name: /Device Name/ }),
      ' Washer 1 ',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Device description/i }),
      ' Main washer ',
    );
    await selectTag(user, /Device NFC Tag/);
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(apiClient.post).toHaveBeenCalledWith(
      'processes',
      {
        name: 'QC Washing',
        description: 'Final inspection',
        stationNumber: '03',
        nfcMode: 'DEVICES',
        quality: false,
        nfcUid: null,
        deviceCount: 1,
        devices: [
          { name: 'Washer 1', description: 'Main washer', nfcUid: '1234' },
        ],
      },
      expect.anything(),
    );
  });

  it('shows required field errors before sending a request', async () => {
    const { user } = await openForm();
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(
      screen.getByRole('textbox', { name: /Process Name/ }),
    ).toHaveAccessibleDescription('Enter a process name.');
    expect(
      screen.getByRole('textbox', { name: /Station Number/ }),
    ).toHaveAccessibleDescription('Enter a station number.');
    expect(apiClient.post).not.toHaveBeenCalled();
  });

  it('retains fields and QC selection when the backend rejects an assigned tag', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 409,
      data: {
        code: 'NFC_ALREADY_ASSIGNED',
        detail: 'Unassign the NFC tag before assigning it to another asset',
      },
    });
    const { user } = await openForm();
    await fillBase(user);
    await selectTag(user, /Process-level NFC Tag ID/);
    await user.click(
      screen.getByRole('checkbox', { name: 'Quality control (QC) process' }),
    );
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unassign the NFC tag before assigning it to another asset',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 409');
    expect(screen.getByRole('textbox', { name: /Process Name/ })).toHaveValue(
      ' QC Washing ',
    );
    expect(
      screen.getByRole('checkbox', { name: 'Quality control (QC) process' }),
    ).toBeChecked();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
  });

  it('maps backend validation errors to form fields', async () => {
    vi.mocked(apiClient.post).mockResolvedValue({
      status: 400,
      data: {
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        fieldErrors: {
          name: 'Invalid process name',
          stationNumber: 'Invalid station',
          nfcUid: 'Invalid tag',
        },
      },
    });
    const { user } = await openForm();
    await fillBase(user);
    await selectTag(user, /Process-level NFC Tag ID/);
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Request validation failed',
    );
    expect(
      screen.getByRole('textbox', { name: /Process Name/ }),
    ).toHaveAccessibleDescription('Invalid process name');
    expect(
      screen.getByRole('textbox', { name: /Station Number/ }),
    ).toHaveAccessibleDescription('Invalid station');
    expect(
      screen.getByRole('combobox', { name: /Process-level NFC Tag ID/ }),
    ).toHaveAccessibleDescription('Invalid tag');
  });

  it('prevents repeated submissions and aborts a pending create when unmounted', async () => {
    vi.mocked(apiClient.post).mockReturnValue(new Promise(() => {}));
    const { user, unmount } = await openForm();
    await fillBase(user);
    await selectTag(user, /Process-level NFC Tag ID/);
    const submit = screen.getByRole('button', { name: 'Save Process' });
    await user.click(submit);
    fireEvent.submit(submit.closest('form')!);
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(apiClient.post).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
  });

  it('keeps saving disabled when available tags cannot load', async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) =>
      url === 'processes'
        ? { status: 200, data: [] }
        : { status: 403, data: { detail: 'Missing module access: tags' } },
    );
    const user = userEvent.setup();
    renderWithProviders(<ProcessConfigurationsPage />);
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: 'Create Process' }),
      ).toBeEnabled(),
    );
    await user.click(screen.getByRole('button', { name: 'Create Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: tags',
    );
    expect(screen.getByRole('button', { name: 'Save Process' })).toBeDisabled();
  });
});
