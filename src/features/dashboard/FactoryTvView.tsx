import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  LinearProgress,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import FullscreenOutlinedIcon from '@mui/icons-material/FullscreenOutlined';
import { useTranslation } from 'react-i18next';
import type { ApiPage } from '../../api/collections';
import { formatDateTime } from '../../utils/formatDateTime';
import {
  dashboardFailure,
  getDisplayLots,
  getFactoryDisplay,
} from './dashboardApi';
import { DashboardFailureAlert } from './DashboardFailureAlert';
import type { DashboardFailure, DashboardLot, DashboardSummary } from './types';

const rotationMs = 15000;
export function FactoryTvView({ onExit }: { onExit: () => void }) {
  const { t } = useTranslation('translation');
  const root = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [lots, setLots] = useState<ApiPage<DashboardLot> | null>(null);
  const [failure, setFailure] = useState<DashboardFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [page, setPage] = useState(0);
  const [stationPage, setStationPage] = useState(0);
  const [fullscreenError, setFullscreenError] = useState(false);
  const summaryPoll = useRef<() => void>(() => {});
  const lotPoll = useRef<() => void>(() => {});
  const [summaryError, setSummaryError] = useState<DashboardFailure | null>(
    null,
  );
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function poll() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        const result = await getFactoryDisplay(controller.signal);
        if (!controller.signal.aborted) {
          setSummary(result);
          setSummaryError(null);
        }
      } catch (error) {
        if (!controller.signal.aborted)
          setSummaryError(dashboardFailure(error));
      } finally {
        pending = false;
      }
    }
    summaryPoll.current = () => void poll();
    void poll();
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function poll() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        const result = await getDisplayLots(
          { page, size: 6, search: '' },
          controller.signal,
        );
        if (!controller.signal.aborted) {
          if (page > 0 && page * result.size >= result.totalElements)
            setPage(0);
          else setLots(result);
          setFailure(null);
        }
      } catch (error) {
        if (!controller.signal.aborted) setFailure(dashboardFailure(error));
      } finally {
        pending = false;
      }
    }
    lotPoll.current = () => void poll();
    void poll();
    return () => controller.abort();
  }, [page, attempt]);
  useEffect(() => {
    const timer = setInterval(
      () => {
        summaryPoll.current();
        lotPoll.current();
      },
      (summary?.refreshIntervalSeconds ?? 5) * 1000,
    );
    return () => clearInterval(timer);
  }, [summary?.refreshIntervalSeconds]);
  useEffect(() => {
    const timer = setInterval(() => {
      setPage(
        (current) =>
          (current + 1) %
          Math.max(1, Math.ceil((lots?.totalElements ?? 0) / 6)),
      );
      setStationPage(
        (current) =>
          (current + 1) %
          Math.max(1, Math.ceil((summary?.stations.length ?? 0) / 6)),
      );
    }, rotationMs);
    return () => clearInterval(timer);
  }, [lots?.totalElements, summary?.stations.length]);
  useEffect(
    () => () => {
      if (
        document.fullscreenElement &&
        root.current?.contains(document.fullscreenElement)
      )
        void document.exitFullscreen().catch(() => {});
    },
    [],
  );
  async function exit() {
    if (document.fullscreenElement === root.current)
      await document.exitFullscreen().catch(() => {});
    onExit();
  }
  const stale = !!summaryError || !!failure;
  const metrics = summary
    ? ([
        ['totalLots', summary.metrics.totalLots],
        ['openLots', summary.metrics.openLots],
        ['completedLots', summary.metrics.completedLots],
        ['inTransit', summary.metrics.inTransitLots],
        ['storageOccupancies', summary.metrics.storedLots],
        ['availableTrolleys', summary.metrics.availableTrolleys],
      ] as const)
    : [];
  const stationStart =
    (stationPage %
      Math.max(1, Math.ceil((summary?.stations.length ?? 0) / 6))) *
    6;
  return (
    <Dialog
      fullScreen
      open
      onClose={() => void exit()}
      aria-labelledby="factory-tv-title"
      slotProps={{
        paper: {
          ref: root,
          sx: { bgcolor: '#f5f7fb', p: { xs: 2, lg: 3 }, overflow: 'auto' },
        },
      }}
    >
      <Stack spacing={2}>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 2,
          }}
        >
          <Box>
            <Typography
              component="h1"
              id="factory-tv-title"
              sx={{ fontSize: { xs: 26, lg: 36 }, fontWeight: 750 }}
            >
              Factory production · TV
            </Typography>
            <Typography color="text.secondary">
              {summary
                ? `Updated ${formatDateTime(summary.snapshotAt, { timeZone: summary.productionTrend.timezone })}`
                : 'Connecting to factory display…'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              label={
                stale
                  ? 'Updates interrupted'
                  : summary && lots
                    ? 'Live'
                    : 'Connecting'
              }
              color={
                stale ? 'warning' : summary && lots ? 'success' : 'default'
              }
            />
            <Button
              startIcon={<FullscreenOutlinedIcon />}
              onClick={async () => {
                try {
                  if (!root.current?.requestFullscreen) throw new Error();
                  await root.current.requestFullscreen();
                  setFullscreenError(false);
                } catch {
                  setFullscreenError(true);
                }
              }}
            >
              Fullscreen
            </Button>
            <Button variant="outlined" onClick={() => void exit()}>
              Exit TV view
            </Button>
          </Stack>
        </Stack>
        {fullscreenError && (
          <Alert severity="info" onClose={() => setFullscreenError(false)}>
            Fullscreen is unavailable. TV view remains active.
          </Alert>
        )}
        {(summaryError || failure) && (
          <DashboardFailureAlert
            failure={(summaryError || failure)!}
            onRetry={() => setAttempt((value) => value + 1)}
          />
        )}
        {stale && (summary || lots) && (
          <Alert severity="warning">
            Showing the last received data. Reconnecting automatically.
          </Alert>
        )}
        {!summary && !summaryError && (
          <CircularProgress aria-label="Loading factory display" />
        )}
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: {
              xs: 'repeat(2, minmax(0, 1fr))',
              md: 'repeat(3, minmax(0, 1fr))',
              xl: 'repeat(6, minmax(0, 1fr))',
            },
            gap: 2,
          }}
        >
          {metrics.map(([key, value]) => (
            <Paper key={key} variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
              <Typography
                sx={{ fontSize: { xs: 14, lg: 18 }, color: 'text.secondary' }}
              >
                {t(`dashboard.${key}`)}
              </Typography>
              <Typography
                sx={{
                  fontSize: { xs: 32, lg: 48 },
                  fontWeight: 750,
                  color: 'primary.main',
                }}
              >
                {value.toLocaleString()}
              </Typography>
            </Paper>
          ))}
        </Box>
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 2 }}>
          <Typography
            component="h2"
            sx={{ fontSize: 22, fontWeight: 700, mb: 1 }}
          >
            Station workload
          </Typography>
          {summary?.stations.length === 0 && (
            <Typography>No station workload available.</Typography>
          )}
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(6, minmax(0, 1fr))',
              },
              gap: 2,
            }}
          >
            {summary?.stations
              .slice(stationStart, stationStart + 6)
              .map((station) => (
                <Box
                  key={station.id}
                  sx={{ bgcolor: '#edf4ff', p: 1.5, borderRadius: 1 }}
                >
                  <Typography sx={{ fontSize: 18, fontWeight: 600 }}>
                    {station.name || station.code}
                  </Typography>
                  <Typography sx={{ fontSize: 30, fontWeight: 700 }}>
                    {station.wip}{' '}
                    <Box
                      component="span"
                      sx={{ fontSize: 15, fontWeight: 400 }}
                    >
                      lots
                    </Box>
                  </Typography>
                </Box>
              ))}
          </Box>
        </Paper>
        <Paper
          variant="outlined"
          sx={{ p: 2, borderRadius: 2, overflowX: 'auto' }}
        >
          <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
            <Typography component="h2" sx={{ fontSize: 22, fontWeight: 700 }}>
              Production lots
            </Typography>
            <Typography color="text.secondary">
              Page {(lots?.page ?? 0) + 1} of{' '}
              {Math.max(1, Math.ceil((lots?.totalElements ?? 0) / 6))} · rotates
              every 15 seconds
            </Typography>
          </Stack>
          {!lots && !failure ? (
            <CircularProgress aria-label="Loading TV lots" />
          ) : (
            <Table
              aria-label="TV production lots"
              sx={{
                '& .MuiTableCell-root': {
                  fontSize: { xs: 16, lg: 20 },
                  py: 1.5,
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {[
                    'Style / Lot',
                    'Quantity',
                    'Station / Process',
                    'Status',
                    'Progress',
                  ].map((label) => (
                    <TableCell key={label}>{label}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {lots?.items.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>
                      <Typography sx={{ fontSize: 'inherit', fontWeight: 700 }}>
                        {lot.style_number}
                      </Typography>
                      {lot.lot_number}
                    </TableCell>
                    <TableCell>{lot.quantity ?? '—'}</TableCell>
                    <TableCell>
                      {lot.current_station || '—'}
                      <Typography sx={{ fontSize: 16 }} color="text.secondary">
                        {lot.current_process || '—'}
                      </Typography>
                    </TableCell>
                    <TableCell>{lot.status.replaceAll('_', ' ')}</TableCell>
                    <TableCell sx={{ minWidth: 170 }}>
                      <Typography sx={{ fontSize: 'inherit', fontWeight: 700 }}>
                        {lot.progress_percent}%
                      </Typography>
                      <LinearProgress
                        variant="determinate"
                        value={lot.progress_percent}
                        aria-label={`Progress for ${lot.lot_number}`}
                        sx={{ height: 10, borderRadius: 1 }}
                      />
                    </TableCell>
                  </TableRow>
                ))}
                {lots?.items.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5}>
                      No production lots available.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </Paper>
      </Stack>
    </Dialog>
  );
}
