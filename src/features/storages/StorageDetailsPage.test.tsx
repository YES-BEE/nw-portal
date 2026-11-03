import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configurationTheme } from '../../app/theme';
import { renderWithProviders } from '../../test/render';
import { StorageDetailsPage } from './StorageDetailsPage';
import { StorageConfigurationsPage } from './StorageConfigurationsPage';
import { STORAGE_STORAGE_KEY } from './storageData';

function setup(path = '/configurations/storages') {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <ThemeProvider theme={configurationTheme}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/configurations/storages/:storageId"
              element={<StorageDetailsPage />}
            />
            <Route
              path="/configurations/storages"
              element={<StorageConfigurationsPage />}
            />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    ),
  };
}

beforeEach(() => {
  localStorage.clear();
});

describe('storage details', () => {
  it('opens View as a read-only page and returns without writing records', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const { user } = setup();
    await user.click(screen.getByRole('link', { name: 'View storage ST-001' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'ST-001' }),
    ).toBeVisible();
    expect(screen.getByText('Intermediate storage bay A')).toBeVisible();
    expect(screen.getByText('NFC-STORE-001')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to Storages' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Storage Configurations' }),
    ).toBeVisible();
    expect(write).not.toHaveBeenCalled();
  });

  it('loads a saved storage from a direct detail URL', () => {
    localStorage.setItem(
      STORAGE_STORAGE_KEY,
      JSON.stringify([
        {
          id: 'saved',
          number: 'ST-009',
          description: 'New bay',
          tag: 'NFC-STORE-003',
        },
      ]),
    );
    setup('/configurations/storages/saved');
    expect(
      screen.getByRole('heading', { level: 1, name: 'ST-009' }),
    ).toBeVisible();
    expect(screen.getByText('New bay')).toBeVisible();
    expect(screen.getByText('NFC-STORE-003')).toBeVisible();
  });

  it('handles a missing or deleted storage', () => {
    setup('/configurations/storages/missing');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This configuration was not found.',
    );
    expect(
      screen.getByRole('link', { name: 'Back to Storages' }),
    ).toHaveAttribute('href', '/configurations/storages');
  });
});
