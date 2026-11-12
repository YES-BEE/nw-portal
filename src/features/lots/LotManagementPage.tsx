import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
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
  Snackbar,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { usePageMetadata } from '../../app/usePageMetadata';
import { formatDateTime } from '../../utils/formatDateTime';
import { getLots, getLotStyleOptions, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import { LotForm } from './LotForm';
import { LotCancelDialog } from './LotCancelDialog';
import { useLotLabels } from './lotDisplay';
import type {
  LotResponse,
  LotStyleOption,
  LotsFailure,
  LotsQuery,
} from './types';
type StyleFilter = { id: string; name: string };
type LookupState =
  | { status: 'loading' }
  | { status: 'ready'; styles: LotStyleOption[] }
  | { status: 'error'; failure: LotsFailure };
export function LotManagementPage() {
  const [filter, setFilter] = useState<StyleFilter>({ id: '', name: '' });
  return <LotWorkspace key={filter.id} filter={filter} onFilter={setFilter} />;
}
function LotWorkspace({
  filter,
  onFilter,
}: {
  filter: StyleFilter;
  onFilter: (value: StyleFilter) => void;
}) {
  const { t } = useTranslation('translation');
  const navigate = useNavigate();
  const labels = useLotLabels();
  const load = useCallback(
    (query: LotsQuery, signal?: AbortSignal) =>
      getLots(query, signal, filter.id || undefined),
    [filter.id],
  );
  const list = usePagedList(load);
  const [lookup, setLookup] = useState<LookupState>({ status: 'loading' });
  const [lookupAttempt, setLookupAttempt] = useState(0);
  const [creating, setCreating] = useState(false);
  const [cancelling, setCancelling] = useState<LotResponse | null>(null);
  const [cancelled, setCancelled] = useState(false);
  const busy = creating || !!cancelling;
  usePageMetadata(t('lots.pageTitle'), t('lots.description'));
  useEffect(() => {
    const controller = new AbortController();
    void getLotStyleOptions(controller.signal).then(
      (styles) => {
        if (!controller.signal.aborted) setLookup({ status: 'ready', styles });
      },
      (error) => {
        if (!controller.signal.aborted)
          setLookup({ status: 'error', failure: lotsFailure(error) });
      },
    );
    return () => controller.abort();
  }, [lookupAttempt]);
  function retryStyles() {
    setLookup({ status: 'loading' });
    setLookupAttempt((value) => value + 1);
  }
  function reload() {
    setCreating(false);
    setCancelling(null);
    list.reload();
  }
  const styles = lookup.status === 'ready' ? lookup.styles : [];
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          justifyContent: 'space-between',
          alignItems: { xs: 'flex-start', sm: 'center' },
          gap: 2,
          mb: 3,
        }}
      >
        <Box>
          <Typography component="h1" sx={{ fontSize: 26, fontWeight: 700 }}>
            {t('lots.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t('lots.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={busy || lookup.status !== 'ready' || !styles.length}
          onClick={() => setCreating(true)}
        >
          {t('lots.add')}
        </Button>
      </Stack>
      {lookup.status === 'error' && (
        <LotFailureAlert
          failure={lookup.failure}
          onReload={retryStyles}
          onRetry={retryStyles}
        />
      )}
      {lookup.status === 'ready' && !styles.length && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('lots.noStyles')}
        </Alert>
      )}
      {list.state.status === 'error' && (
        <LotFailureAlert
          failure={lotsFailure(list.state.error)}
          onReload={reload}
          onRetry={reload}
        />
      )}
      <Paper
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          spacing={2}
          sx={{ p: 3 }}
        >
          <TextField
            type="search"
            label={t('lots.search')}
            placeholder={t('lots.searchPlaceholder')}
            value={list.input}
            disabled={busy}
            onChange={(event) => list.setInput(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ width: '100%', maxWidth: 420 }}
          />
          <TextField
            select
            label={t('lots.filterStyle')}
            value={filter.id}
            disabled={busy || lookup.status === 'loading'}
            onChange={(event) =>
              onFilter({
                id: event.target.value,
                name:
                  styles.find((style) => style.id === event.target.value)
                    ?.style_number || '',
              })
            }
            sx={{ width: '100%', maxWidth: 320 }}
          >
            <MenuItem value="">{t('lots.allStyles')}</MenuItem>
            {filter.id && !styles.some((style) => style.id === filter.id) && (
              <MenuItem value={filter.id}>{filter.name}</MenuItem>
            )}
            {styles.map((style) => (
              <MenuItem key={style.id} value={style.id}>
                {style.style_number}
              </MenuItem>
            ))}
          </TextField>
        </Stack>
        <TableContainer>
          <Table
            aria-label={t('lots.title')}
            aria-busy={list.state.status === 'loading'}
            sx={{ minWidth: 700 }}
          >
            <TableHead>
              <TableRow>
                {(
                  [
                    'number',
                    'style',
                    'quantity',
                    'status',
                    'location',
                    'created',
                    'actions',
                  ] as const
                ).map((key) => (
                  <TableCell key={key}>{t(`lots.${key}`)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                    />
                  </TableCell>
                </TableRow>
              )}
              {items.map((lot) => (
                <TableRow key={lot.id}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 600 }}
                  >
                    {lot.lot_number}
                  </TableCell>
                  <TableCell>{lot.style_number}</TableCell>
                  <TableCell>{lot.quantity}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      variant="outlined"
                      label={labels.statusLabel(lot.status)}
                    />
                  </TableCell>
                  <TableCell>
                    {labels.locationLabel(lot.current_location_type)}
                  </TableCell>
                  <TableCell>{formatDateTime(lot.created_at)}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={t('common.view')}>
                        <IconButton
                          size="small"
                          color="primary"
                          disabled={busy}
                          component={RouterLink}
                          to={`/lots/${encodeURIComponent(lot.id)}`}
                          aria-label={t('lots.viewNamed', {
                            number: lot.lot_number,
                          })}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {!['COMPLETED', 'CANCELLED'].includes(lot.status) && (
                        <Tooltip title={t('lots.cancel')}>
                          <Box component="span">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={busy}
                              aria-label={t('lots.cancelNamed', {
                                number: lot.lot_number,
                              })}
                              onClick={() => setCancelling(lot)}
                            >
                              <BlockOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Tooltip>
                      )}
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {list.state.status === 'ready' && !items.length && (
                <TableRow>
                  <TableCell colSpan={7} align="center" sx={{ py: 4 }}>
                    {t(list.query.search ? 'lots.noMatches' : 'lots.empty')}
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
      {creating && (
        <LotForm
          styles={styles}
          initialStyleId={filter.id}
          onClose={() => setCreating(false)}
          onReload={() => {
            reload();
            retryStyles();
          }}
          onCreated={(lot) => {
            void navigate(`/lots/${encodeURIComponent(lot.id)}`, {
              state: { createdLotId: lot.id },
            });
          }}
        />
      )}
      {cancelling && (
        <LotCancelDialog
          lot={cancelling}
          onClose={() => setCancelling(null)}
          onReload={reload}
          onCancelled={() => {
            setCancelled(true);
            reload();
          }}
        />
      )}
      <Snackbar
        open={cancelled}
        autoHideDuration={3500}
        onClose={() => setCancelled(false)}
        message={t('lots.cancelled')}
      />
    </>
  );
}
