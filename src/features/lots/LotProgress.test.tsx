import { screen } from '@testing-library/react';
import { expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { LotProgress } from './LotProgress';

it.each([0, 33.33, 100])(
  'uses the backend percentage %s directly for progress',
  (percent) => {
    renderWithProviders(
      <LotProgress percent={percent} completed={1} total={3} />,
    );
    expect(
      screen.getByRole('progressbar', { name: 'Progress' }),
    ).toHaveAttribute('aria-valuenow', String(percent));
    expect(screen.getByText('1/3')).toBeVisible();
  },
);
