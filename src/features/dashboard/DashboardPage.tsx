import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined';
import { usePageMetadata } from '../../app/usePageMetadata';
import { formatDateTime } from '../../utils/formatDateTime';
import { useLotLabels } from '../lots/lotDisplay';
import { dashboardFailure, getDashboard } from './dashboardApi';
import { DashboardFailureAlert } from './DashboardFailureAlert';
import { DashboardLotsTable } from './DashboardLotsTable';
import { StatusBreakdown, StationWipBreakdown } from './DashboardBreakdowns';
import type { DashboardFailure, DashboardSummary, StatusCount } from './types';

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
  useEffect(() => {
    const controller = new AbortController();
    void getDashboard(controller.signal).then(
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
    );
    return () => controller.abort();
  }, [attempt]);
  function refresh() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  const data = state.status === 'ready' ? state.data : null;
  const total = (rows: StatusCount[]) =>
    rows.reduce((sum, row) => sum + row.count, 0);
  const statusCount = (value: string) =>
    data?.lots.find((row) => row.status === value)?.count || 0;
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
          {state.status === 'ready' && (
            <Typography color="text.secondary" sx={{ mt: 0.5 }}>
              {t('dashboard.updated', { date: formatDateTime(state.loadedAt) })}
            </Typography>
          )}
        </Box>
        <Button
          variant="outlined"
          startIcon={<RefreshOutlinedIcon />}
          disabled={state.status === 'loading'}
          onClick={refresh}
        >
          {t('dashboard.refresh')}
        </Button>
      </Stack>
      {state.status === 'loading' && (
        <Box sx={{ py: 4, textAlign: 'center' }}>
          <CircularProgress size={28} aria-label={t('dashboard.loading')} />
        </Box>
      )}
      {state.status === 'error' && (
        <DashboardFailureAlert failure={state.failure} onRetry={refresh} />
      )}
      {data && (
        <>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: {
                xs: '1fr 1fr',
                md: 'repeat(3, 1fr)',
                xl: 'repeat(6, 1fr)',
              },
              gap: 2,
              mb: 3,
            }}
          >
            {[
              { label: t('dashboard.totalLots'), value: total(data.lots) },
              {
                label: t('dashboard.openLots'),
                value: total(
                  data.lots.filter(
                    (row) => !['COMPLETED', 'CANCELLED'].includes(row.status),
                  ),
                ),
              },
              {
                label: t('dashboard.completedLots'),
                value: statusCount('COMPLETED'),
              },
              {
                label: t('dashboard.stylesWithLots'),
                value: total(data.styles),
              },
              {
                label: t('dashboard.storageOccupancies'),
                value: data.storageOccupancies,
              },
              {
                label: t('dashboard.availableTrolleys'),
                value: data.availableTrolleys,
              },
            ].map((metric) => (
              <Paper
                component="section"
                variant="outlined"
                key={metric.label}
                aria-label={metric.label}
                sx={{ p: 2.5, borderRadius: 2 }}
              >
                <Typography
                  component="h2"
                  sx={{
                    fontSize: 13,
                    fontWeight: 500,
                    color: 'text.secondary',
                    mb: 1,
                  }}
                >
                  {metric.label}
                </Typography>
                <Typography sx={{ fontSize: 17, fontWeight: 700 }}>
                  {metric.value.toLocaleString()}
                </Typography>
              </Paper>
            ))}
          </Box>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' },
              gap: 3,
              mb: 3,
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
          <StationWipBreakdown stations={data.stations} />
        </>
      )}
      <DashboardLotsTable
        key={`${attempt}-${lotStatus}`}
        status={lotStatus}
        statuses={statuses}
        onStatus={setLotStatus}
        stations={data?.stations || []}
      />
    </>
  );
}
