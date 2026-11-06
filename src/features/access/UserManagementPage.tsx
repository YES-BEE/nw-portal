import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Chip,
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
import type { AccessUser, UserDraft } from './accessData';
import { useAccessData } from './useAccessData';
import { UserForm } from './UserForm';
import { DeleteAccessDialog, ManagementHeader } from './ManagementScaffold';

export function UserManagementPage() {
  const { t } = useTranslation('translation');
  const { data, error, persist, setError } = useAccessData();
  const [form, setForm] = useState<{
    initial: UserDraft;
    editing: boolean;
  } | null>(null);
  const [pendingDelete, setPendingDelete] = useState<AccessUser | null>(null);
  const [saved, setSaved] = useState(false);
  const [query, setQuery] = useState('');
  const [page, setPage] = useState(0);
  const [rows, setRows] = useState(10);
  const search = query.trim().toLowerCase();
  const filtered = data.records.users.filter((user) =>
    `${user.username} ${user.role}`.toLowerCase().includes(search),
  );
  const currentPage = Math.min(
    page,
    Math.max(0, Math.ceil(filtered.length / rows) - 1),
  );

  return (
    <>
      <ManagementHeader
        kind="users"
        onAdd={() => {
          setError(null);
          setForm({
            initial: {
              id: crypto.randomUUID(),
              username: '',
              role: '',
              status: '',
            },
            editing: false,
          });
        }}
      />
      {data.unavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('access.loadWarning')}
        </Alert>
      )}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {t(`access.${error}`)}
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
            value={query}
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
          <Table aria-label={t('access.users.existing')}>
            <TableHead>
              <TableRow>
                {(['username', 'role', 'status', 'actions'] as const).map(
                  (key) => (
                    <TableCell key={key}>{t(`access.${key}`)}</TableCell>
                  ),
                )}
              </TableRow>
            </TableHead>
            <TableBody>
              {filtered
                .slice(currentPage * rows, (currentPage + 1) * rows)
                .map((user) => (
                  <TableRow key={user.id}>
                    <TableCell component="th" scope="row">
                      {user.username}
                    </TableCell>
                    <TableCell>{user.role}</TableCell>
                    <TableCell>
                      <Chip
                        size="small"
                        color={user.status === 'Active' ? 'success' : 'default'}
                        variant="outlined"
                        label={t(
                          user.status === 'Active'
                            ? 'access.active'
                            : 'access.inactive',
                        )}
                      />
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('access.edit')}>
                        <IconButton
                          aria-label={t('access.editNamed', {
                            name: user.username,
                          })}
                          onClick={() => {
                            setError(null);
                            setForm({ initial: user, editing: true });
                          }}
                        >
                          <EditOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title={t('access.delete')}>
                        <IconButton
                          color="error"
                          aria-label={t('access.deleteNamed', {
                            name: user.username,
                          })}
                          onClick={() => setPendingDelete(user)}
                        >
                          <DeleteOutlinedIcon />
                        </IconButton>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
              {!filtered.length && (
                <TableRow>
                  <TableCell colSpan={4} align="center" sx={{ py: 4 }}>
                    {t('access.users.empty')}
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
      </Paper>
      {form && (
        <UserForm
          key={form.initial.id}
          {...form}
          roles={data.records.roles}
          onClose={() => setForm(null)}
          onSave={(user) => {
            if (
              persist((latest) => ({
                ...latest,
                users: form.editing
                  ? latest.users.map((record) =>
                      record.id === user.id ? user : record,
                    )
                  : [...latest.users, user],
              }))
            ) {
              setForm(null);
              setSaved(true);
            }
          }}
        />
      )}
      <DeleteAccessDialog
        name={pendingDelete?.username ?? null}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => {
          if (
            pendingDelete &&
            persist((latest) => ({
              ...latest,
              users: latest.users.filter(
                (user) => user.id !== pendingDelete.id,
              ),
            }))
          ) {
            if (form?.initial.id === pendingDelete.id) setForm(null);
            setSaved(true);
          }
          setPendingDelete(null);
        }}
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
