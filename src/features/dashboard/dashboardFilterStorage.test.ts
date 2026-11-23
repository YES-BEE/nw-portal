import { beforeEach, expect, it, vi } from 'vitest';
import {
  readDashboardFilters,
  saveDashboardFilters,
  dashboardFilterKey,
} from './dashboardFilterStorage';
import { emptyProductionFilters } from '../lots/productionFilterSelection';

beforeEach(() => sessionStorage.clear());
it('stores every selection and list query separately for each user', () => {
  const value = {
    selection: {
      ...emptyProductionFilters,
      styles: [
        { id: 's1', label: 'STYLE-01' },
        { id: 's2', label: 'STYLE-02' },
      ],
      lots: [
        { id: 'l1', label: 'LOT-01' },
        { id: 'l2', label: 'LOT-02' },
      ],
      stations: { id: 'st1', label: 'Washing' },
      processes: { id: 'p1', label: 'Wash' },
      status: 'IN_PROCESS',
    },
    query: { page: 2, size: 25, search: 'denim' },
  };
  saveDashboardFilters('user-1', value);
  expect(readDashboardFilters('user-1')).toEqual(value);
  expect(readDashboardFilters('user-2').selection).toEqual(
    emptyProductionFilters,
  );
});
it.each([
  'not-json',
  '{}',
  JSON.stringify({
    selection: emptyProductionFilters,
    query: { page: -1, size: 500, search: '' },
  }),
  JSON.stringify({
    selection: { ...emptyProductionFilters, styles: { label: 'missing-id' } },
    query: { page: 0, size: 10, search: '' },
  }),
])('ignores malformed saved preferences: %s', (raw) => {
  sessionStorage.setItem(dashboardFilterKey('user-1'), raw);
  expect(readDashboardFilters('user-1')).toEqual({
    selection: emptyProductionFilters,
    query: { page: 0, size: 10, search: '' },
  });
});
it('keeps storage failures from breaking filtering', () => {
  vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
    throw new Error('blocked');
  });
  expect(readDashboardFilters('user-1').selection).toEqual(
    emptyProductionFilters,
  );
  expect(() =>
    saveDashboardFilters('user-1', readDashboardFilters()),
  ).not.toThrow();
});
it('migrates previously saved single style and lot selections', () => {
  sessionStorage.setItem(
    dashboardFilterKey('user-1'),
    JSON.stringify({
      selection: {
        ...emptyProductionFilters,
        styles: { id: 's1', label: 'Style' },
        lots: { id: 'l1', label: 'Lot' },
      },
      query: { page: 0, size: 10, search: '' },
    }),
  );
  expect(readDashboardFilters('user-1').selection).toEqual({
    ...emptyProductionFilters,
    styles: [{ id: 's1', label: 'Style' }],
    lots: [{ id: 'l1', label: 'Lot' }],
  });
});

it('ignores a previously saved route scope while preserving the remaining filters', () => {
  sessionStorage.setItem(
    dashboardFilterKey('user-1'),
    JSON.stringify({
      selection: {
        ...emptyProductionFilters,
        status: 'IN_PROCESS',
        routeScope: 'ANY',
      },
      query: { page: 0, size: 10, search: '' },
    }),
  );
  expect(readDashboardFilters('user-1').selection).toEqual({
    ...emptyProductionFilters,
    status: 'IN_PROCESS',
  });
});
