import { fireEvent, screen, waitFor } from '@testing-library/react';
import { expect, it, vi } from 'vitest';
import type { FilterOptionsLoader } from '../../api/productionFilters';
import { renderWithProviders } from '../../test/render';
import { ProductionLotFilters } from './ProductionLotFilters';
import { emptyProductionFilters } from './productionFilterSelection';

it.each(['styles', 'lots'] as const)(
  'loads %s with the button, stops at the last page, and resets for search',
  async (kind) => {
    const loadOptions = vi.fn<FilterOptionsLoader>(async (_, query) => ({
      items: Array.from({ length: query.page === 0 ? 20 : 1 }, (_, index) => ({
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
      totalElements: 21,
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
    expect(screen.getAllByRole('option')).toHaveLength(21);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    expect(
      screen.queryByRole('button', { name: 'Load more' }),
    ).not.toBeInTheDocument();
    fireEvent.scroll(list);
    expect(loadOptions).toHaveBeenCalledTimes(2);
    fireEvent.change(input, { target: { value: 'NEW' } });
    await screen.findByRole('option', {
      name: kind === 'lots' ? 'NEW-0-0 / STYLE' : 'NEW-0-0',
    });
    await waitFor(() => expect(screen.getAllByRole('option')).toHaveLength(20));
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
          styles: { id: 'style', label: 'Style' },
          lots: { id: 'lot', label: 'Lot' },
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
        styleId: 'style',
        lotId: 'lot',
        stationId: 'stations-0',
      });
    } else {
      expect(onChange).not.toHaveBeenCalled();
    }
  },
);
