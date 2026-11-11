import { useState } from 'react';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
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
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { readSession } from '../auth/session';
import { useSession } from '../auth/useSession';
import { loadProcesses } from '../processes/processData';
import {
  emptyStyle,
  getStyleErrors,
  loadStyles,
  ownsStyle,
  saveStyleRecord,
  STYLE_STORAGE_KEY,
  toStyleDraft,
} from './styleData';
import type { StyleDraft, StyleMode, StyleRecord } from './styleData';
import { StyleForm } from './StyleForm';
import { usePageMetadata } from '../../app/usePageMetadata';

export function StyleWorkspacePage({ mode }: { mode: StyleMode }) {
  const { t } = useTranslation('translation');
  const session = useSession();
  const navigate = useNavigate();
  const [data, setData] = useState(loadStyles);
  const [form, setForm] = useState<{
    initial: StyleDraft;
    editing: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<StyleRecord | null>(null);
  const [error, setError] = useState<
    | 'storageError'
    | 'recordsUnavailable'
    | 'processesUnavailable'
    | 'changedRecords'
    | null
  >(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const own = mode === 'own';
  const basePath = own ? '/new-style' : '/styles';
  const title = t(own ? 'navigation.newstyle' : 'navigation.styles');
  const tableTitle = t(own ? 'styles.myStyles' : 'styles.existing');
  const filtered = data.records.filter(
    (record) =>
      (!own || (session && ownsStyle(record, session))) &&
      [record.number, record.client, record.description].some((value) =>
        value.toLowerCase().includes(query.trim().toLowerCase()),
      ),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / rows) - 1),
  );

  usePageMetadata(
    t('access.pageTitle', { title }),
    t(own ? 'styles.ownDescription' : 'styles.pageDescription'),
  );

  function write(records: StyleRecord[]) {
    try {
      localStorage.setItem(STYLE_STORAGE_KEY, JSON.stringify(records));
      setData({ records, storageUnavailable: false });
      setError(null);
      setForm(null);
      setSaved(true);
      return true;
    } catch {
      setError('storageError');
      return false;
    }
  }

  function save(record: StyleRecord) {
    if (!form) return;
    const latest = loadStyles();
    const processes = loadProcesses();
    if (latest.storageUnavailable) {
      setError('recordsUnavailable');
      return;
    }
    if (processes.storageUnavailable) {
      setError('processesUnavailable');
      return;
    }
    if (
      !getStyleErrors(toStyleDraft(record), latest.records, processes.records)
        .valid
    ) {
      setError('changedRecords');
      return;
    }
    const records = saveStyleRecord(
      latest.records,
      record,
      form.editing,
      mode,
      readSession(),
    );
    if (!records) {
      setError('changedRecords');
      return;
    }
    if (write(records) && !form.editing) {
      void navigate(`${basePath}/${encodeURIComponent(record.id)}`, {
        state: { createdStyleId: record.id },
      });
    }
  }

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
            {title}
          </Typography>
          <Typography color="text.secondary" sx={{ mt: 0.5 }}>
            {t(own ? 'styles.ownDescription' : 'styles.pageDescription')}
          </Typography>
        </Box>
        {!form && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={data.storageUnavailable}
            onClick={() => {
              setError(null);
              setForm({ initial: emptyStyle(), editing: false });
            }}
            sx={{ flexShrink: 0 }}
          >
            {t(own ? 'navigation.newstyle' : 'styles.create')}
          </Button>
        )}
      </Stack>
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('styles.loadWarning')}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t(`styles.${error}`)}
        </Alert>
      )}
      {form ? (
        <StyleForm
          key={form.initial.id}
          {...form}
          onSave={save}
          onClose={() => {
            setForm(null);
            setError(null);
          }}
        />
      ) : (
        <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
          <Box sx={{ p: 3 }}>
            <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
              {tableTitle}
            </Typography>
            <TextField
              type="search"
              slotProps={{
                htmlInput: { 'aria-label': t('styles.search') },
              }}
              placeholder={t('styles.searchPlaceholder')}
              value={query}
              onChange={(event) => {
                setQuery(event.target.value);
                setPage(0);
              }}
              sx={{ width: '100%', maxWidth: 420 }}
            />
          </Box>
          <TableContainer>
            <Table aria-label={tableTitle} sx={{ minWidth: 900 }}>
              <TableHead>
                <TableRow>
                  {(
                    [
                      'number',
                      'client',
                      'created',
                      'garments',
                      'lots',
                      'delivery',
                      'route',
                      'actions',
                    ] as const
                  ).map((key) => (
                    <TableCell key={key}>{t(`styles.${key}`)}</TableCell>
                  ))}
                </TableRow>
              </TableHead>
              <TableBody>
                {filtered
                  .slice(currentPage * rows, (currentPage + 1) * rows)
                  .map((record) => (
                    <TableRow key={record.id}>
                      <TableCell component="th" scope="row">
                        {record.number}
                      </TableCell>
                      <TableCell>{record.client}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {record.created}
                      </TableCell>
                      <TableCell>{record.garments}</TableCell>
                      <TableCell>{record.lots}</TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        {record.delivery}
                      </TableCell>
                      <TableCell>
                        {t('styles.processCount', {
                          count: record.steps.length,
                        })}
                      </TableCell>
                      <TableCell sx={{ whiteSpace: 'nowrap' }}>
                        <Tooltip title={t('common.view')}>
                          <IconButton
                            size="small"
                            component={RouterLink}
                            to={`${basePath}/${encodeURIComponent(record.id)}`}
                            aria-label={t('styles.viewNamed', {
                              name: record.number,
                            })}
                          >
                            <VisibilityOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        {!own && (
                          <>
                            <Tooltip title={t('access.edit')}>
                              <IconButton
                                size="small"
                                disabled={data.storageUnavailable}
                                aria-label={t('access.editNamed', {
                                  name: record.number,
                                })}
                                onClick={() => {
                                  setError(null);
                                  setForm({
                                    initial: toStyleDraft(record),
                                    editing: true,
                                  });
                                }}
                              >
                                <EditOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                            <Tooltip title={t('access.delete')}>
                              <IconButton
                                size="small"
                                disabled={data.storageUnavailable}
                                color="error"
                                aria-label={t('access.deleteNamed', {
                                  name: record.number,
                                })}
                                onClick={() => setPendingDelete(record)}
                              >
                                <DeleteOutlinedIcon fontSize="small" />
                              </IconButton>
                            </Tooltip>
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                {!filtered.length && (
                  <TableRow>
                    <TableCell colSpan={8} align="center" sx={{ py: 4 }}>
                      {t('styles.empty')}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </TableContainer>
          {filtered.length > 0 && (
            <TablePagination
              component="div"
              count={filtered.length}
              page={currentPage}
              rowsPerPage={rows}
              rowsPerPageOptions={[10, 25, 50]}
              labelRowsPerPage={t('common.pagination.rowsPerPage')}
              labelDisplayedRows={({ from, to, count }) =>
                t('common.pagination.range', { from, to, count })
              }
              getItemAriaLabel={(type) => t(`common.pagination.${type}`)}
              onPageChange={(_, next) => setPage(next)}
              onRowsPerPageChange={(event) => {
                setRows(Number(event.target.value));
                setPage(0);
              }}
            />
          )}
        </Paper>
      )}
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        aria-labelledby="style-delete-title"
        aria-describedby="style-delete-message"
      >
        <DialogTitle id="style-delete-title">
          {t('styles.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="style-delete-message">
            {t('styles.deleteMessage', { name: pendingDelete?.number })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setPendingDelete(null)}>
            {t('access.cancel')}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => {
              const latest = loadStyles();
              const current = readSession();
              if (latest.storageUnavailable) setError('recordsUnavailable');
              else if (
                mode !== 'management' ||
                !current?.modules.includes('styles') ||
                !latest.records.some(
                  (record) => record.id === pendingDelete?.id,
                )
              )
                setError('changedRecords');
              else
                write(
                  latest.records.filter(
                    (record) => record.id !== pendingDelete?.id,
                  ),
                );
              setPendingDelete(null);
            }}
          >
            {t('access.delete')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('access.saved')}
      />
    </>
  );
}
