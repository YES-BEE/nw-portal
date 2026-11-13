import {
  Box,
  Chip,
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ListPagination } from '../../api/ListPagination';
import { usePagedList } from '../../api/usePagedList';
import { formatDateTime } from '../../utils/formatDateTime';
import { LotProgress } from '../lots/LotProgress';
import { useDashboardLotLabels } from '../dashboard/useDashboardLotLabels';
import { getLotProgress, reportsFailure } from './reportsApi';
import { ReportFailureAlert } from './ReportFailureAlert';

export function LotProgressReport() {
  const { t } = useTranslation('translation');
  const labels = useDashboardLotLabels();
  const report = usePagedList(getLotProgress);
  const headings = [
    t('lots.style'),
    t('lots.number'),
    t('lots.quantity'),
    t('lots.status'),
    t('lots.progress'),
    t('reports.station'),
    t('dashboard.process'),
    t('reports.processStatus'),
    t('lots.routeSequence'),
    t('lots.created'),
    t('lots.completedAt'),
  ];
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, minWidth: 0, overflow: 'hidden' }}
    >
      <Box sx={{ p: 2.5 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 16, fontWeight: 600, mb: 2 }}
        >
          {t('reports.lotProgress')}
        </Typography>
        <TextField
          size="small"
          type="search"
          label={t('reports.search')}
          placeholder={t('reports.searchPlaceholder')}
          value={report.input}
          onChange={(event) => report.setInput(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          sx={{ width: { xs: '100%', sm: 340 } }}
        />
      </Box>
      {report.state.status === 'error' && (
        <Box sx={{ px: 2.5, pb: 2 }}>
          <ReportFailureAlert
            failure={reportsFailure(report.state.error)}
            onRetry={report.reload}
          />
        </Box>
      )}
      <TableContainer>
        <Table
          size="small"
          aria-label={t('reports.lotProgress')}
          aria-busy={report.state.status === 'loading'}
          sx={{ '& .MuiTableCell-root': { whiteSpace: 'nowrap' } }}
        >
          <TableHead>
            <TableRow>
              {headings.map((heading) => (
                <TableCell key={heading}>{heading}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {report.state.status === 'loading' && (
              <TableRow>
                <TableCell colSpan={headings.length} align="center">
                  <CircularProgress
                    size={24}
                    aria-label={t('reports.loading')}
                  />
                </TableCell>
              </TableRow>
            )}
            {report.state.status === 'ready' &&
              (report.state.data.items.length ? (
                report.state.data.items.map((lot) => (
                  <TableRow key={lot.id}>
                    <TableCell>{lot.style_number}</TableCell>
                    <TableCell>{lot.lot_number}</TableCell>
                    <TableCell>
                      {lot.quantity ?? t('lots.quantityUnset')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={labels.statusLabel(lot.status)}
                      />
                    </TableCell>
                    <TableCell>
                      <LotProgress
                        percent={lot.progress_percent}
                        completed={lot.completed_processes}
                        total={lot.total_processes}
                      />
                    </TableCell>
                    <TableCell>
                      {lot.current_station || t('common.notProvided')}
                    </TableCell>
                    <TableCell>
                      {lot.current_process || t('common.notProvided')}
                    </TableCell>
                    <TableCell>
                      {lot.current_process_status || t('common.notProvided')}
                    </TableCell>
                    <TableCell>
                      {lot.current_route_sequence ?? t('common.notProvided')}
                    </TableCell>
                    <TableCell>{formatDateTime(lot.created_at)}</TableCell>
                    <TableCell>
                      {lot.completed_at
                        ? formatDateTime(lot.completed_at)
                        : t('common.notProvided')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headings.length}>
                    {t('reports.noLots')}
                  </TableCell>
                </TableRow>
              ))}
          </TableBody>
        </Table>
      </TableContainer>
      {report.state.status === 'ready' && (
        <ListPagination
          query={report.query}
          total={report.state.data.totalElements}
          onPage={report.setPage}
          onSize={report.setSize}
        />
      )}
    </Paper>
  );
}
