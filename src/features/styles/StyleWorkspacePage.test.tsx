import { screen, within, waitFor } from '@testing-library/react';
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
import {
  mockProcessDragLayout,
  dragProcessToEnd,
} from '../../test/processDrag';
import { StyleWorkspacePage } from './StyleWorkspacePage';
import type { StyleMode, StyleResponse } from './types';
import { seedTestData, signIn } from '../../test/fixtures';
import { readSession, setAuthenticatedSession } from '../auth/session';
let records: StyleResponse[];
beforeEach(() => {
  records = [styleResponse];
  mockProcessDragLayout();
  vi.spyOn(apiClient, 'get').mockImplementation(async (url, config) => {
    if (url === 'ui/lookups')
      return { status: 200, data: { processes: styleProcessOptions } };
    if (url.endsWith('/derived-route'))
      return { status: 200, data: styleRouteResponse };
    if (url !== 'styles') return { status: 200, data: styleResponse };
    const query = config!.params as {
      page: number;
      size: number;
      search: string;
    };
    const matches = records.filter((record) =>
      record.style_number.toLowerCase().includes(query.search.toLowerCase()),
    );
    return {
      status: 200,
      data: {
        items: matches.slice(
          query.page * query.size,
          (query.page + 1) * query.size,
        ),
        ...query,
        totalElements: matches.length,
      },
    };
  });
});
function setup(mode: StyleMode = 'management') {
  const base = mode === 'own' ? '/new-style' : '/styles';
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <MemoryRouter initialEntries={[base]}>
        <Routes>
          <Route path={base} element={<StyleWorkspacePage mode={mode} />} />
          <Route
            path={`${base}/:styleId`}
            element={<span>Backend style details</span>}
          />
        </Routes>
      </MemoryRouter>,
    ),
  };
}
it('lists server styles and status without reading browser-local style records', async () => {
  localStorage.setItem(
    'nw-track-styles-v2',
    JSON.stringify([{ id: 'local', number: 'LOCAL-ONLY' }]),
  );
  setup();
  expect(
    await screen.findByRole('rowheader', { name: 'STY-1001' }),
  ).toBeVisible();
  expect(screen.getByText('Draft')).toBeVisible();
  expect(screen.queryByText('LOCAL-ONLY')).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Delete/ }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View STY-1001' })).toHaveAttribute(
    'href',
    `/styles/${styleResponse.id}`,
  );
});
it('creates a backend style and navigates to the returned UUID', async () => {
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 200, data: styleResponse });
  const { user } = setup();
  await user.click(screen.getByRole('button', { name: 'Create Style' }));
  await user.type(
    await screen.findByRole('textbox', { name: /Style Number/ }),
    'STY-1001',
  );
  await dragProcessToEnd(user, 'Washing');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(await screen.findByText('Backend style details')).toBeVisible();
  expect(post).toHaveBeenCalledWith(
    'styles',
    expect.objectContaining({
      styleNumber: 'STY-1001',
      processIds: [styleProcessOptions[0].id],
    }),
    expect.anything(),
  );
});
it('offers only create and view actions in New Style mode', async () => {
  setup('own');
  await screen.findByRole('rowheader', { name: 'STY-1001' });
  expect(screen.getByRole('button', { name: 'New Style' })).toBeEnabled();
  expect(
    screen.queryByRole('button', { name: 'Edit STY-1001' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Release style STY-1001' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'View STY-1001' })).toHaveAttribute(
    'href',
    `/new-style/${styleResponse.id}`,
  );
});
it('allows configurators to release only their own drafts without enabling style editing', async () => {
  seedTestData();
  signIn('style.configurator');
  const session = readSession()!;
  setAuthenticatedSession({ ...session, modules: ['newstyle', 'lots'] });
  records = [
    { ...styleResponse, created_by: session.user.id },
    {
      ...styleResponse,
      id: 'outside',
      style_number: 'OUTSIDE',
      created_by: 'another-user',
    },
    {
      ...styleResponse,
      id: 'released',
      style_number: 'RELEASED',
      created_by: session.user.id,
      status: 'RELEASED',
    },
  ];
  const post = vi.spyOn(apiClient, 'post').mockImplementation(async () => {
    records[0] = {
      ...records[0],
      status: 'RELEASED',
      released_at: '2026-11-12T00:00:00Z',
    };
    return { status: 200, data: records[0] };
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Release style STY-1001' }),
  );
  expect(
    screen.queryByRole('button', { name: 'Release style OUTSIDE' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Release style RELEASED' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Edit STY-1001' }),
  ).not.toBeInTheDocument();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Release to Production',
    }),
  );
  await waitFor(() =>
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
  );
  expect(post).toHaveBeenCalledWith(
    `styles/${styleResponse.id}/release`,
    undefined,
    expect.anything(),
  );
});
it('confirms release and reloads the backend list after success', async () => {
  const post = vi.spyOn(apiClient, 'post').mockImplementation(async () => {
    records = [
      {
        ...styleResponse,
        status: 'RELEASED',
        released_at: '2026-11-12T00:00:00Z',
      },
    ];
    return { status: 200, data: records[0] };
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Release style STY-1001' }),
  );
  expect(post).not.toHaveBeenCalled();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Release to Production',
    }),
  );
  expect(await screen.findByText('Released')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Release style STY-1001' }),
  ).not.toBeInTheDocument();
  expect(post).toHaveBeenCalledWith(
    `styles/${styleResponse.id}/release`,
    undefined,
    expect.anything(),
  );
});
it('shows a blocked release error and keeps the dialog open', async () => {
  vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 409,
    data: {
      code: 'STYLE_PROCESS_REQUIRED',
      detail: 'At least one Process is required',
    },
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Release style STY-1001' }),
  );
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Release to Production',
    }),
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'At least one Process is required',
  );
  expect(screen.getByRole('dialog')).toBeVisible();
  expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
});
it('opens a draft for process editing and fetches a fresh route', async () => {
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Edit STY-1001' }),
  );
  expect(
    await screen.findByRole('textbox', { name: /Style Number/ }),
  ).toBeVisible();
  expect(
    screen.queryByRole('textbox', { name: /Reason for change/ }),
  ).not.toBeInTheDocument();
  expect(apiClient.get).toHaveBeenCalledWith(
    `styles/${styleResponse.id}/derived-route`,
    expect.anything(),
  );
});
it('uses backend search and pagination and resets the page on a new search', async () => {
  records = Array.from({ length: 12 }, (_, index) => ({
    ...styleResponse,
    id: 'style-' + index,
    style_number: 'STY-' + index,
  }));
  const { user } = setup();
  await screen.findByRole('rowheader', { name: 'STY-0' });
  await user.click(screen.getByRole('button', { name: 'Go to next page' }));
  await screen.findByRole('rowheader', { name: 'STY-11' });
  expect(screen.getAllByRole('rowheader')).toHaveLength(2);
  await user.type(screen.getByRole('searchbox'), 'STY-3');
  await screen.findByRole('rowheader', { name: 'STY-3' });
  expect(apiClient.get).toHaveBeenCalledWith(
    'styles',
    expect.objectContaining({ params: { page: 0, size: 10, search: 'STY-3' } }),
  );
});
it('accepts empty 200 responses and hides pagination', async () => {
  records = [];
  setup();
  expect(await screen.findByText('No styles found.')).toBeVisible();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
});
it('retries a failed list fetch without discarding the backend message', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Maintenance in progress' },
  });
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Maintenance in progress',
  );
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.getByRole('rowheader', { name: 'STY-1001' })).toBeVisible(),
  );
});
it('confirms planned lots on release and uses only the backend release operation', async () => {
  records = [{ ...styleResponse, lot_count: 5, lot_quantity: null }];
  const post = vi.spyOn(apiClient, 'post').mockImplementation(async () => {
    records = [
      {
        ...records[0],
        status: 'IN_PRODUCTION',
        released_at: '2026-11-12T00:00:00Z',
      },
    ];
    return { status: 200, data: records[0] };
  });
  const { user } = setup();
  await user.click(
    await screen.findByRole('button', { name: 'Release style STY-1001' }),
  );
  expect(screen.getByText(/This will create 5 planned lots/)).toBeVisible();
  await user.click(
    within(screen.getByRole('dialog')).getByRole('button', {
      name: 'Release to Production',
    }),
  );
  expect(await screen.findByText('In Production')).toBeVisible();
  expect(post).toHaveBeenCalledTimes(1);
  expect(post).toHaveBeenCalledWith(
    `styles/${styleResponse.id}/release`,
    undefined,
    expect.anything(),
  );
  expect(
    screen.queryByRole('button', { name: 'Release style STY-1001' }),
  ).not.toBeInTheDocument();
});
