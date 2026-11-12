import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
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
  Box,
} from '@mui/material';
import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { formatDateTime } from '../../utils/formatDateTime';
import { getLotTimeline, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import { timelineNote, useLotLabels } from './lotDisplay';
import type { LotsQuery } from './types';
export function LotTimeline({ lotId }: { lotId: string }) {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  const load = useCallback(
    (query: LotsQuery, signal?: AbortSignal) =>
      getLotTimeline(lotId, query, signal),
    [lotId],
  );
  const list = usePagedList(load);
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="lot-timeline-title"
      sx={{ borderRadius: 2, overflow: 'hidden' }}
    >
      <Box sx={{ p: 3 }}>
        <Typography
          component="h2"
          id="lot-timeline-title"
          sx={{ fontSize: 17, fontWeight: 600, mb: 2 }}
        >
          {t('lots.timeline')}
        </Typography>
        <TextField
          type="search"
          label={t('lots.timelineSearch')}
          placeholder={t('lots.timelineSearchPlaceholder')}
          value={list.input}
          onChange={(event) => list.setInput(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          sx={{ width: '100%', maxWidth: 420 }}
        />
      </Box>
      {list.state.status === 'error' && (
        <LotFailureAlert
          failure={lotsFailure(list.state.error)}
          onReload={list.reload}
          onRetry={list.reload}
        />
      )}
      <TableContainer>
        <Table
          aria-labelledby="lot-timeline-title"
          aria-busy={list.state.status === 'loading'}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('lots.occurredAt')}</TableCell>
              <TableCell>{t('lots.location')}</TableCell>
              <TableCell>{t('lots.details')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.state.status === 'loading' && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  <CircularProgress
                    size={28}
                    aria-label={t('common.loading')}
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((event, index) => (
              <TableRow key={`${list.query.page}-${index}`}>
                <TableCell>{formatDateTime(event.occurred_at)}</TableCell>
                <TableCell>
                  {labels.locationLabel(event.location_type)}
                </TableCell>
                <TableCell>
                  {timelineNote(event.detail) || t('common.notProvided')}
                </TableCell>
              </TableRow>
            ))}
            {list.state.status === 'ready' && !items.length && (
              <TableRow>
                <TableCell colSpan={3} align="center" sx={{ py: 4 }}>
                  {t(
                    list.query.search
                      ? 'lots.noTimelineMatches'
                      : 'lots.emptyTimeline',
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
