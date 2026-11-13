import { screen, within } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { dashboardResponse } from '../../test/dashboard';
import { DashboardMetrics } from './DashboardMetrics';
import type { DashboardMetricsResponse } from './types';

it('displays every numeric backend metric as a dedicated card without deriving values from status counts', () => {
  const values = [
    ['totalLots', 'Total Lots', 101],
    ['openLots', 'Open Lots', 102],
    ['completedLots', 'Completed Lots', 103],
    ['stylesWithLots', 'Styles with Lots', 104],
    ['storedLots', 'Stored Lots', 105],
    ['availableTrolleys', 'Available Trolleys', 106],
    ['completedSharePercent', 'Completed share', 12.34],
    ['inTransitLots', 'In transit', 107],
    ['readyToStartLots', 'Ready to start', 108],
    ['totalStationLotVisits', 'Total station lot visits', 109],
    ['highestStationWorkloadCount', 'Highest station workload', 110],
  ] as const;
  const metrics: DashboardMetricsResponse = {
    ...dashboardResponse.metrics,
    ...Object.fromEntries(values.map(([key, , value]) => [key, value])),
  };
  renderWithProviders(
    <DashboardMetrics data={{ ...dashboardResponse, metrics, stations: [] }} />,
  );
  expect(screen.getAllByRole('region')).toHaveLength(11);
  for (const [, label, value] of values) {
    expect(
      within(screen.getByRole('region', { name: label })).getByText(
        value.toLocaleString(),
      ),
    ).toBeVisible();
  }
  expect(
    within(
      screen.getByRole('region', { name: 'Highest station workload' }),
    ).getByText('Washing'),
  ).toBeVisible();
});
