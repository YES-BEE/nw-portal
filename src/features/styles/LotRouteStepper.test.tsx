import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { sampleProcesses } from '../processes/processData';
import { LotRouteStepper } from './LotRouteStepper';

afterEach(() => vi.unstubAllGlobals());

describe('lot route stepper', () => {
  it('shows stations above check circles and process names in saved order', () => {
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
    expect(within(steps[0]).getByTestId('CheckIcon')).toBeInTheDocument();
    expect(
      container.querySelector('.MuiStepIcon-text'),
    ).not.toBeInTheDocument();
    expect(
      within(steps[0])
        .getByText('Station 03')
        .compareDocumentPosition(within(steps[0]).getByTestId('CheckIcon')) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(route).toHaveClass('MuiStepper-vertical');
    expect(container.querySelector('.Mui-completed')).not.toBeInTheDocument();
    expect(
      container.querySelector('[aria-current="step"]'),
    ).not.toBeInTheDocument();
    expect(within(route).getAllByRole('button')).toHaveLength(3);
  });

  it('shows the process description when hovering over its info icon', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <LotRouteStepper
        processIds={['demo-2']}
        processes={sampleProcesses}
        lots={1}
      />,
    );
    await user.hover(
      screen.getByRole('button', { name: 'Description for Washing' }),
    );
    expect(await screen.findByRole('tooltip')).toHaveTextContent(
      'Industrial washing process',
    );
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
