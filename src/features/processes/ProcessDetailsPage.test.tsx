import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  processResponse,
  processesResponse,
  processTags,
} from '../../test/processes';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { ProcessDetailsPage } from './ProcessDetailsPage';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';

function setup(path = '/configurations/processes/' + processResponse.id) {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <MemoryRouter initialEntries={[path]}>
        <Routes>
          <Route
            path="/configurations/processes/:processId"
            element={<ProcessDetailsPage />}
          />
          <Route
            path="/configurations/processes"
            element={<ProcessConfigurationsPage />}
          />
        </Routes>
      </MemoryRouter>,
    ),
  };
}
beforeEach(() => {
  localStorage.clear();
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { tags: processTags }
        : url === 'processes'
          ? processesResponse
          : (processesResponse.find(
              (process) => 'processes/' + process.id === url,
            ) ?? processResponse),
  }));
});

describe('backend process details', () => {
  it('opens View using the process UUID, loads fresh details, and returns to the list', async () => {
    const detail = { ...processResponse, name: 'Fresh Washing', quality: true };
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'ui/lookups'
          ? { tags: processTags }
          : url === 'processes'
            ? processesResponse
            : detail,
    }));
    const { user } = setup('/configurations/processes');
    await user.click(await screen.findByRole('link', { name: 'View Washing' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Fresh Washing' }),
    ).toBeVisible();
    expect(apiClient.get).toHaveBeenCalledWith(
      'processes/' + detail.id,
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(await screen.findByText('Washing tag')).toBeVisible();
    expect(screen.queryByText('NFC-WASH')).not.toBeInTheDocument();
    expect(screen.getByText('03')).toBeVisible();
    expect(screen.getByText('Yes')).toBeVisible();
    expect(screen.getByText('Active')).toBeVisible();
    expect(screen.getByText('120 seconds')).toBeVisible();
    expect(screen.queryByText(detail.id)).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save Process' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to Processes' }));
    expect(
      await screen.findByRole('rowheader', { name: /Washing/ }),
    ).toBeVisible();
    expect(localStorage.length).toBe(0);
  });

  it('maps backend devices to the device table on direct navigation', async () => {
    setup('/configurations/processes/' + processesResponse[1].id);
    const devices = await screen.findByRole('table', { name: 'Machines' });
    expect(within(devices).getByText('Dryer 1')).toBeVisible();
    expect(await within(devices).findByText('Dryer tag')).toBeVisible();
    expect(within(devices).queryByText('NFC-DRYER')).not.toBeInTheDocument();
    expect(screen.getByText('Machine-level tracking')).toBeVisible();
    expect(screen.getByText('Inactive')).toBeVisible();
  });

  it('shows the complete device array supplied by the detail endpoint', async () => {
    const base = processesResponse[1];
    const record = {
      ...base,
      id: 'large',
      name: 'Production Line',
      deviceCount: 30,
      device_count: 30,
      devices: Array.from({ length: 30 }, (_, index) => ({
        ...base.devices[0],
        id: 'device-' + index,
        process_id: 'large',
        processId: 'large',
        name: 'Device ' + (index + 1),
        description: 'Machine ' + (index + 1),
        nfcUid: 'TAG-' + (index + 1),
        nfc_uid: 'TAG-' + (index + 1),
      })),
    };
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: record });
    setup('/configurations/processes/large');
    const devices = await screen.findByRole('table', { name: 'Machines' });
    expect(within(devices).getAllByRole('row')).toHaveLength(31);
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('shows loading without a false missing-process message', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    setup();
    expect(screen.getByRole('status')).toHaveTextContent(
      'Loading process details...',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => resolve({ status: 200, data: processResponse }));
    expect(screen.getByRole('heading', { name: 'Washing' })).toBeVisible();
  });

  it.each([404, 409])(
    'handles a missing process with HTTP %s and a working return link',
    async (status) => {
      vi.mocked(apiClient.get).mockResolvedValue({
        status,
        data: { code: 'NOT_FOUND', detail: 'Requested resource was not found' },
      });
      const { user } = setup();
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Requested resource was not found',
      );
      expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP ' + status);
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      vi.mocked(apiClient.get).mockResolvedValue({
        status: 200,
        data: processesResponse,
      });
      await user.click(screen.getByRole('link', { name: 'Back to Processes' }));
      await screen.findByRole('rowheader', { name: /Washing/ });
    },
  );

  it('retries a service failure', async () => {
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
      await screen.findByRole('heading', { name: 'Washing' }),
    ).toBeVisible();
    expect(
      vi
        .mocked(apiClient.get)
        .mock.calls.filter(([url]) => url.startsWith('processes/')).length,
    ).toBe(2);
  });

  it('shows access denial without a futile retry', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 403,
      data: { detail: 'Missing module access: process' },
    });
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Missing module access: process',
    );
    expect(
      screen.queryByRole('button', { name: 'Try again' }),
    ).not.toBeInTheDocument();
  });

  it('offers sign-in when authentication is required', async () => {
    setAuthenticatedSession({
      user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
      modules: ['process'],
    });
    vi.mocked(apiClient.get).mockResolvedValue({ status: 401, data: '' });
    const { user } = setup();
    await user.click(
      await screen.findByRole('button', { name: 'Back to sign in' }),
    );
    expect(readSession()).toBeNull();
  });

  it('rejects a mismatched response without displaying the wrong process', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 200,
      data: { ...processResponse, id: 'wrong-process' },
    });
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'The service returned an unexpected response',
    );
    expect(
      screen.queryByRole('heading', { name: 'Washing' }),
    ).not.toBeInTheDocument();
  });

  it('aborts the request on exit', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    const view = setup();
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
