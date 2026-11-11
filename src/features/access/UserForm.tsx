import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  AlertTitle,
  Button,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import type {
  CreateUserRequest,
  UpdateUserRequest,
  UserResponse,
  UsersFailure,
  UserProcessAssignmentRequest,
} from './types';
import { UserProcessSelect } from './UserProcessSelect';
import { UserRoleSelect } from './UserRoleSelect';
import { UsersError } from './usersFailure';
import { signOut } from '../auth/session';

type UserFormProps = { onClose: () => void; onReload?: () => void } & (
  | {
      initial: UserResponse;
      onCreate?: never;
      onUpdate: (body: UpdateUserRequest, signal: AbortSignal) => Promise<void>;
    }
  | {
      initial?: never;
      onUpdate?: never;
      onCreate: (
        body: CreateUserRequest,
        signal: AbortSignal,
      ) => Promise<UserResponse | void>;
    }
);

export function UserForm({
  initial,
  onClose,
  onCreate,
  onUpdate,
  onReload,
}: UserFormProps) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState({
    username: initial?.username ?? '',
    displayName: initial?.display_name ?? '',
    role: initial?.role ?? '',
    processAssignments: (initial?.processAssignments ?? []).map(
      ({ processId, activeOnShift }): UserProcessAssignmentRequest => ({
        processId,
        activeOnShift,
      }),
    ),
    initialPassword: '',
  });
  const [processesReady, setProcessesReady] = useState(false);
  const isProcessManager = draft.role === 'PROCESS_MANAGER';
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<UsersFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    section.current?.scrollIntoView?.({ behavior: 'instant', block: 'start' });
    return () => pending.current?.abort();
  }, []);
  const requiredErrors = {
    username: !draft.username.trim(),
    displayName: !draft.displayName.trim(),
    initialPassword: !!onCreate && !draft.initialPassword.trim(),
    role: !draft.role.trim(),
  };
  const fieldError = (field: keyof typeof requiredErrors) =>
    failure?.fieldErrors?.[field] ||
    (submitted && requiredErrors[field]
      ? t(`access.users.required.${field}`)
      : undefined);
  function update(field: keyof typeof requiredErrors, value: string) {
    setDraft((current) => ({
      ...current,
      [field]: value,
      ...(field === 'role' && value !== current.role
        ? { processAssignments: [] }
        : {}),
    }));
    if (field === 'role' && value !== draft.role) setProcessesReady(false);
    setFailure((current) =>
      current
        ? {
            ...current,
            fieldErrors: {
              ...current.fieldErrors,
              [field]: undefined,
              ...(field === 'role' ? { processAssignments: undefined } : {}),
            },
          }
        : null,
    );
  }
  return (
    <Paper
      component="section"
      ref={section}
      aria-labelledby="user-form-title"
      variant="outlined"
      sx={{ p: 3, mt: 3, borderRadius: 2, scrollMarginTop: 84 }}
    >
      <Typography
        id="user-form-title"
        component="h2"
        variant="h6"
        sx={{ mb: 2 }}
      >
        {t(onCreate ? 'access.users.add' : 'access.users.edit')}
      </Typography>
      <Box
        component="form"
        noValidate
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current || (isProcessManager && !processesReady)) return;
          setSubmitted(true);
          if (Object.values(requiredErrors).some(Boolean)) return;
          const controller = new AbortController();
          pending.current = controller;
          setSaving(true);
          setFailure(null);
          try {
            const body: UpdateUserRequest = {
              username: draft.username.trim(),
              displayName: draft.displayName.trim(),
              role: draft.role,
              processAssignments: draft.processAssignments,
            };
            if (onCreate)
              await onCreate(
                { ...body, initialPassword: draft.initialPassword },
                controller.signal,
              );
            else await onUpdate(body, controller.signal);
          } catch (error: unknown) {
            if (!controller.signal.aborted)
              setFailure(
                error instanceof UsersError
                  ? error.failure
                  : { kind: 'network', action: 'retry' },
              );
          } finally {
            pending.current = null;
            if (!controller.signal.aborted) setSaving(false);
          }
        }}
      >
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          sx={{ alignItems: 'flex-start' }}
        >
          <TextField
            placeholder={t('access.users.usernamePlaceholder')}
            label={t('access.username')}
            autoFocus
            required
            disabled={saving}
            value={draft.username}
            onChange={(event) => update('username', event.target.value)}
            error={!!fieldError('username')}
            helperText={fieldError('username')}
            sx={{ width: { xs: '100%', md: 320 } }}
          />
          <TextField
            placeholder={t('access.users.displayNamePlaceholder')}
            label={t('access.users.displayName')}
            required
            disabled={saving}
            value={draft.displayName}
            onChange={(event) => update('displayName', event.target.value)}
            error={!!fieldError('displayName')}
            helperText={fieldError('displayName')}
            sx={{ width: { xs: '100%', md: 320 } }}
          />
          <UserRoleSelect
            value={draft.role}
            onChange={(role) => update('role', role)}
            disabled={saving}
            errorMessage={fieldError('role')}
          />
        </Stack>
        {isProcessManager && (
          <UserProcessSelect
            value={draft.processAssignments}
            initial={initial?.processAssignments}
            disabled={saving}
            onReadyChange={setProcessesReady}
            errorMessage={failure?.fieldErrors?.processAssignments}
            onChange={(processAssignments) => {
              setDraft((current) => ({ ...current, processAssignments }));
              setFailure((current) =>
                current
                  ? {
                      ...current,
                      fieldErrors: {
                        ...current.fieldErrors,
                        processAssignments: undefined,
                      },
                    }
                  : null,
              );
            }}
          />
        )}
        {onCreate && (
          <TextField
            placeholder={t('access.users.initialPasswordPlaceholder')}
            label={t('access.users.initialPassword')}
            type="password"
            autoComplete="new-password"
            required
            disabled={saving}
            value={draft.initialPassword}
            onChange={(event) => update('initialPassword', event.target.value)}
            error={!!fieldError('initialPassword')}
            helperText={fieldError('initialPassword')}
            sx={{ mt: 2.5, width: { xs: '100%', sm: 320 } }}
          />
        )}
        {failure && (
          <Alert
            severity="error"
            sx={{ mt: 2 }}
            action={
              failure.action === 'signIn' ? (
                <Button color="inherit" onClick={signOut}>
                  {t('startup.signIn')}
                </Button>
              ) : failure.action === 'reload' && onReload ? (
                <Button color="inherit" onClick={onReload}>
                  {t('access.users.reload')}
                </Button>
              ) : undefined
            }
          >
            <AlertTitle>
              {t(
                onCreate
                  ? 'access.users.createFailure'
                  : 'access.users.updateFailure',
              )}
            </AlertTitle>
            {failure.message ||
              t(`access.users.failures.${failure.kind}.description`)}
            {!isProcessManager && failure.fieldErrors?.processAssignments && (
              <Typography variant="body2">
                {failure.fieldErrors.processAssignments}
              </Typography>
            )}
            {!failure.message && failure.status !== undefined && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('access.users.failureStatus', { status: failure.status })}
              </Typography>
            )}
          </Alert>
        )}
        <Stack
          direction="row"
          spacing={1.5}
          sx={{ justifyContent: 'flex-end', mt: 3 }}
        >
          <Button variant="outlined" onClick={onClose} disabled={saving}>
            {t('access.cancel')}
          </Button>
          <Button
            type="submit"
            variant="contained"
            disabled={saving || (isProcessManager && !processesReady)}
          >
            {t(
              saving
                ? onCreate
                  ? 'access.users.creating'
                  : 'access.users.saving'
                : 'access.users.save',
            )}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
