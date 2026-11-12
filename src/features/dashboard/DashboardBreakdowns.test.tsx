import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { StatusBreakdown, StationWipBreakdown } from './DashboardBreakdowns';

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
  expect(screen.queryByRole('button')).not.toBeInTheDocument();
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
      stations={[{ id: 'hidden-id', code: '03', name: 'Washing', wip: 4 }]}
    />,
  );
  expect(screen.getByText('Washing')).toBeVisible();
  expect(screen.getByText('4 lot visits')).toBeVisible();
  expect(screen.queryByText('03')).not.toBeInTheDocument();
  expect(screen.queryByText('hidden-id')).not.toBeInTheDocument();
});
