import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { TrolleyNfcEditor } from './TrolleyNfcEditor';
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
function setup(mode: 'assign' | 'replace' | 'unassign' = 'assign') {
  const user = userEvent.setup();
  const change =
    mode === 'assign' ? ({ mode } as const) : { mode, tagId: old.id };
  renderWithProviders(
    <TrolleyNfcEditor
      trolley={trolley}
      change={change}
      onClose={vi.fn()}
      onSaved={vi.fn()}
    />,
  );
  return user;
}
it('validates the reason and assigns an available tag inline without a modal', async () => {
  records = [tag];
  const user = setup();
  await screen.findByRole('combobox', { name: 'Available NFC tag' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  expect(screen.getByText('Enter a reason.')).toBeInTheDocument();
  expect(nfc.assignTrolleyNfcTag).not.toHaveBeenCalled();
  await user.click(screen.getByRole('combobox', { name: 'Available NFC tag' }));
  await user.click(screen.getByRole('option', { name: 'New tag' }));
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
  const user = setup('replace');
  await screen.findByRole('combobox', { name: 'Available NFC tag' });
  await user.click(screen.getByRole('combobox', { name: 'Available NFC tag' }));
  await user.click(screen.getByRole('option', { name: 'New tag' }));
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

it('unassigns the selected tag without fetching tag names for display', async () => {
  const user = setup('unassign');
  expect(nfc.getTrolleyNfcTags).not.toHaveBeenCalled();
  expect(screen.queryByText('Old tag')).not.toBeInTheDocument();
  await user.type(screen.getByRole('textbox', { name: /Reason/ }), 'Retired');
  await user.click(screen.getByRole('button', { name: 'Save assignment' }));
  await waitFor(() =>
    expect(nfc.unassignTrolleyNfcTag).toHaveBeenCalledWith(
      'old',
      { reason: 'Retired' },
      expect.any(AbortSignal),
    ),
  );
});
it.each(['assign', 'replace'] as const)(
  'disables the dropdown and shows a message when no tags are available to %s',
  async (mode) => {
    records = [old];
    setup(mode);
    expect(
      await screen.findByText(
        'No available tags. Add a tag in Tag Management first.',
      ),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('combobox', { name: 'Available NFC tag' }),
    ).toHaveAttribute('aria-disabled', 'true');
    expect(
      screen.getByRole('button', { name: 'Save assignment' }),
    ).toBeDisabled();
    expect(nfc.assignTrolleyNfcTag).not.toHaveBeenCalled();
    expect(nfc.unassignTrolleyNfcTag).not.toHaveBeenCalled();
  },
);
it('rejects a tag that was assigned to another asset after selection', async () => {
  records = [tag];
  const user = setup();
  await user.click(
    await screen.findByRole('combobox', { name: 'Available NFC tag' }),
  );
  await user.click(screen.getByRole('option', { name: 'New tag' }));
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
