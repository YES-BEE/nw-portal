import { sampleStorages, seedTestData } from '../../test/fixtures';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configurationTheme } from '../../app/theme';
import { renderWithProviders } from '../../test/render';
import { StorageConfigurationsPage } from './StorageConfigurationsPage';
import { STORAGE_STORAGE_KEY } from './storageData';

function setup() {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <ThemeProvider theme={configurationTheme}>
        <MemoryRouter>
          <StorageConfigurationsPage />
        </MemoryRouter>
      </ThemeProvider>,
    ),
  };
}
beforeEach(() => {
  seedTestData();
});

describe('storage configurations', () => {
  it('creates a storage with an available registered tag and reloads it', async () => {
    const { user, unmount } = setup();
    await user.click(screen.getByRole('button', { name: 'Add New Storage' }));
    expect(
      screen.getByRole('combobox', { name: /NFC Tag ID/ }),
    ).toHaveTextContent('Select a registered tag');
    await user.type(
      screen.getByRole('textbox', { name: /Storage Number/ }),
      ' ST-003 ',
    );
    await user.type(
      screen.getByRole('textbox', { name: 'Description' }),
      'New holding area',
    );
    await user.click(screen.getByRole('combobox', { name: /NFC Tag ID/ }));
    await user.click(screen.getByRole('option', { name: 'Storage Bay C Tag' }));
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(screen.getByRole('rowheader', { name: 'ST-003' })).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Storage Number/ }),
    ).not.toBeInTheDocument();
    unmount();
    setup();
    expect(screen.getByRole('rowheader', { name: 'ST-003' })).toBeVisible();
    expect(
      screen.getByRole('cell', { name: 'New holding area' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: /Reset Demo Data/ }),
    ).not.toBeInTheDocument();
  });
  it('edits a storage and retains its existing NFC tag', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Edit storage ST-001' }),
    );
    const description = screen.getByRole('textbox', { name: 'Description' });
    await user.clear(description);
    await user.type(description, 'Updated storage bay');
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(
      screen.getByRole('cell', { name: 'Updated storage bay' }),
    ).toBeVisible();
    expect(
      JSON.parse(localStorage.getItem(STORAGE_STORAGE_KEY) ?? '[]')[0].tag,
    ).toBe('NFC-STORE-001');
  });
  it('cancels edits without changing the saved storage', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Edit storage ST-001' }),
    );
    await user.clear(screen.getByRole('textbox', { name: /Storage Number/ }));
    await user.type(
      screen.getByRole('textbox', { name: /Storage Number/ }),
      'Unsaved',
    );
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('rowheader', { name: 'ST-001' })).toBeVisible();
    expect(localStorage.getItem(STORAGE_STORAGE_KEY)).toBe(
      JSON.stringify(sampleStorages),
    );
  });
  it('rejects missing fields and duplicate storage numbers', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add New Storage' }));
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(
      screen.getByRole('textbox', { name: /Storage Number/ }),
    ).toHaveAccessibleDescription('Enter a storage number.');
    expect(
      screen.getByRole('combobox', { name: /NFC Tag ID/ }),
    ).toHaveAccessibleDescription('Select an NFC tag for this storage.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.type(
      screen.getByRole('textbox', { name: /Storage Number/ }),
      'st-002',
    );
    await user.click(screen.getByRole('combobox', { name: /NFC Tag ID/ }));
    await user.click(screen.getByRole('option', { name: 'Storage Bay C Tag' }));
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(
      screen.getByRole('textbox', { name: /Storage Number/ }),
    ).toHaveAccessibleDescription('Storage Number already exists.');
  });
  it('disables tags assigned to other storages, processes, or devices', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add New Storage' }));
    await user.click(screen.getByRole('combobox', { name: /NFC Tag ID/ }));
    for (const label of [
      'Storage Bay A Tag',
      'Lot Preparation Tag',
      'Washer 01 Tag',
    ]) {
      expect(screen.getByRole('option', { name: label })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    }
    expect(
      screen.getByRole('option', { name: 'Storage Bay C Tag' }),
    ).not.toHaveAttribute('aria-disabled', 'true');
  });
  it('deletes only after confirmation and keeps deletion on reload', async () => {
    const { user, unmount } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Delete storage ST-001' }),
    );
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete storage?' })).getByRole(
        'button',
        { name: 'Cancel' },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('rowheader', { name: 'ST-001' })).toBeVisible();
    await user.click(
      screen.getByRole('button', { name: 'Delete storage ST-001' }),
    );
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete storage?' })).getByRole(
        'button',
        { name: 'Delete' },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('rowheader', { name: 'ST-001' }),
    ).not.toBeInTheDocument();
    unmount();
    setup();
    expect(
      screen.queryByRole('rowheader', { name: 'ST-001' }),
    ).not.toBeInTheDocument();
  });
  it('keeps records and the editor when browser-storage writes fail', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Edit storage ST-001' }),
    );
    const number = screen.getByRole('textbox', { name: /Storage Number/ });
    await user.clear(number);
    await user.type(number, 'ST-009');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    await user.click(screen.getByRole('button', { name: 'Save Storage' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes could not be saved',
    );
    expect(screen.getByRole('rowheader', { name: 'ST-001' })).toBeVisible();
    expect(number).toHaveValue('ST-009');
  });
});
