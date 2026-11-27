import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router-dom';
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
  TableRow,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined';
import RestoreIcon from '@mui/icons-material/Restore';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { usePageMetadata } from '../../app/usePageMetadata';
import { getStorageUnits, storageFailure } from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';
import { StorageForm } from './StorageForm';
import { StorageAreaForm } from './StorageAreaForm';
import { StorageAreasPanel } from './StorageAreasPanel';
import { StorageStatusDialog } from './StorageStatusDialog';
import type { StorageUnitResponse } from './types';

export function StorageConfigurationsPage() {
  const { t } = useTranslation('translation');
  const list = usePagedList(getStorageUnits);
  const [form, setForm] = useState<{
    id?: string;
    areaId?: string;
    kind?: 'area';
  } | null>(null);
  const [areasVersion, setAreasVersion] = useState(0);
  const [pendingStatus, setPendingStatus] =
    useState<StorageUnitResponse | null>(null);
  const [toast, setToast] = useState(false);
  const [areaSaved, setAreaSaved] = useState(false);
  usePageMetadata(t('storages.pageTitle'), t('storages.pageDescription'));
  const items = list.state.status === 'ready' ? list.state.data.items : [];
  const busy = !!form || !!pendingStatus;
  function reload() {
    setForm(null);
    setPendingStatus(null);
    list.reload();
  }
  function saved() {
    setAreaSaved(false);
    setToast(true);
    reload();
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
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('storages.pageDescription')}
          </Typography>
        </Box>
        <Stack direction="row" spacing={1}>
          <Button
            variant="outlined"
            startIcon={<AddIcon />}
            disabled={busy}
            onClick={() => {
              setToast(false);
              setForm({ kind: 'area' });
            }}
          >
            {t('storages.areas.add')}
          </Button>
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            disabled={busy}
            onClick={() => {
              setToast(false);
              setForm({});
            }}
          >
            {t('storages.add')}
          </Button>
        </Stack>
      </Stack>
      <StorageAreasPanel
        key={areasVersion}
        busy={busy}
        onAddUnit={(areaId) => {
          setToast(false);
          setForm({ areaId });
        }}
      />
      {list.state.status === 'error' && (
        <StorageFailureAlert
          failure={storageFailure(list.state.error)}
          onReload={reload}
          onRetry={reload}
        />
      )}
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="existing-storages-heading"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{ px: 3, py: 2.5, gap: 2, justifyContent: 'space-between' }}
        >
          <Typography
            component="h2"
            id="existing-storages-heading"
            sx={{ fontSize: 17, fontWeight: 600 }}
          >
            {t('storages.existing')}
          </Typography>
          <TextField
            type="search"
            label={t('storages.search')}
            placeholder={t('storages.searchPlaceholder')}
            value={list.input}
            onChange={(e) => list.setInput(e.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ width: '100%', maxWidth: 420 }}
          />
        </Stack>
        <TableContainer>
          <Table
            aria-labelledby="existing-storages-heading"
            aria-busy={list.state.status === 'loading'}
            sx={{ minWidth: 650 }}
          >
            <TableHead>
              <TableRow>
                {(
                  [
                    'number',
                    'name',
                    'area',
                    'station',
                    'status',
                    'actions',
                  ] as const
                ).map((key) => (
                  <TableCell key={key}>{t(`storages.${key}`)}</TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {list.state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                    />
                  </TableCell>
                </TableRow>
              )}
              {items.map((record) => (
                <TableRow key={record.id}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 600 }}
                  >
                    {record.code}
                  </TableCell>
                  <TableCell>{record.name}</TableCell>
                  <TableCell>{record.storage_area_code}</TableCell>
                  <TableCell>{record.station_code}</TableCell>
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
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title={t('common.view')}>
                        <IconButton
                          size="small"
                          color="primary"
                          disabled={busy}
                          component={RouterLink}
                          to={`/configurations/storages/${encodeURIComponent(record.id)}`}
                          aria-label={t('storages.viewNamed', {
                            number: record.code,
                          })}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('storages.editAction')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={busy}
                            onClick={() => {
                              setToast(false);
                              setForm({ id: record.id });
                            }}
                            aria-label={t('storages.editNamed', {
                              number: record.code,
                            })}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip
                        title={t(
                          record.active
                            ? 'storages.deleteAction'
                            : 'storages.restore',
                        )}
                      >
                        <Box component="span">
                          <IconButton
                            size="small"
                            color={record.active ? 'warning' : 'primary'}
                            disabled={busy}
                            onClick={() => {
                              setToast(false);
                              setPendingStatus(record);
                            }}
                            aria-label={t(
                              record.active
                                ? 'storages.deleteNamed'
                                : 'storages.restoreNamed',
                              { number: record.code },
                            )}
                          >
                            {record.active ? (
                              <BlockOutlinedIcon fontSize="small" />
                            ) : (
                              <RestoreIcon fontSize="small" />
                            )}
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {list.state.status === 'ready' && !items.length && (
                <TableRow>
                  <TableCell colSpan={6} align="center" sx={{ py: 4 }}>
                    {t(
                      list.query.search
                        ? 'storages.noMatches'
                        : 'storages.empty',
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
      {form?.kind === 'area' && (
        <StorageAreaForm
          onClose={() => setForm(null)}
          onReload={reload}
          onSaved={(area) => {
            setAreasVersion((value) => value + 1);
            setAreaSaved(true);
            setToast(true);
            setForm({ areaId: area.id });
          }}
        />
      )}
      {form && form.kind !== 'area' && (
        <StorageForm
          key={form.id || form.areaId || 'create'}
          storageId={form.id}
          initialAreaId={form.areaId}
          onClose={() => setForm(null)}
          onSaved={saved}
          onReload={reload}
        />
      )}
      {pendingStatus && (
        <StorageStatusDialog
          record={pendingStatus}
          onClose={() => setPendingStatus(null)}
          onSaved={saved}
          onReload={reload}
        />
      )}
      <Snackbar
        open={toast}
        autoHideDuration={3500}
        onClose={() => setToast(false)}
        message={t(areaSaved ? 'storages.areas.saved' : 'storages.saved')}
      />
    </>
  );
}
