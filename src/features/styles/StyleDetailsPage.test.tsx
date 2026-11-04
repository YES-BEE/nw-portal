import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { signIn } from '../auth/session';
import { sampleStyles, STYLE_STORAGE_KEY } from './styleData';
import type { StyleMode } from './styleData';
import { StyleDetailsPage } from './StyleDetailsPage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signIn('nw.admin', 'NW@2026demo');
});
function renderDetails(mode: StyleMode, id = 'sty-1') {
  const base = mode === 'own' ? '/new-style' : '/styles';
  return renderWithProviders(
    <MemoryRouter initialEntries={[`${base}/${id}`]}>
      <Routes>
        <Route
          path={`${base}/:styleId`}
          element={<StyleDetailsPage mode={mode} />}
        />
      </Routes>
    </MemoryRouter>,
  );
}

describe('shared style details', () => {
  it('shows read-only details with an ordered process/station table and a return link', () => {
    renderDetails('management');
    expect(
      screen.getByRole('heading', { level: 1, name: 'STY-1001' }),
    ).toHaveFocus();
    expect(screen.getByText('100 kg')).toBeVisible();
    expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    const rows = within(
      screen.getByRole('table', { name: 'Production Process Sequence' }),
    ).getAllByRole('row');
    expect(rows[1]).toHaveTextContent('Lot Preparation');
    expect(rows[1]).toHaveTextContent('01');
    expect(rows[2]).toHaveTextContent('Washing');
    expect(rows[2]).toHaveTextContent('03');
    expect(
      screen.getByRole('link', { name: 'Back to Styles' }),
    ).toHaveAttribute('href', '/styles');
    expect(localStorage.length).toBe(0);
  });

  it('does not expose another creator’s style through a guessed own-mode URL', () => {
    signIn('style.configurator', 'Style@2026demo');
    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify([
        { ...sampleStyles[0], createdBy: 'nw.admin', createdById: 'user-1' },
      ]),
    );
    renderDetails('own');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'not available to your account',
    );
    expect(screen.queryByText('STY-1001')).not.toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('allows creators to view their style and handles missing process references explicitly', () => {
    signIn('style.configurator', 'Style@2026demo');
    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify([
        { ...sampleStyles[0], createdById: 'user-7', steps: ['removed'] },
      ]),
    );
    renderDetails('own');
    expect(
      screen.getByRole('heading', { level: 1, name: 'STY-1001' }),
    ).toBeVisible();
    expect(screen.getByText('Unavailable process (removed)')).toBeVisible();
    expect(
      screen.getByRole('link', { name: 'Back to My Styles' }),
    ).toHaveAttribute('href', '/new-style');
  });

  it('paginates long production sequences without dropping or reordering steps', async () => {
    localStorage.setItem(
      STYLE_STORAGE_KEY,
      JSON.stringify([
        {
          ...sampleStyles[0],
          steps: Array.from({ length: 25 }, (_, index) =>
            index % 2 ? 'demo-2' : 'demo-1',
          ),
        },
      ]),
    );
    const user = userEvent.setup();
    renderDetails('management');
    const table = screen.getByRole('table', {
      name: 'Production Process Sequence',
    });
    expect(within(table).getAllByRole('rowheader')).toHaveLength(10);
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(within(table).getAllByRole('rowheader')[0]).toHaveTextContent('11');
    await user.click(screen.getByRole('button', { name: 'Go to next page' }));
    expect(within(table).getAllByRole('rowheader')).toHaveLength(5);
    expect(
      screen.getByRole('button', { name: 'Go to next page' }),
    ).toBeDisabled();
  });

  it('handles a missing style with a return link', () => {
    renderDetails('management', 'missing');
    expect(screen.getByRole('alert')).toHaveTextContent(
      'This style was not found',
    );
    expect(screen.getByRole('link', { name: 'Back to Styles' })).toBeVisible();
  });
});
