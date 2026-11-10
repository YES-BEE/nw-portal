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
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import { moduleKeys } from './accessData';
import type { ModuleKey } from './accessData';
import { getAccessRoles, saveAccessRole } from './accessRolesApi';
import { AccessRolesError } from './accessRolesFailure';
import { signOut } from '../auth/session';
import type {
  AccessRoleDraft,
  AccessRolesFailure,
  AccessRolesResponse,
} from './types';
import { ManagementHeader } from './ManagementScaffold';
import { RoleForm } from './RoleForm';

type RolesState =
  | { status: 'loading' }
  | { status: 'ready'; roles: AccessRolesResponse }
  | { status: 'error'; failure: AccessRolesFailure };

export function RoleManagementPage() {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<RolesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [form, setForm] = useState<{
    initial: AccessRoleDraft;
    editing: boolean;
  } | null>(null);
  const [saved, setSaved] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    void getAccessRoles(controller.signal).then(
      (roles) => {
        if (!controller.signal.aborted) setState({ status: 'ready', roles });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof AccessRolesError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [attempt]);
  return (
    <>
      <ManagementHeader
        kind="roles"
        onAdd={
          state.status === 'ready' && !form
            ? () => {
                setSaved(false);
                setForm({
                  initial: {
                    code: '',
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
            {t(`access.roles.failures.${state.failure.kind}.title`)}
          </AlertTitle>
          {state.failure.message ||
            t(`access.roles.failures.${state.failure.kind}.description`)}
          {state.failure.status !== undefined && (
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
                            disabled={Boolean(form)}
                            onClick={() => {
                              setSaved(false);
                              setForm({
                                initial: {
                                  code: role.code,
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
                            <EditOutlinedIcon />
                          </IconButton>
                        </Box>
                      </Tooltip>
                      <Tooltip title={t('access.roles.deleteUnavailable')}>
                        <Box component="span">
                          <IconButton
                            disabled
                            color="error"
                            aria-label={t('access.deleteNamed', {
                              name: role.name,
                            })}
                          >
                            <DeleteOutlinedIcon />
                          </IconButton>
                        </Box>
                      </Tooltip>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Paper>
      {form && (
        <RoleForm
          key={form.editing ? form.initial.code : 'new-role'}
          {...form}
          existingCodes={
            state.status === 'ready' ? state.roles.map((role) => role.code) : []
          }
          onClose={() => setForm(null)}
          onSave={async (draft, signal) => {
            await saveAccessRole(
              draft.code,
              {
                modules: draft.modules,
                pcAccess: draft.modules.length > 0,
                padAccess: draft.padAccess,
              },
              signal,
            );
            if (signal.aborted) return;
            setForm(null);
            setSaved(true);
            setState({ status: 'loading' });
            setAttempt((value) => value + 1);
          }}
        />
      )}
      <Snackbar
        open={saved}
        autoHideDuration={3500}
        onClose={() => setSaved(false)}
        message={t('access.saved')}
      />
    </>
  );
}
