import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
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
import type { ListQuery } from '../../api/collections';
import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { formatDateTime } from '../../utils/formatDateTime';
import { getStyleRevisions, stylesFailure } from './stylesApi';
import { StyleFailureAlert } from './StyleFailureAlert';

export function StyleRevisionHistory({ styleId }: { styleId: string }) {
  const { t } = useTranslation('translation');
  const load = useCallback(
    (query: ListQuery, signal?: AbortSignal) =>
      getStyleRevisions(styleId, query, signal),
    [styleId],
  );
  const list = usePagedList(load);
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="style-history-title"
      sx={{ mt: 3, borderRadius: 2, overflow: 'hidden' }}
    >
      <Box sx={{ p: 3 }}>
        <Typography
          component="h2"
          id="style-history-title"
          sx={{ fontSize: 17, fontWeight: 600, mb: 2 }}
        >
          {t('styles.historyTitle')}
        </Typography>
        <TextField
          type="search"
          label={t('styles.historySearch')}
          placeholder={t('styles.historySearchPlaceholder')}
          value={list.input}
          onChange={(event) => list.setInput(event.target.value)}
          slotProps={{ htmlInput: { maxLength: 200 } }}
          sx={{ width: '100%', maxWidth: 420 }}
        />
      </Box>
      {list.state.status === 'error' && (
        <StyleFailureAlert
          failure={stylesFailure(list.state.error)}
          onReload={list.reload}
          onRetry={list.reload}
        />
      )}
      <TableContainer>
        <Table
          aria-labelledby="style-history-title"
          aria-busy={list.state.status === 'loading'}
          sx={{ minWidth: 600 }}
        >
          <TableHead>
            <TableRow>
              <TableCell>{t('styles.historyRevision')}</TableCell>
              <TableCell>{t('styles.historyDate')}</TableCell>
              <TableCell>{t('styles.historyRole')}</TableCell>
              <TableCell>{t('styles.revisionReason')}</TableCell>
              <TableCell>{t('styles.historyLots')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {list.state.status === 'loading' && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  <CircularProgress
                    size={28}
                    aria-label={t('common.loading')}
                  />
                </TableCell>
              </TableRow>
            )}
            {items.map((revision) => (
              <TableRow key={revision.id}>
                <TableCell component="th" scope="row">
                  {revision.revision_no}
                </TableCell>
                <TableCell>{formatDateTime(revision.created_at)}</TableCell>
                <TableCell>{revision.actor_role}</TableCell>
                <TableCell
                  sx={{ whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}
                >
                  {revision.reason}
                </TableCell>
                <TableCell>{revision.affected_lot_count}</TableCell>
              </TableRow>
            ))}
            {list.state.status === 'ready' && !items.length && (
              <TableRow>
                <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                  {t(
                    list.query.search
                      ? 'styles.historyNoMatches'
                      : 'styles.historyEmpty',
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
