import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  LinearProgress,
} from '@mui/material';
import HubOutlinedIcon from '@mui/icons-material/HubOutlined';
import FactCheckOutlinedIcon from '@mui/icons-material/FactCheckOutlined';
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
      sx={{ p: 2, borderRadius: 2, minWidth: 0, borderColor: '#e7edf5' }}
    >
      <Typography component="h2" sx={{ fontSize: 15, fontWeight: 700, mb: 1 }}>
        {title}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2, fontSize: 11 }}>
        {hint}
      </Typography>
      {rows.length ? (
        <Stack spacing={1.5}>
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
      sx={{
        p: 2,
        borderRadius: 2,
        borderColor: '#e7edf5',
        minWidth: 0,
        height: '100%',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <HubOutlinedIcon color="primary" fontSize="small" />
        <Typography
          component="h2"
          id="station-wip-title"
          sx={{ fontSize: 15, fontWeight: 700 }}
        >
          {t('dashboard.stationWip')}
        </Typography>
      </Stack>
      <Typography color="text.secondary" sx={{ mb: 2, fontSize: 11 }}>
        {t('dashboard.stationHint')}
      </Typography>
      {stations.length ? (
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: 1.25,
            maxHeight: 260,
            overflowY: 'auto',
          }}
        >
          {stations.map((station) => (
            <Box
              key={station.id}
              sx={{
                p: 1.5,
                border: 1,
                borderColor: '#e1edf8',
                borderRadius: 1.5,
                background: 'linear-gradient(145deg, #f0f8ff, #fbfdff)',
              }}
            >
              <Bar
                label={station.name || t('common.notProvided')}
                value={station.wip}
                formatValue={formatVisits}
                max={maximum}
                color="#0957f7"
              />
            </Box>
          ))}
        </Box>
      ) : (
        <Alert severity="info">{t('dashboard.noStations')}</Alert>
      )}
    </Paper>
  );
}

export function StationStatusTable({ stations }: { stations: StationWip[] }) {
  const { t } = useTranslation('translation');
  const total = stations.reduce((sum, station) => sum + station.wip, 0);
  return (
    <Paper
      component="section"
      aria-labelledby="station-status-title"
      variant="outlined"
      sx={{
        borderRadius: 2,
        borderColor: '#e7edf5',
        minWidth: 0,
        overflow: 'hidden',
        height: '100%',
      }}
    >
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', p: 2 }}>
        <FactCheckOutlinedIcon color="primary" fontSize="small" />
        <Typography
          component="h2"
          id="station-status-title"
          sx={{ fontSize: 15, fontWeight: 700 }}
        >
          {t('dashboard.stationStatus')}
        </Typography>
      </Stack>
      {stations.length ? (
        <TableContainer sx={{ maxHeight: 280 }}>
          <Table
            size="small"
            stickyHeader
            aria-labelledby="station-status-title"
            sx={{ '& .MuiTableCell-root': { px: 1.5, py: 1.25 } }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('dashboard.stationName')}</TableCell>
                <TableCell align="right">{t('dashboard.visits')}</TableCell>
                <TableCell>{t('dashboard.workloadShare')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {stations.map((station) => {
                const share = total
                  ? Math.round((station.wip / total) * 100)
                  : 0;
                return (
                  <TableRow key={station.id}>
                    <TableCell sx={{ fontWeight: 600 }}>
                      {station.name || t('common.notProvided')}
                    </TableCell>
                    <TableCell align="right">
                      <AnimatedCount value={station.wip} />
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        spacing={1}
                        sx={{ alignItems: 'center', minWidth: 85 }}
                      >
                        <LinearProgress
                          variant="determinate"
                          value={share}
                          sx={{
                            flex: 1,
                            height: 6,
                            borderRadius: 3,
                            bgcolor: '#e8f4ee',
                            '& .MuiLinearProgress-bar': {
                              bgcolor: '#16a365',
                              borderRadius: 3,
                              transition: 'transform 650ms ease-out',
                              '@media (prefers-reduced-motion: reduce)': {
                                transition: 'none',
                              },
                            },
                          }}
                        />
                        <Typography
                          sx={{
                            fontSize: 11,
                            color: 'text.secondary',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          <AnimatedCount value={share} />%
                        </Typography>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableContainer>
      ) : (
        <Box sx={{ p: 2 }}>
          <Alert severity="info">{t('dashboard.noStationStatus')}</Alert>
        </Box>
      )}
      <Typography color="text.secondary" sx={{ p: 1.5, fontSize: 11 }}>
        {t('dashboard.workloadShareHint')}
      </Typography>
    </Paper>
  );
}
