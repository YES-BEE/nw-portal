import { usePagedList } from '../../api/usePagedList';
import { ListPagination } from '../../api/ListPagination';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
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
  Tooltip,
  Typography,
  TextField,
} from '@mui/material';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { moduleKeys } from './accessData';
import type { ModuleKey } from './accessData';
import {
  createAccessRole,
  getAccessRolesPage,
  saveAccessRole,
} from './accessRolesApi';
import { AccessRolesError } from './accessRolesFailure';
import { signOut } from '../auth/session';
import type { AccessRoleDraft, AccessRoleResponse } from './types';
import { ManagementHeader } from './ManagementScaffold';
import { RoleForm } from './RoleForm';
import { RoleDeleteDialog } from './RoleDeleteDialog';

export function RoleManagementPage() {
  const { t } = useTranslation('translation');
  const list = usePagedList(getAccessRolesPage);
  const state =
    list.state.status === 'ready'
      ? { status: 'ready' as const, roles: list.state.data.items }
      : list.state.status === 'error'
        ? {
            status: 'error' as const,
            failure:
              list.state.error instanceof AccessRolesError
                ? list.state.error.failure
                : { kind: 'network' as const, action: 'retry' as const },
          }
        : list.state;
  const [form, setForm] = useState<{
    initial: AccessRoleDraft;
    editing: boolean;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  const [deletingRole, setDeletingRole] = useState<AccessRoleResponse | null>(
    null,
  );
  const [deleted, setDeleted] = useState(false);
  function reloadRoles() {
    setDeletingRole(null);
    list.reload();
  }

  return (
    <>
      <ManagementHeader
        kind="roles"
        onAdd={
          state.status === 'ready' && !form && !deletingRole
            ? () => {
                setSaved(false);
                setForm({
                  initial: {
                    code: '',
                    name: '',
                    modules: [],
                    padAccess: true,
                  },
                  editing: false,
                });
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
                  list.reload();
                }}
              >
                {t('startup.retry')}
              </Button>
            ) : undefined
          }
        >
          <AlertTitle>
            {t(`access.roles.failures.${state.failure.kind}.title`)}
          </AlertTitle>
          {state.failure.message ||
            t(`access.roles.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {t('access.roles.failureStatus', {
                status: state.failure.status,
              })}
            </Typography>
          )}
        </Alert>
      )}
      <Paper variant="outlined" sx={{ borderRadius: 2, overflow: 'hidden' }}>
        <Typography component="h2" variant="h6" sx={{ p: 3 }}>
          {t('access.roles.existing')}
        </Typography>
        <Box sx={{ p: 3 }}>
          <TextField
            placeholder={t('access.roles.searchPlaceholder')}
            type="search"
            label={t('access.roles.search')}
            value={list.input}
            onChange={(event) => list.setInput(event.target.value)}
            slotProps={{ htmlInput: { maxLength: 200 } }}
            sx={{ width: '100%', maxWidth: 420 }}
          />
        </Box>
        <TableContainer>
          <Table
            aria-label={t('access.roles.existing')}
            aria-busy={state.status === 'loading'}
          >
            <TableHead>
              <TableRow>
                <TableCell>{t('access.role')}</TableCell>
                <TableCell>{t('access.assignedModules')}</TableCell>
                <TableCell>{t('access.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {state.status === 'loading' && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    <CircularProgress
                      size={28}
                      aria-label={t('common.loading')}
                      sx={{ my: 3 }}
                    />
                  </TableCell>
                </TableRow>
              )}
              {state.status === 'ready' && !state.roles.length && (
                <TableRow>
                  <TableCell colSpan={3} align="center">
                    {t('access.roles.empty')}
                  </TableCell>
                </TableRow>
              )}
              {state.status === 'ready' &&
                state.roles.map((role) => (
                  <TableRow key={role.code}>
                    <TableCell
                      component="th"
                      scope="row"
                      sx={{ minWidth: 170 }}
                    >
                      {role.name}
                    </TableCell>
                    <TableCell>
                      <Stack
                        direction="row"
                        useFlexGap
                        sx={{ gap: 0.75, flexWrap: 'wrap' }}
                      >
                        {role.modules.length ? (
                          [...new Set(role.modules)].map((key) => (
                            <Chip
                              key={key}
                              size="small"
                              variant="outlined"
                              label={
                                moduleKeys.includes(key as ModuleKey)
                                  ? t(`access.modules.${key as ModuleKey}`)
                                  : key
                              }
                            />
                          ))
                        ) : (
                          <Typography color="text.secondary" variant="body2">
                            {t('access.noAccess')}
                          </Typography>
                        )}
                      </Stack>
                    </TableCell>
                    <TableCell sx={{ whiteSpace: 'nowrap' }}>
                      <Tooltip title={t('access.edit')}>
                        <Box component="span">
                          <IconButton
                            size="small"
                            disabled={Boolean(form || deletingRole)}
                            onClick={() => {
                              setSaved(false);
                              setForm({
                                initial: {
                                  code: role.code,
                                  name: role.name,
                                  modules: [...role.modules],
                                  padAccess: role.pad_access,
                                },
                                editing: true,
                              });
                            }}
                            aria-label={t('access.editNamed', {
                              name: role.name,
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
                            disabled={Boolean(form || deletingRole)}
                            onClick={() => {
                              setDeleted(false);
                              setDeletingRole(role);
                            }}
                            color="error"
                            aria-label={t('access.deleteNamed', {
                              name: role.name,
                            })}
                          >
                            <DeleteOutlinedIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
        {list.state.status === 'ready' && list.state.data.items.length > 0 && (
          <ListPagination
            query={list.query}
            total={list.state.data.totalElements}
            onPage={list.setPage}
            onSize={list.setSize}
          />
        )}
      </Paper>
      {form && (
        <RoleForm
          key={form.editing ? form.initial.code : 'new-role'}
          {...form}
          existingNames={
            state.status === 'ready' ? state.roles.map((role) => role.name) : []
          }
          onClose={() => setForm(null)}
          onReload={() => {
            setForm(null);
            setSaved(false);
            list.reload();
          }}
          onSave={async (draft, signal) => {
            const body = {
              modules: draft.modules,
              pcAccess: draft.modules.length > 0,
              padAccess: draft.padAccess,
            };
            if (form.editing) await saveAccessRole(draft.code, body, signal);
            else await createAccessRole({ ...body, name: draft.name }, signal);
            if (signal.aborted) return;
            setForm(null);
            setSaved(true);
            list.reload();
          }}
        />
      )}
      {deletingRole && (
        <RoleDeleteDialog
          role={deletingRole}
          onClose={() => setDeletingRole(null)}
          onReload={reloadRoles}
          onDeleted={() => {
            setDeleted(true);
            reloadRoles();
          }}
        />
      )}
      <Snackbar
        open={deleted}
        autoHideDuration={3500}
        onClose={() => setDeleted(false)}
        message={t('access.roles.deleted')}
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
