import {
  defaultTags,
  sampleProcesses,
  seedTestData,
} from '../../test/fixtures';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configurationTheme } from '../../app/theme';
import { renderWithProviders } from '../../test/render';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';
import { PROCESS_STORAGE_KEY } from './processData';
import { TAG_STORAGE_KEY } from '../configurations/tagRegistry';

function setup() {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <ThemeProvider theme={configurationTheme}>
        <MemoryRouter>
          <ProcessConfigurationsPage />
        </MemoryRouter>
      </ThemeProvider>,
    ),
  };
}

beforeEach(() => {
  seedTestData();
});

describe('process configurations', () => {
  it('shows the registered tag name instead of its NFC ID in the existing processes table', () => {
    localStorage.setItem(
      TAG_STORAGE_KEY,
      JSON.stringify(
        defaultTags.map((tag) =>
          tag.actual === 'NFC-PROC-001'
            ? { ...tag, name: 'Preparation Reader' }
            : tag,
        ),
      ),
    );
    setup();
    const row = screen.getByRole('row', { name: /Lot Preparation/ });
    expect(within(row).getByText('Preparation Reader')).toBeVisible();
    expect(within(row).queryByText('NFC-PROC-001')).not.toBeInTheDocument();
  });

  it('shows all required process errors on their fields and clears corrected errors', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Create Process' }));
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    const name = screen.getByRole('textbox', { name: /Process Name/ });
    expect(name).toHaveAccessibleDescription('Enter a process name.');
    expect(
      screen.getByRole('textbox', { name: /Station Number/ }),
    ).toHaveAccessibleDescription('Enter a station number.');
    expect(
      screen.getByRole('combobox', { name: /Process-level NFC Tag ID/ }),
    ).toHaveAccessibleDescription(
      'Select an NFC tag for process-level tracking.',
    );
    await user.type(name, 'Finishing');
    expect(name).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('attaches device name and duplicate NFC errors to the affected device fields', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Washing' }));
    const names = screen.getAllByRole('textbox', { name: /Device Name/ });
    await user.clear(names[0]);
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(names[0]).toHaveAccessibleDescription('Enter a device name.');
    expect(names[1]).not.toHaveAttribute('aria-invalid', 'true');
    await user.type(names[0], 'Washer 01');
    const tags = screen.getAllByRole('combobox', { name: /Device NFC Tag/ });
    await user.click(tags[0]);
    await user.click(
      screen.getByRole('option', { name: 'Washer 02 Tag (NFC-DEV-002)' }),
    );
    for (const tag of tags)
      expect(tag).toHaveAccessibleDescription(
        'NFC Tag IDs must be unique within this process.',
      );
    await user.click(tags[0]);
    await user.click(
      screen.getByRole('option', { name: 'Washer 01 Tag (NFC-DEV-001)' }),
    );
    for (const tag of tags)
      expect(tag).not.toHaveAttribute('aria-invalid', 'true');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('shows invalid device-count feedback under the count field and clears it after correction', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Edit Washing' }));
    const count = screen.getByRole('spinbutton', { name: 'Device count' });
    await user.clear(count);
    await user.type(count, '51');
    await user.click(screen.getByRole('button', { name: 'Apply Count' }));
    expect(count).toHaveAccessibleDescription(
      'Device count must be a whole number between 0 and 50.',
    );
    expect(count).toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getAllByRole('textbox', { name: /Device Name/ }),
    ).toHaveLength(2);
    await user.clear(count);
    await user.type(count, '3');
    await user.click(screen.getByRole('button', { name: 'Apply Count' }));
    expect(count).not.toHaveAttribute('aria-invalid', 'true');
    expect(
      screen.getAllByRole('textbox', { name: /Device Name/ }),
    ).toHaveLength(3);
  });

  it('creates a process with a registered tag and reloads the saved record', async () => {
    localStorage.setItem(PROCESS_STORAGE_KEY, '[]');
    const { user, unmount } = setup();
    await user.click(screen.getByRole('button', { name: 'Create Process' }));
    expect(
      screen.getByRole('combobox', { name: /Process-level NFC Tag ID/ }),
    ).toHaveTextContent('Select a registered tag');
    await user.type(
      screen.getByRole('textbox', { name: /Process Name/ }),
      ' Finishing ',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Station Number/ }),
      '07',
    );
    await user.click(
      screen.getByRole('combobox', { name: /Process-level NFC Tag ID/ }),
    );
    await user.click(
      screen.getByRole('option', {
        name: 'Lot Preparation Tag (NFC-PROC-001)',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Save Process' }));

    expect(screen.getByRole('rowheader', { name: 'Finishing' })).toBeVisible();
    expect(
      screen.queryByRole('textbox', { name: /Process Name/ }),
    ).not.toBeInTheDocument();
    unmount();
    setup();
    expect(screen.getByRole('rowheader', { name: 'Finishing' })).toBeVisible();
    expect(screen.getByRole('cell', { name: '07' })).toBeVisible();
  });

  it('retains saved process data when editing is cancelled', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Edit Lot Preparation' }),
    );
    const name = screen.getByRole('textbox', { name: /Process Name/ });
    await user.clear(name);
    await user.type(name, 'Unsaved name');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(
      screen.getByRole('rowheader', { name: /Lot Preparation/ }),
    ).toBeVisible();
    expect(screen.queryByText('Unsaved name')).not.toBeInTheDocument();
    expect(localStorage.getItem(PROCESS_STORAGE_KEY)).toBe(
      JSON.stringify(sampleProcesses),
    );
  });

  it('switches NFC modes and requires at least one device', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Create Process' }));
    await user.type(
      screen.getByRole('textbox', { name: /Process Name/ }),
      'Finishing',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Station Number/ }),
      '07',
    );
    await user.click(
      screen.getByRole('radio', { name: /^Device-level tracking/ }),
    );
    expect(
      screen.queryByRole('combobox', { name: /Process-level NFC Tag ID/ }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Save Process' }));
    expect(
      screen.getByRole('spinbutton', { name: 'Device count' }),
    ).toHaveAccessibleDescription(
      'Add at least one device when using device-level tracking.',
    );
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Add Device' }));
    expect(
      screen.getByRole('combobox', { name: /Device NFC Tag/ }),
    ).toHaveTextContent('Select a registered tag');
    expect(screen.getByRole('textbox', { name: /Device Name/ })).toBeVisible();
    expect(
      screen.getByRole('spinbutton', { name: 'Device count' }),
    ).toHaveValue(1);
    await user.click(screen.getByRole('button', { name: 'Remove device 1' }));
    expect(
      screen.queryByRole('textbox', { name: /Device Name/ }),
    ).not.toBeInTheDocument();
  });

  it('requires confirmation before deleting a process', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Delete Lot Preparation' }),
    );
    const dialog = screen.getByRole('dialog', { name: 'Delete process?' });
    expect(
      screen.getByRole('rowheader', { name: /Lot Preparation/, hidden: true }),
    ).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    expect(
      screen.queryByRole('rowheader', { name: /Lot Preparation/ }),
    ).not.toBeInTheDocument();
    expect(
      JSON.parse(localStorage.getItem(PROCESS_STORAGE_KEY) ?? '[]'),
    ).toHaveLength(1);
  });

  it('keeps the current records and edit form if saving fails', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Edit Lot Preparation' }),
    );
    const name = screen.getByRole('textbox', { name: /Process Name/ });
    await user.clear(name);
    await user.type(name, 'Updated name');
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    await user.click(screen.getByRole('button', { name: 'Save Process' }));

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes could not be saved',
    );
    expect(
      screen.getByRole('rowheader', { name: /Lot Preparation/ }),
    ).toBeVisible();
    expect(name).toHaveValue('Updated name');
  });
});
