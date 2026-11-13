import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { StationWipBreakdown, StationStatusTable } from './DashboardBreakdowns';

it('displays station names and WIP counts directly without codes', () => {
  renderWithProviders(
    <StationWipBreakdown
      stations={[
        {
          id: 'hidden-id',
          code: '03',
          name: 'Washing',
          wip: 4,
          share_percent: 100,
        },
      ]}
    />,
  );
  expect(screen.getByText('Washing')).toBeVisible();
  expect(screen.getByText('4 lot visits')).toBeVisible();
  expect(screen.queryByText('03')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-id')).not.toBeInTheDocument();
});

const data = {
  stations: [
    { id: 's1', code: '01', name: 'Washing', wip: 4, share_percent: 66.67 },
    { id: 's2', code: '02', name: 'Drying', wip: 2, share_percent: 33.33 },
  ],
};
it('shows station names and shares of real visit counts without exposing codes or claiming utilization', () => {
  renderWithProviders(<StationStatusTable stations={data.stations} />);
  const table = screen.getByRole('table', { name: 'Station Status' });
  const row = within(table).getByText('Washing').closest('tr')!;
  expect(within(row).getByText('4')).toBeVisible();
  expect(within(row).getByText('66.67')).toBeVisible();
  expect(within(table).queryByText('01')).not.toBeInTheDocument();
  expect(within(table).queryByText(/utilization/i)).not.toBeInTheDocument();
});
it('preserves backend shares when the displayed station subset has a different local total', () => {
  renderWithProviders(
    <StationStatusTable
      stations={[{ ...data.stations[0], share_percent: 12.34 }]}
    />,
  );
  expect(screen.getByText('12.34')).toBeVisible();
  expect(screen.queryByText('100')).not.toBeInTheDocument();
});
