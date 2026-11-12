import { Fragment, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  Paper,
  Snackbar,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import LinkIcon from '@mui/icons-material/Link';
import LinkOffIcon from '@mui/icons-material/LinkOff';
import SyncIcon from '@mui/icons-material/Sync';
import { TrolleyNfcEditor, type TrolleyNfcChange } from './TrolleyNfcEditor';
import { getTrolleyNfcTags } from './trolleyNfcApi';
import { TagsError } from '../tags/tagsApi';
import { usePageMetadata } from '../../app/usePageMetadata';
import { getTrolleys, TrolleysError } from './trolleysApi';
import type {
  TrolleyResponse,
  TrolleysFailure,
  TrolleysResponse,
} from './types';
import { TrolleyFailureAlert } from './TrolleyFailureAlert';
import { TrolleyDialog } from './TrolleyDialog';
import type { TrolleySelection } from './TrolleyDialog';

type ListState =
  | { status: 'loading' }
  | { status: 'ready'; data: TrolleysResponse }
  | { status: 'error'; failure: TrolleysFailure };

export function TrolleyConfigurationsPage() {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<ListState>({ status: 'loading' });
  const [page, setPage] = useState(0);
  const [size, setSize] = useState(10);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selection, setSelection] = useState<TrolleySelection | null>(null);
  const [saved, setSaved] = useState(false);
  const [nfcSelection, setNfcSelection] = useState<{
    trolley: TrolleyResponse;
    change: TrolleyNfcChange;
  } | null>(null);
  const [assignments, setAssignments] = useState<{
    source: TrolleysResponse;
    byTrolley: Map<string, string[]>;
    failure?: TrolleysFailure;
  } | null>(null);
  usePageMetadata(t('trolleys.pageTitle'), t('trolleys.description'));
  useEffect(() => {
    const timer = setTimeout(() => {
      if (query.trim() !== search) {
        setState({ status: 'loading' });
        setSearch(query.trim());
        setPage(0);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query, search]);
  useEffect(() => {
    const controller = new AbortController();
    void getTrolleys({ page, size, search }, controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          const lastPage = Math.max(
            0,
            Math.ceil(data.totalElements / size) - 1,
          );
          if (page > lastPage) {
            setPage(lastPage);
            return;
          }
          setState({ status: 'ready', data });
          if (!data.items.length) return;
          void getTrolleyNfcTags(controller.signal, true).then(
            (tags) => {
              if (controller.signal.aborted) return;
              const byTrolley = new Map<string, string[]>();
              for (const tag of tags) {
                if (
                  tag.assigned &&
                  tag.asset_type === 'TROLLEY' &&
                  tag.trolley_id
                ) {
                  byTrolley.set(tag.trolley_id, [
                    ...(byTrolley.get(tag.trolley_id) || []),
                    tag.id,
                  ]);
                }
              }
              setAssignments({ source: data, byTrolley });
            },
            (error: unknown) => {
              if (controller.signal.aborted) return;
              const value =
                error instanceof TagsError
                  ? error.failure
                  : { kind: 'network' as const, action: 'retry' as const };
              setAssignments({
                source: data,
                byTrolley: new Map(),
                failure: {
                  ...value,
                  kind:
                    value.kind === 'representation'
                      ? 'invalidResponse'
                      : value.kind,
                },
              });
            },
          );
        }
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof TrolleysError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [page, size, search, attempt]);
  function reload() {
    setSelection(null);
    setNfcSelection(null);
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  function open(value: TrolleySelection) {
    setSaved(false);
    setSelection(value);
  }
  const items = state.status === 'ready' ? state.data.items : [];
  const currentAssignments =
    state.status === 'ready' && assignments?.source === state.data
      ? assignments
      : null;
  return (
    <>
      <Breadcrumbs
        sx={{ fontSize: 12, mb: 1 }}
        aria-label={t('navigation.configurations')}
      >
        <Typography sx={{ fontSize: 'inherit' }} color="text.secondary">
          {t('navigation.configurations')}
        </Typography>
        <Typography sx={{ fontSize: 'inherit' }}>
          {t('trolleys.title')}
        </Typography>
      </Breadcrumbs>
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
            {t('trolleys.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('trolleys.description')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          disabled={!!selection || !!nfcSelection}
          onClick={() => open({ mode: 'create' })}
        >
          {t('trolleys.create')}
        </Button>
      </Stack>
      {state.status === 'error' && (
        <TrolleyFailureAlert
          failure={state.failure}
          onReload={reload}
          onRetry={reload}
        />
      )}
      {currentAssignments?.failure && (
        <TrolleyFailureAlert
          failure={currentAssignments.failure}
          onReload={reload}
          onRetry={reload}
        />
      )}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <TextField
            type="search"
            label={t('trolleys.search')}
            placeholder={t('trolleys.searchPlaceholder')}
            value={query}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            sx={{ width: '100%', maxWidth: 420 }}
          />
        </Box>
        <TableContainer>
          <Table
            aria-label={t('trolleys.title')}
            aria-busy={state.status === 'loading'}
            sx={{ minWidth: 600 }}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('trolleys.code')}</TableCell>
                <TableCell>{t('trolleys.availability')}</TableCell>
                <TableCell>{t('access.status')}</TableCell>
                <TableCell>{t('access.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                    />
                  </TableCell>
                </TableRow>
              )}
              {items.map((record) => (
                <Fragment key={record.id}>
                  <TableRow>
                    <TableCell component="th" scope="row">
                      {record.code}
                    </TableCell>
                    <TableCell>
                      {record.status === 'AVAILABLE'
                        ? t('trolleys.available')
                        : record.status === 'IN_USE'
                          ? t('trolleys.inUse')
                          : record.status}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        variant="outlined"
                        color={record.active ? 'success' : 'default'}
                        label={t(
                          record.active ? 'access.active' : 'access.inactive',
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      {currentAssignments &&
                        !currentAssignments.failure &&
                        (() => {
                          const ids =
                            currentAssignments.byTrolley.get(record.id) || [];
                          const actions: TrolleyNfcChange[] = ids.length
                            ? [
                                ...(record.active && ids.length === 1
                                  ? [
                                      {
                                        mode: 'replace' as const,
                                        tagId: ids[0],
                                      },
                                    ]
                                  : []),
                                ...ids.map((tagId) => ({
                                  mode: 'unassign' as const,
                                  tagId,
                                })),
                              ]
                            : record.active
                              ? [{ mode: 'assign' }]
                              : [];
                          return actions.map((action) => (
                            <Tooltip
                              key={
                                action.mode +
                                ('tagId' in action ? action.tagId : '')
                              }
                              title={t(`trolleys.nfc.${action.mode}`)}
                            >
                              <Box component="span">
                                <IconButton
                                  size="small"
                                  color="primary"
                                  disabled={!!selection || !!nfcSelection}
                                  aria-label={t(
                                    `trolleys.nfc.${action.mode}Trolley`,
                                    { code: record.code },
                                  )}
                                  onClick={() =>
                                    setNfcSelection({
                                      trolley: record,
                                      change: action,
                                    })
                                  }
                                >
                                  {action.mode === 'assign' ? (
                                    <LinkIcon fontSize="small" />
                                  ) : action.mode === 'replace' ? (
                                    <SyncIcon fontSize="small" />
                                  ) : (
                                    <LinkOffIcon fontSize="small" />
                                  )}
                                </IconButton>
                              </Box>
                            </Tooltip>
                          ));
                        })()}
                      <Tooltip title={t('common.view')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!!selection || !!nfcSelection}
                            aria-label={t('trolleys.viewNamed', {
                              code: record.code,
                            })}
                            onClick={() => open({ mode: 'view', record })}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip title={t('access.edit')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={!!selection || !!nfcSelection}
                            aria-label={t('trolleys.editNamed', {
                              code: record.code,
                            })}
                            onClick={() => open({ mode: 'edit', record })}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip
                        title={t(
                          record.active ? 'access.delete' : 'trolleys.restore',
                        )}
                      >
                        <Box component="span">
                          <IconButton
                            size="small"
                            color={record.active ? 'error' : 'primary'}
                            disabled={!!selection || !!nfcSelection}
                            aria-label={t(
                              record.active
                                ? 'trolleys.deleteNamed'
                                : 'trolleys.restoreNamed',
                              { code: record.code },
                            )}
                            onClick={() => open({ mode: 'status', record })}
                          >
                            {record.active ? (
                              <DeleteOutlinedIcon fontSize="small" />
                            ) : (
                              <RestoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                  {nfcSelection?.trolley.id === record.id && (
                    <TableRow>
                      <TableCell colSpan={4}>
                        <TrolleyNfcEditor
                          trolley={record}
                          change={nfcSelection.change}
                          onClose={reload}
                          onSaved={() => {
                            setSaved(true);
                            reload();
                          }}
                        />
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
              {state.status === 'ready' && !items.length && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    {t('trolleys.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {state.status === 'ready' && items.length > 0 && (
          <TablePagination
            component="div"
            count={state.data.totalElements}
            page={page}
            rowsPerPage={size}
            rowsPerPageOptions={[10, 25, 50, 100]}
            labelRowsPerPage={t('common.pagination.rowsPerPage')}
            labelDisplayedRows={({ from, to, count }) =>
              t('common.pagination.range', { from, to, count })
            }
            getItemAriaLabel={(type) => t(`common.pagination.${type}`)}
            onPageChange={(_, value) => {
              setState({ status: 'loading' });
              setPage(value);
            }}
            onRowsPerPageChange={(event) => {
              setState({ status: 'loading' });
              setSize(Number(event.target.value));
              setPage(0);
            }}
          />
        )}
      </Paper>
      {selection && (
        <TrolleyDialog
          selection={selection}
          onClose={() => setSelection(null)}
          onReload={reload}
          onSaved={() => {
            setSaved(true);
            reload();
          }}
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('trolleys.saved')}
      />
    </>
  );
}
