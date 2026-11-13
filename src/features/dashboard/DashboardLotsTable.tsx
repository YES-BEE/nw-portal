import { useCallback } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import ViewListOutlinedIcon from '@mui/icons-material/ViewListOutlined';
import type { ListQuery } from '../../api/collections';
import { ListPagination } from '../../api/ListPagination';
import { usePagedList } from '../../api/usePagedList';
import { useSession } from '../auth/useSession';
import { useLotLabels } from '../lots/lotDisplay';
import { formatDateTime } from '../../utils/formatDateTime';
import { dashboardFailure, getDashboardLots } from './dashboardApi';
import { DashboardFailureAlert } from './DashboardFailureAlert';
import type { StationWip } from './types';
import { getDashboardPollIntervalMs } from './dashboardConfig';

export function DashboardLotsTable({
  status,
  statuses,
  onStatus,
  stations,
}: {
  status: string;
  statuses: string[];
  onStatus: (value: string) => void;
  stations: StationWip[];
}) {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  const session = useSession();
  const canViewLot = session?.modules.includes('lots');
  const load = useCallback(
    (query: ListQuery, signal?: AbortSignal) =>
      getDashboardLots(query, signal, status || undefined),
    [status],
  );
  const list = usePagedList(load, getDashboardPollIntervalMs());
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  const columns = canViewLot ? 11 : 10;
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="dashboard-lots-title"
      sx={{ borderRadius: 2, overflow: 'hidden', borderColor: '#e7edf5' }}
    >
      <Stack
        direction={{ xs: 'column', lg: 'row' }}
        sx={{
          p: 2,
          gap: 2,
          justifyContent: 'space-between',
          alignItems: { lg: 'center' },
        }}
      >
        <Stack
          direction="row"
          spacing={1}
          sx={{ alignItems: 'center', flexShrink: 0 }}
        >
          <ViewListOutlinedIcon color="primary" fontSize="small" />
          <Typography
            component="h2"
            id="dashboard-lots-title"
            sx={{ fontSize: 15, fontWeight: 700 }}
          >
            {t('dashboard.lotsTitle')}
          </Typography>
        </Stack>
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={1.5}
          sx={{ minWidth: 0 }}
        >
          <TextField
            type="search"
            size="small"
            label={t('lots.search')}
            placeholder={t('dashboard.searchPlaceholder')}
            value={list.input}
            onChange={(event) => list.setInput(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ width: '100%', minWidth: { sm: 180 }, maxWidth: 300 }}
          />
          <TextField
            select
            size="small"
            label={t('lots.status')}
            value={status}
            onChange={(event) => onStatus(event.target.value)}
            sx={{ width: '100%', minWidth: { sm: 140 }, maxWidth: 200 }}
          >
            <MenuItem value="">{t('dashboard.allStatuses')}</MenuItem>
            {statuses.map((value) => (
              <MenuItem key={value} value={value}>
                {labels.statusLabel(value)}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
      </Stack>
      {list.state.status === 'error' && (
        <Box sx={{ px: 3 }}>
          <DashboardFailureAlert
            failure={dashboardFailure(list.state.error)}
            onRetry={list.reload}
          />
        </Box>
      )}
      <TableContainer>
        <Table
          aria-labelledby="dashboard-lots-title"
          aria-busy={list.state.status === 'loading'}
          size="small"
          sx={{
            minWidth: 1100,
            '& .MuiTableCell-root': { whiteSpace: 'nowrap', px: 1.5, py: 1.5 },
            '& .MuiTableRow-root:last-child .MuiTableCell-root': {
              borderBottom: 0,
            },
          }}
        >
          <TableHead>
            <TableRow>
              {(['number', 'style', 'quantity', 'status'] as const).map(
                (key) => (
                  <TableCell key={key}>{t(`lots.${key}`)}</TableCell>
                ),
              )}
              <TableCell>{t('dashboard.station')}</TableCell>
              <TableCell>{t('dashboard.process')}</TableCell>
              <TableCell>{t('lots.routeSequence')}</TableCell>
              <TableCell>{t('dashboard.currentLocation')}</TableCell>
              <TableCell>{t('lots.created')}</TableCell>
              <TableCell>{t('lots.completedAt')}</TableCell>
              {canViewLot && <TableCell>{t('lots.actions')}</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {list.state.status === 'loading' && (
              <TableRow>
                <TableCell colSpan={columns} align="center" sx={{ py: 4 }}>
                  <CircularProgress
                    size={28}
                    aria-label={t('common.loading')}
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((lot) => (
              <TableRow key={lot.id} hover>
                <TableCell component="th" scope="row" sx={{ fontWeight: 600 }}>
                  {lot.lot_number}
                </TableCell>
                <TableCell>{lot.style_number}</TableCell>
                <TableCell>{lot.quantity ?? t('lots.quantityUnset')}</TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    variant="filled"
                    color={
                      lot.status === 'COMPLETED'
                        ? 'success'
                        : lot.status === 'IN_PROCESS'
                          ? 'primary'
                          : lot.status === 'DISPATCHED'
                            ? 'secondary'
                            : [
                                  'READY',
                                  'AT_STATION',
                                  'READY_FOR_DISPATCH',
                                ].includes(lot.status)
                              ? 'warning'
                              : 'default'
                    }
                    sx={{
                      borderRadius: 1,
                      height: 23,
                      bgcolor:
                        lot.status === 'COMPLETED'
                          ? '#eaf8ef'
                          : lot.status === 'IN_PROCESS'
                            ? '#eaf2ff'
                            : lot.status === 'DISPATCHED'
                              ? '#f2edff'
                              : [
                                    'READY',
                                    'AT_STATION',
                                    'READY_FOR_DISPATCH',
                                  ].includes(lot.status)
                                ? '#fff6df'
                                : '#f1f4f8',
                      color:
                        lot.status === 'COMPLETED'
                          ? '#15803d'
                          : lot.status === 'IN_PROCESS'
                            ? '#0957f7'
                            : lot.status === 'DISPATCHED'
                              ? '#7c3aed'
                              : [
                                    'READY',
                                    'AT_STATION',
                                    'READY_FOR_DISPATCH',
                                  ].includes(lot.status)
                                ? '#946200'
                                : '#52647c',
                      fontWeight: 600,
                    }}
                    label={labels.statusLabel(lot.status)}
                  />
                </TableCell>
                <TableCell>
                  {stations.find(
                    (station) => station.code === lot.current_station,
                  )?.name || t('common.notProvided')}
                </TableCell>
                <TableCell>
                  {lot.current_process || t('common.notProvided')}
                </TableCell>
                <TableCell>{lot.current_route_sequence ?? '—'}</TableCell>
                <TableCell>
                  {labels.locationLabel(lot.current_location_type)}
                </TableCell>
                <TableCell>{formatDateTime(lot.created_at)}</TableCell>
                <TableCell>
                  {lot.completed_at ? formatDateTime(lot.completed_at) : '—'}
                </TableCell>
                {canViewLot && (
                  <TableCell>
                    <Tooltip title={t('common.view')}>
                      <IconButton
                        size="small"
                        color="primary"
                        component={RouterLink}
                        to={`/lots/${encodeURIComponent(lot.id)}`}
                        aria-label={t('lots.viewNamed', {
                          number: lot.lot_number,
                        })}
                      >
                        <VisibilityOutlinedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {list.state.status === 'ready' && !items.length && (
              <TableRow>
                <TableCell colSpan={columns} align="center" sx={{ py: 4 }}>
                  {t(
                    list.query.search || status
                      ? 'dashboard.noMatchingLots'
                      : 'lots.empty',
                  )}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      {list.state.status === 'ready' && items.length > 0 && (
        <ListPagination
          query={list.query}
          total={list.state.data.totalElements}
          onPage={list.setPage}
          onSize={list.setSize}
        />
      )}
    </Paper>
  );
}
