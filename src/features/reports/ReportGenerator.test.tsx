import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';
import { renderWithProviders } from '../../test/render';
import { apiClient } from '../../api/client';
import { ReportsPage } from './ReportsPage';
import { exportReport, getReportCatalog } from './reportsApi';
import type { ReportCategory } from './types';
import type { ListQuery } from '../../api/collections';

const report: ReportCategory = {
  id: '00000000-0000-0000-0000-000000000001',
  key: 'daily-production-summary',
  name: 'Daily production summary',
  description: 'Production totals by day.',
  displayOrder: 1,
  formats: ['pdf', 'xlsx'],
  filters: ['styleId', 'lotId', 'stationId', 'processId', 'status'],
  requiredParameters: ['from', 'to', 'format'],
};
beforeEach(() => vi.restoreAllMocks());

async function enterDate(
  user: ReturnType<typeof userEvent.setup>,
  label: string,
  date: string,
) {
  const [year, month, day] = date.split('-');
  for (const [section, value] of [
    ['Year', year],
    ['Month', month],
    ['Day', day],
  ]) {
    await user.click(
      within(screen.getByRole('group', { name: new RegExp(label) })).getByRole(
        'spinbutton',
        { name: section },
      ),
    );
    await user.keyboard(value);
  }
}

it('uses catalog formats and generates a download with the selected parameters', async () => {
  const blob = new Blob(['pdf'], { type: 'application/pdf' });
  const get = vi.spyOn(apiClient, 'get').mockImplementation(async (url) => ({
    status: 200,
    data: url === 'reports/catalog' ? [report] : blob,
    headers: { 'content-disposition': 'attachment; filename="daily.pdf"' },
  }));
  const objectUrl = vi.fn(() => 'blob:report');
  vi.stubGlobal(
    'URL',
    Object.assign(URL, {
      createObjectURL: objectUrl,
      revokeObjectURL: vi.fn(),
    }),
  );
  const click = vi
    .spyOn(HTMLAnchorElement.prototype, 'click')
    .mockImplementation(() => {});
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await screen.findByRole('combobox', { name: 'Format' });
  expect(
    screen.queryByRole('tab', { name: /production progress/i }),
  ).not.toBeInTheDocument();
  await enterDate(user, 'From', '2026-11-01');
  await enterDate(user, 'To', '2026-11-18');
  await user.click(screen.getByRole('combobox', { name: 'Format' }));
  expect(screen.queryByRole('option', { name: 'CSV' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('option', { name: 'PDF' }));
  await user.click(screen.getByRole('button', { name: 'Generate report' }));
  await screen.findByText('Report generated. Your download has started.');
  expect(get).toHaveBeenLastCalledWith(
    `reports/${report.id}/export`,
    expect.objectContaining({
      responseType: 'blob',
      params: { from: '2026-11-01', to: '2026-11-18', format: 'pdf' },
    }),
  );
  expect(objectUrl).toHaveBeenCalledWith(blob);
  expect(click).toHaveBeenCalledOnce();
});

it('blocks invalid date ranges without making an export request', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: [report] });
  renderWithProviders(<ReportsPage />);
  await screen.findByRole('combobox', { name: 'Format' });
  const user = userEvent.setup();
  await enterDate(user, 'From', '2026-12-01');
  await enterDate(user, 'To', '2026-11-01');
  expect(
    screen.getByRole('button', { name: 'Generate report' }),
  ).toBeDisabled();
  expect(get).toHaveBeenCalledTimes(1);
});

it('handles binary error responses as access errors rather than downloading them', async () => {
  const blob = new Blob(['{}'], { type: 'application/problem+json' });
  Object.defineProperty(blob, 'text', {
    value: async () => JSON.stringify({ detail: 'Report denied' }),
  });
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 403, data: blob });
  await expect(
    exportReport(report, {
      from: '2026-11-01',
      to: '2026-11-18',
      format: 'pdf',
    }),
  ).rejects.toMatchObject({ failure: { kind: 'access', status: 403 } });
});

it('rejects malformed catalog formats and lets users retry catalog failures', async () => {
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: [{ ...report, formats: ['exe'] }],
  });
  await expect(getReportCatalog()).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  get.mockResolvedValue({ status: 503, data: {} });
  const user = userEvent.setup();
  renderWithProviders(<ReportsPage />);
  await screen.findByRole('alert');
  get.mockResolvedValue({ status: 200, data: [report] });
  await user.click(screen.getByRole('button', { name: /retry|try again/i }));
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Format' })).toBeVisible(),
  );
});

it('prefills unique station and process options after selecting a style and lot', async () => {
  const ids = [
    '00000000-0000-0000-0000-000000000002',
    '00000000-0000-0000-0000-000000000003',
    '00000000-0000-0000-0000-000000000004',
    '00000000-0000-0000-0000-000000000005',
  ];
  const options = {
    styles: { id: ids[0], style_number: 'STYLE-01' },
    lots: {
      id: ids[1],
      lot_number: 'LOT-01',
      style_id: ids[0],
      style_number: 'STYLE-01',
    },
    stations: { id: ids[2], code: 'WASH', name: 'Washing' },
    processes: { id: ids[3], name: 'Wash' },
  };
  const get = vi
    .spyOn(apiClient, 'get')
    .mockImplementation(async (url, config) => {
      if (url === 'reports/catalog') return { status: 200, data: [report] };
      const kind = url.split('/').at(-1) as keyof typeof options;
      const query = config?.params as ListQuery;
      return {
        status: 200,
        data: {
          items: [options[kind]],
          page: query.page,
          size: query.size,
          totalElements: 1,
        },
      };
    });
  const user = userEvent.setup();
  const { container } = renderWithProviders(<ReportsPage />);
  await screen.findByRole('combobox', { name: 'Format' });
  expect(container.querySelector('.MuiChip-root')).toBeNull();
  await user.click(screen.getByRole('combobox', { name: 'Style' }));
  await user.click(await screen.findByRole('option', { name: 'STYLE-01' }));
  await user.click(screen.getByRole('combobox', { name: 'Lot Number' }));
  await user.click(
    await screen.findByRole('option', { name: 'LOT-01 / STYLE-01' }),
  );
  await waitFor(() =>
    expect(screen.getByRole('combobox', { name: 'Station' })).toHaveValue(
      'Washing',
    ),
  );
  expect(screen.getByRole('combobox', { name: 'Process' })).toHaveValue('Wash');
  expect(get).toHaveBeenCalledWith(
    'reports/filter-options/processes',
    expect.objectContaining({
      params: expect.objectContaining({
        styleId: ids[0],
        lotId: ids[1],
        stationId: ids[2],
      }),
    }),
  );
  await user.click(screen.getByRole('combobox', { name: 'Status' }));
  expect(screen.getByRole('option', { name: 'COMPLETED' })).toBeVisible();
  expect(
    screen.queryByRole('option', { name: 'PAUSED' }),
  ).not.toBeInTheDocument();
});
