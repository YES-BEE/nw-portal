import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
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
  InputAdornment,
  Link,
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
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { loadTags, TAG_STORAGE_KEY } from '../configurations/tagRegistry';
import type { RegisteredTag } from '../configurations/tagRegistry';
import { emptyTag, loadTagAssignments } from './tagData';
import { TagForm } from './TagForm';

export function TagManagementPage() {
  const { t } = useTranslation('translation');
  const [data, setData] = useState(loadTags);
  const [form, setForm] = useState<{
    initial: RegisteredTag;
    editing: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RegisteredTag | null>(
    null,
  );
  const [storageError, setStorageError] = useState(false);
  const [guardError, setGuardError] = useState<
    'deleteBlocked' | 'assignmentsUnavailable' | null
  >(null);
  const [toast, setToast] = useState<'saved' | 'deleted' | null>(null);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const status = loadTagAssignments();
  const search = query.trim().toLowerCase();
  const filtered = data.records.filter(
    (tag) =>
      tag.name.toLowerCase().includes(search) ||
      tag.actual.toLowerCase().includes(search),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / rowsPerPage) - 1),
  );
  const visible = filtered.slice(
    currentPage * rowsPerPage,
    (currentPage + 1) * rowsPerPage,
  );

  useEffect(() => {
    document.title = t('tags.pageTitle');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('tags.pageDescription'));
  }, [t]);

  function persist(records: RegisteredTag[], message: 'saved' | 'deleted') {
    try {
      localStorage.setItem(TAG_STORAGE_KEY, JSON.stringify(records));
      setData({ records, storageUnavailable: false });
      setStorageError(false);
      setGuardError(null);
      setForm(null);
      setToast(message);
    } catch {
      setStorageError(true);
    }
  }

  function deleteTag() {
    if (!pendingDelete) return;
    const latest = loadTags().records;
    const target = latest.find((tag) => tag.id === pendingDelete.id);
    const assignments = loadTagAssignments();
    if (assignments.unavailable) setGuardError('assignmentsUnavailable');
    else if (target && assignments.assignments.has(target.actual.toUpperCase()))
      setGuardError('deleteBlocked');
    else
      persist(
        latest.filter((tag) => tag.id !== pendingDelete.id),
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
        <Typography sx={{ fontSize: 'inherit' }}>{t('tags.title')}</Typography>
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
            {t('tags.title')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 14, mt: 0.5 }}>
            {t('tags.pageDescription')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          startIcon={<AddIcon />}
          sx={{ flexShrink: 0 }}
          onClick={() => {
            setForm({ initial: emptyTag(), editing: false });
            setStorageError(false);
            setGuardError(null);
          }}
        >
          {t('tags.add')}
        </Button>
      </Stack>
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('tags.loadWarning')}
        </Alert>
      )}
      {status.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('tags.assignmentsUnavailable')}
        </Alert>
      )}
      {storageError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t('tags.storageError')}
        </Alert>
      )}
      {guardError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t(`tags.${guardError}`)}
        </Alert>
      )}
      <Paper
        component="section"
        variant="outlined"
        aria-labelledby="existing-tags-heading"
        sx={{ borderRadius: 2, overflow: 'hidden', mb: 3 }}
      >
        <Stack
          direction={{ xs: 'column', sm: 'row' }}
          sx={{
            justifyContent: 'space-between',
            alignItems: { xs: 'stretch', sm: 'flex-end' },
            gap: 2,
            p: 3,
          }}
        >
          <Box>
            <Typography
              component="h2"
              id="existing-tags-heading"
              sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}
            >
              {t('tags.existing')}
            </Typography>
            <Chip
              size="small"
              label={t('tags.count', { count: data.records.length })}
            />
          </Box>
          <TextField
            type="search"
            label={t('tags.search')}
            placeholder={t('tags.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            sx={{ width: { xs: '100%', sm: 320 }, maxWidth: '100%' }}
            slotProps={{
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon fontSize="small" />
                  </InputAdornment>
                ),
              },
            }}
          />
        </Stack>
        <TableContainer>
          <Table aria-labelledby="existing-tags-heading" sx={{ minWidth: 700 }}>
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
                {(['name', 'actual', 'assignedTo', 'actions'] as const).map(
                  (column) => (
                    <TableCell key={column} scope="col">
                      {t(`tags.${column}`)}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {visible.map((tag) => {
                const assignment = status.assignments.get(
                  tag.actual.toUpperCase(),
                );
                const blocked = Boolean(assignment) || status.unavailable;
                return (
                  <TableRow key={tag.id}>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ fontWeight: 600 }}
                    >
                      {tag.name}
                    </TableCell>
                    <TableCell sx={{ overflowWrap: 'anywhere' }}>
                      {tag.actual}
                    </TableCell>
                    <TableCell>
                      {assignment ? (
                        <Link
                          component={RouterLink}
                          to={assignment.path}
                          underline="hover"
                        >
                          {t(`tags.assignment.${assignment.type}`, {
                            name: assignment.name,
                            process: assignment.process ?? '',
                          })}
                        </Link>
                      ) : (
                        <Chip
                          size="small"
                          label={t('tags.available')}
                          color="success"
                          variant="outlined"
                        />
                      )}
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" sx={{ gap: 0.5 }}>
                        <Tooltip title={t('tags.editAction')}>
                          <IconButton
                            size="small"
                            color="primary"
                            aria-label={t('tags.editNamed', { name: tag.name })}
                            onClick={() => {
                              setForm({
                                initial: structuredClone(tag),
                                editing: true,
                              });
                              setStorageError(false);
                              setGuardError(null);
                            }}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip
                          title={t(
                            blocked
                              ? 'tags.deleteBlocked'
                              : 'tags.deleteAction',
                          )}
                        >
                          <Box component="span">
                            <IconButton
                              size="small"
                              color="error"
                              disabled={blocked}
                              aria-label={t('tags.deleteNamed', {
                                name: tag.name,
                              })}
                              onClick={() => setPendingDelete(tag)}
                            >
                              <DeleteOutlinedIcon fontSize="small" />
                            </IconButton>
                          </Box>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                );
              })}
              {visible.length === 0 && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                    {t(
                      data.records.length === 0
                        ? 'tags.empty'
                        : 'tags.noMatches',
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={filtered.length}
          page={currentPage}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, next) => setPage(next)}
          onRowsPerPageChange={(event) => {
            setRowsPerPage(Number(event.target.value));
            setPage(0);
          }}
          labelRowsPerPage={t('common.pagination.rowsPerPage')}
          labelDisplayedRows={({ from, to, count }) =>
            t('common.pagination.range', { from, to, count })
          }
          getItemAriaLabel={(type) => t(`common.pagination.${type}`)}
        />
      </Paper>
      {form && (
        <TagForm
          key={form.initial.id}
          initial={form.initial}
          editing={form.editing}
          onClose={() => setForm(null)}
          onSave={(tag) => {
            const records = loadTags().records;
            persist(
              form.editing
                ? records.map((record) => (record.id === tag.id ? tag : record))
                : [tag, ...records],
              'saved',
            );
          }}
        />
      )}
      <Dialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        aria-labelledby="tag-confirmation-title"
        aria-describedby="tag-confirmation-description"
      >
        <DialogTitle id="tag-confirmation-title">
          {t('tags.deleteTitle')}
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="tag-confirmation-description">
            {t('tags.deleteMessage', {
              name: pendingDelete?.name ?? '',
              actual: pendingDelete?.actual ?? '',
            })}
          </DialogContentText>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setPendingDelete(null)} autoFocus>
            {t('tags.cancel')}
          </Button>
          <Button color="error" variant="contained" onClick={deleteTag}>
            {t('tags.deleteAction')}
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
          {toast && t(`tags.${toast}`)}
        </Alert>
      </Snackbar>
    </>
  );
}
