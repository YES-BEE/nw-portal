import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { configurationTheme } from '../../app/theme';
import {
  defaultTags,
  loadTags,
  TAG_STORAGE_KEY,
} from '../configurations/tagRegistry';
import { PROCESS_STORAGE_KEY, sampleProcesses } from '../processes/processData';
import { TagManagementPage } from './TagManagementPage';

function setup() {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <ThemeProvider theme={configurationTheme}>
        <MemoryRouter>
          <TagManagementPage />
        </MemoryRouter>
      </ThemeProvider>,
    ),
  };
}
beforeEach(() => {
  localStorage.clear();
});

describe('tag management', () => {
  it('shows linked assignments and prevents deletion of assigned tags', () => {
    setup();
    expect(
      screen.getByRole('link', { name: 'Process: Lot Preparation' }),
    ).toHaveAttribute('href', '/configurations/processes/demo-1');
    expect(
      screen.getByRole('link', { name: 'Device: Washer 01 (Washing)' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Storage: ST-001' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Delete tag Lot Preparation Tag' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Delete tag Finishing Line Tag' }),
    ).toBeEnabled();
  });

  it('registers a new tag and reloads it from browser storage', async () => {
    const { user, unmount } = setup();
    await user.click(screen.getByRole('button', { name: 'Add New Tag' }));
    await user.type(
      screen.getByRole('textbox', { name: /Tag Name/ }),
      ' New Factory Tag ',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
      ' 04:AA:BB:CC ',
    );
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(
      screen.getByRole('rowheader', { name: 'New Factory Tag' }),
    ).toBeVisible();
    unmount();
    setup();
    expect(
      screen.getByRole('rowheader', { name: 'New Factory Tag' }),
    ).toBeVisible();
    expect(screen.getByRole('cell', { name: '04:AA:BB:CC' })).toBeVisible();
  });

  it('allows renaming an assigned tag but keeps its NFC ID read-only', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Edit tag Lot Preparation Tag' }),
    );
    expect(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
    ).toHaveAttribute('readonly');
    const name = screen.getByRole('textbox', { name: /Tag Name/ });
    await user.clear(name);
    await user.type(name, 'Preparation Tracking Tag');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(
      screen.getByRole('rowheader', { name: 'Preparation Tracking Tag' }),
    ).toBeVisible();
    expect(
      loadTags().records.find((tag) => tag.id === defaultTags[0].id)?.actual,
    ).toBe('NFC-PROC-001');
  });

  it('validates required fields and case-insensitive name and ID uniqueness', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add New Tag' }));
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(
      screen.getByRole('textbox', { name: /Tag Name/ }),
    ).toHaveAccessibleDescription('Enter a tag name.');
    expect(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
    ).toHaveAccessibleDescription('Enter the actual NFC tag ID.');
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    const name = screen.getByRole('textbox', { name: /Tag Name/ });
    const actual = screen.getByRole('textbox', { name: /Actual NFC Tag ID/ });
    await user.type(name, 'lot preparation tag');
    await user.type(actual, 'NEW-ID');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(name).toHaveAccessibleDescription('Tag Name already exists.');
    await user.clear(name);
    await user.type(name, 'New tag');
    await user.clear(actual);
    await user.type(actual, 'nfc-proc-001');
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(actual).toHaveAccessibleDescription(
      'Actual NFC Tag ID already exists.',
    );
    expect(name).not.toHaveAttribute('aria-invalid', 'true');
  });

  it('deletes an unused tag after confirmation and persists the change', async () => {
    const { user, unmount } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Delete tag Finishing Line Tag' }),
    );
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete tag?' })).getByRole(
        'button',
        { name: 'Delete' },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(
      screen.queryByRole('rowheader', { name: 'Finishing Line Tag' }),
    ).not.toBeInTheDocument();
    unmount();
    setup();
    expect(
      screen.queryByRole('rowheader', { name: 'Finishing Line Tag' }),
    ).not.toBeInTheDocument();
  });

  it('rechecks assignment before deleting if a process claimed the tag after confirmation opened', async () => {
    const { user } = setup();
    await user.click(
      screen.getByRole('button', { name: 'Delete tag Finishing Line Tag' }),
    );
    localStorage.setItem(
      PROCESS_STORAGE_KEY,
      JSON.stringify([
        ...sampleProcesses,
        {
          ...sampleProcesses[0],
          id: 'new-process',
          processTag: 'NFC-PROC-002',
        },
      ]),
    );
    await user.click(
      within(screen.getByRole('dialog', { name: 'Delete tag?' })).getByRole(
        'button',
        { name: 'Delete' },
      ),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Unassign this tag before deleting it.',
    );
    expect(
      loadTags().records.some((tag) => tag.actual === 'NFC-PROC-002'),
    ).toBe(true);
    expect(localStorage.getItem(TAG_STORAGE_KEY)).toBeNull();
  });

  it('keeps the editor and registry if saving fails', async () => {
    const { user } = setup();
    await user.click(screen.getByRole('button', { name: 'Add New Tag' }));
    await user.type(
      screen.getByRole('textbox', { name: /Tag Name/ }),
      'New tag',
    );
    await user.type(
      screen.getByRole('textbox', { name: /Actual NFC Tag ID/ }),
      'NEW-ID',
    );
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota exceeded');
    });
    await user.click(screen.getByRole('button', { name: 'Save Tag' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes could not be saved',
    );
    expect(screen.getByRole('textbox', { name: /Tag Name/ })).toHaveValue(
      'New tag',
    );
    expect(localStorage.getItem(TAG_STORAGE_KEY)).toBeNull();
  });

  it('paginates and searches the registry without losing matches on later pages', async () => {
    localStorage.setItem(
      TAG_STORAGE_KEY,
      JSON.stringify(
        Array.from({ length: 30 }, (_, index) => ({
          id: `tag-${index}`,
          name: `Factory Tag ${index + 1}`,
          actual: `TAG-${index + 1}`,
        })),
      ),
    );
    const { user } = setup();
    const table = screen.getByRole('table', { name: 'Existing Tags' });
    expect(within(table).getAllByRole('row')).toHaveLength(11);
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(
      within(table).getByRole('rowheader', { name: 'Factory Tag 11' }),
    ).toBeVisible();
    await user.type(
      screen.getByRole('searchbox', { name: 'Search tags' }),
      'Factory Tag 30',
    );
    expect(
      within(table).getByRole('rowheader', { name: 'Factory Tag 30' }),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeDisabled();
  });
});
