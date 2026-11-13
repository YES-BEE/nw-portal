import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { dashboardResponse } from '../../test/dashboard';
import { DashboardMetrics } from './DashboardMetrics';
import type { DashboardMetricsResponse } from './types';

it('displays selected backend metrics and the peak station name without removed cards', () => {
  const values = [
    ['totalLots', 'Total Lots', 101],
    ['openLots', 'Open Lots', 102],
    ['completedLots', 'Completed Lots', 103],
    ['stylesWithLots', 'Styles', 104],
    ['storedLots', 'Stored Lots', 105],
    ['availableTrolleys', 'Available Trolleys', 106],
    ['inTransitLots', 'In Progress', 107],
    ['readyToStartLots', 'Ready to start', 108],
    ['highestStationWorkloadCount', 'Peak Station Workload', 110],
  ] as const;
  const metrics: DashboardMetricsResponse = {
    ...dashboardResponse.metrics,
    ...Object.fromEntries(values.map(([key, , value]) => [key, value])),
  };
  renderWithProviders(
    <DashboardMetrics data={{ ...dashboardResponse, metrics, stations: [] }} />,
  );
  expect(screen.getAllByRole('region')).toHaveLength(9);
  for (const [, label, value] of values) {
    expect(
      within(screen.getByRole('region', { name: label })).getByText(
        value.toLocaleString(),
      ),
    ).toBeVisible();
  }
  expect(
    screen.queryByRole('region', { name: 'Completed share' }),
  ).not.toBeInTheDocument();
  expect(
    screen.queryByRole('region', { name: 'Total station lot visits' }),
  ).not.toBeInTheDocument();
  expect(
    within(
      screen.getByRole('region', { name: 'Peak Station Workload' }),
    ).getByText('Washing'),
  ).toBeVisible();
});
