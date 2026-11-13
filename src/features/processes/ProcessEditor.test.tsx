import { apiPage } from '../../test/apiPage';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { processResponse, processesResponse } from '../../test/processes';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';

const readyTag = {
  id: 'new-tag',
  name: 'New tag',
  uid: 'NEW-TAG',
  assigned: false,
  status: 'ACTIVE',
};
const fresh = { ...processResponse, name: 'Fresh Washing', quality: true };
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'processes'
        ? apiPage(processesResponse, undefined, 10)
        : url === 'ui/lookups'
          ? {
              processes: apiPage([], undefined, 20),
              tags: apiPage([readyTag], undefined, 20),
            }
          : fresh,
  }));
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 200, data: fresh });
});
async function openEditor(name = 'Washing') {
  const user = userEvent.setup();
  const view = renderWithProviders(
    <MemoryRouter>
      <ProcessConfigurationsPage />
    </MemoryRouter>,
  );
  await user.click(await screen.findByRole('button', { name: 'Edit ' + name }));
  await screen.findByRole('textbox', { name: /Process Name/ });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Process' })).toBeEnabled(),
  );
  return { user, ...view };
}

describe('backend process editing', () => {
  it('prefills fresh values and QC state, retains the assigned tag, and refreshes after a typed PUT', async () => {
    const { user } = await openEditor();
    expect(apiClient.get).toHaveBeenCalledWith(
      'processes/' + processResponse.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    const name = screen.getByRole('textbox', { name: /Process Name/ });
    expect(name).toHaveValue('Fresh Washing');
    expect(
      screen.getByRole('checkbox', { name: 'Quality control (QC) process' }),
    ).toBeChecked();
    expect(
      screen.getByRole('combobox', { name: /Process-level NFC Tag/ }),
    ).toHaveTextContent('Current tag');
    await user.clear(name);
    await user.type(name, ' Updated Washing ');
    const updated = { ...fresh, name: 'Updated Washing', version: 1 };
    vi.mocked(apiClient.put).mockResolvedValue({ status: 200, data: updated });
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: apiPage([updated], undefined, 10),
    });
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(apiClient.put).toHaveBeenCalledWith(
      'processes/' + fresh.id,
      {
        name: 'Updated Washing',
        description: fresh.description,
        stationNumber: '03',
        nfcMode: 'PROCESS',
        quality: true,
        nfcUid: 'NFC-WASH',
        deviceCount: 0,
        devices: [],
        targetDurationSeconds: 120,
      },
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(
      await screen.findByRole('rowheader', { name: /Updated Washing/ }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Save Process' }),
    ).not.toBeInTheDocument();
  });

  it('keeps existing device IDs and types and omits UI-generated IDs for new devices', async () => {
    const deviceProcess = {
      ...processesResponse[1],
      active: true,
      target_duration_seconds: null,
    };
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'processes'
          ? apiPage([processResponse, deviceProcess], undefined, 10)
          : url === 'ui/lookups'
            ? {
                processes: apiPage([], undefined, 20),
                tags: apiPage([readyTag], undefined, 20),
              }
            : deviceProcess,
    }));
    vi.mocked(apiClient.put).mockResolvedValue({
      status: 200,
      data: deviceProcess,
    });
    const { user } = await openEditor('Drying');
    expect(screen.getByRole('textbox', { name: /Machine Name/ })).toHaveValue(
      'Dryer 1',
    );
    await user.click(screen.getByRole('button', { name: 'Add Machine' }));
    await user.type(
      screen.getAllByRole('textbox', { name: /Machine Name/ })[1],
      'Dryer 2',
    );
    await user.click(
      screen.getAllByRole('combobox', { name: /Machine NFC Tag/ })[1],
    );
    await user.click(screen.getByRole('option', { name: 'New tag' }));
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(apiClient.put).toHaveBeenCalledWith(
      'processes/' + deviceProcess.id,
      expect.objectContaining({
        nfcMode: 'DEVICES',
        nfcUid: null,
        quality: false,
        deviceCount: 2,
        targetDurationSeconds: null,
        devices: [
          {
            id: deviceProcess.devices[0].id,
            type: 'DRYER',
            name: 'Dryer 1',
            description: '',
            nfcUid: 'NFC-DRYER',
          },
          { name: 'Dryer 2', description: '', nfcUid: 'NEW-TAG' },
        ],
      }),
      expect.anything(),
    );
  });

  it.each([
    [
      409,
      'PROCESS_IN_USE',
      'Cannot reconfigure a process referenced by unfinished production',
    ],
    [
      409,
      'NFC_ALREADY_ASSIGNED',
      'Unassign the NFC tag before assigning it to another asset',
    ],
    [400, 'INVALID_ARGUMENT', 'Device belongs to another process or is in use'],
  ])(
    'keeps the draft and QC selection on HTTP %s / %s',
    async (status, code, detail) => {
      vi.mocked(apiClient.put).mockResolvedValue({
        status,
        data: { code, detail },
      });
      const { user } = await openEditor();
      await user.click(screen.getByRole('button', { name: 'Save Process' }));
      expect(await screen.findByRole('alert')).toHaveTextContent(detail);
      expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP ' + status);
      expect(screen.getByRole('textbox', { name: /Process Name/ })).toHaveValue(
        'Fresh Washing',
      );
      expect(
        screen.getByRole('checkbox', { name: 'Quality control (QC) process' }),
      ).toBeChecked();
      expect(apiClient.put).toHaveBeenCalledTimes(1);
      expect(
        screen.getByRole('button', { name: 'Save Process' }),
      ).toBeEnabled();
    },
  );

  it('reloads the list for a process which disappears while editing', async () => {
    vi.mocked(apiClient.put).mockResolvedValue({
      status: 404,
      data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
    });
    const { user } = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Requested resource was not found',
    );
    expect(screen.getByRole('button', { name: 'Save Process' })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Reload processes' }));
    await screen.findByRole('rowheader', { name: /Washing/ });
    expect(
      screen.queryByRole('textbox', { name: /Process Name/ }),
    ).not.toBeInTheDocument();
  });

  it('blocks duplicate submissions and aborts a pending update on exit', async () => {
    vi.mocked(apiClient.put).mockReturnValue(new Promise(() => {}));
    const { user, unmount } = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    const signal = vi.mocked(apiClient.put).mock.calls[0][2]?.signal;
    unmount();
    expect(signal?.aborted).toBe(true);
    expect(apiClient.put).toHaveBeenCalledTimes(1);
  });

  it('cancels without sending PUT', async () => {
    const { user } = await openEditor();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(
      screen.queryByRole('textbox', { name: /Process Name/ }),
    ).not.toBeInTheDocument();
  });
});
