import { render, screen, waitFor } from '@testing-library/react';
import { ThemeProvider } from '@mui/material';
import { expect, it, vi } from 'vitest';
import { getInstanceByDom } from 'echarts/core';
import { theme } from '../../app/theme';
import { dashboardResponse } from '../../test/dashboard';
import { DashboardProductionTrend } from './DashboardProductionTrend';

it('renders the React ECharts series from backend counts without a data table', async () => {
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    measureText: (text: string) => ({ width: text.length * 7 }),
  } as CanvasRenderingContext2D);
  vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(800);
  vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(290);
  const trend = dashboardResponse.productionTrend;
  const { container, rerender } = render(
    <DashboardProductionTrend trend={trend} />,
    {
      wrapper: ({ children }) => (
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      ),
    },
  );
  expect(
    screen.getByRole('heading', {
      name: "Today's Production Trend",
    }),
  ).toBeVisible();
  expect(screen.getByText(/Times shown in Asia\/Kolkata/)).toBeVisible();
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('Production trend data')).not.toBeInTheDocument();
  const chart = container.querySelector<HTMLElement>('.echarts-for-react')!;
  await waitFor(() =>
    expect(getInstanceByDom(chart)?.getOption().series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'completed',
          data: trend.points.map((point) => point.completed),
        }),
        expect.objectContaining({
          id: 'in_progress',
          data: trend.points.map((point) => point.in_progress),
        }),
      ]),
    ),
  );
  expect(chart.querySelector('svg')).not.toBeNull();
  expect(getInstanceByDom(chart)?.getOption().xAxis).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        data: trend.points.map(
          (_, index) => `${String(index).padStart(2, '0')}:00`,
        ),
      }),
    ]),
  );
  const updated = {
    ...trend,
    points: trend.points.map((point) => ({
      ...point,
      completed: 20,
      in_progress: 30,
    })),
  };
  rerender(<DashboardProductionTrend trend={updated} />);
  await waitFor(() =>
    expect(getInstanceByDom(chart)?.getOption().series).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: 'completed',
          data: updated.points.map((point) => point.completed),
        }),
      ]),
    ),
  );
});
