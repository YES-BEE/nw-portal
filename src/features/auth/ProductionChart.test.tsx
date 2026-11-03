import { screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { ProductionChart } from './ProductionChart';

describe('decorative production illustration', () => {
  it('does not announce illustrative chart data to screen-reader users', () => {
    const { container } = renderWithProviders(<ProductionChart />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
    expect(container.querySelector('img')).toHaveAttribute(
      'aria-hidden',
      'true',
    );
  });
});
