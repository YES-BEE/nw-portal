import { apiPage } from '../../test/apiPage';
import { act, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import { renderWithProviders } from '../../test/render';
import {
  dragProcessToEnd,
  mockProcessDragLayout,
} from '../../test/processDrag';
import {
  styleResponse,
  styleRouteResponse,
  styleProcessOptions,
  styleRevisionResponse,
} from '../../test/styles';
import { StyleForm } from './StyleForm';
beforeEach(() => {
  mockProcessDragLayout();
  vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { processes: apiPage(styleProcessOptions, undefined, 20) }
        : url.endsWith('/derived-route')
          ? styleRouteResponse
          : styleResponse,
  }));
  vi.spyOn(apiClient, 'post').mockImplementation(async (url) => ({
    status: 200,
    data: url === 'styles' ? styleResponse : styleRevisionResponse,
  }));
});
function setup(styleId?: string) {
  const callbacks = { onClose: vi.fn(), onSaved: vi.fn(), onReload: vi.fn() };
  return {
    user: userEvent.setup(),
    ...callbacks,
    ...renderWithProviders(<StyleForm styleId={styleId} {...callbacks} />),
  };
}
it('creates a style using backend fields and the dragged process order', async () => {
  const { user, onSaved } = setup();
  await user.type(
    await screen.findByRole('textbox', { name: /Style Number/ }),
    ' STY-1001 ',
  );
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    ' Denim ',
  );
  await dragProcessToEnd(user, 'Drying');
  await dragProcessToEnd(user, 'Washing');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).toHaveBeenCalledWith(
    'styles',
    {
      styleNumber: 'STY-1001',
      description: 'Denim',
      processIds: [styleProcessOptions[1].id, styleProcessOptions[0].id],
      lotCount: 0,
    },
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledWith(styleResponse.id);
  expect(
    screen.queryByRole('textbox', { name: /Client/ }),
  ).not.toBeInTheDocument();
});
it('hides drag/drop panels and disables save when the system has no processes', async () => {
  vi.mocked(apiClient.get).mockResolvedValue({
    status: 200,
    data: { processes: apiPage([], undefined, 20) },
  });
  setup();
  expect(await screen.findByText(/No processes are available/)).toBeVisible();
  expect(
    screen.queryByRole('region', { name: 'Scrollable production sequence' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: /Drag / }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Save Style' })).toBeDisabled();
});
it('requires a selected process and displays the backend rejection for duplicates', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 400,
    data: {
      code: 'INVALID_ARGUMENT',
      detail: 'Process IDs must be unique and non-null',
    },
  });
  const { user, onSaved } = setup();
  await user.type(
    await screen.findByRole('textbox', { name: /Style Number/ }),
    'STY-1001',
  );
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  await dragProcessToEnd(user, 'Washing');
  await dragProcessToEnd(user, 'Washing');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(
    await screen.findByText('Process IDs must be unique and non-null'),
  ).toBeVisible();
  expect(apiClient.post).toHaveBeenCalledWith(
    'styles',
    expect.objectContaining({
      processIds: [styleProcessOptions[0].id, styleProcessOptions[0].id],
    }),
    expect.anything(),
  );
  expect(onSaved).not.toHaveBeenCalled();
});
it('loads fresh edit data, requires a revision reason and saves using the chosen revision scope', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { processes: apiPage(styleProcessOptions, undefined, 20) }
        : url.endsWith('/derived-route')
          ? styleRouteResponse
          : { ...styleResponse, status: 'RELEASED' },
  }));
  const { user, onSaved } = setup(styleResponse.id);
  const number = await screen.findByRole('textbox', { name: /Style Number/ });
  expect(number).toHaveValue(styleResponse.style_number);
  expect(number).toHaveAttribute('readonly');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(screen.getByText('Enter a reason for this change.')).toBeVisible();
  await user.clear(screen.getByRole('textbox', { name: 'Description' }));
  await user.type(
    screen.getByRole('textbox', { name: 'Description' }),
    'Revised description',
  );
  await user.type(
    screen.getByRole('textbox', { name: /Reason for change/ }),
    'Improve route',
  );
  await user.click(screen.getByRole('combobox', { name: 'Apply revision to' }));
  await user.click(screen.getByRole('option', { name: 'In-progress lots' }));
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 200,
    data: { ...styleRevisionResponse, scope: 'ALL_IN_PROGRESS' },
  });
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).toHaveBeenCalledWith(
    `styles/${styleResponse.id}/revisions/in-progress`,
    {
      description: 'Revised description',
      processIds: [styleProcessOptions[0].id],
      reason: 'Improve route',
    },
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledOnce();
});
it('preserves entered fields and process order when the backend rejects a route', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 409,
    data: {
      code: 'REPEATED_STATION_NOT_ALLOWED',
      detail: 'Derived route returns to Station 03',
    },
  });
  const { user, onSaved } = setup();
  await user.type(
    await screen.findByRole('textbox', { name: /Style Number/ }),
    'STY-1001',
  );
  await dragProcessToEnd(user, 'Washing');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Derived route returns to Station 03',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('HTTP');
  expect(screen.getByRole('textbox', { name: /Style Number/ })).toHaveValue(
    'STY-1001',
  );
  expect(
    within(screen.getByRole('region', { name: 'Step 1' })).getByText('Washing'),
  ).toBeVisible();
  expect(onSaved).not.toHaveBeenCalled();
});
it('blocks duplicate saves and aborts a pending create when unmounted', async () => {
  let resolve!: (value: { status: number; data: unknown }) => void;
  vi.mocked(apiClient.post).mockReturnValue(
    new Promise((done) => {
      resolve = done;
    }),
  );
  const { user, unmount, onSaved } = setup();
  await user.type(
    await screen.findByRole('textbox', { name: /Style Number/ }),
    'STY-1001',
  );
  await dragProcessToEnd(user, 'Washing');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
  expect(apiClient.post).toHaveBeenCalledOnce();
  const signal = vi.mocked(apiClient.post).mock.calls[0][2]?.signal;
  unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => resolve({ status: 200, data: styleResponse }));
  expect(onSaved).not.toHaveBeenCalled();
});
it('retries failed process lookups instead of showing an empty drag/drop area', async () => {
  vi.mocked(apiClient.get).mockResolvedValueOnce({
    status: 503,
    data: { detail: 'Process lookup unavailable' },
  });
  const { user } = setup();
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Process lookup unavailable',
  );
  expect(screen.getByRole('button', { name: 'Save Style' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Save Style' })).toBeEnabled(),
  );
});
it('updates a draft using only process IDs without requiring a revision reason', async () => {
  const put = vi
    .spyOn(apiClient, 'put')
    .mockResolvedValue({ status: 200, data: styleRouteResponse });
  const { user, onSaved } = setup(styleResponse.id);
  await screen.findByRole('textbox', { name: /Style Number/ });
  expect(screen.getByRole('textbox', { name: 'Description' })).toHaveAttribute(
    'readonly',
  );
  expect(
    screen.queryByRole('textbox', { name: /Reason for change/ }),
  ).not.toBeInTheDocument();
  expect(screen.queryByRole('spinbutton')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(put).toHaveBeenCalledWith(
    `styles/${styleResponse.id}/processes`,
    [styleProcessOptions[0].id],
    expect.anything(),
  );
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(onSaved).toHaveBeenCalledWith(styleResponse.id);
});
it('validates optional per-lot quantity and sends it in the selected revision scope', async () => {
  vi.mocked(apiClient.get).mockImplementation(async (url) => ({
    status: 200,
    data:
      url === 'ui/lookups'
        ? { processes: apiPage(styleProcessOptions, undefined, 20) }
        : url.endsWith('/derived-route')
          ? styleRouteResponse
          : { ...styleResponse, status: 'IN_PRODUCTION' },
  }));
  const { user, onSaved } = setup(styleResponse.id);
  await user.type(
    await screen.findByRole('textbox', { name: /Reason for change/ }),
    'Adjust garment count',
  );
  const quantity = screen.getByRole('spinbutton', {
    name: 'Quantity per affected lot',
  });
  await user.type(quantity, '0');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  expect(
    screen.getByText(
      /Enter a whole number between 1 and 2147483647, or leave blank/,
    ),
  ).toBeVisible();
  await user.clear(quantity);
  await user.type(quantity, '150');
  vi.mocked(apiClient.post).mockResolvedValueOnce({
    status: 400,
    data: {
      code: 'VALIDATION_FAILED',
      detail: 'Invalid quantity',
      fieldErrors: { quantity: 'Review lot quantity' },
    },
  });
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(await screen.findByText('Review lot quantity')).toBeVisible();
  expect(quantity).toHaveValue(150);
  expect(onSaved).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).toHaveBeenLastCalledWith(
    `styles/${styleResponse.id}/revisions/unstarted`,
    {
      description: styleResponse.description,
      processIds: [styleProcessOptions[0].id],
      reason: 'Adjust garment count',
      quantity: 150,
    },
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledWith(styleResponse.id);
});
it('retains the draft process sequence when the backend reports a concurrent release', async () => {
  vi.spyOn(apiClient, 'put').mockResolvedValue({
    status: 409,
    data: {
      code: 'STYLE_IMMUTABLE',
      detail: 'Processes cannot change after Style release',
    },
  });
  const { user, onSaved } = setup(styleResponse.id);
  await screen.findByRole('textbox', { name: /Style Number/ });
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(await screen.findByRole('alert')).toHaveTextContent(
    'Processes cannot change after Style release',
  );
  expect(screen.getByRole('alert')).not.toHaveTextContent('409');
  expect(
    within(screen.getByRole('region', { name: 'Step 1' })).getByText('Washing'),
  ).toBeVisible();
  expect(onSaved).not.toHaveBeenCalled();
});
it('saves a planned lot count and optional per-lot quantity on a new style', async () => {
  vi.mocked(apiClient.post).mockResolvedValue({
    status: 200,
    data: { ...styleResponse, lot_count: 5, lot_quantity: 100 },
  });
  const { user, onSaved } = setup();
  await user.type(
    await screen.findByRole('textbox', { name: /Style Number/ }),
    'PLANNED-01',
  );
  await dragProcessToEnd(user, 'Washing');
  const count = screen.getByRole('spinbutton', { name: 'Planned Lots' });
  await user.clear(count);
  await user.type(count, '1001');
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).not.toHaveBeenCalled();
  await user.clear(count);
  await user.type(count, '5');
  await user.type(
    screen.getByRole('spinbutton', { name: 'Garment Quantity per Lot' }),
    '100',
  );
  await user.click(screen.getByRole('button', { name: 'Save Style' }));
  expect(apiClient.post).toHaveBeenCalledWith(
    'styles',
    {
      styleNumber: 'PLANNED-01',
      description: '',
      processIds: [styleProcessOptions[0].id],
      lotCount: 5,
      quantity: 100,
    },
    expect.anything(),
  );
  expect(onSaved).toHaveBeenCalledWith(styleResponse.id);
});
