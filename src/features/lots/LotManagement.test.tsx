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
        ? { styles: [lotStyleOption] }
        : url.endsWith('/qc')
          ? lotQcResponse
          : url.endsWith('/timeline')
            ? [lotEvent]
            : url === 'lots' || url.endsWith('/lots')
              ? [lotResponse]
              : lotResponse,
  }));
  vi.spyOn(apiClient, 'post').mockImplementation(async (url) => ({
    status: 200,
    data: {
      ...lotResponse,
      status: url.endsWith('/cancel') ? 'CANCELLED' : 'READY',
    },
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
it('creates a lot from a released style, then fetches its details and timeline', async () => {
  const user = userEvent.setup();
  renderList();
  await screen.findByRole('link', { name: 'View lot LOT-001' });
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Add New Lot' })).toBeEnabled(),
  );
  await user.click(screen.getByRole('button', { name: 'Add New Lot' }));
  const form = screen.getByRole('form', { name: 'Create Lot' });
  expect(form).toHaveAccessibleDescription(
    'Create a production lot for a released style. The lot receives an automatically generated number.',
  );
  await user.click(within(form).getByRole('combobox', { name: /Style/ }));
  await user.click(screen.getByRole('option', { name: 'STY-001' }));
  const numberField = within(form).getByRole('textbox', { name: /Lot Number/ });
  const generatedNumber = (numberField as HTMLInputElement).value;
  expect(generatedNumber).toMatch(/^LOT-\d{17}-001$/);
  expect(numberField).toHaveAttribute('readonly');
  await user.type(
    within(form).getByRole('spinbutton', { name: /Quantity/ }),
    '200',
  );
  await user.click(within(form).getByRole('button', { name: 'Create Lot' }));
  expect(
    await screen.findByRole('heading', { level: 1, name: 'LOT-001' }),
  ).toBeVisible();
  expect(apiClient.post).toHaveBeenCalledWith(
    'styles/style-id/lots',
    { lotNumber: generatedNumber, quantity: 200 },
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
    data: url === 'ui/lookups' ? { styles: [] } : [],
  }));
  renderList();
  expect(await screen.findByText('No lots found.')).toBeVisible();
  expect(screen.getByText(/No released styles are available/)).toBeVisible();
  expect(screen.getByRole('button', { name: 'Add New Lot' })).toBeDisabled();
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
  await waitFor(() =>
    expect(
      (screen.getByRole('textbox', { name: /Lot Number/ }) as HTMLInputElement)
        .value,
    ).toMatch(/^LOT-\d{17}-001$/),
  );
  const generatedNumber = (
    screen.getByRole('textbox', { name: /Lot Number/ }) as HTMLInputElement
  ).value;
  await user.type(screen.getByRole('spinbutton', { name: /Quantity/ }), '0');
  await user.click(screen.getByRole('button', { name: 'Create Lot' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  await user.clear(screen.getByRole('spinbutton', { name: /Quantity/ }));
  await user.type(screen.getByRole('spinbutton', { name: /Quantity/ }), '200');
  await user.click(screen.getByRole('button', { name: 'Create Lot' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'This lot number is already in use.',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('409');
  expect(screen.getByRole('textbox', { name: /Lot Number/ })).toHaveValue(
    generatedNumber,
  );
  expect(onCreated).not.toHaveBeenCalled();
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 200,
    data: { ...lotResponse, lot_number: generatedNumber },
  });
  await user.click(screen.getByRole('button', { name: 'Create Lot' }));
  await waitFor(() => expect(onCreated).toHaveBeenCalled());
  expect(apiClient.post).toHaveBeenLastCalledWith(
    'styles/style-id/lots',
    { lotNumber: generatedNumber, quantity: 200 },
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
  await user.click(screen.getByRole('button', { name: 'Cancel lot' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  await user.type(
    screen.getByRole('textbox', { name: /Reason/ }),
    ' Order withdrawn ',
  );
  await user.click(screen.getByRole('button', { name: 'Cancel lot' }));
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
it('refreshes the list after cancellation and removes the cancellation action', async () => {
  const user = userEvent.setup();
  renderList();
  await user.click(
    await screen.findByRole('button', { name: 'Cancel lot LOT-001' }),
  );
  await user.type(
    screen.getByRole('textbox', { name: /Reason/ }),
    'Cancelled order',
  );
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { styles: [lotStyleOption] }
        : [{ ...lotResponse, status: 'CANCELLED' }],
  }));
  await user.click(screen.getByRole('button', { name: 'Cancel lot' }));
  expect(await screen.findByText('Cancelled')).toBeVisible();
  expect(
    screen.queryByRole('button', { name: 'Cancel lot LOT-001' }),
  ).not.toBeInTheDocument();
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
