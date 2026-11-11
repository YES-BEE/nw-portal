import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  MenuItem,
  TextField,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { getAccessRoleOptions } from './accessRolesApi';
import { AccessRolesError } from './accessRolesFailure';
import type { AccessRolesFailure, AccessRoleOptionsResponse } from './types';

type RolesState =
  | { status: 'loading' }
  | { status: 'ready'; roles: AccessRoleOptionsResponse }
  | { status: 'error'; failure: AccessRolesFailure };

export function UserRoleSelect({
  value,
  onChange,
  disabled = false,
  errorMessage,
}: {
  value: string | null;
  onChange: (code: string) => void;
  disabled?: boolean;
  errorMessage?: string;
}) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<RolesState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getAccessRoleOptions(controller.signal).then(
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
  const roles = state.status === 'ready' ? state.roles : [];
  const hasActiveRoles = roles.length > 0;
  const missingCurrent = !!value && !roles.some((role) => role.code === value);
  return (
    <Box
      sx={{ width: { xs: '100%', md: 280 } }}
      aria-busy={state.status === 'loading'}
    >
      <TextField
        select
        fullWidth
        required
        name="role"
        label={t('access.role')}
        value={value ?? ''}
        disabled={disabled || state.status !== 'ready' || !hasActiveRoles}
        error={!!errorMessage || state.status === 'error'}
        onChange={(event) => onChange(event.target.value)}
        helperText={
          errorMessage ||
          (state.status === 'loading'
            ? t('access.users.loadingRoles')
            : state.status === 'ready' && !hasActiveRoles
              ? t('access.users.noRolesAvailable')
              : undefined)
        }
        slotProps={{
          select: { displayEmpty: true },
          inputLabel: { shrink: true },
        }}
      >
        <MenuItem value="" disabled>
          {t('access.selectRole')}
        </MenuItem>
        {missingCurrent && (
          <MenuItem value={value!} disabled>
            {state.status === 'ready'
              ? t('access.users.unavailableRole', {
                  code: value!,
                })
              : value!}
          </MenuItem>
        )}
        {roles.map((role) => (
          <MenuItem key={role.code} value={role.code}>
            {role.name}
          </MenuItem>
        ))}
      </TextField>
      {state.status === 'error' && (
        <Alert
          severity="error"
          sx={{ mt: 1 }}
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
          <AlertTitle>{t('access.users.rolesFailure')}</AlertTitle>
          {state.failure.message ||
            t(`access.roles.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
              {t('access.users.failureStatus', {
                status: state.failure.status,
              })}
            </Typography>
          )}
        </Alert>
      )}
    </Box>
  );
}
