import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { ThemeProvider } from '@mui/material';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { configurationTheme } from '../../app/theme';
import { renderWithProviders } from '../../test/render';
import { ProcessDetailsPage } from './ProcessDetailsPage';
import { ProcessConfigurationsPage } from './ProcessConfigurationsPage';
import { PROCESS_STORAGE_KEY, sampleProcesses } from './processData';

function setup(path = '/configurations/processes/demo-1') {
  return {
    user: userEvent.setup(),
    ...renderWithProviders(
      <ThemeProvider theme={configurationTheme}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route
              path="/configurations/processes/:processId"
              element={<ProcessDetailsPage />}
            />
            <Route
              path="/configurations/processes"
              element={<ProcessConfigurationsPage />}
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

describe('process details', () => {
  it('opens from View as a read-only page and returns to the process list', async () => {
    const write = vi.spyOn(Storage.prototype, 'setItem');
    const { user } = setup('/configurations/processes');
    await user.click(
      screen.getByRole('link', { name: 'View Lot Preparation' }),
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Lot Preparation' }),
    ).toBeVisible();
    expect(screen.getByText('NFC-PROC-001')).toBeVisible();
    expect(screen.getByText('01')).toBeVisible();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: 'Save Process' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('link', { name: 'Back to Processes' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Process Configurations' }),
    ).toBeVisible();
    expect(write).not.toHaveBeenCalled();
  });

  it('shows device names, descriptions, and tags when opened directly', () => {
    setup('/configurations/processes/demo-2');
    const devices = screen.getByRole('table', { name: 'Devices' });
    for (const value of [
      'Washer 01',
      'Washer 02',
      'NFC-DEV-001',
      'NFC-DEV-002',
      'Main washing machine',
      'Secondary washing machine',
    ]) {
      expect(within(devices).getByText(value)).toBeVisible();
    }
    expect(screen.getByText('Device-level tracking')).toBeVisible();
  });

  it('paginates a large device list and resets the page when searching', async () => {
    const record = {
      ...sampleProcesses[1],
      id: 'large',
      name: 'Production Line',
      devices: Array.from({ length: 125 }, (_, index) => ({
        id: `device-${index}`,
        name: `Device ${index + 1}`,
        description: `Machine ${index + 1}`,
        tag: `TAG-${index + 1}`,
      })),
    };
    localStorage.setItem(PROCESS_STORAGE_KEY, JSON.stringify([record]));
    const { user } = setup('/configurations/processes/large');
    const devices = screen.getByRole('table', { name: 'Devices' });
    expect(within(devices).getAllByRole('row')).toHaveLength(11);
    expect(
      within(devices).getByRole('rowheader', { name: 'Device 10' }),
    ).toBeVisible();
    expect(
      within(devices).queryByRole('rowheader', { name: 'Device 11' }),
    ).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(
      within(devices).getByRole('rowheader', { name: 'Device 11' }),
    ).toBeVisible();
    await user.click(screen.getByRole('combobox', { name: /Rows per page/ }));
    await user.click(screen.getByRole('option', { name: '25' }));
    expect(within(devices).getAllByRole('row')).toHaveLength(26);
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search devices' }),
      'TAG-125',
    );
    expect(
      within(devices).getByRole('rowheader', { name: 'Device 125' }),
    ).toBeVisible();
    expect(within(devices).getAllByRole('row')).toHaveLength(2);
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Go to previous page' }),
    ).toBeDisabled();
    await user.clear(screen.getByRole('searchbox', { name: 'Search devices' }));
    await user.type(
      screen.getByRole('searchbox', { name: 'Search devices' }),
      'no matching device',
    );
    expect(screen.getByText('No devices match your search.')).toBeVisible();
  });

  it('handles a missing or deleted process with a working return link', async () => {
    const { user } = setup('/configurations/processes/missing');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This configuration was not found.',
    );
    await user.click(screen.getByRole('link', { name: 'Back to Processes' }));
    expect(
      screen.getByRole('heading', { level: 1, name: 'Process Configurations' }),
    ).toBeVisible();
  });
});
