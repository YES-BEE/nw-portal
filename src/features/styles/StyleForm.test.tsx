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
        ? { processes: styleProcessOptions }
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
    data: { processes: [] },
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
it('requires a selected process and refuses duplicate process selections', async () => {
  const { user } = setup();
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
    await screen.findByText('Each process can only be added once.'),
  ).toBeVisible();
  expect(apiClient.post).not.toHaveBeenCalled();
});
it('loads fresh edit data, requires a revision reason and saves using the chosen revision scope', async () => {
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
