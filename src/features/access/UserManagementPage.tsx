import { usePagedList } from '../../api/usePagedList';
import { useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Paper,
  Snackbar,
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
import SearchIcon from '@mui/icons-material/Search';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined';
import { signOut } from '../auth/session';
import { ManagementHeader } from './ManagementScaffold';
import { createUser, getUsersPage } from './usersApi';
import { UsersError } from './usersFailure';
import { UserEditor } from './UserEditor';
import { UserDeleteDialog } from './UserDeleteDialog';
import { UserForm } from './UserForm';
import type { UserResponse } from './types';

export function UserManagementPage() {
  const { t } = useTranslation('translation');
  const list = usePagedList(getUsersPage);
  const query = list.input,
    setQuery = list.setInput;
  const page = list.query.page,
    rows = list.query.size;
  const setPage = list.setPage,
    setRows = list.setSize;
  const state =
    list.state.status === 'ready'
      ? {
          status: 'ready' as const,
          users: list.state.data.items.filter((user) => user.enabled),
        }
      : list.state.status === 'error'
        ? {
            status: 'error' as const,
            failure:
              list.state.error instanceof UsersError
                ? list.state.error.failure
                : { kind: 'network' as const, action: 'retry' as const },
          }
        : list.state;
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);
  const [deleted, setDeleted] = useState(false);
  function reloadUsers() {
    setDeletingUser(null);
    setEditingUserId(null);
    setPage(0);
    list.reload();
  }
  return (
    <>
      <ManagementHeader
        kind="users"
        onAdd={
          state.status === 'ready' &&
          !creatingUser &&
          !editingUserId &&
          !deletingUser
            ? () => {
                setSaved(false);
                setCreatingUser(true);
              }
            : undefined
        }
      />
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
                  setPage(0);
                  list.reload();
                }}
              >
                {t('startup.retry')}
              </Button>
            ) : undefined
          }
        >
          <AlertTitle>
            {t(`access.users.failures.${state.failure.kind}.title`)}
          </AlertTitle>
          {state.failure.message ||
            t(`access.users.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {t('access.users.failureStatus', {
                status: state.failure.status,
              })}
            </Typography>
          )}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Box sx={{ p: 3 }}>
          <Typography component="h2" variant="h6" sx={{ mb: 2 }}>
            {t('access.users.existing')}
          </Typography>
          <TextField
            type="search"
            label={t('access.users.search')}
            placeholder={t('access.users.searchPlaceholder')}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
            }}
            slotProps={{
              htmlInput: { maxLength: 200 },
              input: {
                startAdornment: (
                  <InputAdornment position="start">
                    <SearchIcon />
                  </InputAdornment>
                ),
              },
            }}
            sx={{ width: '100%', maxWidth: 420 }}
          />
        </Box>
        <TableContainer>
          <Table
            aria-label={t('access.users.existing')}
            aria-busy={state.status === 'loading'}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('access.username')}</TableCell>
                <TableCell>{t('access.users.displayName')}</TableCell>
                <TableCell>{t('access.role')}</TableCell>
                <TableCell>{t('access.status')}</TableCell>
                <TableCell>{t('access.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                    />
                  </TableCell>
                </TableRow>
              )}
              {state.status === 'ready' &&
                state.users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell component="th" scope="row">
                      {user.username}
                    </TableCell>
                    <TableCell>
                      {user.display_name || t('access.users.noDisplayName')}
                    </TableCell>
                    <TableCell>
                      {user.role ? user.role : t('access.users.noRole')}
                    </TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={user.enabled ? 'success' : 'default'}
                        variant="outlined"
                        label={t(
                          user.enabled ? 'access.active' : 'access.inactive',
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('common.view')}>
                        <IconButton
                          size="small"
                          component={RouterLink}
                          to={`/users/${encodeURIComponent(user.id)}`}
                          color="primary"
                          aria-label={t('access.users.viewNamed', {
                            name: user.username,
                          })}
                        >
                          <VisibilityOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('access.edit')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            disabled={
                              editingUserId !== null ||
                              creatingUser ||
                              deletingUser !== null
                            }
                            onClick={() => setEditingUserId(user.id)}
                            aria-label={t('access.editNamed', {
                              name: user.username,
                            })}
                          >
                            <EditOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip title={t('access.delete')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            disabled={
                              editingUserId !== null ||
                              creatingUser ||
                              deletingUser !== null ||
                              !user.enabled
                            }
                            onClick={() => {
                              setDeleted(false);
                              setDeletingUser(user);
                            }}
                            color="error"
                            aria-label={t('access.deleteNamed', {
                              name: user.username,
                            })}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              {state.status === 'ready' && !state.users.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    {t(
                      list.query.search
                        ? 'access.users.empty'
                        : 'access.users.noUsers',
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {list.state.status === 'ready' && list.state.data.totalElements > 0 && (
          <TablePagination
            component="div"
            count={
              list.state.status === 'ready' ? list.state.data.totalElements : 0
            }
            page={page}
            rowsPerPage={rows}
            rowsPerPageOptions={[10, 25, 50, 100]}
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
      {creatingUser && (
        <UserForm
          onClose={() => setCreatingUser(false)}
          onCreate={async (body, signal) => {
            await createUser(body, signal);
            if (signal.aborted) return;
            setCreatingUser(false);
            setSaved(true);
            list.resetSearch();
            list.reload();
          }}
        />
      )}
      {editingUserId && (
        <UserEditor
          key={editingUserId}
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
          onUpdated={() => {
            setSaved(true);
            reloadUsers();
          }}
          onReload={() => {
            setEditingUserId(null);
            setPage(0);
            list.reload();
          }}
        />
      )}
      {deletingUser && (
        <UserDeleteDialog
          user={deletingUser}
          onClose={() => setDeletingUser(null)}
          onReload={reloadUsers}
          onDeleted={() => {
            setDeleted(true);
            reloadUsers();
          }}
        />
      )}
      <Snackbar
        open={deleted}
        autoHideDuration={3500}
        onClose={() => setDeleted(false)}
        message={t('access.users.deleted')}
      />
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('access.saved')}
      />
    </>
  );
}
