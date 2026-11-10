import { sampleStorages, seedTestData } from '../../test/fixtures';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { StorageForm } from './StorageForm';

beforeEach(() => {
  seedTestData();
});

describe('storage editor callbacks', () => {
  it('submits normalized values without persisting them itself', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <StorageForm
        initial={{
          id: 'new',
          number: ' ST-003 ',
          description: ' Holding area ',
          tag: 'NFC-STORE-003',
        }}
        editing={false}
        records={sampleStorages}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      id: 'new',
      number: 'ST-003',
      description: 'Holding area',
      tag: 'NFC-STORE-003',
    });
    expect(localStorage.length).toBe(5);
  });

  it('blocks stale NFC assignments and attaches the error to the dropdown', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <StorageForm
        initial={{
          id: 'new',
          number: 'ST-003',
          description: '',
          tag: 'NFC-PROC-001',
        }}
        editing={false}
        records={sampleStorages}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(
      screen.getByRole('combobox', { name: /NFC Tag ID/ }),
    ).toHaveAccessibleDescription(
      'This NFC tag is already assigned to another storage, process, or device.',
    );
    expect(onSave).not.toHaveBeenCalled();
  });

  it('calls onClose without saving when the editor is closed', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <StorageForm
        initial={sampleStorages[0]}
        editing
        records={sampleStorages}
        onSave={onSave}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Close' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
