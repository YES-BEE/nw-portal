import { Box, Paper, Stack, Typography } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import PercentOutlinedIcon from '@mui/icons-material/PercentOutlined';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
import ScheduleOutlinedIcon from '@mui/icons-material/ScheduleOutlined';
import { useTranslation } from 'react-i18next';
import { AnimatedCount } from './AnimatedCount';
import type { DashboardSummary } from './types';

export function DashboardMetrics({ data }: { data: DashboardSummary }) {
  const { t } = useTranslation('translation');
  const metrics = [
    {
      key: 'totalLots',
      value: data.metrics.totalLots,
      icon: Inventory2OutlinedIcon,
      color: '#0957f7',
      tint: '#edf4ff',
      hint: t('dashboard.totalHint'),
      suffix: '',
    },
    {
      key: 'openLots',
      value: data.metrics.openLots,
      icon: PlayCircleOutlinedIcon,
      color: '#07946d',
      tint: '#eaf8f2',
      hint: t('dashboard.openHint'),
      suffix: '',
    },
    {
      key: 'completedLots',
      value: data.metrics.completedLots,
      icon: CheckCircleOutlinedIcon,
      color: '#15803d',
      tint: '#edf9ef',
      hint: t('dashboard.completedHint'),
      suffix: '',
    },
    {
      key: 'stylesWithLots',
      value: data.metrics.stylesWithLots,
      icon: StyleOutlinedIcon,
      color: '#7c3aed',
      tint: '#f4efff',
      hint: t('dashboard.stylesMetricHint'),
      suffix: '',
    },
    {
      key: 'storageOccupancies',
      value: data.metrics.storedLots,
      icon: WarehouseOutlinedIcon,
      color: '#b77912',
      tint: '#fff7e7',
      hint: t('dashboard.storageHint'),
      suffix: '',
    },
    {
      key: 'availableTrolleys',
      value: data.metrics.availableTrolleys,
      icon: LocalShippingOutlinedIcon,
      color: '#0891b2',
      tint: '#eaf8fc',
      hint: t('dashboard.trolleysHint'),
      suffix: '',
    },
    {
      key: 'completionShare',
      value: data.metrics.completedSharePercent,
      icon: PercentOutlinedIcon,
      color: '#15803d',
      tint: '#edf9ef',
      hint: t('dashboard.completionHint'),
      suffix: '%',
    },
    {
      key: 'inTransit',
      value: data.metrics.inTransitLots,
      icon: LocalShippingOutlinedIcon,
      color: '#0957f7',
      tint: '#edf4ff',
      hint: t('dashboard.transitHint'),
      suffix: '',
    },
    {
      key: 'readyLots',
      value: data.metrics.readyToStartLots,
      icon: ScheduleOutlinedIcon,
      color: '#b77912',
      tint: '#fff7e7',
      hint: t('dashboard.readyHint'),
      suffix: '',
    },
    {
      key: 'totalStationVisits',
      value: data.metrics.totalStationLotVisits,
      icon: FactCheckOutlinedIcon,
      color: '#0891b2',
      tint: '#eaf8fc',
      hint: t('dashboard.stationVisitsHint'),
      suffix: '',
    },
    {
      key: 'busiestStation',
      value: data.metrics.highestStationWorkloadCount,
      icon: HubOutlinedIcon,
      color: '#7c3aed',
      tint: '#f4efff',
      hint: data.metrics.highestStationWorkload
        ? data.metrics.highestStationWorkload.name || t('common.notProvided')
        : t('dashboard.noActiveWorkload'),
      suffix: '',
    },
  ] as const;
  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: {
          xs: 'repeat(2, minmax(0, 1fr))',
          md: 'repeat(3, minmax(0, 1fr))',
          xl: 'repeat(6, minmax(0, 1fr))',
        },
        gap: 1.5,
        mb: 2.5,
      }}
    >
      {metrics.map(({ key, value, icon: Icon, color, tint, hint, suffix }) => (
        <Paper
          key={key}
          component="section"
          aria-label={t(`dashboard.${key}`)}
          variant="outlined"
          sx={{
            p: 2,
            borderRadius: 2,
            borderColor: '#e7edf5',
            boxShadow: '0 3px 12px #132e5504',
            minWidth: 0,
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{ alignItems: 'flex-start' }}
          >
            <Box
              sx={{
                bgcolor: tint,
                color,
                width: 38,
                height: 38,
                flexShrink: 0,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Icon sx={{ fontSize: 22 }} />
            </Box>
            <Box sx={{ minWidth: 0 }}>
              <Typography
                component="h2"
                sx={{ fontSize: 12, fontWeight: 500, color: 'text.secondary' }}
              >
                {t(`dashboard.${key}`)}
              </Typography>
              <Typography
                sx={{
                  fontSize: 24,
                  fontWeight: 750,
                  letterSpacing: -0.6,
                  my: 0.25,
                }}
              >
                <AnimatedCount value={value} />
                {suffix}
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 11 }}>
                {hint}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
