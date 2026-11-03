import { screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from './ConfigurationDetails';

describe('configuration details', () => {
  it('preserves field labels and values and shows a placeholder for missing optional data', () => {
    renderWithProviders(
      <ConfigurationDetails
        fields={[
          { label: 'Station', value: '0' },
          { label: 'Description', value: '' },
          { label: 'NFC Tag ID', value: '04:A1:B2' },
        ]}
      />,
    );
    expect(screen.getByText('Station')).toBeVisible();
    expect(screen.getByText('0')).toBeVisible();
    expect(screen.getByText('—')).toBeVisible();
    expect(screen.getByText('04:A1:B2')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
  });

  it('focuses the page heading for keyboard navigation and provides explicit return links', () => {
    renderWithProviders(
      <MemoryRouter>
        <ConfigurationDetailHeader
          title="Washing"
          listTitle="Process Configurations"
          listPath="/configurations/processes"
          backLabel="Back to Processes"
        />
      </MemoryRouter>,
    );
    expect(
      screen.getByRole('heading', { level: 1, name: 'Washing' }),
    ).toHaveFocus();
    expect(
      screen.getByRole('link', { name: 'Back to Processes' }),
    ).toHaveAttribute('href', '/configurations/processes');
    expect(
      screen.getByRole('link', { name: 'Process Configurations' }),
    ).toHaveAttribute('href', '/configurations/processes');
  });
});
