import { act, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { MemoryRouter } from 'react-router-dom';
import { renderWithProviders } from '../../test/render';
import { processResponse, processesResponse } from '../../test/processes';
import { readSession, setAuthenticatedSession } from '../auth/session';
import { PROCESS_STORAGE_KEY } from './processData';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: processesResponse,
  });
});

describe('backend process listing', () => {
  it('lists backend processes with active-only filtering without local records', async () => {
    const saved = JSON.stringify([{ id: 'local-process', name: 'Local only' }]);
    localStorage.setItem(PROCESS_STORAGE_KEY, saved);
    renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    const row = (
      await screen.findByRole('rowheader', { name: /Washing/ })
    ).closest('tr')!;
    expect(apiClient.get).toHaveBeenCalledWith(
      'processes',
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
    expect(within(row).getByText('03')).toBeVisible();
    expect(within(row).getByText('Process-level')).toBeVisible();
    expect(within(row).getByText('NFC-WASH')).toBeVisible();
    expect(within(row).getByText('Active')).toBeVisible();
    expect(
      screen.queryByRole('rowheader', { name: /Drying/ }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText('Local only')).not.toBeInTheDocument();
    expect(localStorage.getItem(PROCESS_STORAGE_KEY)).toBe(saved);
    expect(
      screen.getByRole('button', { name: 'Create Process' }),
    ).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Edit Washing' })).toBeEnabled();
    expect(
      screen.getByRole('button', { name: 'Delete Washing' }),
    ).toBeEnabled();
    expect(screen.getByRole('link', { name: 'View Washing' })).toHaveAttribute(
      'href',
      '/configurations/processes/' + processResponse.id,
    );
  });

  it('shows loading without an empty or error state until the request finishes', async () => {
    let resolve!: (value: { status: number; data: unknown }) => void;
    vi.mocked(apiClient.get).mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    expect(screen.getByRole('progressbar')).toBeVisible();
    expect(
      screen.queryByText('No processes configured.'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await act(async () => resolve({ status: 200, data: processesResponse }));
    expect(screen.getAllByRole('rowheader')).toHaveLength(1);
  });

  it.each([
    { data: [] },
    { data: { items: [], page: 0, size: 10, totalElements: 0 } },
  ])(
    'shows an empty table when no active processes exist: %j',
    async ({ data }) => {
      vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
      renderWithProviders(
        <MemoryRouter>
          <ProcessConfigurationsPage />
        </MemoryRouter>,
      );
      expect(await screen.findByText('No processes configured.')).toBeVisible();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    },
  );

  it('preserves a service error message, hides its HTTP code, and retries on request', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce({
      status: 503,
      data: { detail: 'Process service unavailable' },
    });
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Process service unavailable',
    );
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP 503');
    expect(apiClient.get).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    await screen.findByRole('rowheader', { name: /Washing/ });
    expect(apiClient.get).toHaveBeenCalledTimes(2);
  });

  it.each([403, 406])(
    'handles HTTP %s without offering a futile retry',
    async (status) => {
      vi.mocked(apiClient.get).mockResolvedValue({
        status,
        data: { detail: 'Backend reason' },
      });
      renderWithProviders(
        <MemoryRouter>
          <ProcessConfigurationsPage />
        </MemoryRouter>,
      );
      expect(await screen.findByRole('alert')).toHaveTextContent(
        'Backend reason',
      );
      expect(
        screen.queryByRole('button', { name: 'Try again' }),
      ).not.toBeInTheDocument();
      expect(
        screen.queryByText('No processes configured.'),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    { status: 401, data: '' },
    {
      status: 403,
      data: {
        type: 'about:blank',
        title: 'Forbidden',
        status: 403,
        code: 'ACCESS_DENIED',
        detail: 'Role changed; log in again',
      },
    },
  ])(
    'offers sign-in when the session must be renewed: %j',
    async (response) => {
      setAuthenticatedSession({
        user: { id: 'admin', username: 'admin', role: 'NW', status: 'Active' },
        modules: ['process'],
      });
      vi.mocked(apiClient.get).mockResolvedValue(response);
      const user = userEvent.setup();
      renderWithProviders(
        <MemoryRouter>
          <ProcessConfigurationsPage />
        </MemoryRouter>,
      );
      await user.click(
        await screen.findByRole('button', { name: 'Back to sign in' }),
      );
      expect(readSession()).toBeNull();
    },
  );

  it('handles HTML service failures with safe fallback text', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status: 502,
      data: '<html>Proxy diagnostics</html>',
    });
    renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Processes are temporarily unavailable',
    );
    expect(screen.getByRole('alert')).toHaveTextContent('HTTP 502');
    expect(screen.queryByText('Proxy diagnostics')).not.toBeInTheDocument();
  });

  it('shows connectivity guidance when no response is available', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('Network Error'));
    renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Check your connection',
    );
  });

  it.each([
    { data: {} },
    { data: [processResponse, processResponse] },
    { data: [{ ...processResponse, nfcMode: 'INVALID' }] },
    { data: [{ ...processResponse, devices: [{}] }] },
  ])('rejects malformed process responses: %j', async ({ data }) => {
    vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data });
    renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Unable to read processes',
    );
    expect(screen.queryAllByRole('rowheader')).toHaveLength(0);
  });

  it('cancels the request on exit', () => {
    vi.mocked(apiClient.get).mockReturnValue(new Promise(() => {}));
    const view = renderWithProviders(
      <MemoryRouter>
        <ProcessConfigurationsPage />
      </MemoryRouter>,
    );
    const signal = vi.mocked(apiClient.get).mock.calls[0][1]?.signal;
    view.unmount();
    expect(signal?.aborted).toBe(true);
  });
});
