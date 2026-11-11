import { screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { DeviceTable } from './DeviceTable';

describe('device table', () => {
  it('shows an empty state when no devices are supplied', () => {
    renderWithProviders(<DeviceTable devices={[]} />);
    expect(
      screen.getByText('No machines are associated with this process.'),
    ).toBeVisible();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });
  it('displays every device returned with the process without local filtering or pagination', () => {
    const devices = Array.from({ length: 12 }, (_, index) => ({
      id: String(index),
      name: 'Device ' + index,
      description: '',
      tag: 'TAG-' + index,
    }));
    renderWithProviders(<DeviceTable devices={devices} />);
    expect(
      within(screen.getByRole('table', { name: 'Machines' })).getAllByRole(
        'rowheader',
      ),
    ).toHaveLength(12);
    expect(
      screen.queryByRole('button', { name: 'Go to next page' }),
    ).not.toBeInTheDocument();
  });
});
