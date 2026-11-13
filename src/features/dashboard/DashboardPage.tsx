import { useEffect, useState } from 'react';
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
import { DashboardInsights } from './DashboardInsights';
import CircleIcon from '@mui/icons-material/Circle';
import type { DashboardFailure, DashboardSummary } from './types';
import { getDashboardPollIntervalMs } from './dashboardConfig';

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
  | { status: 'ready'; data: DashboardSummary; loadedAt: string }
  | { status: 'error'; failure: DashboardFailure };
export function DashboardPage() {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [lotStatus, setLotStatus] = useState('');
  usePageMetadata(t('dashboard.pageTitle'), t('dashboard.description'));
  const pollIntervalMs = getDashboardPollIntervalMs();
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
                loadedAt: new Date().toISOString(),
              });
          },
          (error: unknown) => {
            if (!controller.signal.aborted)
              setState({ status: 'error', failure: dashboardFailure(error) });
          },
        )
        .finally(() => {
          pending = false;
        });
    }
    poll();
    const timer = setInterval(poll, pollIntervalMs);
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [attempt, pollIntervalMs]);
  function refresh() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  const data = state.status === 'ready' ? state.data : null;
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
            label={t('dashboard.liveUpdates')}
            size="small"
            sx={{
              bgcolor: '#eaf8f1',
              color: '#15803d',
              fontWeight: 600,
              '& .MuiChip-icon': { color: '#16a365' },
            }}
          />
          {state.status === 'ready' && (
            <Typography color="text.secondary" sx={{ fontSize: 11 }}>
              {t('dashboard.updated', { date: formatDateTime(state.loadedAt) })}
            </Typography>
          )}
        </Stack>
      </Stack>
      {state.status === 'loading' && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress size={28} aria-label={t('dashboard.loading')} />
        </Box>
      )}
      {state.status === 'error' && (
        <DashboardFailureAlert failure={state.failure} onRetry={refresh} />
      )}
      {data && <DashboardMetrics data={data} />}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: {
            xs: 'minmax(0, 1fr)',
            xl: data ? 'minmax(0, 1fr) 290px' : 'minmax(0, 1fr)',
          },
          gap: 2,
        }}
      >
        <Stack spacing={2} sx={{ minWidth: 0 }}>
          {data && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: {
                  xs: 'minmax(0, 1fr)',
                  lg: 'minmax(0, 1.25fr) minmax(0, 1fr)',
                },
                gap: 2,
                alignItems: 'stretch',
              }}
            >
              <StationWipBreakdown stations={data.stations} />
              <StationStatusTable stations={data.stations} />
            </Box>
          )}
          <DashboardLotsTable
            key={lotStatus}
            status={lotStatus}
            statuses={statuses}
            onStatus={setLotStatus}
            stations={data?.stations || []}
          />
        </Stack>
        {data && (
          <Stack component="aside" spacing={2} sx={{ minWidth: 0 }}>
            <DashboardInsights data={data} />
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
          </Stack>
        )}
      </Box>
    </>
  );
}
