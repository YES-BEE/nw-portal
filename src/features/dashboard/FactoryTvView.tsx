import { useEffect, useRef, useState } from 'react';
import { keyframes } from '@emotion/react';
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
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PendingActionsOutlinedIcon from '@mui/icons-material/PendingActionsOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import ShoppingCartOutlinedIcon from '@mui/icons-material/ShoppingCartOutlined';
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
const pageEnter = keyframes`
  from { opacity: 0.25; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
`;
const rotationCountdown = keyframes`
  from { transform: scaleX(1); }
  to { transform: scaleX(0); }
`;
const pageMotion = {
  animation: `${pageEnter} 480ms ease-out`,
  '@media (prefers-reduced-motion: reduce)': { animation: 'none' },
};
const tones = {
  blue: { solid: '#1d4ed8', surface: '#eff6ff' },
  violet: { solid: '#6d28d9', surface: '#f5f3ff' },
  green: { solid: '#047857', surface: '#ecfdf5' },
  amber: { solid: '#b45309', surface: '#fffbeb' },
  cyan: { solid: '#0e7490', surface: '#ecfeff' },
  rose: { solid: '#be185d', surface: '#fff1f2' },
  slate: { solid: '#475569', surface: '#f1f5f9' },
};
const metricAppearance = {
  totalLots: { tone: tones.blue, Icon: Inventory2OutlinedIcon },
  openLots: { tone: tones.violet, Icon: PendingActionsOutlinedIcon },
  completedLots: { tone: tones.green, Icon: TaskAltOutlinedIcon },
  inTransit: { tone: tones.amber, Icon: LocalShippingOutlinedIcon },
  storageOccupancies: { tone: tones.cyan, Icon: WarehouseOutlinedIcon },
  availableTrolleys: { tone: tones.rose, Icon: ShoppingCartOutlinedIcon },
};
const statusTones: Record<string, (typeof tones)[keyof typeof tones]> = {
  READY: tones.slate,
  DISPATCHED: tones.amber,
  AT_STATION: tones.cyan,
  IN_PROCESS: tones.blue,
  READY_FOR_DISPATCH: tones.violet,
  IN_STORAGE: tones.cyan,
  AT_QC: tones.violet,
  COMPLETED: tones.green,
  CANCELLED: tones.rose,
};
const stationTones = [
  tones.blue,
  tones.violet,
  tones.cyan,
  tones.amber,
  tones.rose,
  tones.green,
];
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
  const rotationKey = `${lots?.totalElements ?? 0}:${summary?.stations.length ?? 0}`;
  const rotating =
    (lots?.totalElements ?? 0) > 6 || (summary?.stations.length ?? 0) > 6;
  return (
    <Dialog
      fullScreen
      open
      onClose={() => void exit()}
      aria-labelledby="factory-tv-title"
      slotProps={{
        paper: {
          ref: root,
          sx: {
            bgcolor: '#091a30',
            backgroundImage: 'linear-gradient(135deg, #091a30, #163555)',
            color: '#f8fafc',
            p: 2,
            overflow: 'auto',
            fontVariantNumeric: 'tabular-nums',
          },
        },
      }}
    >
      <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 2200, mx: 'auto' }}>
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
              sx={{
                fontSize: { xs: 28, lg: 38 },
                fontWeight: 800,
                letterSpacing: '-0.03em',
              }}
            >
              Factory production
            </Typography>
            <Typography
              sx={{ color: '#cbd5e1', fontSize: { xs: 14, lg: 17 }, mt: 0.5 }}
            >
              {summary
                ? `Updated ${formatDateTime(summary.snapshotAt, { timeZone: summary.productionTrend.timezone })}`
                : 'Connecting to factory display...'}
            </Typography>
          </Box>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <Chip
              sx={{
                height: 38,
                fontSize: 16,
                fontWeight: 750,
                bgcolor: stale
                  ? '#fef3c7'
                  : summary && lots
                    ? '#d1fae5'
                    : '#e2e8f0',
                color: stale
                  ? '#92400e'
                  : summary && lots
                    ? '#065f46'
                    : '#334155',
                '&::before': {
                  content: '""',
                  width: 9,
                  height: 9,
                  borderRadius: '50%',
                  bgcolor: 'currentColor',
                  ml: 1.5,
                },
              }}
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
              sx={{
                color: '#e2e8f0',
                fontSize: 15,
                minHeight: 40,
                '&:hover': { bgcolor: '#ffffff14' },
              }}
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
            <Button
              variant="outlined"
              onClick={() => void exit()}
              sx={{
                color: '#fff',
                borderColor: '#64748b',
                fontSize: 15,
                minHeight: 40,
                '&:hover': { borderColor: '#cbd5e1', bgcolor: '#ffffff14' },
              }}
            >
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
          {metrics.map(([key, value]) => {
            const { tone, Icon } = metricAppearance[key];
            return (
              <Paper
                key={key}
                elevation={0}
                sx={{
                  p: 2,
                  borderRadius: 3,
                  bgcolor: tone.solid,
                  color: '#fff',
                  boxShadow: '0 8px 24px #00000020',
                  minWidth: 0,
                }}
              >
                <Stack
                  direction="row"
                  sx={{
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: 1,
                  }}
                >
                  <Typography
                    sx={{ fontSize: { xs: 14, lg: 18 }, fontWeight: 650 }}
                  >
                    {t(`dashboard.${key}`)}
                  </Typography>
                  <Icon sx={{ fontSize: 28, opacity: 0.8, flexShrink: 0 }} />
                </Stack>
                <Typography
                  sx={{
                    fontSize: { xs: 38, lg: 56 },
                    fontWeight: 800,
                    lineHeight: 1.1,
                    mt: 1,
                    letterSpacing: '-0.04em',
                  }}
                >
                  {value.toLocaleString()}
                </Typography>
              </Paper>
            );
          })}
        </Box>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3 }}>
          <Typography
            component="h2"
            sx={{ fontSize: { xs: 22, lg: 25 }, fontWeight: 800, mb: 1.5 }}
          >
            Station workload
          </Typography>
          {summary?.stations.length === 0 && (
            <Typography>No station workload available.</Typography>
          )}
          <Box
            key={stationStart}
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: 'repeat(2, minmax(0, 1fr))',
                md: 'repeat(3, minmax(0, 1fr))',
                xl: 'repeat(6, minmax(0, 1fr))',
              },
              gap: 2,
              ...pageMotion,
            }}
          >
            {summary?.stations
              .slice(stationStart, stationStart + 6)
              .map((station, index) => {
                const tone =
                  stationTones[(stationStart + index) % stationTones.length];
                return (
                  <Box
                    key={station.id}
                    sx={{
                      bgcolor: tone.surface,
                      borderTop: `4px solid ${tone.solid}`,
                      p: 1.5,
                      borderRadius: 2,
                      minWidth: 0,
                    }}
                  >
                    <Typography
                      sx={{
                        fontSize: { xs: 17, lg: 20 },
                        fontWeight: 700,
                        lineHeight: 1.3,
                        overflowWrap: 'anywhere',
                      }}
                    >
                      {station.name || station.code}
                    </Typography>
                    <Typography
                      sx={{
                        fontSize: { xs: 32, lg: 36 },
                        fontWeight: 800,
                        color: tone.solid,
                        mt: 0.5,
                        lineHeight: 1.2,
                      }}
                    >
                      {station.wip}{' '}
                      <Box
                        component="span"
                        sx={{ fontSize: 17, fontWeight: 600, color: '#475569' }}
                      >
                        lots
                      </Box>
                    </Typography>
                  </Box>
                );
              })}
          </Box>
        </Paper>
        <Paper elevation={0} sx={{ p: 2, borderRadius: 3, overflowX: 'auto' }}>
          <Stack
            direction="row"
            sx={{
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: 1,
              mb: 1.5,
            }}
          >
            <Typography
              component="h2"
              sx={{ fontSize: { xs: 22, lg: 25 }, fontWeight: 800 }}
            >
              Production lots
            </Typography>
            <Box sx={{ minWidth: { xs: 0, sm: 260 } }}>
              <Typography
                sx={{
                  color: '#475569',
                  bgcolor: '#f1f5f9',
                  px: 1.5,
                  py: 0.75,
                  borderRadius: 2,
                  fontSize: 15,
                  fontWeight: 600,
                }}
              >
                Page {(lots?.page ?? 0) + 1} of{' '}
                {Math.max(1, Math.ceil((lots?.totalElements ?? 0) / 6))} /
                rotates every 15 seconds
              </Typography>
              {rotating && (
                <Box
                  aria-hidden="true"
                  sx={{
                    mt: 0.75,
                    height: 4,
                    borderRadius: 2,
                    overflow: 'hidden',
                    bgcolor: '#e2e8f0',
                    '@media (prefers-reduced-motion: reduce)': {
                      display: 'none',
                    },
                  }}
                >
                  <Box
                    key={rotationKey}
                    sx={{
                      height: '100%',
                      background: 'linear-gradient(90deg, #1d4ed8, #06b6d4)',
                      transformOrigin: 'left',
                      animation: `${rotationCountdown} ${rotationMs}ms linear infinite`,
                    }}
                  />
                </Box>
              )}
            </Box>
          </Stack>
          {!lots && !failure ? (
            <CircularProgress aria-label="Loading TV lots" />
          ) : (
            <Table
              aria-label="TV production lots"
              sx={{
                '& .MuiTableCell-root': {
                  fontSize: { xs: 16, lg: 20 },
                  py: 1,
                  borderColor: '#e2e8f0',
                },
                '& .MuiTableHead-root .MuiTableCell-root': {
                  bgcolor: '#163555',
                  color: '#f8fafc',
                  fontWeight: 700,
                  fontSize: { xs: 15, lg: 18 },
                  whiteSpace: 'nowrap',
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
              <TableBody key={lots?.page ?? 'loading'} sx={pageMotion}>
                {lots?.items.map((lot, index) => {
                  const tone = statusTones[lot.status] ?? tones.slate;
                  return (
                    <TableRow
                      key={lot.id}
                      sx={{ bgcolor: index % 2 === 0 ? '#fff' : '#f8fafc' }}
                    >
                      <TableCell sx={{ borderLeft: `4px solid ${tone.solid}` }}>
                        <Typography
                          sx={{
                            fontSize: { xs: 14, lg: 16 },
                            fontWeight: 600,
                            color: '#475569',
                          }}
                        >
                          {lot.style_number}
                        </Typography>
                        <Typography
                          sx={{ fontSize: 'inherit', fontWeight: 800 }}
                        >
                          {lot.lot_number}
                        </Typography>
                      </TableCell>
                      <TableCell sx={{ fontWeight: 700 }}>
                        {lot.quantity ?? '\u2014'}
                      </TableCell>
                      <TableCell>
                        <Typography
                          sx={{ fontSize: 'inherit', fontWeight: 700 }}
                        >
                          {lot.current_station || '\u2014'}
                        </Typography>
                        <Typography
                          sx={{
                            fontSize: { xs: 15, lg: 17 },
                            color: '#475569',
                          }}
                        >
                          {lot.current_process || '\u2014'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={lot.status.replaceAll('_', ' ')}
                          sx={{
                            bgcolor: tone.surface,
                            color: tone.solid,
                            border: `1px solid ${tone.solid}40`,
                            fontWeight: 800,
                            fontSize: { xs: 13, lg: 16 },
                            height: 36,
                            whiteSpace: 'nowrap',
                          }}
                        />
                      </TableCell>
                      <TableCell sx={{ minWidth: 170 }}>
                        <Typography
                          sx={{
                            fontSize: 'inherit',
                            fontWeight: 800,
                            color: tone.solid,
                            mb: 0.5,
                          }}
                        >
                          {lot.progress_percent}%
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={lot.progress_percent}
                          aria-label={`Progress for ${lot.lot_number}`}
                          sx={{
                            height: 12,
                            borderRadius: 2,
                            bgcolor: '#e2e8f0',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: tone.solid,
                              borderRadius: 2,
                            },
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  );
                })}
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
