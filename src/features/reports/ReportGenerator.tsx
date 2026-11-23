import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import dayjs, { type Dayjs } from 'dayjs';
import { usePageMetadata } from '../../app/usePageMetadata';
import { FilterPicker } from '../lots/ProductionLotFilters';
import {
  emptyProductionFilters,
  productionFilterParams,
  type ProductionFilterSelection,
} from '../lots/productionFilterSelection';
import {
  exportReport,
  getReportCatalog,
  getReportFilterOptions,
  reportsFailure,
} from './reportsApi';
import { ReportFailureAlert } from './ReportFailureAlert';
import type {
  ReportCategory,
  ReportFormat,
  ReportsFailure,
  ReportExportRequest,
} from './types';
import { isUuid, reportStatuses } from './reportContract';

function today() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
const pickerFilters = {
  styles: 'styleIds',
  lots: 'lotIds',
  stations: 'stationId',
  processes: 'processId',
} as const;

export function ReportGenerator() {
  const [catalog, setCatalog] = useState<ReportCategory[] | null>(null);
  const [catalogError, setCatalogError] = useState<ReportsFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  const [format, setFormat] = useState<ReportFormat>('xlsx');
  const [fromDate, setFromDate] = useState<Dayjs | null>(() =>
    dayjs(today().slice(0, 8) + '01'),
  );
  const [toDate, setToDate] = useState<Dayjs | null>(() => dayjs(today()));
  const from = fromDate?.isValid() ? fromDate.format('YYYY-MM-DD') : '';
  const to = toDate?.isValid() ? toDate.format('YYYY-MM-DD') : '';
  const [fromError, setFromError] = useState(false);
  const [toError, setToError] = useState(false);
  const [selection, setSelection] = useState<ProductionFilterSelection>(
    emptyProductionFilters,
  );
  const [operator, setOperator] = useState('');
  const [status, setStatus] = useState('');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<ReportsFailure | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const download = useRef<AbortController | null>(null);
  usePageMetadata(
    'Reports and Analysis',
    'Generate and download production reports.',
  );
  useEffect(() => {
    const controller = new AbortController();
    void getReportCatalog(controller.signal).then(
      (items) => {
        if (controller.signal.aborted) return;
        setCatalog(items);
        setSelected(items[0]?.id ?? '');
        setFormat(
          items[0]?.formats.includes('xlsx')
            ? 'xlsx'
            : (items[0]?.formats[0] ?? 'xlsx'),
        );
      },
      (failure: unknown) => {
        if (!controller.signal.aborted)
          setCatalogError(reportsFailure(failure));
      },
    );
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => download.current?.abort(), []);
  const report = catalog?.find((item) => item.id === selected);
  const filters = productionFilterParams(selection);
  const invalidDates = !from || !to || from > to || fromError || toError;
  const invalidOperator = !!operator.trim() && !isUuid(operator.trim());
  const allowedStatuses = report ? reportStatuses[report.key] : undefined;
  const autoSelectionKey = JSON.stringify([
    report?.id,
    report?.filters,
    selection,
  ]);
  useEffect(() => {
    const [reportId, supportedFilters, current] = JSON.parse(
      autoSelectionKey,
    ) as [string | undefined, string[] | undefined, ProductionFilterSelection];
    if (
      !reportId ||
      !supportedFilters ||
      !current.styles.length ||
      !current.lots.length
    )
      return;
    const controller = new AbortController();
    void (async () => {
      let next = current;
      try {
        for (const kind of ['stations', 'processes'] as const) {
          if (next[kind] || !supportedFilters.includes(pickerFilters[kind]))
            continue;
          const result = await getReportFilterOptions(
            kind,
            { ...productionFilterParams(next), page: 0, size: 2, search: '' },
            controller.signal,
          );
          if (controller.signal.aborted) return;
          if (result.totalElements === 1 && result.items.length === 1) {
            const item = result.items[0];
            const label =
              'name' in item && item.name
                ? item.name
                : 'code' in item
                  ? item.code
                  : item.id;
            next = { ...next, [kind]: { id: item.id, label } };
          }
        }
        if (next !== current) setSelection(next);
      } catch (failure) {
        if (!controller.signal.aborted) setError(reportsFailure(failure));
      }
    })();
    return () => controller.abort();
  }, [autoSelectionKey]);
  const invalidStatus =
    !!status.trim() &&
    !!allowedStatuses &&
    !allowedStatuses.includes(status.trim().toUpperCase());
  async function generate() {
    if (
      !report ||
      invalidDates ||
      invalidOperator ||
      invalidStatus ||
      download.current
    )
      return;
    const controller = new AbortController();
    download.current = controller;
    setPending(true);
    setError(null);
    setDownloaded(false);
    const query: ReportExportRequest = { from, to, format };
    for (const key of report.filters) {
      if (key === 'styleIds' || key === 'lotIds') {
        if (filters[key]?.length) query[key] = filters[key];
        continue;
      }
      const value =
        key === 'status'
          ? status.trim()
          : key === 'operatorId'
            ? operator.trim()
            : filters[key];
      if (value) query[key] = value;
    }
    try {
      const result = await exportReport(report, query, controller.signal);
      if (controller.signal.aborted) return;
      const url = URL.createObjectURL(result.blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = result.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setDownloaded(true);
    } catch (failure) {
      if (!controller.signal.aborted) setError(reportsFailure(failure));
    } finally {
      if (!controller.signal.aborted) setPending(false);
      download.current = null;
    }
  }
  return (
    <Stack spacing={3}>
      <Box>
        <Typography component="h1" variant="h5" sx={{ fontWeight: 700 }}>
          Reports and Analysis
        </Typography>
        <Typography color="text.secondary" sx={{ mt: 1 }}>
          Choose a report, set a date range, and download the results.
        </Typography>
      </Box>
      {catalogError ? (
        <ReportFailureAlert
          failure={catalogError}
          onRetry={() => {
            setCatalogError(null);
            setAttempt((value) => value + 1);
          }}
        />
      ) : !catalog ? (
        <CircularProgress aria-label="Loading report catalog" />
      ) : !catalog.length ? (
        <Alert severity="info">No reports are currently available.</Alert>
      ) : (
        <Paper variant="outlined" sx={{ p: { xs: 2, md: 3 }, borderRadius: 2 }}>
          <Stack
            component="form"
            spacing={3}
            onSubmit={(event) => {
              event.preventDefault();
              void generate();
            }}
          >
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  sm: 'repeat(2, minmax(0, 1fr))',
                  lg: 'minmax(0, 2fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr)',
                },
                gap: 2,
                alignItems: 'start',
              }}
            >
              <TextField
                select
                label="Report"
                value={selected}
                disabled={pending}
                onChange={(event) => {
                  const next = catalog.find(
                    (item) => item.id === event.target.value,
                  )!;
                  setSelected(next.id);
                  setFormat(
                    next.formats.includes(format) ? format : next.formats[0],
                  );
                  setSelection(emptyProductionFilters);
                  setOperator('');
                  setStatus('');
                  setError(null);
                  setDownloaded(false);
                }}
              >
                {catalog.map((item) => (
                  <MenuItem key={item.id} value={item.id}>
                    {item.name}
                  </MenuItem>
                ))}
              </TextField>
              {report && (
                <>
                  <DatePicker
                    label="From"
                    value={fromDate}
                    disabled={pending}
                    onChange={setFromDate}
                    onError={(error) => setFromError(error !== null)}
                    maxDate={toDate?.isValid() ? toDate : undefined}
                    slotProps={{
                      textField: { required: true, fullWidth: true },
                    }}
                  />
                  <DatePicker
                    label="To"
                    value={toDate}
                    disabled={pending}
                    minDate={fromDate?.isValid() ? fromDate : undefined}
                    onChange={setToDate}
                    onError={(error) => setToError(error !== null)}
                    slotProps={{
                      textField: {
                        required: true,
                        fullWidth: true,
                        error: !!from && !!to && from > to,
                        helperText:
                          from > to
                            ? 'End date must be on or after start date.'
                            : undefined,
                      },
                    }}
                  />
                  <TextField
                    fullWidth
                    select
                    label="Format"
                    value={format}
                    disabled={pending}
                    onChange={(event) =>
                      setFormat(event.target.value as ReportFormat)
                    }
                  >
                    {report.formats.map((item) => (
                      <MenuItem key={item} value={item}>
                        {item.toUpperCase()}
                      </MenuItem>
                    ))}
                  </TextField>
                </>
              )}
            </Box>
            {report && (
              <>
                <Box
                  component="fieldset"
                  disabled={pending}
                  sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}
                >
                  <Typography
                    component="legend"
                    sx={{ mb: 2, fontWeight: 600 }}
                  >
                    Optional filters
                  </Typography>
                  <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 2 }}>
                    {(
                      Object.keys(
                        pickerFilters,
                      ) as (keyof typeof pickerFilters)[]
                    )
                      .filter((kind) =>
                        report.filters.includes(pickerFilters[kind]),
                      )
                      .map((kind) => (
                        <FilterPicker
                          key={`${report.id}-${kind}`}
                          kind={kind}
                          value={
                            kind === 'styles' || kind === 'lots'
                              ? selection[kind]
                              : selection[kind]
                                ? [selection[kind]]
                                : []
                          }
                          filters={filters}
                          loadOptions={getReportFilterOptions}
                          failure={reportsFailure}
                          onChange={(choice) => {
                            setSelection((previous) => ({
                              ...previous,
                              [kind]:
                                kind === 'styles' || kind === 'lots'
                                  ? choice
                                  : (choice[0] ?? null),
                              ...(kind === 'styles'
                                ? {
                                    lots: [],
                                    stations: null,
                                    processes: null,
                                  }
                                : kind === 'lots'
                                  ? { stations: null, processes: null }
                                  : kind === 'stations'
                                    ? { processes: null }
                                    : {}),
                            }));
                          }}
                        />
                      ))}
                    {report.filters.includes('operatorId') && (
                      <TextField
                        label="Operator ID"
                        value={operator}
                        onChange={(event) => setOperator(event.target.value)}
                        error={invalidOperator}
                        helperText={
                          invalidOperator
                            ? 'Enter a valid operator UUID.'
                            : 'Optional'
                        }
                        sx={{ flex: '1 1 220px' }}
                      />
                    )}
                    {report.filters.includes('status') && (
                      <TextField
                        select
                        label="Status"
                        value={status}
                        onChange={(event) => setStatus(event.target.value)}
                        sx={{ flex: '1 1 180px' }}
                      >
                        <MenuItem value="">All statuses</MenuItem>
                        {(allowedStatuses ?? []).map((value) => (
                          <MenuItem key={value} value={value}>
                            {value.replaceAll('_', ' ')}
                          </MenuItem>
                        ))}
                      </TextField>
                    )}
                    <Button
                      sx={{ alignSelf: 'flex-end', height: 47, flexShrink: 0 }}
                      onClick={() => {
                        setSelection(emptyProductionFilters);
                        setOperator('');
                        setStatus('');
                      }}
                    >
                      Clear filters
                    </Button>
                  </Stack>
                </Box>
                {error && (
                  <ReportFailureAlert
                    failure={error}
                    onRetry={() => void generate()}
                  />
                )}
                {downloaded && (
                  <Alert severity="success">
                    Report generated. Your download has started.
                  </Alert>
                )}
                <Box>
                  <Button
                    type="submit"
                    variant="contained"
                    disabled={
                      pending ||
                      invalidDates ||
                      invalidOperator ||
                      invalidStatus
                    }
                    startIcon={
                      pending ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        <DownloadOutlinedIcon />
                      )
                    }
                  >
                    {pending ? 'Generating report…' : 'Generate report'}
                  </Button>
                </Box>
              </>
            )}
          </Stack>
        </Paper>
      )}
    </Stack>
  );
}
