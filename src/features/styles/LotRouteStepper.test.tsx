import { screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { sampleProcesses } from '../processes/processData';
import { LotRouteStepper } from './LotRouteStepper';

afterEach(() => vi.unstubAllGlobals());

describe('lot route stepper', () => {
  it('shows numbered process and station labels in saved order without claiming completion', () => {
    const { container } = renderWithProviders(
      <LotRouteStepper
        processIds={['demo-2', 'demo-1', 'demo-2']}
        processes={sampleProcesses}
        lots={20}
      />,
    );
    const route = screen.getByRole('list', { name: 'Lot Route' });
    const steps = within(route).getAllByRole('listitem');
    expect(steps.map((step) => step.getAttribute('aria-label'))).toEqual([
      'Step 1: Washing',
      'Step 2: Lot Preparation',
      'Step 3: Washing',
    ]);
    expect(within(steps[0]).getByText('Station 03')).toBeVisible();
    expect(route).toHaveClass('MuiStepper-vertical');
    expect(container.querySelector('.Mui-completed')).not.toBeInTheDocument();
    expect(
      container.querySelector('[aria-current="step"]'),
    ).not.toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('uses a horizontal connected route on wide screens', () => {
    vi.stubGlobal('matchMedia', (query: string) => ({
      matches: query.includes('min-width:900px'),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }));
    renderWithProviders(
      <LotRouteStepper
        processIds={['demo-1', 'demo-2']}
        processes={sampleProcesses}
        lots={1}
      />,
    );
    expect(screen.getByRole('list', { name: 'Lot Route' })).toHaveClass(
      'MuiStepper-horizontal',
    );
    expect(
      screen.getByText('The lot follows this route in the order shown.'),
    ).toBeVisible();
    expect(
      screen.getByRole('region', { name: 'Ordered lot process route' }),
    ).toHaveAttribute('tabindex', '0');
  });

  it('keeps missing processes in their original positions with explicit unavailable labels', () => {
    renderWithProviders(
      <LotRouteStepper
        processIds={['demo-1', 'removed', 'demo-2']}
        processes={sampleProcesses}
        lots={2}
      />,
    );
    const steps = within(
      screen.getByRole('list', { name: 'Lot Route' }),
    ).getAllByRole('listitem');
    expect(steps).toHaveLength(3);
    expect(steps[1]).toHaveAccessibleName(
      'Step 2: Unavailable process (removed)',
    );
    expect(steps[2]).toHaveAccessibleName('Step 3: Washing');
  });
});
