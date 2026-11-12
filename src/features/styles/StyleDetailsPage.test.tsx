import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  styleResponse,
  styleRouteResponse,
  styleProcessOptions,
} from '../../test/styles';
import { StyleDetailsPage } from './StyleDetailsPage';
import type { StyleMode } from './types';
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { processes: styleProcessOptions }
        : url.endsWith('/derived-route')
          ? styleRouteResponse
          : url.endsWith('/revisions')
            ? []
            : styleResponse,
  }));
});
function setup(mode: StyleMode = 'management') {
  renderWithProviders(
    <MemoryRouter
      initialEntries={[
        `/${mode === 'own' ? 'new-style' : 'styles'}/${styleResponse.id}`,
      ]}
    >
      <Routes>
        <Route
          path="/styles/:styleId"
          element={<StyleDetailsPage mode={mode} />}
        />
        <Route
          path="/new-style/:styleId"
          element={<StyleDetailsPage mode={mode} />}
        />
      </Routes>
    </MemoryRouter>,
  );
  return userEvent.setup();
}
it.each(['management', 'own'] as const)(
  'loads backend detail and derived route for %s',
  async (mode) => {
    setup(mode);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'STY-1001' }),
    ).toBeVisible();
    expect(screen.getByText('Denim wash style')).toBeVisible();
    expect(
      within(
        screen.getByRole('region', { name: 'Ordered lot process route' }),
      ).getByText('Washing'),
    ).toBeVisible();
    expect(screen.queryByText(styleResponse.id)).not.toBeInTheDocument();
    expect(apiClient.get).toHaveBeenCalledWith(
      `styles/${styleResponse.id}/derived-route`,
      expect.anything(),
    );
    expect(apiClient.get).not.toHaveBeenCalledWith(
      expect.stringContaining('/lots'),
      expect.anything(),
    );
    if (mode === 'management') {
      expect(await screen.findByText('No revisions recorded.')).toBeVisible();
    } else {
      expect(apiClient.get).not.toHaveBeenCalledWith(
        expect.stringContaining('/revisions'),
        expect.anything(),
      );
    }
  },
);
it('uses the process code if a route process is absent from current lookup choices', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { processes: [] }
        : url.endsWith('/derived-route')
          ? styleRouteResponse
          : styleResponse,
  }));
  setup();
  expect(await screen.findByText('WASH')).toBeVisible();
  expect(screen.queryByText(styleProcessOptions[0].id)).not.toBeInTheDocument();
});
it('shows an informative empty route message for a draft without selected processes', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: url.endsWith('/derived-route') ? 409 : 200,
    data:
      url === 'ui/lookups'
        ? { processes: [] }
        : url.endsWith('/derived-route')
          ? {
              code: 'STYLE_PROCESS_REQUIRED',
              detail: 'At least one Process is required',
            }
          : styleResponse,
  }));
  setup();
  expect(
    await screen.findByText('No process route is configured for this style.'),
  ).toBeVisible();
  expect(
    screen.getByRole('heading', { level: 1, name: 'STY-1001' }),
  ).toBeVisible();
});
it.each([403, 404])(
  'shows backend error %s without leaking local style details',
  async (status) => {
    vi.mocked(apiClient.get).mockResolvedValue({
      status,
      data: { detail: 'Style is outside your access' },
    });
    setup();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Style is outside your access',
    );
    expect(screen.queryByText('Denim wash style')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
  },
);
it('retries failed style loads', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Maintenance in progress' },
  });
  const user = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Maintenance in progress',
  );
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'STY-1001' }),
  ).toBeVisible();
});
