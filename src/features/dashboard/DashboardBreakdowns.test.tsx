import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import {
  StatusBreakdown,
  StationWipBreakdown,
  StationStatusTable,
} from './DashboardBreakdowns';

const rows = [
  { status: 'READY', count: 2 },
  { status: 'IN_PROCESS', count: 3 },
];
it('shows exact status values in the original bar layout', () => {
  renderWithProviders(
    <StatusBreakdown
      title="Lots"
      hint="Status summary"
      rows={rows}
      label={(status) => status}
      empty="No lots"
    />,
  );
  expect(screen.getByText('READY')).toBeVisible();
  expect(screen.getByText('2')).toBeVisible();
  expect(screen.getByText('IN_PROCESS')).toBeVisible();
  expect(screen.getByText('3')).toBeVisible();
  expect(screen.getByRole('progressbar', { name: 'READY' })).toHaveAttribute(
    'aria-valuenow',
    '40',
  );
  expect(
    screen.getByRole('progressbar', { name: 'IN_PROCESS' }),
  ).toHaveAttribute('aria-valuenow', '60');
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
});
it('renders empty counts at zero and full counts at one hundred percent', () => {
  const { rerender } = renderWithProviders(
    <StatusBreakdown
      title="Lots"
      hint="Status summary"
      rows={[{ status: 'READY', count: 0 }]}
      label={(status) => status}
      empty="No lots"
    />,
  );
  expect(screen.getByRole('progressbar', { name: 'READY' })).toHaveAttribute(
    'aria-valuenow',
    '0',
  );
  rerender(
    <StatusBreakdown
      title="Lots"
      hint="Status summary"
      rows={[{ status: 'READY', count: 5 }]}
      label={(status) => status}
      empty="No lots"
    />,
  );
  expect(screen.getByRole('progressbar', { name: 'READY' })).toHaveAttribute(
    'aria-valuenow',
    '100',
  );
});
it('preserves mouse and keyboard status filtering', async () => {
  const onSelect = vi.fn();
  const { rerender } = renderWithProviders(
    <StatusBreakdown
      title="Lots"
      hint="Status summary"
      rows={rows}
      label={(status) => status}
      empty="No lots"
      onSelect={onSelect}
    />,
  );
  const user = userEvent.setup();
  await user.click(screen.getByRole('button', { name: 'IN_PROCESS: 3' }));
  expect(onSelect).toHaveBeenLastCalledWith('IN_PROCESS');
  rerender(
    <StatusBreakdown
      title="Lots"
      hint="Status summary"
      rows={rows}
      label={(status) => status}
      empty="No lots"
      onSelect={onSelect}
      selected="IN_PROCESS"
    />,
  );
  const button = screen.getByRole('button', { name: 'IN_PROCESS: 3' });
  expect(button).toHaveAttribute('aria-pressed', 'true');
  button.focus();
  await user.keyboard('{Enter}');
  expect(onSelect).toHaveBeenLastCalledWith('');
});
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
