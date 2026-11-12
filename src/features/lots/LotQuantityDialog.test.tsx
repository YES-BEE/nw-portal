import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import { lotResponse } from '../../test/lots';
import { LotQuantityDialog } from './LotQuantityDialog';
import { canEditLotQuantity } from './lotDisplay';
import type { LotResponse } from './types';

beforeEach(() => {
  vi.spyOn(apiClient, 'put').mockResolvedValue({
    status: 200,
    data: { ...lotResponse, quantity: 120 },
  });
});
function setup(lot: LotResponse = lotResponse) {
  const callbacks = { onClose: vi.fn(), onSaved: vi.fn(), onReload: vi.fn() };
  return {
    user: userEvent.setup(),
    ...callbacks,
    ...renderWithProviders(<LotQuantityDialog lot={lot} {...callbacks} />),
  };
}
it('changes only this lot with a required reason and returns the updated response', async () => {
  const { user, onSaved } = setup();
  expect(screen.getByRole('spinbutton')).toHaveValue(200);
  await user.clear(screen.getByRole('spinbutton'));
  await user.type(screen.getByRole('spinbutton'), '120');
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), ' Recount ');
  await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
  expect(apiClient.put).toHaveBeenCalledWith(
    'lots/lot-id',
    { quantity: 120, reason: 'Recount' },
    expect.objectContaining({ signal: expect.any(AbortSignal) }),
  );
  expect(onSaved).toHaveBeenCalledWith({ ...lotResponse, quantity: 120 });
});
it.each(['', '0', '-1', '1.5', '2147483648'])(
  'rejects invalid quantity %s',
  async (quantity) => {
    const { user } = setup();
    fireEvent.change(screen.getByRole('spinbutton'), {
      target: { value: quantity },
    });
    await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Recount');
    await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
    expect(apiClient.put).not.toHaveBeenCalled();
    expect(screen.getByRole('spinbutton')).toHaveAttribute(
      'aria-invalid',
      'true',
    );
  },
);
it('requires a nonblank reason limited to 500 characters and permits setting an unknown initial quantity', async () => {
  const { user } = setup({ ...lotResponse, quantity: null });
  await user.type(screen.getByRole('spinbutton'), '120');
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), '  ');
  await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
  expect(apiClient.put).not.toHaveBeenCalled();
  expect(screen.getByRole('textbox', { name: /Reason/ })).toHaveAttribute(
    'maxlength',
    '500',
  );
  fireEvent.change(screen.getByRole('textbox', { name: /Reason/ }), {
    target: { value: 'x'.repeat(501) },
  });
  await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
  expect(apiClient.put).not.toHaveBeenCalled();
  fireEvent.change(screen.getByRole('textbox', { name: /Reason/ }), {
    target: { value: 'Initial count' },
  });
  await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
  expect(apiClient.put).toHaveBeenCalledWith(
    'lots/lot-id',
    { quantity: 120, reason: 'Initial count' },
    expect.anything(),
  );
});
it.each(['DISPATCHED', 'COMPLETED', 'CANCELLED'])(
  'prevents edits for %s',
  (status) => {
    setup({ ...lotResponse, status });
    expect(canEditLotQuantity(status)).toBe(false);
    expect(
      screen.getByRole('button', { name: 'Save Quantity' }),
    ).toBeDisabled();
  },
);
it.each([
  'READY',
  'AT_STATION',
  'IN_PROCESS',
  'IN_STORAGE',
  'READY_FOR_DISPATCH',
  'AT_QC',
])('permits edits for %s', (status) => {
  expect(canEditLotQuantity(status)).toBe(true);
});
it.each([
  [403, { code: 'ACCESS_DENIED', detail: 'This lot is outside your styles' }],
  [
    409,
    {
      code: 'LOT_EDIT_NOT_ALLOWED',
      detail: 'Lot quantity cannot change during transit',
    },
  ],
  [
    400,
    {
      code: 'VALIDATION_FAILED',
      detail: 'Validation failed',
      fieldErrors: {
        reason: 'Enter a change reason',
        quantity: 'Use a positive integer',
      },
    },
  ],
] as const)(
  'keeps values and displays backend failure %s',
  async (status, data) => {
    vi.mocked(apiClient.put).mockResolvedValue({ status, data });
    const { user, onSaved } = setup();
    await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Recount');
    await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(data.detail);
    expect(screen.getByRole('alert')).not.toHaveTextContent(String(status));
    expect(screen.getByRole('textbox', { name: /Reason/ })).toHaveValue(
      'Recount',
    );
    expect(onSaved).not.toHaveBeenCalled();
    if (status === 400)
      expect(screen.getByRole('spinbutton')).toHaveAccessibleDescription(
        'Use a positive integer',
      );
    else
      expect(
        screen.getByRole('button', { name: 'Save Quantity' }),
      ).toBeDisabled();
  },
);
it('prevents duplicate submissions and aborts a pending save on unmount', async () => {
  let resolve!: (response: { status: number; data: LotResponse }) => void;
  vi.mocked(apiClient.put).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { user, onSaved, unmount } = setup();
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Recount');
  await user.click(screen.getByRole('button', { name: 'Save Quantity' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  fireEvent.submit(document.getElementById('lot-quantity-form')!);
  await waitFor(() => expect(apiClient.put).toHaveBeenCalledTimes(1));
  const signal = vi.mocked(apiClient.put).mock.calls[0][2]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ status: 200, data: lotResponse }));
  expect(onSaved).not.toHaveBeenCalled();
});
