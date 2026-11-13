import { Box, Divider, Paper, Stack, Typography } from '@mui/material';
import InsightsOutlinedIcon from '@mui/icons-material/InsightsOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import { useTranslation } from 'react-i18next';
import { AnimatedCount } from './AnimatedCount';
import type { DashboardSummary } from './types';

export function DashboardInsights({ data }: { data: DashboardSummary }) {
  const { t } = useTranslation('translation');
  const total = data.lots.reduce((sum, row) => sum + row.count, 0);
  const count = (status: string) =>
    data.lots.find((row) => row.status === status)?.count ?? 0;
  const busiest = data.stations.reduce<
    DashboardSummary['stations'][number] | null
  >((best, station) => (station.wip > (best?.wip ?? 0) ? station : best), null);
  const entries = [
    {
      key: 'completionShare',
      value: total ? Math.round((count('COMPLETED') / total) * 100) : 0,
      suffix: '%',
      hint: t('dashboard.completionHint'),
      icon: CheckCircleOutlinedIcon,
      color: '#15803d',
      tint: '#edf9ef',
    },
    {
      key: 'inTransit',
      suffix: '',
      value: count('DISPATCHED'),
      hint: t('dashboard.transitHint'),
      icon: LocalShippingOutlinedIcon,
      color: '#0957f7',
      tint: '#edf4ff',
    },
    {
      key: 'readyLots',
      suffix: '',
      value: count('READY'),
      hint: t('dashboard.readyHint'),
      icon: PlayCircleOutlinedIcon,
      color: '#b77912',
      tint: '#fff7e7',
    },
    {
      key: 'busiestStation',
      suffix: '',
      value: busiest?.wip ?? 0,
      hint: busiest?.name || t('dashboard.noActiveWorkload'),
      icon: HubOutlinedIcon,
      color: '#7c3aed',
      tint: '#f4efff',
    },
  ] as const;
  return (
    <Paper
      component="section"
      aria-labelledby="dashboard-insights-title"
      variant="outlined"
      sx={{ borderRadius: 2, borderColor: '#e7edf5', overflow: 'hidden' }}
    >
      <Stack
        direction="row"
        spacing={1}
        sx={{
          alignItems: 'center',
          p: 2,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <InsightsOutlinedIcon color="primary" fontSize="small" />
        <Typography
          id="dashboard-insights-title"
          component="h2"
          sx={{ fontSize: 15, fontWeight: 700 }}
        >
          {t('dashboard.quickInsights')}
        </Typography>
      </Stack>
      <Stack divider={<Divider />} sx={{ px: 2 }}>
        {entries.map(
          ({ key, value, suffix, hint, icon: Icon, color, tint }) => (
            <Stack
              key={key}
              direction="row"
              spacing={1.25}
              sx={{ py: 1.75, alignItems: 'flex-start' }}
            >
              <Box
                sx={{
                  bgcolor: tint,
                  color,
                  display: 'grid',
                  placeItems: 'center',
                  width: 32,
                  height: 32,
                  borderRadius: '50%',
                  flexShrink: 0,
                }}
              >
                <Icon sx={{ fontSize: 18 }} />
              </Box>
              <Box sx={{ minWidth: 0, flex: 1 }}>
                <Stack
                  direction="row"
                  sx={{ gap: 1, justifyContent: 'space-between' }}
                >
                  <Typography sx={{ fontWeight: 600, fontSize: 12 }}>
                    {t(`dashboard.${key}`)}
                  </Typography>
                  <Typography
                    sx={{ fontWeight: 700, color, whiteSpace: 'nowrap' }}
                  >
                    <AnimatedCount value={value} />
                    {suffix}
                  </Typography>
                </Stack>
                <Typography
                  color="text.secondary"
                  sx={{ fontSize: 11, mt: 0.5 }}
                >
                  {hint}
                </Typography>
              </Box>
            </Stack>
          ),
        )}
      </Stack>
    </Paper>
  );
}
