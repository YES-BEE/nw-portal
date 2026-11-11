import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { TrolleyNfcDialog } from './TrolleyNfcDialog';
import * as nfc from './trolleyNfcApi';
import * as tagsApi from '../tags/tagsApi';
import type { TagDetailsResponse } from '../tags/tagsApi';

const trolley = {
  id: 'trolley-1',
  code: 'TR-01',
  status: 'AVAILABLE',
  active: true,
  version: 0,
};
const tag: TagDetailsResponse = {
  id: 'tag-1',
  name: 'New tag',
  uid: 'ABC',
  status: 'ACTIVE',
  assigned: false,
  asset_type: null,
  trolley_id: null,
  station_id: null,
  process_id: null,
  machine_id: null,
  storage_area_id: null,
  storage_location_id: null,
  version: 0,
};
const old: TagDetailsResponse = {
  ...tag,
  id: 'old',
  name: 'Old tag',
  uid: 'OLD',
  assigned: true,
  asset_type: 'TROLLEY',
  trolley_id: trolley.id,
};
let records: TagDetailsResponse[];
beforeEach(() => {
  records = [tag, old];
  vi.spyOn(nfc, 'getTrolleyNfcTags').mockImplementation(async () => records);
  vi.spyOn(tagsApi, 'getTag').mockImplementation(async (id) =>
    records.find((item) => item.id === id)!,
  );
  vi.spyOn(nfc, 'assignTrolleyNfcTag').mockResolvedValue({
    ...tag,
    assigned: true,
    asset_type: 'TROLLEY',
    trolley_id: trolley.id,
  });
  vi.spyOn(nfc, 'unassignTrolleyNfcTag').mockImplementation(async (id) => {
    records = records.map((item) =>
      item.id === id
        ? { ...item, assigned: false, asset_type: null, trolley_id: null }
        : item,
    );
  });
});
function setup() {
  const user = userEvent.setup();
  renderWithProviders(<TrolleyNfcDialog trolley={trolley} onClose={vi.fn()} />);
  return user;
}
it('shows assigned tag names and UIDs, validates reason and assigns an available tag', async () => {
  records = [tag];
  const user = setup();
  expect(await screen.findByText('No NFC tag assigned.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Assign NFC tag' }));
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  expect(screen.getByText('Enter a reason.')).toBeInTheDocument();
  expect(nfc.assignTrolleyNfcTag).not.toHaveBeenCalled();
  await user.click(screen.getByRole('combobox', { name: 'Available NFC tag' }));
  await user.click(screen.getByRole('option', { name: 'New tag (ABC)' }));
  await user.type(
    screen.getByRole('textbox', { name: /Reason/ }),
    'Initial setup',
  );
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(nfc.assignTrolleyNfcTag).toHaveBeenCalledWith(
      'tag-1',
      { assetType: 'TROLLEY', assetId: 'trolley-1', reason: 'Initial setup' },
      expect.any(AbortSignal),
    ),
  );
});
it('removes the previous tag first and retries only assigning the replacement', async () => {
  vi.mocked(nfc.assignTrolleyNfcTag).mockRejectedValueOnce(
    new tagsApi.TagsError({
      kind: 'conflict',
      action: 'none',
      message: 'Please try assigning again',
    }),
  );
  const user = setup();
  await user.click(await screen.findByRole('button', { name: 'Replace tag' }));
  await user.click(screen.getByRole('combobox', { name: 'Available NFC tag' }));
  await user.click(screen.getByRole('option', { name: 'New tag (ABC)' }));
  await user.type(
    screen.getByRole('textbox', { name: /Reason/ }),
    'Damaged tag',
  );
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  expect(
    await screen.findByText('Please try assigning again'),
  ).toBeInTheDocument();
  expect(
    screen.getByText(/The previous tag was unassigned/),
  ).toBeInTheDocument();
  expect(screen.queryByText(/HTTP/)).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Finish replacement' }));
  await waitFor(() => expect(nfc.assignTrolleyNfcTag).toHaveBeenCalledTimes(2));
  expect(nfc.unassignTrolleyNfcTag).toHaveBeenCalledTimes(1);
  expect(
    vi.mocked(nfc.unassignTrolleyNfcTag).mock.invocationCallOrder[0],
  ).toBeLessThan(
    vi.mocked(nfc.assignTrolleyNfcTag).mock.invocationCallOrder[0],
  );
});
it('unassigns the chosen tag with a reason and rejects a stale selected tag', async () => {
  const user = setup();
  await user.click(await screen.findByRole('button', { name: 'Unassign tag' }));
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Retired');
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(nfc.unassignTrolleyNfcTag).toHaveBeenCalledWith(
      'old',
      { reason: 'Retired' },
      expect.any(AbortSignal),
    ),
  );
  await user.click(
    await screen.findByRole('button', { name: 'Assign NFC tag' }),
  );
  await user.click(screen.getByRole('combobox', { name: 'Available NFC tag' }));
  await user.click(screen.getByRole('option', { name: 'New tag (ABC)' }));
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Setup');
  vi.mocked(tagsApi.getTag).mockResolvedValueOnce({ ...tag, assigned: true });
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  expect(
    await screen.findByText(
      'This tag is no longer available. Reload and choose another tag.',
    ),
  ).toBeInTheDocument();
  expect(nfc.assignTrolleyNfcTag).not.toHaveBeenCalled();
});

it('offers replacement instead of another assignment when a tag is assigned', async () => {
  setup();
  expect(await screen.findByText('Old tag (OLD)')).toBeInTheDocument();
  expect(
    screen.queryByRole('button', { name: 'Assign NFC tag' }),
  ).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Replace tag' })).toBeEnabled();
});
it('shows an informational empty state and disables assignment when no tags are available', async () => {
  records = [];
  setup();
  expect(
    await screen.findByText(
      'No available tags. Add a tag in Tag Management first.',
    ),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Assign NFC tag' })).toBeDisabled();
});
it('keeps the assigned tag visible and disables replacement when no spare tag is available', async () => {
  records = [old];
  setup();
  expect(await screen.findByText('Old tag (OLD)')).toBeInTheDocument();
  expect(
    screen.getByText('No available tags. Add a tag in Tag Management first.'),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Replace tag' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Unassign tag' })).toBeEnabled();
});
