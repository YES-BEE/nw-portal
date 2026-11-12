import { screen } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import * as usersApi from './usersApi';
import { UserProcessSelect } from './UserProcessSelect';

it('disables an empty process dropdown and explains why below the field', async () => {
  vi.spyOn(usersApi, 'getUserProcessOptions').mockResolvedValue([]);
  renderWithProviders(
    <UserProcessSelect
      value={[]}
      onChange={vi.fn()}
      onReadyChange={vi.fn()}
      disabled={false}
    />,
  );
  expect(
    await screen.findByText('No active processes are available.'),
  ).toBeVisible();
  expect(screen.getByRole('combobox')).toHaveAttribute('aria-disabled', 'true');
  expect(screen.getByRole('combobox')).toHaveAccessibleDescription(
    'No active processes are available.',
  );
});
