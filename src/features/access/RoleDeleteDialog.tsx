import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { deleteAccessRole } from './accessRolesApi';
import { AccessRolesError } from './accessRolesFailure';
import type { AccessRoleResponse, AccessRolesFailure } from './types';

export function RoleDeleteDialog({
  role,
  onClose,
  onDeleted,
  onReload,
}: {
  role: AccessRoleResponse;
  onClose: () => void;
  onDeleted: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<AccessRolesFailure | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function confirmDelete() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFailure(null);
    try {
      await deleteAccessRole(role.code, controller.signal);
      if (!controller.signal.aborted) onDeleted();
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setFailure(
          error instanceof AccessRolesError
            ? error.failure
            : { kind: 'network', action: 'retry' },
        );
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setPending(false);
      }
    }
  }
  return (
    <Dialog
      open
      onClose={pending ? undefined : onClose}
      aria-labelledby="delete-role-title"
      aria-describedby="delete-role-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="delete-role-title">
        {t('access.roles.deleteTitle')}
      </DialogTitle>
      <DialogContent aria-busy={pending}>
        <DialogContentText id="delete-role-description">
          {t('access.roles.deleteMessage', { name: role.name })}
        </DialogContentText>
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>{t('access.roles.deleteFailure')}</AlertTitle>
            {failure.message ||
              t(
                failure.code === 'ROLE_IN_USE'
                  ? 'access.roles.roleInUse'
                  : failure.code === 'BUILT_IN_ROLE'
                    ? 'access.roles.builtInDelete'
                    : `access.roles.failures.${failure.kind}.description`,
              )}
            {!failure.message && failure.status !== undefined && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('access.roles.failureStatus', { status: failure.status })}
              </Typography>
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button disabled={pending} onClick={onClose}>
          {t('access.cancel')}
        </Button>
        {failure?.action === 'signIn' ? (
          <Button onClick={signOut}>{t('startup.signIn')}</Button>
        ) : failure?.action === 'reload' ? (
          <Button onClick={onReload}>{t('access.roles.reload')}</Button>
        ) : !failure || failure.action === 'retry' ? (
          <Button
            color="primary"
            variant="contained"
            disabled={pending}
            onClick={() => void confirmDelete()}
          >
            {t(
              pending
                ? 'access.roles.deleting'
                : failure
                  ? 'startup.retry'
                  : 'access.delete',
            )}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
