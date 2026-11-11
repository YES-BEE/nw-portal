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
import { deleteUser } from './usersApi';
import { UsersError } from './usersFailure';
import type { UserResponse, UsersFailure } from './types';

export function UserDeleteDialog({
  user,
  onClose,
  onDeleted,
  onReload,
}: {
  user: UserResponse;
  onClose: () => void;
  onDeleted: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<UsersFailure | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);

  async function confirmDelete() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFailure(null);
    try {
      await deleteUser(user.id, controller.signal);
      if (!controller.signal.aborted) onDeleted();
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setFailure(
          error instanceof UsersError
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
      aria-labelledby="delete-user-title"
      aria-describedby="delete-user-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="delete-user-title">
        {t('access.users.deleteTitle')}
      </DialogTitle>
      <DialogContent aria-busy={pending}>
        <DialogContentText id="delete-user-description">
          {t('access.users.deleteMessage', { name: user.username })}
        </DialogContentText>
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>{t('access.users.deleteFailure')}</AlertTitle>
            {failure.message ||
              t(`access.users.failures.${failure.kind}.description`)}
            {!failure.message && failure.status !== undefined && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('access.users.failureStatus', { status: failure.status })}
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
          <Button onClick={onReload}>{t('access.users.reload')}</Button>
        ) : !failure || failure.action === 'retry' ? (
          <Button
            color="primary"
            variant="contained"
            disabled={pending}
            onClick={() => void confirmDelete()}
          >
            {t(
              pending
                ? 'access.users.deleting'
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
