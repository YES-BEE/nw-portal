import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { DashboardInsights } from './DashboardInsights';
import { StationStatusTable } from './DashboardBreakdowns';
import type { DashboardSummary } from './types';

const data: DashboardSummary = {
  lots: [
    { status: 'READY', count: 2 },
    { status: 'DISPATCHED', count: 1 },
    { status: 'COMPLETED', count: 2 },
    { status: 'IN_PROCESS', count: 4 },
  ],
  styles: [{ status: 'IN_PRODUCTION', count: 1 }],
  stations: [
    { id: 's1', code: '01', name: 'Washing', wip: 4 },
    { id: 's2', code: '02', name: 'Drying', wip: 2 },
  ],
  storageOccupancies: 0,
  availableTrolleys: 3,
};
it('derives insights from the full backend summary rather than the current lot page', () => {
  renderWithProviders(<DashboardInsights data={data} />);
  const panel = screen.getByRole('region', { name: 'Quick Insights' });
  expect(within(panel).getByText('22')).toBeVisible();
  expect(within(panel).getByText('1')).toBeVisible();
  expect(within(panel).getByText('2')).toBeVisible();
  expect(within(panel).getByText('4')).toBeVisible();
  expect(within(panel).getByText('Washing')).toBeVisible();
  expect(
    within(panel).queryByText(/delayed|previous day|waiting time/i),
  ).not.toBeInTheDocument();
});
it('keeps empty insight values at zero without inventing a busiest station', () => {
  renderWithProviders(
    <DashboardInsights data={{ ...data, lots: [], stations: [] }} />,
  );
  expect(screen.getByText('No station lot visits in progress.')).toBeVisible();
  expect(screen.getAllByText('0')).toHaveLength(4);
});
it('shows station names and shares of real visit counts without exposing codes or claiming utilization', () => {
  renderWithProviders(<StationStatusTable stations={data.stations} />);
  const table = screen.getByRole('table', { name: 'Station Status' });
  const row = within(table).getByText('Washing').closest('tr')!;
  expect(within(row).getByText('4')).toBeVisible();
  expect(within(row).getByText('67')).toBeVisible();
  expect(within(table).queryByText('01')).not.toBeInTheDocument();
  expect(within(table).queryByText(/utilization/i)).not.toBeInTheDocument();
});
