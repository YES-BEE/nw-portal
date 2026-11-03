import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../test/render';
import { ConfigurationLayout } from './ConfigurationLayout';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('persistent desktop navigation', () => {
  it('keeps Logout in the sidebar when the configuration submenu is collapsed', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const sidebar = document.getElementById('configuration-navigation')!;
    expect(
      within(sidebar).getByRole('button', { name: 'Logout' }),
    ).toBeVisible();
    await user.click(
      within(sidebar).getByRole('button', { name: 'Configurations' }),
    );
    expect(
      within(sidebar).getByRole('button', { name: 'Logout' }),
    ).toBeVisible();
    expect(
      screen.queryByRole('button', { name: 'Account menu' }),
    ).not.toBeInTheDocument();
  });

  it('opens by default and releases workspace space when closed, then reopens', async () => {
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
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter initialEntries={['/configurations/processes']}>
        <ConfigurationLayout />
      </MemoryRouter>,
    );

    const main = screen.getByRole('main');
    const header = screen.getByRole('banner');
    expect(
      within(header).getByText('Process Control & Production Intelligence'),
    ).toBeVisible();
    const drawer = document.getElementById('configuration-navigation')!;
    expect(drawer).toHaveStyle({
      position: 'fixed',
      top: '0px',
      height: '100%',
    });
    const drawerToolbar = drawer?.querySelector('.MuiToolbar-root');
    const appBarToolbar = header.querySelector('.MuiToolbar-root');
    expect(drawerToolbar).toHaveStyle({ minHeight: '68px', flexShrink: '0' });
    expect(appBarToolbar).toHaveStyle({ minHeight: '68px' });
    expect(header).toHaveStyle({
      width: 'calc(100% - 242px)',
      marginLeft: '242px',
    });
    const toggle = within(drawer).getByRole('button', {
      name: 'Close navigation menu',
    });
    expect(
      within(header).queryByRole('button', { name: 'Close navigation menu' }),
    ).not.toBeInTheDocument();
    expect(
      within(header).queryByRole('button', { name: 'Open navigation menu' }),
    ).not.toBeInTheDocument();
    expect(toggle).toHaveAttribute('aria-expanded', 'true');
    expect(
      screen.getByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    expect(main).toHaveStyle({ marginLeft: '0px' });

    await user.click(toggle);

    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toHaveAttribute('aria-expanded', 'false');
    expect(main).toHaveStyle({ marginLeft: '-242px' });
    expect(header).toHaveStyle({ width: '100%', marginLeft: '0px' });
    expect(
      within(header).getByRole('button', { name: 'Open navigation menu' }),
    ).toHaveFocus();
    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Main navigation' }),
      ).not.toBeInTheDocument(),
    );

    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    expect(
      screen.getByRole('button', { name: 'Close navigation menu' }),
    ).toHaveAttribute('aria-expanded', 'true');
    expect(
      await screen.findByRole('navigation', { name: 'Main navigation' }),
    ).toBeVisible();
    expect(main).toHaveStyle({ marginLeft: '0px' });
    expect(header).toHaveStyle({
      width: 'calc(100% - 242px)',
      marginLeft: '242px',
    });
  });

  it('closes the mobile drawer using the chevron inside its toolbar', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <ConfigurationLayout />
      </MemoryRouter>,
    );
    await user.click(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    );
    const drawer = document.getElementById('configuration-navigation')!;
    await user.click(
      within(drawer).getByRole('button', { name: 'Close navigation menu' }),
    );

    await waitFor(() =>
      expect(
        screen.queryByRole('navigation', { name: 'Main navigation' }),
      ).not.toBeInTheDocument(),
    );
    expect(
      screen.getByRole('button', { name: 'Open navigation menu' }),
    ).toBeVisible();
  });
});
