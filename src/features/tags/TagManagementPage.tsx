import { usePagedList } from '../../api/usePagedList';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Breadcrumbs,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
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
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { signOut } from '../auth/session';
import { createTag, getTagsPage, TagsError } from './tagsApi';
import { TagForm } from './TagForm';
import { TagDetailsDialog } from './TagDetailsDialog';
import { TagEditor } from './TagEditor';
import { TagDeleteDialog } from './TagDeleteDialog';
import type { TagResponse } from './tagsApi';

export function TagManagementPage() {
  const { t } = useTranslation('translation');
  const list = usePagedList(getTagsPage);
  const query = list.input,
    setQuery = list.setInput;
  const page = list.query.page,
    rowsPerPage = list.query.size;
  const setPage = list.setPage,
    setRowsPerPage = list.setSize;
  const state =
    list.state.status === 'ready'
      ? { status: 'ready' as const, tags: list.state.data.items }
      : list.state.status === 'error'
        ? {
            status: 'error' as const,
            failure:
              list.state.error instanceof TagsError
                ? list.state.error.failure
                : { kind: 'network' as const, action: 'retry' as const },
          }
        : list.state;
  const [creating, setCreating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [viewingTagId, setViewingTagId] = useState<string | null>(null);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [deletingTag, setDeletingTag] = useState<TagResponse | null>(null);
  const [deleted, setDeleted] = useState(false);
  function reloadTags() {
    setEditingTagId(null);
    setDeletingTag(null);
    list.reload();
  }
  useEffect(() => {
    document.title = t('tags.pageTitle');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('tags.pageDescription'));
  }, [t]);

  const tags = state.status === 'ready' ? state.tags : [];
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
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('tags.pageDescription')}
          </Typography>
        </Box>
        <Button
          variant="contained"
          disabled={
            state.status !== 'ready' ||
            creating ||
            editingTagId !== null ||
            deletingTag !== null
          }
          startIcon={<AddIcon />}
          onClick={() => {
            setSaved(false);
            setCreating(true);
          }}
        >
          {t('tags.add')}
        </Button>
      </Stack>
      {state.status === 'error' && (
        <Alert
          severity="error"
          sx={{ mb: 2 }}
          action={
            state.failure.action === 'signIn' ? (
              <Button color="inherit" onClick={signOut}>
                {t('startup.signIn')}
              </Button>
            ) : state.failure.action === 'retry' ? (
              <Button
                color="inherit"
                onClick={() => {
                  list.reload();
                }}
              >
                {t('startup.retry')}
              </Button>
            ) : undefined
          }
        >
          <AlertTitle>
            {t(`tags.failures.${state.failure.kind}.title`)}
          </AlertTitle>
          {state.failure.message ||
            t(`tags.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {t('tags.failureStatus', { status: state.failure.status })}
            </Typography>
          )}
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
            {state.status === 'ready' && tags.length > 0 && (
              <Chip
                size="small"
                label={t('tags.count', {
                  count:
                    list.state.status === 'ready'
                      ? list.state.data.totalElements
                      : 0,
                })}
              />
            )}
          </Box>
          <TextField
            type="search"
            label={t('tags.search')}
            placeholder={t('tags.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            sx={{ width: { xs: '100%', sm: 320 }, maxWidth: '100%' }}
            slotProps={{
              htmlInput: { maxLength: 200 },
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
          <Table
            aria-label={t('tags.existing')}
            aria-busy={state.status === 'loading'}
          >
            <TableHead>
              <TableRow>
                {(['name', 'status', 'assigned', 'actions'] as const).map(
                  (column) => (
                    <TableCell key={column} scope="col">
                      {t(`tags.${column}`)}
                    </TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                    />
                  </TableCell>
                </TableRow>
              )}
              {tags.map((tag) => (
                <TableRow key={tag.id}>
                  <TableCell
                    component="th"
                    scope="row"
                    sx={{ fontWeight: 600 }}
                  >
                    {tag.name}
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={t(`tags.statusValues.${tag.status}`)}
                      color={tag.status === 'ACTIVE' ? 'success' : 'default'}
                      variant="outlined"
                    />
                  </TableCell>
                  <TableCell>
                    {tag.assigned ? t('tags.yes') : t('tags.no')}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" sx={{ gap: 0.5 }}>
                      <Tooltip title={t('tags.details.view')}>
                        <IconButton
                          size="small"
                          color="primary"
                          aria-label={t('tags.details.viewNamed', {
                            name: tag.name,
                          })}
                          onClick={() => setViewingTagId(tag.id)}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('tags.editAction')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            color="primary"
                            disabled={
                              creating ||
                              editingTagId !== null ||
                              deletingTag !== null
                            }
                            onClick={() => {
                              setSaved(false);
                              setEditingTagId(tag.id);
                            }}
                            aria-label={t('tags.editNamed', { name: tag.name })}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip title={t('tags.deleteAction')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            color="error"
                            disabled={
                              creating ||
                              editingTagId !== null ||
                              deletingTag !== null
                            }
                            onClick={() => {
                              setDeleted(false);
                              setSaved(false);
                              setDeletingTag(tag);
                            }}
                            aria-label={t('tags.deleteNamed', {
                              name: tag.name,
                            })}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
              {state.status === 'ready' && !tags.length && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 5 }}>
                    {t(list.query.search ? 'tags.noMatches' : 'tags.empty')}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {state.status === 'ready' && tags.length > 0 && (
          <TablePagination
            component="div"
            count={
              list.state.status === 'ready' ? list.state.data.totalElements : 0
            }
            page={page}
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
        )}
      </Paper>
      {deletingTag && (
        <TagDeleteDialog
          tag={deletingTag}
          onClose={() => setDeletingTag(null)}
          onReload={reloadTags}
          onDeleted={() => {
            setDeleted(true);
            reloadTags();
          }}
        />
      )}
      <Snackbar
        open={deleted}
        autoHideDuration={3500}
        onClose={() => setDeleted(false)}
        message={t('tags.deleted')}
      />
      {viewingTagId && (
        <TagDetailsDialog
          key={viewingTagId}
          tagId={viewingTagId}
          onClose={() => setViewingTagId(null)}
          onReload={() => {
            setViewingTagId(null);
            list.reload();
          }}
        />
      )}
      {editingTagId && (
        <TagEditor
          key={editingTagId}
          tagId={editingTagId}
          onClose={() => setEditingTagId(null)}
          onReload={reloadTags}
          onUpdated={() => {
            setSaved(true);
            reloadTags();
          }}
        />
      )}
      {creating && (
        <TagForm
          onClose={() => setCreating(false)}
          onCreate={async (body, signal) => {
            await createTag(body, signal);
            if (signal.aborted) return;
            setCreating(false);
            setSaved(true);
            list.resetSearch();
            list.reload();
          }}
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('tags.saved')}
      />
    </>
  );
}
