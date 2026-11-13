import { useCallback, type ReactNode } from 'react';
import {
  Box,
  CircularProgress,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ApiPage, ListQuery } from '../../api/collections';
import { ListPagination } from '../../api/ListPagination';
import { usePagedList } from '../../api/usePagedList';
import { formatDateTime } from '../../utils/formatDateTime';
import { useLotLabels } from '../lots/lotDisplay';
import { getLotHistory, reportsFailure } from './reportsApi';
import { ReportFailureAlert } from './ReportFailureAlert';
import type { JsonValue } from '../lots/types';

interface Column<T> {
  label: string;
  render: (row: T) => ReactNode;
}
function ResultsTable<T extends { id: string }>({
  title,
  page,
  columns,
  empty,
}: {
  title: string;
  page: ApiPage<T>;
  columns: Column<T>[];
  empty: string;
}) {
  return (
    <TableContainer>
      <Table
        size="small"
        aria-label={title}
        sx={{ '& .MuiTableCell-root': { whiteSpace: 'nowrap' } }}
      >
        <TableHead>
          <TableRow>
            {columns.map((column) => (
              <TableCell key={column.label}>{column.label}</TableCell>
            ))}
          </TableRow>
        </TableHead>
        <TableBody>
          {page.items.length ? (
            page.items.map((row) => (
              <TableRow key={row.id}>
                {columns.map((column) => (
                  <TableCell key={column.label}>{column.render(row)}</TableCell>
                ))}
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={columns.length}>{empty}</TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </TableContainer>
  );
}
function Search({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  const { t } = useTranslation('translation');
  return (
    <TextField
      size="small"
      type="search"
      label={t('reports.search')}
      placeholder={t('reports.searchPlaceholder')}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{ htmlInput: { maxLength: 200 } }}
      sx={{ my: 2, width: { xs: '100%', sm: 320 } }}
    />
  );
}
function detailText(detail: JsonValue): string {
  let value = detail;
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type === 'jsonb' &&
    typeof value.value === 'string'
  )
    value = value.value;
  if (typeof value === 'string') {
    const raw = value;
    try {
      value = JSON.parse(value) as JsonValue;
    } catch {
      return raw;
    }
  }
  return value === null
    ? '—'
    : typeof value === 'string'
      ? value
      : JSON.stringify(value, null, 2);
}
export function LotHistoryReport({ id }: { id: string }) {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  const load = useCallback(
    (query: ListQuery, signal?: AbortSignal) =>
      getLotHistory({ ...query, lotId: id }, signal),
    [id],
  );
  const report = usePagedList(load);
  return (
    <Box>
      <Search value={report.input} onChange={report.setInput} />
      {report.state.status === 'loading' && (
        <CircularProgress size={24} aria-label={t('reports.loading')} />
      )}
      {report.state.status === 'error' && (
        <ReportFailureAlert
          failure={reportsFailure(report.state.error)}
          onRetry={report.reload}
        />
      )}
      {report.state.status === 'ready' && (
        <>
          <ResultsTable
            title={t('reports.lotHistory')}
            page={report.state.data}
            empty={t('reports.noEvents')}
            columns={[
              {
                label: t('reports.occurredAt'),
                render: (row) => formatDateTime(row.occurred_at),
              },
              {
                label: t('reports.locationType'),
                render: (row) => labels.locationLabel(row.location_type),
              },
              {
                label: t('reports.locationId'),
                render: (row) => row.location_id || t('common.notProvided'),
              },
              {
                label: t('reports.actor'),
                render: (row) => row.actor_id || t('common.notProvided'),
              },
              {
                label: t('reports.details'),
                render: (row) => (
                  <Box
                    component="pre"
                    sx={{
                      m: 0,
                      fontFamily: 'inherit',
                      whiteSpace: 'pre-wrap',
                      overflowWrap: 'anywhere',
                      minWidth: 180,
                      maxWidth: 480,
                    }}
                  >
                    {detailText(row.detail)}
                  </Box>
                ),
              },
            ]}
          />
          <ListPagination
            query={report.query}
            total={report.state.data.totalElements}
            onPage={report.setPage}
            onSize={report.setSize}
          />
        </>
      )}
    </Box>
  );
}
