import { act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { lotResponse } from '../../test/lots';
import { LotTrolleyDialog } from './LotTrolleyDialog';
const trolley = {
  id: 'trolley-id',
  code: 'TR-01',
  status: 'AVAILABLE',
  active: true,
  version: 0,
};
const assigned = {
  ...lotResponse,
  trolley_id: trolley.id,
  trolley_code: trolley.code,
};
beforeEach(() => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: [trolley],
  });
  vi.spyOn(apiClient, 'put').mockResolvedValue({ status: 200, data: assigned });
  vi.spyOn(apiClient, 'delete').mockResolvedValue({
    status: 200,
    data: lotResponse,
  });
});
function setup(mapped = false) {
  const callbacks = { onClose: vi.fn(), onSaved: vi.fn(), onReload: vi.fn() };
  return {
    ...callbacks,
    user: userEvent.setup(),
    ...renderWithProviders(
      <LotTrolleyDialog lot={mapped ? assigned : lotResponse} {...callbacks} />,
    ),
  };
}
it('chooses an available trolley without needing trolley configuration access', async () => {
  const { user, onSaved } = setup();
  const select = await screen.findByRole('combobox', {
    name: /Available Trolley/,
  });
  await user.click(screen.getByRole('button', { name: 'Assign trolley' }));
  expect(screen.getByText('Select an available trolley.')).toBeVisible();
  expect(apiClient.put).not.toHaveBeenCalled();
  await user.click(select);
  await user.click(screen.getByRole('option', { name: 'TR-01' }));
  await user.click(screen.getByRole('button', { name: 'Assign trolley' }));
  expect(apiClient.put).toHaveBeenCalledWith(
    'lots/lot-id/trolley',
    { trolleyId: 'trolley-id' },
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledOnce();
  expect(apiClient.get).toHaveBeenCalledWith(
    'trolleys/available',
    expect.anything(),
  );
});
it('unassigns the current trolley without fetching the available list', async () => {
  const { user, onSaved } = setup(true);
  expect(
    screen.getByText('Unassign trolley TR-01 from lot LOT-001?'),
  ).toBeVisible();
  await user.click(screen.getByRole('button', { name: 'Unassign trolley' }));
  expect(apiClient.delete).toHaveBeenCalledWith(
    'lots/lot-id/trolley',
    expect.anything(),
  );
  expect(apiClient.get).not.toHaveBeenCalled();
  expect(onSaved).toHaveBeenCalledOnce();
});
it('handles no available trolleys without enabling assignment or offering a reload button', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({ status: 200, data: [] });
  setup();
  expect(
    await screen.findByText(
      'No trolleys are available. Try again after a trolley becomes available.',
    ),
  ).toBeVisible();
  expect(screen.getByRole('button', { name: 'Assign trolley' })).toBeDisabled();
  expect(
    screen.getByRole('combobox', { name: /Available Trolley/ }),
  ).toHaveAttribute('aria-disabled', 'true');
  expect(
    screen.queryByRole('button', { name: 'Reload available trolleys' }),
  ).not.toBeInTheDocument();
});
it('preserves selection and displays backend concurrent-booking errors', async () => {
  vi.mocked(apiClient.put).mockResolvedValue({
    status: 409,
    data: { code: 'TROLLEY_OCCUPIED', detail: 'Trolley is already assigned' },
  });
  const { user, onSaved } = setup();
  await user.click(
    await screen.findByRole('combobox', { name: /Available Trolley/ }),
  );
  await user.click(screen.getByRole('option', { name: 'TR-01' }));
  await user.click(screen.getByRole('button', { name: 'Assign trolley' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Trolley is already assigned',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('409');
  expect(screen.getByRole('combobox')).toHaveTextContent('TR-01');
  expect(onSaved).not.toHaveBeenCalled();
});
it('aborts an assignment on unmount and prevents duplicate submissions', async () => {
  let resolve!: (value: { status: number; data: unknown }) => void;
  vi.mocked(apiClient.put).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { user, unmount, onSaved } = setup();
  await user.click(
    await screen.findByRole('combobox', { name: /Available Trolley/ }),
  );
  await user.click(screen.getByRole('option', { name: 'TR-01' }));
  await user.click(screen.getByRole('button', { name: 'Assign trolley' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  const signal = vi.mocked(apiClient.put).mock.calls[0][2]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ status: 200, data: assigned }));
  expect(onSaved).not.toHaveBeenCalled();
  expect(apiClient.put).toHaveBeenCalledTimes(1);
});
it('shows backend trolley field validation without losing the selected trolley', async () => {
  vi.mocked(apiClient.put).mockResolvedValue({
    status: 400,
    data: {
      code: 'VALIDATION_FAILED',
      detail: 'Review trolley selection',
      fieldErrors: { trolleyId: 'Select another available trolley' },
    },
  });
  const { user, onSaved } = setup();
  await user.click(
    await screen.findByRole('combobox', { name: /Available Trolley/ }),
  );
  await user.click(screen.getByRole('option', { name: 'TR-01' }));
  await user.click(screen.getByRole('button', { name: 'Assign trolley' }));
  expect(
    await screen.findByText('Select another available trolley'),
  ).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveTextContent('TR-01');
  expect(onSaved).not.toHaveBeenCalled();
});
