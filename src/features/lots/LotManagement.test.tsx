import { apiPage } from '../../test/apiPage';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  lotResponse,
  lotStyleOption,
  lotEvent,
  lotQcResponse,
  lotBatchResponse,
} from '../../test/lots';
import { LotManagementPage } from './LotManagementPage';
import { LotDetailsPage } from './LotDetailsPage';
import { LotForm } from './LotForm';
import { LotCancelDialog } from './LotCancelDialog';

beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: apiPage([lotStyleOption], undefined, 20) }
        : url.endsWith('/qc')
          ? lotQcResponse
          : url.endsWith('/timeline')
            ? apiPage([lotEvent], undefined, 10)
            : url === 'lots' || url.endsWith('/lots')
              ? apiPage([lotResponse], undefined, 10)
              : lotResponse,
  }));
  vi.spyOn(apiClient, 'post').mockImplementation(async (url) => ({
    status: 200,
    data: url.endsWith('/cancel')
      ? { ...lotResponse, status: 'CANCELLED' }
      : lotBatchResponse,
  }));
});
function renderList() {
  return renderWithProviders(
    <MemoryRouter>
      <Routes>
        <Route path="/" element={<LotManagementPage />} />
        <Route path="/lots/:lotId" element={<LotDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
}
it('shows the newest lot first within the loaded page and style number in the first column', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: apiPage([lotStyleOption], undefined, 20) }
        : {
            items: [
              lotResponse,
              {
                ...lotResponse,
                id: 'new-lot',
                lot_number: 'LOT-002',
                created_at: '2026-11-13T09:00:00Z',
              },
            ],
            page: 0,
            size: 10,
            totalElements: 2,
          },
  }));
  renderList();
  await screen.findByRole('rowheader', { name: 'LOT-002' });
  expect(
    screen.getAllByRole('rowheader').map((cell) => cell.textContent),
  ).toEqual(['LOT-002', 'LOT-001']);
  const row = screen.getByRole('rowheader', { name: 'LOT-002' }).closest('tr')!;
  expect(row.firstElementChild).toHaveTextContent('STY-001');
  expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent('Style');
});
it.each(['list', 'details'])(
  'updates the displayed quantity from the %s view',
  async (view) => {
    let current = { ...lotResponse };
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'ui/lookups'
          ? { styles: apiPage([lotStyleOption], undefined, 20) }
          : url === 'lots'
            ? apiPage([current], undefined, 10)
            : url.endsWith('/timeline')
              ? apiPage([lotEvent], undefined, 10)
              : url.endsWith('/qc')
                ? lotQcResponse
                : current,
    }));
    vi.spyOn(apiClient, 'put').mockImplementation(async () => {
      current = { ...current, quantity: 120, version: 1 };
      return { status: 200, data: current };
    });
    const user = userEvent.setup();
    if (view === 'list') renderList();
    else
      renderWithProviders(
        <MemoryRouter initialEntries={['/lots/lot-id']}>
          <Routes>
            <Route path="/lots/:lotId" element={<LotDetailsPage />} />
          </Routes>
        </MemoryRouter>,
      );
    await user.click(
      await screen.findByRole('button', {
        name:
          view === 'list'
            ? 'Change quantity for lot LOT-001'
            : 'Change Quantity',
      }),
    );
    const dialog = screen.getByRole('dialog');
    await user.clear(within(dialog).getByRole('spinbutton'));
    await user.type(within(dialog).getByRole('spinbutton'), '120');
    await user.type(
      within(dialog).getByRole('textbox', { name: /Reason/ }),
      'Recount',
    );
    await user.click(
      within(dialog).getByRole('button', { name: 'Save Quantity' }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(await screen.findByText('120')).toBeVisible();
    expect(screen.getByText('Lot quantity updated.')).toBeVisible();
    expect(apiClient.put).toHaveBeenCalledWith(
      'lots/lot-id',
      { quantity: 120, reason: 'Recount' },
      expect.anything(),
    );
  },
);
it('creates a lot from a released style, then fetches its details and timeline', async () => {
  const user = userEvent.setup();
  renderList();
  await screen.findByRole('link', { name: 'View lot LOT-001' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Add Lots' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Add Lots' }));
  const form = screen.getByRole('form', { name: 'Create Production Lots' });
  expect(form).toHaveAccessibleDescription(
    'Choose a style and the number of lots to create. Lot numbers are assigned automatically. Garment quantity per lot is optional.',
  );
  await user.click(within(form).getByRole('combobox', { name: /Style/ }));
  await user.click(screen.getByRole('option', { name: 'STY-001' }));
  expect(
    within(form).queryByRole('textbox', { name: /Lot Number/ }),
  ).not.toBeInTheDocument();
  await user.type(
    within(form).getByRole('spinbutton', { name: /Quantity/ }),
    '200',
  );
  await user.click(within(form).getByRole('button', { name: 'Create Lots' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'LOT-001' }),
  ).toBeVisible();
  expect(apiClient.post).toHaveBeenCalledWith(
    'styles/style-id/lots',
    { lotCount: 1, quantity: 200 },
    expect.anything(),
  );
  expect(await screen.findByText('PASS')).toBeVisible();
  expect(
    await screen.findByRole('heading', { name: 'QC Results' }),
  ).toBeVisible();
  expect(await screen.findByText('Two damaged pieces')).toBeVisible();
  expect(screen.getAllByText(/12\/11\/2026/).length).toBeGreaterThan(0);
  expect(screen.queryByText('hidden-location-id')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-actor-id')).not.toBeInTheDocument();
  expect(screen.queryByText('lot-id')).not.toBeInTheDocument();
});
it('uses server search, page size and style filtering', async () => {
  const user = userEvent.setup();
  renderList();
  await screen.findByText('LOT-001');
  await user.type(
    screen.getByRole('searchbox', { name: 'Search lots' }),
    'LOT',
  );
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'lots',
      expect.objectContaining({ params: { page: 0, size: 10, search: 'LOT' } }),
    ),
  );
  await user.click(
    await screen.findByRole('combobox', { name: 'Rows per page:' }),
  );
  await user.click(screen.getByRole('option', { name: '25' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'lots',
      expect.objectContaining({ params: { page: 0, size: 25, search: 'LOT' } }),
    ),
  );
  await user.click(screen.getByRole('combobox', { name: 'Filter by style' }));
  await user.click(screen.getByRole('option', { name: 'STY-001' }));
  await waitFor(() =>
    expect(apiClient.get).toHaveBeenCalledWith(
      'styles/style-id/lots',
      expect.objectContaining({ params: { page: 0, size: 10, search: '' } }),
    ),
  );
});
it('handles an empty list and unavailable released styles without pagination', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: apiPage([], undefined, 20) }
        : apiPage([], undefined, 10),
  }));
  renderList();
  expect(await screen.findByText('No lots found.')).toBeVisible();
  expect(screen.getByText(/No released styles are available/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add Lots' })).toBeDisabled();
  expect(screen.queryByText('Rows per page:')).not.toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toHaveTextContent(
    /unexpected response/,
  );
});
it('validates quantity locally and retains the form and backend conflict explanation', async () => {
  const user = userEvent.setup();
  const onCreated = vi.fn();
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 409,
    data: {
      code: 'DATA_CONFLICT',
      detail: 'This lot number is already in use.',
    },
  });
  renderWithProviders(
    <LotForm
      styles={[lotStyleOption]}
      initialStyleId="style-id"
      onCreated={onCreated}
      onClose={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  await user.type(screen.getByRole('spinbutton', { name: /Quantity/ }), '0');
  await user.click(screen.getByRole('button', { name: 'Create Lots' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  await user.clear(screen.getByRole('spinbutton', { name: /Quantity/ }));
  await user.type(screen.getByRole('spinbutton', { name: /Quantity/ }), '200');
  await user.click(screen.getByRole('button', { name: 'Create Lots' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This lot number is already in use.',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('409');
  expect(screen.getByRole('spinbutton', { name: /Quantity/ })).toHaveValue(200);
  expect(onCreated).not.toHaveBeenCalled();
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 200,
    data: lotBatchResponse,
  });
  await user.click(screen.getByRole('button', { name: 'Create Lots' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
  expect(apiClient.post).toHaveBeenLastCalledWith(
    'styles/style-id/lots',
    { lotCount: 1, quantity: 200 },
    expect.anything(),
  );
});
it('requires a cancellation reason and keeps the backend completed-lot error visible', async () => {
  const user = userEvent.setup();
  const onCancelled = vi.fn();
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 409,
    data: {
      code: 'COMPLETED_LOT_IMMUTABLE',
      detail: 'A completed Lot cannot be cancelled',
    },
  });
  renderWithProviders(
    <LotCancelDialog
      lot={lotResponse}
      onClose={vi.fn()}
      onReload={vi.fn()}
      onCancelled={onCancelled}
    />,
  );
  await user.click(screen.getByRole('button', { name: 'Delete lot' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  await user.type(
    screen.getByRole('textbox', { name: /Reason/ }),
    ' Order withdrawn ',
  );
  await user.click(screen.getByRole('button', { name: 'Delete lot' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'A completed Lot cannot be cancelled',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('409');
  expect(apiClient.post).toHaveBeenCalledWith(
    'lots/lot-id/cancel',
    { reason: 'Order withdrawn' },
    expect.anything(),
  );
  expect(onCancelled).not.toHaveBeenCalled();
});
it('refreshes the list after deletion and hides the cancelled lot', async () => {
  const user = userEvent.setup();
  renderList();
  await user.click(
    await screen.findByRole('button', { name: 'Delete lot LOT-001' }),
  );
  await user.type(
    screen.getByRole('textbox', { name: /Reason/ }),
    'Cancelled order',
  );
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: apiPage([lotStyleOption], undefined, 20) }
        : apiPage([{ ...lotResponse, status: 'CANCELLED' }], undefined, 10),
  }));
  await user.click(screen.getByRole('button', { name: 'Delete lot' }));
  expect(await screen.findByText('No lots found.')).toBeVisible();
  expect(
    screen.queryByRole('rowheader', { name: 'LOT-001' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Delete lot LOT-001' }),
  ).not.toBeInTheDocument();
});
it('hides cancelled lots on later pages and preserves navigation through empty pages', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url, config) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: apiPage([lotStyleOption], config?.params, 20) }
        : {
            items:
              (config?.params as { page?: number } | undefined)?.page === 1
                ? [
                    {
                      ...lotResponse,
                      id: 'hidden-last',
                      lot_number: 'HIDDEN-LAST',
                      status: 'CANCELLED',
                    },
                  ]
                : [
                    lotResponse,
                    ...Array.from({ length: 9 }, (_, i) => ({
                      ...lotResponse,
                      id: `hidden-${i}`,
                      lot_number: `HIDDEN-${i}`,
                      status: 'CANCELLED',
                    })),
                  ],
            page: (config?.params as { page?: number } | undefined)?.page ?? 0,
            size: 10,
            totalElements: 11,
          },
  }));
  const user = userEvent.setup();
  renderList();
  await screen.findByRole('rowheader', { name: 'LOT-001' });
  expect(screen.getAllByRole('rowheader')).toHaveLength(1);
  await user.click(screen.getByRole('button', { name: 'Go to next page' }));
  expect(await screen.findByText('No lots found.')).toBeVisible();
  expect(screen.queryByText('HIDDEN-LAST')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Go to previous page' }));
  expect(
    await screen.findByRole('rowheader', { name: 'LOT-001' }),
  ).toBeVisible();
});
it('does not fetch a timeline when the lot detail request is forbidden', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 403,
    data: {
      code: 'ACCESS_DENIED',
      detail: 'This lot is outside your assigned processes.',
    },
  });
  renderWithProviders(
    <MemoryRouter initialEntries={['/lots/lot-id']}>
      <Routes>
        <Route path="/lots/:lotId" element={<LotDetailsPage />} />
      </Routes>
    </MemoryRouter>,
  );
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This lot is outside your assigned processes.',
  );
  expect(apiClient.get).toHaveBeenCalledTimes(1);
});
it('creates multiple lots with optional quantities and validates the batch size', async () => {
  const user = userEvent.setup();
  const onCreated = vi.fn();
  const batch = {
    createdCount: 2,
    items: [
      { ...lotResponse, quantity: null },
      { ...lotResponse, id: 'lot-2', lot_number: 'LOT-2', quantity: null },
    ],
  };
  vi.mocked(apiClient.post).mockResolvedValue({ status: 200, data: batch });
  renderWithProviders(
    <LotForm
      styles={[{ ...lotStyleOption, status: 'COMPLETED' }]}
      initialStyleId="style-id"
      onCreated={onCreated}
      onClose={vi.fn()}
      onReload={vi.fn()}
    />,
  );
  const count = screen.getByRole('spinbutton', { name: /Number of Lots/ });
  await user.clear(count);
  await user.type(count, '1001');
  await user.click(screen.getByRole('button', { name: 'Create Lots' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(
    screen.getByText('Enter a whole number between 1 and 1000.'),
  ).toBeVisible();
  await user.clear(count);
  await user.type(count, '2');
  await user.click(screen.getByRole('button', { name: 'Create Lots' }));
  expect(apiClient.post).toHaveBeenCalledWith(
    'styles/style-id/lots',
    { lotCount: 2 },
    expect.anything(),
  );
  expect(onCreated).toHaveBeenCalledWith(batch);
  expect(
    screen.queryByRole('textbox', { name: /Lot Number/ }),
  ).not.toBeInTheDocument();
});
it('returns to the list after creating a batch and displays unset quantities', async () => {
  const user = userEvent.setup();
  const items = [
    { ...lotResponse, quantity: null },
    { ...lotResponse, id: 'lot-2', lot_number: 'LOT-2', quantity: null },
  ];
  vi.mocked(apiClient.post).mockImplementation(async () => {
    vi.mocked(apiClient.get).mockImplementation(async (url) => ({
      status: 200,
      data:
        url === 'ui/lookups'
          ? { styles: apiPage([lotStyleOption], undefined, 20) }
          : apiPage(items, undefined, 10),
    }));
    return { status: 200, data: { createdCount: 2, items } };
  });
  renderList();
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Add Lots' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Add Lots' }));
  await user.click(screen.getByRole('combobox', { name: /^Style/ }));
  await user.click(screen.getByRole('option', { name: 'STY-001' }));
  await user.clear(screen.getByRole('spinbutton', { name: /Number of Lots/ }));
  await user.type(
    screen.getByRole('spinbutton', { name: /Number of Lots/ }),
    '2',
  );
  await user.click(screen.getByRole('button', { name: 'Create Lots' }));
  expect(await screen.findByText('2 lots created successfully.')).toBeVisible();
  expect(await screen.findByText('LOT-2')).toBeVisible();
  expect(screen.getAllByText('Not specified')).toHaveLength(2);
  expect(screen.queryByRole('form')).not.toBeInTheDocument();
});
it('does not offer trolley mapping for processing or terminal lots', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: apiPage([lotStyleOption], undefined, 20) }
        : apiPage([{ ...lotResponse, status: 'IN_PROCESS' }], undefined, 10),
  }));
  renderList();
  await screen.findByText('LOT-001');
  expect(
    screen.queryByRole('button', { name: 'Assign trolley LOT-001' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Unassign trolley LOT-001' }),
  ).not.toBeInTheDocument();
});
