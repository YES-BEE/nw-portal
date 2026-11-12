import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { StationWip, StatusCount } from './types';
import { useCallback } from 'react';
import { AnimatedCount } from './AnimatedCount';

const colors: Record<string, string> = {
  COMPLETED: '#15803d',
  CANCELLED: '#64748b',
  IN_PROCESS: '#0957f7',
  DISPATCHED: '#9333ea',
  IN_STORAGE: '#b45309',
  DRAFT: '#64748b',
  RELEASED: '#0891b2',
};
function Bar({
  label,
  value,
  max,
  color,
  formatValue,
}: {
  label: string;
  value: number;
  max: number;
  color: string;
  formatValue?: (value: number) => string;
}) {
  return (
    <Box sx={{ width: '100%' }}>
      <Stack
        direction="row"
        sx={{ justifyContent: 'space-between', gap: 2, mb: 0.75 }}
      >
        <Typography sx={{ overflowWrap: 'anywhere' }}>{label}</Typography>
        <Typography sx={{ fontWeight: 600 }}>
          <AnimatedCount value={value} format={formatValue} />
        </Typography>
      </Stack>
      <Box
        sx={{
          height: 8,
          bgcolor: '#eef2f7',
          borderRadius: 1,
          overflow: 'hidden',
        }}
      >
        <Box
          sx={{
            width: `${(value / Math.max(1, max)) * 100}%`,
            height: '100%',
            bgcolor: color,
            borderRadius: 1,
            transition: 'width 650ms ease-out',
            '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
          }}
        />
      </Box>
    </Box>
  );
}
export function StatusBreakdown({
  title,
  rows,
  label,
  empty,
  hint,
  selected,
  onSelect,
}: {
  title: string;
  rows: StatusCount[];
  label: (status: string) => string;
  empty: string;
  hint: string;
  selected?: string;
  onSelect?: (status: string) => void;
}) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  return (
    <Paper
      component="section"
      aria-label={title}
      variant="outlined"
      sx={{ p: 3, borderRadius: 2, minWidth: 0 }}
    >
      <Typography component="h2" sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {hint}
      </Typography>
      {rows.length ? (
        <Stack spacing={2}>
          {rows.map((row) =>
            onSelect ? (
              <Button
                key={row.status}
                size="small"
                variant={selected === row.status ? 'outlined' : 'text'}
                color="inherit"
                aria-pressed={selected === row.status}
                aria-label={`${label(row.status)}: ${row.count}`}
                onClick={() =>
                  onSelect(selected === row.status ? '' : row.status)
                }
                sx={{ textTransform: 'none', justifyContent: 'stretch', p: 1 }}
              >
                <Bar
                  label={label(row.status)}
                  value={row.count}
                  max={total}
                  color={colors[row.status] || '#0957f7'}
                />
              </Button>
            ) : (
              <Bar
                key={row.status}
                label={label(row.status)}
                value={row.count}
                max={total}
                color={colors[row.status] || '#0957f7'}
              />
            ),
          )}
        </Stack>
      ) : (
        <Alert severity="info">{empty}</Alert>
      )}
    </Paper>
  );
}
export function StationWipBreakdown({ stations }: { stations: StationWip[] }) {
  const { t } = useTranslation('translation');
  const formatVisits = useCallback(
    (count: number) => t('dashboard.stationVisitCount', { count }),
    [t],
  );
  const maximum = Math.max(1, ...stations.map((station) => station.wip));
  return (
    <Paper
      component="section"
      aria-labelledby="station-wip-title"
      variant="outlined"
      sx={{ p: 3, borderRadius: 2 }}
    >
      <Typography
        component="h2"
        id="station-wip-title"
        sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}
      >
        {t('dashboard.stationWip')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('dashboard.stationHint')}
      </Typography>
      {stations.length ? (
        <Stack spacing={2} sx={{ maxHeight: 360, overflowY: 'auto', pr: 1 }}>
          {stations.map((station) => (
            <Bar
              key={station.id}
              label={station.name || t('common.notProvided')}
              value={station.wip}
              formatValue={formatVisits}
              max={maximum}
              color="#0957f7"
            />
          ))}
        </Stack>
      ) : (
        <Alert severity="info">{t('dashboard.noStations')}</Alert>
      )}
    </Paper>
  );
}
