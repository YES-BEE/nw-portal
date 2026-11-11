import { useEffect, useState } from 'react';
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
import { signOut } from '../auth/session';
import { ManagementHeader } from './ManagementScaffold';
import { createUser, getUsers } from './usersApi';
import { UsersError } from './usersFailure';
import { UserEditor } from './UserEditor';
import { UserDeleteDialog } from './UserDeleteDialog';
import { UserForm } from './UserForm';
import type { UserResponse, UsersFailure, UsersResponse } from './types';

type UsersState =
  | { status: 'loading' }
  | { status: 'ready'; users: UsersResponse }
  | { status: 'error'; failure: UsersFailure };

export function UserManagementPage() {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<UsersState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [creatingUser, setCreatingUser] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deletingUser, setDeletingUser] = useState<UserResponse | null>(null);
  const [deleted, setDeleted] = useState(false);
  function reloadUsers() {
    setDeletingUser(null);
    setPage(0);
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  useEffect(() => {
    const controller = new AbortController();
    void getUsers(controller.signal).then(
      (users) => {
        if (!controller.signal.aborted) setState({ status: 'ready', users });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof UsersError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  const search = query.trim().toLowerCase();
  const filtered =
    state.status === 'ready'
      ? state.users.filter((user) =>
          `${user.username} ${user.display_name} ${user.role ?? ''}`
            .toLowerCase()
            .includes(search),
        )
      : [];
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / rows) - 1),
  );
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
                  setState({ status: 'loading' });
                  setAttempt((value) => value + 1);
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
            disabled={state.status !== 'ready'}
            onChange={(event) => {
              setQuery(event.target.value);
              setPage(0);
            }}
            slotProps={{
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
                filtered
                  .slice(currentPage * rows, (currentPage + 1) * rows)
                  .map((user) => (
                    <TableRow key={user.id}>
                      <TableCell component="th" scope="row">
                        {user.username}
                      </TableCell>
                      <TableCell>
                        {user.display_name || t('access.users.noDisplayName')}
                      </TableCell>
                      <TableCell>
                        {user.role || t('access.users.noRole')}
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
                        <Tooltip title={t('access.edit')}>
                          <Box component="span">
                            <IconButton
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
                              <EditOutlinedIcon />
                            </IconButton>
                          </Box>
                        </Tooltip>
                        <Tooltip title={t('access.delete')}>
                          <Box component="span">
                            <IconButton
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
                              <DeleteOutlinedIcon />
                            </IconButton>
                          </Box>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
              {state.status === 'ready' && !filtered.length && (
                <TableRow>
                  <TableCell colSpan={5} align="center" sx={{ py: 4 }}>
                    {t(
                      state.users.length
                        ? 'access.users.empty'
                        : 'access.users.noUsers',
                    )}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        {state.status === 'ready' && (
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
      {creatingUser && (
        <UserForm
          onClose={() => setCreatingUser(false)}
          onCreate={async (body, signal) => {
            await createUser(body, signal);
            if (signal.aborted) return;
            setCreatingUser(false);
            setSaved(true);
            setQuery('');
            setPage(0);
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        />
      )}
      {editingUserId && (
        <UserEditor
          key={editingUserId}
          userId={editingUserId}
          onClose={() => setEditingUserId(null)}
          onReload={() => {
            setEditingUserId(null);
            setPage(0);
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
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
