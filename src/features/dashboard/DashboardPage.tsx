import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import { usePageMetadata } from '../../app/usePageMetadata';
import { formatDateTime } from '../../utils/formatDateTime';
import { useLotLabels } from '../lots/lotDisplay';
import { dashboardFailure, getDashboard } from './dashboardApi';
import { DashboardFailureAlert } from './DashboardFailureAlert';
import { DashboardLotsTable } from './DashboardLotsTable';
import {
  StatusBreakdown,
  StationWipBreakdown,
  StationStatusTable,
} from './DashboardBreakdowns';
import { DashboardMetrics } from './DashboardMetrics';
import CircleIcon from '@mui/icons-material/Circle';
import type { DashboardFailure, DashboardSummary } from './types';
import { getFactoryTimeZone } from './dashboardConfig';

const knownStatuses = [
  'READY',
  'DISPATCHED',
  'AT_STATION',
  'IN_PROCESS',
  'READY_FOR_DISPATCH',
  'IN_STORAGE',
  'COMPLETED',
  'CANCELLED',
];
type State =
  | { status: 'loading' }
  | { status: 'ready'; data: DashboardSummary; failure?: DashboardFailure }
  | { status: 'error'; failure: DashboardFailure };
export function DashboardPage() {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [lotStatus, setLotStatus] = useState('');
  usePageMetadata(t('dashboard.pageTitle'), t('dashboard.description'));
  const data = state.status === 'ready' ? state.data : null;
  const pollIntervalMs = data ? data.refreshIntervalSeconds * 1000 : 0;
  const pollRef = useRef<() => void>(() => {});
  const [lotHealth, setLotHealth] = useState<'loading' | 'healthy' | 'stale'>(
    'loading',
  );
  const summaryFailure =
    state.status === 'error' || (state.status === 'ready' && !!state.failure);
  const stale = summaryFailure || lotHealth === 'stale';
  const healthy =
    state.status === 'ready' && !state.failure && lotHealth === 'healthy';
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    function poll() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      void getDashboard(controller.signal)
        .then(
          (data) => {
            if (!controller.signal.aborted)
              setState({
                status: 'ready',
                data,
              });
          },
          (error: unknown) => {
            if (!controller.signal.aborted)
              setState((previous) =>
                previous.status === 'ready'
                  ? { ...previous, failure: dashboardFailure(error) }
                  : { status: 'error', failure: dashboardFailure(error) },
              );
          },
        )
        .finally(() => {
          pending = false;
        });
    }
    pollRef.current = poll;
    poll();
    return () => {
      controller.abort();
    };
  }, [attempt]);
  useEffect(() => {
    if (pollIntervalMs <= 0) return;
    const timer = setInterval(() => pollRef.current(), pollIntervalMs);
    return () => clearInterval(timer);
  }, [pollIntervalMs]);
  function refresh() {
    setAttempt((value) => value + 1);
  }

  const statuses = [
    ...new Set([
      ...knownStatuses,
      ...(data?.lots.map((row) => row.status) || []),
      ...(lotStatus ? [lotStatus] : []),
    ]),
  ];
  const styleLabel = (status: string) => {
    if (
      status === 'DRAFT' ||
      status === 'RELEASED' ||
      status === 'IN_PRODUCTION' ||
      status === 'COMPLETED'
    )
      return t(`styles.statusValues.${status}`);
    return status;
  };
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
            {t('navigation.dashboard')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t('dashboard.description')}
          </Typography>
        </Box>
        <Stack
          spacing={0.75}
          sx={{ alignItems: { xs: 'flex-start', sm: 'flex-end' } }}
        >
          <Chip
            icon={<CircleIcon sx={{ fontSize: '9px !important' }} />}
            label={t(
              stale
                ? data
                  ? 'dashboard.staleUpdates'
                  : 'dashboard.offlineUpdates'
                : healthy
                  ? 'dashboard.liveUpdates'
                  : 'dashboard.updating',
            )}
            size="small"
            sx={{
              bgcolor: stale ? '#fff6df' : healthy ? '#eaf8f1' : '#f1f4f8',
              color: stale ? '#946200' : healthy ? '#15803d' : '#52647c',
              fontWeight: 600,
              '& .MuiChip-icon': {
                color: stale ? '#b77912' : healthy ? '#16a365' : '#52647c',
              },
            }}
          />
          {state.status === 'ready' && (
            <Typography color="text.secondary" sx={{ fontSize: 11 }}>
              {t('dashboard.updated', {
                date: formatDateTime(state.data.snapshotAt, {
                  timeZone: getFactoryTimeZone(),
                }),
              })}
            </Typography>
          )}
          {data && (
            <Typography color="text.secondary" sx={{ fontSize: 11 }}>
              {t('dashboard.refreshCadence', {
                seconds: data.refreshIntervalSeconds,
              })}
            </Typography>
          )}
        </Stack>
      </Stack>
      {state.status === 'loading' && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress size={28} aria-label={t('dashboard.loading')} />
        </Box>
      )}
      {(state.status === 'error' ||
        (state.status === 'ready' && state.failure)) && (
        <DashboardFailureAlert failure={state.failure!} onRetry={refresh} />
      )}
      {data && <DashboardMetrics data={data} />}
      <Stack spacing={2}>
        {data && (
          <>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'repeat(2, minmax(0, 1fr))',
                  xl: 'minmax(0, 1.2fr) minmax(0, 1fr)',
                },
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              <StationWipBreakdown
                stations={data.stations}
                totalVisits={data.metrics.totalStationLotVisits}
              />
              <StationStatusTable stations={data.stations} />
            </Box>
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'repeat(2, minmax(0, 1fr))',
                },
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              <StatusBreakdown
                title={t('dashboard.lotStatuses')}
                rows={data.lots}
                label={labels.statusLabel}
                empty={t('lots.empty')}
                selected={lotStatus}
                onSelect={setLotStatus}
                hint={t('dashboard.statusHint')}
              />
              <StatusBreakdown
                title={t('dashboard.styleStatuses')}
                rows={data.styles}
                label={styleLabel}
                empty={t('dashboard.noStyles')}
                hint={t('dashboard.stylesHint')}
              />
            </Box>
          </>
        )}
        <DashboardLotsTable
          key={lotStatus}
          status={lotStatus}
          statuses={statuses}
          onStatus={setLotStatus}
          stations={data?.stations || []}
          pollIntervalMs={pollIntervalMs}
          onHealthChange={setLotHealth}
        />
      </Stack>
    </>
  );
}
