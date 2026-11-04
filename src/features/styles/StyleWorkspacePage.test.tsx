import { fireEvent, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { signIn } from '../auth/session';
import { loadStyles, sampleStyles, STYLE_STORAGE_KEY } from './styleData';
import { StyleWorkspacePage } from './StyleWorkspacePage';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  signIn('nw.admin', 'NW@2026demo');
});

describe('shared style workspace', () => {
  it('shows reference styles with detail links, searches client/number/description and cancels edits', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <StyleWorkspacePage mode="management" />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'View STY-1001' })).toHaveAttribute(
      'href',
      '/styles/sty-1',
    );
    expect(screen.getByText('2 processes')).toBeVisible();
    const search = screen.getByRole('searchbox', { name: 'Search styles' });
    await user.type(search, ' DENIM ');
    expect(screen.getByRole('rowheader', { name: 'STY-1001' })).toBeVisible();
    await user.clear(search);
    await user.type(search, 'nothing');
    expect(screen.getByText('No styles found.')).toBeVisible();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: 'Edit STY-1001' }));
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeNull();
    expect(
      screen.getByRole('table', { name: 'Existing Styles' }),
    ).toBeVisible();
  });

  it('updates an existing style and keeps the production sequence intact', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <StyleWorkspacePage mode="management" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit STY-1001' }));
    const client = screen.getByRole('textbox', { name: /Client/ });
    await user.clear(client);
    await user.paste('Updated Fabric Client');
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(screen.getByText('Updated Fabric Client')).toBeVisible();
    expect(loadStyles().records[0].steps).toEqual(['demo-1', 'demo-2']);
  });

  it('requires delete confirmation and preserves an intentionally empty style registry', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <StyleWorkspacePage mode="management" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Delete STY-1001' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Cancel',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(localStorage.getItem(STYLE_STORAGE_KEY)).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete STY-1001' }));
    await user.click(
      within(screen.getByRole('dialog')).getByRole('button', {
        name: 'Delete',
      }),
    );
    await waitFor(() =>
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument(),
    );
    expect(loadStyles().records).toEqual([]);
    expect(screen.getByText('No styles found.')).toBeVisible();
  });

  it('creates an owned style from New Style and offers only read-only access afterward', async () => {
    signIn('style.configurator', 'Style@2026demo');
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <StyleWorkspacePage mode="own" />
      </MemoryRouter>,
    );
    expect(screen.queryByText('STY-1001')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'New Style' }));
    await user.type(
      screen.getByRole('textbox', { name: /Style Number/ }),
      'OWN-001',
    );
    fireEvent.change(screen.getByLabelText(/Date of Creation/), {
      target: { value: '2026-11-01' },
    });
    await user.type(
      screen.getByRole('textbox', { name: /Client/ }),
      'Client B',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: /Number of Garments/ }),
      '200',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: /Number of Lots/ }),
      '2',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: /Weight per Lot/ }),
      '50',
    );
    await user.type(
      screen.getByRole('spinbutton', { name: /Average Garment Weight/ }),
      '0.5',
    );
    fireEvent.change(screen.getByLabelText(/Delivery Date/), {
      target: { value: '2026-12-01' },
    });
    await user.click(screen.getByRole('button', { name: 'Add Process' }));
    await user.click(screen.getByRole('combobox', { name: /Process/ }));
    await user.click(screen.getByRole('option', { name: 'Washing' }));
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(screen.getByRole('rowheader', { name: 'OWN-001' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'View OWN-001' })).toHaveAttribute(
      'href',
      expect.stringMatching(/^\/new-style\//),
    );
    expect(
      screen.queryByRole('button', { name: /^Edit / }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', { name: /^Delete / }),
    ).not.toBeInTheDocument();
    expect(loadStyles().records[0]).toMatchObject({
      createdBy: 'style.configurator',
      createdById: 'user-7',
      avg: 0.5,
      steps: ['demo-2'],
    });
    expect(loadStyles().records).toHaveLength(2);
  }, 15000);

  it('keeps edits intact after a failed write', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <MemoryRouter>
        <StyleWorkspacePage mode="management" />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole('button', { name: 'Edit STY-1001' }));
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('Quota');
    });
    await user.click(screen.getByRole('button', { name: 'Save Style' }));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Changes could not be saved',
    );
    expect(screen.getByRole('textbox', { name: /Style Number/ })).toHaveValue(
      'STY-1001',
    );
    expect(loadStyles().records).toEqual(sampleStyles);
  });
});
