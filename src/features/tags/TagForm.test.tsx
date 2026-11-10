import { defaultTags, seedTestData } from '../../test/fixtures';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { TagForm } from './TagForm';

import { PROCESS_STORAGE_KEY } from '../processes/processData';

beforeEach(() => {
  seedTestData();
});

describe('tag editor callbacks', () => {
  it('submits normalized tag data without writing the registry', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <TagForm
        initial={{ id: 'new', name: ' Factory tag ', actual: ' 04:AA:BB ' }}
        editing={false}
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      id: 'new',
      name: 'Factory tag',
      actual: '04:AA:BB',
    });
    expect(localStorage.length).toBe(5);
  });

  it('locks the NFC ID when assignments cannot be verified but allows a safe rename', async () => {
    localStorage.setItem(PROCESS_STORAGE_KEY, '{invalid');
    const user = userEvent.setup();
    const onSave = vi.fn();
    renderWithProviders(
      <TagForm
        initial={defaultTags[6]}
        editing
        onSave={onSave}
        onClose={vi.fn()}
      />,
    );
    expect(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
    ).toHaveAttribute('readonly');
    const name = screen.getByRole('textbox', { name: /Tag Name/ });
    await user.clear(name);
    await user.type(name, 'Updated finishing tag');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(onSave).toHaveBeenCalledExactlyOnceWith({
      ...defaultTags[6],
      name: 'Updated finishing tag',
    });
  });

  it('cancels without invoking the save callback', async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();
    const onClose = vi.fn();
    renderWithProviders(
      <TagForm
        initial={defaultTags[0]}
        editing
        onSave={onSave}
        onClose={onClose}
      />,
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onClose).toHaveBeenCalledOnce();
    expect(onSave).not.toHaveBeenCalled();
  });
});
