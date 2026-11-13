import { Box, Paper, Stack, Typography } from '@mui/material';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import PlayCircleOutlinedIcon from '@mui/icons-material/PlayCircleOutlined';
import CheckCircleOutlinedIcon from '@mui/icons-material/CheckCircleOutlined';
import StyleOutlinedIcon from '@mui/icons-material/StyleOutlined';
import WarehouseOutlinedIcon from '@mui/icons-material/WarehouseOutlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import { useTranslation } from 'react-i18next';
import { AnimatedCount } from './AnimatedCount';
import type { DashboardSummary } from './types';

export function DashboardMetrics({ data }: { data: DashboardSummary }) {
  const { t } = useTranslation('translation');
  const metrics = [
    {
      key: 'totalLots',
      value: data.lots.reduce((sum, row) => sum + row.count, 0),
      icon: Inventory2OutlinedIcon,
      color: '#0957f7',
      tint: '#edf4ff',
      hint: 'totalHint',
    },
    {
      key: 'openLots',
      value: data.lots
        .filter((row) => !['COMPLETED', 'CANCELLED'].includes(row.status))
        .reduce((sum, row) => sum + row.count, 0),
      icon: PlayCircleOutlinedIcon,
      color: '#07946d',
      tint: '#eaf8f2',
      hint: 'openHint',
    },
    {
      key: 'completedLots',
      value: data.lots.find((row) => row.status === 'COMPLETED')?.count ?? 0,
      icon: CheckCircleOutlinedIcon,
      color: '#15803d',
      tint: '#edf9ef',
      hint: 'completedHint',
    },
    {
      key: 'stylesWithLots',
      value: data.styles.reduce((sum, row) => sum + row.count, 0),
      icon: StyleOutlinedIcon,
      color: '#7c3aed',
      tint: '#f4efff',
      hint: 'stylesMetricHint',
    },
    {
      key: 'storageOccupancies',
      value: data.storageOccupancies,
      icon: WarehouseOutlinedIcon,
      color: '#b77912',
      tint: '#fff7e7',
      hint: 'storageHint',
    },
    {
      key: 'availableTrolleys',
      value: data.availableTrolleys,
      icon: LocalShippingOutlinedIcon,
      color: '#0891b2',
      tint: '#eaf8fc',
      hint: 'trolleysHint',
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
      {metrics.map(({ key, value, icon: Icon, color, tint, hint }) => (
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
              </Typography>
              <Typography color="text.secondary" sx={{ fontSize: 11 }}>
                {t(`dashboard.${hint}`)}
              </Typography>
            </Box>
          </Stack>
        </Paper>
      ))}
    </Box>
  );
}
