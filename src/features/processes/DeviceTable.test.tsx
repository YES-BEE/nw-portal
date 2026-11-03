import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { theme } from '../../app/theme';
import { DeviceTable } from './DeviceTable';
import type { DeviceConfiguration } from './types';

const devices: DeviceConfiguration[] = [
  { id: 'one', name: 'Washer 01', description: 'Heavy duty', tag: 'NFC-001' },
  {
    id: 'two',
    name: 'Dryer 02',
    description: 'Low temperature',
    tag: 'NFC-002',
  },
];

describe('device table', () => {
  it('shows an empty state with disabled pagination when no devices exist', () => {
    renderWithProviders(<DeviceTable devices={[]} />);
    expect(
      screen.getByText('No devices are associated with this process.'),
    ).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Go to previous page' }),
    ).toBeDisabled();
  });

  it('searches names and descriptions regardless of case and restores rows after clearing', async () => {
    const user = userEvent.setup();
    renderWithProviders(<DeviceTable devices={devices} />);
    const search = screen.getByRole('searchbox', { name: 'Search devices' });
    const table = screen.getByRole('table', { name: 'Devices' });
    await user.type(search, '  HEAVY  ');
    expect(
      within(table).getByRole('rowheader', { name: 'Washer 01' }),
    ).toBeVisible();
    expect(
      within(table).queryByRole('rowheader', { name: 'Dryer 02' }),
    ).not.toBeInTheDocument();
    await user.clear(search);
    await user.type(search, 'dRyEr');
    expect(
      within(table).getByRole('rowheader', { name: 'Dryer 02' }),
    ).toBeVisible();
    await user.clear(search);
    expect(within(table).getAllByRole('rowheader')).toHaveLength(2);
  });

  it('keeps pagination valid when the supplied device list shrinks', async () => {
    const user = userEvent.setup();
    const many = Array.from({ length: 12 }, (_, index) => ({
      ...devices[0],
      id: `device-${index}`,
      name: `Device ${index + 1}`,
    }));
    const { rerender } = renderWithProviders(<DeviceTable devices={many} />);
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(screen.getByRole('rowheader', { name: 'Device 11' })).toBeVisible();
    rerender(
      <ThemeProvider theme={theme}>
        <DeviceTable devices={devices} />
      </ThemeProvider>,
    );
    expect(screen.getByRole('rowheader', { name: 'Washer 01' })).toBeVisible();
    expect(
      screen.getByRole('button', { name: 'Go to previous page' }),
    ).toBeDisabled();
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeDisabled();
  });
});
