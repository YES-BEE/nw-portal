import {
  Box,
  Chip,
  CircularProgress,
  LinearProgress,
  Paper,
  Stack,
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
import { getStyleProgress, reportsFailure } from './reportsApi';
import { ReportFailureAlert } from './ReportFailureAlert';

export function StyleProgressReport() {
  const { t } = useTranslation('translation');
  const report = usePagedList(getStyleProgress);
  const headings = [
    t('lots.style'),
    t('lots.status'),
    t('reports.totalLots'),
    t('reports.completedLots'),
    t('reports.averageProgress'),
    t('lots.created'),
    t('reports.releasedAt'),
  ];
  return (
    <Paper
      variant="outlined"
      sx={{ borderRadius: 2, minWidth: 0, overflow: 'hidden' }}
    >
      <Box sx={{ p: 2.5 }}>
        <Typography
          component="h2"
          sx={{ fontSize: 16, fontWeight: 600, mb: 1 }}
        >
          {t('reports.styleProgress')}
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 2 }}>
          {t('reports.styleProgressHint')}
        </Typography>
        <TextField
          size="small"
          type="search"
          label={t('reports.search')}
          placeholder={t('reports.styleSearchPlaceholder')}
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
          aria-label={t('reports.styleProgress')}
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
                report.state.data.items.map((style) => (
                  <TableRow key={style.id}>
                    <TableCell>{style.style_number}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        label={t(`styles.statusValues.${style.status}`)}
                      />
                    </TableCell>
                    <TableCell>{style.lot_count.toLocaleString()}</TableCell>
                    <TableCell>
                      {style.completed_lots.toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Stack spacing={0.5} sx={{ minWidth: 140 }}>
                        <Typography>
                          {style.progress_percent.toLocaleString(undefined, {
                            maximumFractionDigits: 2,
                          })}
                          %
                        </Typography>
                        <LinearProgress
                          variant="determinate"
                          value={style.progress_percent}
                          aria-label={t('reports.averageProgress')}
                          sx={{ height: 6, borderRadius: 1 }}
                        />
                      </Stack>
                    </TableCell>
                    <TableCell>{formatDateTime(style.created_at)}</TableCell>
                    <TableCell>
                      {style.released_at
                        ? formatDateTime(style.released_at)
                        : t('common.notProvided')}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={headings.length} align="center">
                    {t('reports.noStyles')}
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
