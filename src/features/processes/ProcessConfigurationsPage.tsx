import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Chip,
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
  TableRow,
  Typography,
  Tooltip,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import AddIcon from '@mui/icons-material/Add';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Link as RouterLink } from 'react-router-dom';
import {
  emptyProcess,
  loadProcesses,
  PROCESS_STORAGE_KEY,
} from './processData';
import type { ProcessConfiguration } from './types';
import { ProcessForm } from './ProcessForm';

type Toast = 'saved' | 'deleted';

export function ProcessConfigurationsPage() {
  const { t } = useTranslation('translation');
  const [data, setData] = useState(loadProcesses);
  const [form, setForm] = useState<{
    initial: ProcessConfiguration;
    editing: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<ProcessConfiguration | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    document.title = t('processes.pageTitle');
    document.documentElement.lang = 'en';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('processes.pageDescription'));
  }, [t]);

  function persist(records: ProcessConfiguration[], message: Toast) {
    try {
      localStorage.setItem(PROCESS_STORAGE_KEY, JSON.stringify(records));
      setData({ records, storageUnavailable: false });
      setStorageError(false);
      setForm(null);
      setToast(message);
    } catch {
      setStorageError(true);
    }
  }

  function confirm() {
    if (!pendingDelete) return;
    persist(
      data.records.filter((record) => record.id !== pendingDelete.id),
      'deleted',
    );
    setPendingDelete(null);
  }

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
          {t('processes.title')}
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
            {t('processes.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
            {t('processes.pageDescription')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          onClick={() => {
            setForm({ initial: emptyProcess(), editing: false });
            setStorageError(false);
          }}
          sx={{ flexShrink: 0 }}
        >
          {t('processes.create')}
        </Button>
      </Stack>
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('processes.loadWarning')}
        </Alert>
      )}
      {storageError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('processes.storageError')}
        </Alert>
      )}
      <Paper
        component="section"
        variant="outlined"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
        aria-labelledby="existing-processes-heading"
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'flex-start', sm: 'center' },
            gap: 2,
            px: 3,
            py: 2.5,
          }}
        >
          <Box>
            <Typography
              component="h2"
              id="existing-processes-heading"
              sx={{ fontSize: 17, fontWeight: 600 }}
            >
              {t('processes.existing')}
            </Typography>
          </Box>
        </Stack>
        <TableContainer>
          <Table
            aria-labelledby="existing-processes-heading"
            sx={{ minWidth: 700 }}
          >
            <TableHead
              sx={{
                bgcolor: '#f7f9fc',
                '& th': {
                  color: 'text.secondary',
                  fontSize: 11,
                  letterSpacing: 0.4,
                },
              }}
            >
              <TableRow>
                {(
                  [
                    'processColumn',
                    'stationColumn',
                    'trackingLevelColumn',
                    'tagsColumn',
                    'actionsColumn',
                  ] as const
                ).map((column) => (
                  <TableCell key={column} scope="col">
                    {t(`processes.${column}`)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.records.map((record) => (
                <TableRow
                  key={record.id}
                  sx={{ '& td, & th': { verticalAlign: 'top' } }}
                >
                  <TableCell component="th" scope="row">
                    <Typography sx={{ fontSize: 14, fontWeight: 600 }}>
                      {record.name}
                    </Typography>
                    <Typography
                      color="text.secondary"
                      sx={{ fontSize: 12, mt: 0.5 }}
                    >
                      {record.description}
                    </Typography>
                  </TableCell>
                  <TableCell>{record.station}</TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(
                        record.mode === 'process'
                          ? 'processes.processTracking'
                          : 'processes.deviceTracking',
                      )}
                      sx={{
                        bgcolor: '#edf4ff',
                        color: '#1556c4',
                        fontSize: 11,
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    {record.mode === 'process' ? (
                      record.processTag
                    ) : (
                      <Typography sx={{ fontSize: 14 }}>
                        {t('processes.deviceCount', {
                          count: record.devices.length,
                        })}
                      </Typography>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 0.5 }}>
                      <Tooltip title={t('common.view')}>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t('processes.viewNamed', {
                            name: record.name,
                          })}
                          component={RouterLink}
                          to={`/configurations/processes/${encodeURIComponent(record.id)}`}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('processes.editAction')}>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t('processes.editNamed', {
                            name: record.name,
                          })}
                          onClick={() => {
                            setForm({
                              initial: structuredClone(record),
                              editing: true,
                            });
                            setStorageError(false);
                          }}
                        >
                          <EditOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('processes.deleteAction')}>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={t('processes.deleteNamed', {
                            name: record.name,
                          })}
                          onClick={() => setPendingDelete(record)}
                        >
                          <DeleteOutlineIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {data.records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    align="center"
                    sx={{ py: 5, color: 'text.secondary' }}
                  >
                    {t('processes.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {form && (
        <ProcessForm
          key={form.initial.id}
          initial={form.initial}
          editing={form.editing}
          records={data.records}
          onClose={() => setForm(null)}
          onSave={(record) =>
            persist(
              form.editing
                ? data.records.map((existing) =>
                    existing.id === record.id ? record : existing,
                  )
                : [record, ...data.records],
              'saved',
            )
          }
        />
      )}
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        aria-labelledby="process-confirmation-title"
        aria-describedby="process-confirmation-description"
      >
        <DialogTitle id="process-confirmation-title">
          {t('processes.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="process-confirmation-description">
            {t('processes.deleteMessage', { name: pendingDelete?.name ?? '' })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => setPendingDelete(null)}
            autoFocus
          >
            {t('processes.cancel')}
          </Button>
          <Button onClick={confirm} color="primary" variant="contained">
            {t('processes.deleteAction')}
          </Button>
        </DialogActions>
      </Dialog>
      <Snackbar
        open={toast !== null}
        autoHideDuration={4000}
        onClose={() => setToast(null)}
      >
        <Alert
          severity="success"
          variant="filled"
          onClose={() => setToast(null)}
        >
          {toast && t(`processes.${toast}`)}
        </Alert>
      </Snackbar>
    </>
  );
}
