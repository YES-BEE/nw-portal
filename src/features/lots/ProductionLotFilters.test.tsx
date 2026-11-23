import { fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import type { FilterOptionsLoader } from '../../api/productionFilters';
import { renderWithProviders } from '../../test/render';
import { FilterPicker, ProductionLotFilters } from './ProductionLotFilters';
import { emptyProductionFilters } from './productionFilterSelection';

beforeEach(() => vi.stubEnv('VITE_FILTER_OPTIONS_PAGE_SIZE', '10'));
afterEach(() => vi.unstubAllEnvs());

it.each(['styles', 'lots'] as const)(
  'loads %s with the button, stops at the last page, and resets for search',
  async (kind) => {
    const user = userEvent.setup();
    const loadOptions = vi.fn<FilterOptionsLoader>(async (_, query) => ({
      items: Array.from({ length: query.page === 0 ? 10 : 1 }, (_, index) => ({
        id: `${query.search}-${query.page}-${index}`,
        ...(kind === 'lots'
          ? {
              lot_number: `${query.search || 'STYLE'}-${query.page}-${index}`,
              style_id: 'style',
              style_number: 'STYLE',
            }
          : {
              style_number: `${query.search || 'STYLE'}-${query.page}-${index}`,
            }),
      })),
      page: query.page,
      size: query.size,
      totalElements: 11,
    }));
    renderWithProviders(
      <ProductionLotFilters
        value={emptyProductionFilters}
        onChange={vi.fn()}
        loadOptions={loadOptions}
        failure={() => ({ kind: 'network', action: 'retry' })}
      />,
    );
    const input = screen.getAllByRole('combobox')[kind === 'styles' ? 0 : 1];
    fireEvent.mouseDown(input);
    await screen.findByRole('option', {
      name: kind === 'lots' ? 'STYLE-0-0 / STYLE' : 'STYLE-0-0',
    });
    expect(loadOptions).toHaveBeenCalledTimes(1);
    const list = screen.getByRole('listbox');
    fireEvent.scroll(list);
    expect(loadOptions).toHaveBeenCalledTimes(1);
    const loadMore = screen.getByRole('button', { name: 'Load more' });
    fireEvent.mouseDown(loadMore);
    fireEvent.click(loadMore);
    fireEvent.click(loadMore);
    await screen.findByRole('option', {
      name: kind === 'lots' ? 'STYLE-1-0 / STYLE' : 'STYLE-1-0',
    });
    expect(screen.getAllByRole('option')).toHaveLength(11);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
    fireEvent.scroll(list);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    await user.type(input, 'NEW');
    await waitFor(() =>
      expect(loadOptions.mock.calls.at(-1)?.[1]).toMatchObject({
        page: 0,
        search: 'NEW',
      }),
    );
    await screen.findByRole('option', {
      name: kind === 'lots' ? 'NEW-0-0 / STYLE' : 'NEW-0-0',
    });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(10));
    expect(loadOptions.mock.calls[2][1]).toMatchObject({
      page: 0,
      search: 'NEW',
    });
  },
);

it.each([1, 2])(
  'prefills only unique station and process options (count %s)',
  async (count) => {
    const onChange = vi.fn();
    const loadOptions = vi.fn<FilterOptionsLoader>(async (kind, query) => ({
      items: Array.from({ length: count }, (_, index) => ({
        id: `${kind}-${index}`,
        code: `${kind}-${index}`,
        name: `${kind} ${index}`,
      })),
      page: query.page,
      size: query.size,
      totalElements: count,
    }));
    renderWithProviders(
      <ProductionLotFilters
        value={{
          ...emptyProductionFilters,
          styles: [{ id: 'style', label: 'Style' }],
          lots: [{ id: 'lot', label: 'Lot' }],
        }}
        onChange={onChange}
        loadOptions={loadOptions}
        failure={() => ({ kind: 'network', action: 'retry' })}
      />,
    );
    await waitFor(() => expect(loadOptions).toHaveBeenCalledTimes(2));
    if (count === 1) {
      await waitFor(() =>
        expect(onChange).toHaveBeenCalledWith(
          expect.objectContaining({
            stations: { id: 'stations-0', label: 'stations 0' },
            processes: { id: 'processes-0', label: 'processes 0' },
          }),
        ),
      );
      expect(loadOptions.mock.calls[1][1]).toMatchObject({
        styleIds: ['style'],
        lotIds: ['lot'],
        stationId: 'stations-0',
      });
    } else {
      expect(onChange).not.toHaveBeenCalled();
    }
  },
);

it.each(['styles', 'lots'] as const)(
  'limits %s selections to 100 and allows removal',
  async (kind) => {
    const choices = Array.from({ length: 100 }, (_, index) => ({
      id: `selected-${index}`,
      label: `Selected ${index}`,
    }));
    const onChange = vi.fn();
    const user = userEvent.setup();
    renderWithProviders(
      <FilterPicker
        kind={kind}
        value={choices}
        filters={{}}
        onChange={onChange}
        loadOptions={async (_, query) => ({
          items: ['new', 'selected-0'].map((id) => ({
            id,
            style_number: id,
            ...(kind === 'lots' ? { lot_number: id, style_id: 'style' } : {}),
          })),
          page: query.page,
          size: query.size,
          totalElements: 2,
        })}
        failure={() => ({ kind: 'network', action: 'retry' })}
      />,
    );
    await user.click(screen.getByRole('combobox'));
    const name = (id: string) => (kind === 'lots' ? `${id} / ${id}` : id);
    expect(
      await screen.findByRole('option', { name: name('new') }),
    ).toHaveAttribute('aria-disabled', 'true');
    await user.click(screen.getByRole('option', { name: name('selected-0') }));
    expect(onChange.mock.calls[0][0]).toHaveLength(99);
  },
);

it('retries a failed next page while retaining already loaded options', async () => {
  const rows = Array.from({ length: 11 }, (_, index) => ({
    id: String(index),
    style_number: `STYLE-${index}`,
  }));
  let failPage = true;
  const loadOptions = vi.fn<FilterOptionsLoader>(async (_, query) => {
    if (query.page === 1 && failPage) throw new Error('Offline');
    return {
      items: rows.slice(query.page * query.size, (query.page + 1) * query.size),
      page: query.page,
      size: query.size,
      totalElements: rows.length,
    };
  });
  const user = userEvent.setup();
  renderWithProviders(
    <FilterPicker
      kind="styles"
      value={[]}
      filters={{}}
      onChange={() => {}}
      loadOptions={loadOptions}
      failure={() => ({ kind: 'network', action: 'retry' })}
    />,
  );
  await user.click(screen.getByRole('combobox'));
  await user.click(await screen.findByRole('button', { name: 'Load more' }));
  await screen.findByRole('button', { name: 'Try again' });
  expect(screen.getAllByRole('option')).toHaveLength(10);
  failPage = false;
  await user.click(screen.getByRole('button', { name: 'Try again' }));
  await screen.findByRole('option', { name: 'STYLE-10' });
  expect(screen.getAllByRole('option')).toHaveLength(11);
  expect(
    loadOptions.mock.calls.filter(([, query]) => query.page === 0),
  ).toHaveLength(1);
});
