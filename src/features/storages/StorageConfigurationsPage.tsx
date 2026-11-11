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
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { Link as RouterLink } from 'react-router-dom';
import { emptyStorage, loadStorages, STORAGE_STORAGE_KEY } from './storageData';
import { StorageForm } from './StorageForm';
import type { StorageConfiguration } from './types';

type Toast = 'saved' | 'deleted';

export function StorageConfigurationsPage() {
  const { t } = useTranslation('translation');
  const [data, setData] = useState(loadStorages);
  const [form, setForm] = useState<{
    initial: StorageConfiguration;
    editing: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] =
    useState<StorageConfiguration | null>(null);
  const [storageError, setStorageError] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    document.title = t('storages.pageTitle');
    document.documentElement.lang = 'en';
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('storages.pageDescription'));
  }, [t]);

  function persist(records: StorageConfiguration[], message: Toast) {
    try {
      localStorage.setItem(STORAGE_STORAGE_KEY, JSON.stringify(records));
      setData({ records, storageUnavailable: false });
      setStorageError(false);
      setForm(null);
      setToast(message);
    } catch {
      setStorageError(true);
    }
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
          {t('storages.title')}
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
            {t('storages.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
            {t('storages.pageDescription')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ flexShrink: 0 }}
          onClick={() => {
            setForm({ initial: emptyStorage(), editing: false });
            setStorageError(false);
          }}
        >
          {t('storages.add')}
        </Button>
      </Stack>
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('storages.loadWarning')}
        </Alert>
      )}
      {storageError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('storages.storageError')}
        </Alert>
      )}
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="existing-storages-heading"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
      >
        <Box sx={{ px: 3, py: 2.5 }}>
          <Typography
            component="h2"
            id="existing-storages-heading"
            sx={{ fontSize: 17, fontWeight: 600 }}
          >
            {t('storages.existing')}
          </Typography>
        </Box>
        <TableContainer>
          <Table
            aria-labelledby="existing-storages-heading"
            sx={{ minWidth: 650 }}
          >
            <TableHead>
              <TableRow>
                {(['number', 'description', 'tag', 'actions'] as const).map(
                  (column) => (
                    <TableCell key={column} scope="col">
                      {t(`storages.${column}`)}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {data.records.map((record) => (
                <TableRow
                  key={record.id}
                  sx={{ '& td, & th': { verticalAlign: 'top' } }}
                >
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 600 }}
                  >
                    {record.number}
                  </TableCell>
                  <TableCell>
                    {record.description || t('storages.noDescription')}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={record.tag}
                      sx={{
                        bgcolor: '#edf4ff',
                        color: '#1556c4',
                        fontWeight: 600,
                      }}
                    />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 0.5 }}>
                      <Tooltip title={t('common.view')}>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t('storages.viewNamed', {
                            number: record.number,
                          })}
                          component={RouterLink}
                          to={`/configurations/storages/${encodeURIComponent(record.id)}`}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('storages.editAction')}>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t('storages.editNamed', {
                            number: record.number,
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
                      <Tooltip title={t('storages.deleteAction')}>
                        <IconButton
                          size="small"
                          color="error"
                          aria-label={t('storages.deleteNamed', {
                            number: record.number,
                          })}
                          onClick={() => setPendingDelete(record)}
                        >
                          <DeleteOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {data.records.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={4}
                    align="center"
                    sx={{ py: 5, color: 'text.secondary' }}
                  >
                    {t('storages.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {form && (
        <StorageForm
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
        aria-labelledby="storage-confirmation-title"
        aria-describedby="storage-confirmation-description"
      >
        <DialogTitle id="storage-confirmation-title">
          {t('storages.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="storage-confirmation-description">
            {t('storages.deleteMessage', {
              number: pendingDelete?.number ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button
            variant="outlined"
            onClick={() => setPendingDelete(null)}
            autoFocus
          >
            {t('storages.cancel')}
          </Button>
          <Button
            color="primary"
            variant="contained"
            onClick={() => {
              if (pendingDelete)
                persist(
                  data.records.filter(
                    (record) => record.id !== pendingDelete.id,
                  ),
                  'deleted',
                );
              setPendingDelete(null);
            }}
          >
            {t('storages.deleteAction')}
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
          {toast && t(`storages.${toast}`)}
        </Alert>
      </Snackbar>
    </>
  );
}
