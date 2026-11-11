import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { getUser } from './usersApi';
import { UsersError } from './usersFailure';
import { UserForm } from './UserForm';
import type { UserResponse, UsersFailure } from './types';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; user: UserResponse }
  | { status: 'error'; failure: UsersFailure };

export function UserEditor({
  userId,
  onClose,
  onReload,
}: {
  userId: string;
  onClose: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<DetailState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const section = useRef<HTMLElement>(null);
  useEffect(() => {
    const controller = new AbortController();
    section.current?.scrollIntoView?.({ behavior: 'instant', block: 'start' });
    void getUser(userId, controller.signal).then(
      (user) => {
        if (!controller.signal.aborted) setState({ status: 'ready', user });
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
  }, [userId, attempt]);
  if (state.status === 'ready')
    return <UserForm initial={state.user} onClose={onClose} />;
  return (
    <Paper
      component="section"
      ref={section}
      aria-labelledby="user-editor-title"
      variant="outlined"
      sx={{ p: 3, mt: 3, borderRadius: 2, scrollMarginTop: 84 }}
    >
      <Typography
        component="h2"
        variant="h6"
        id="user-editor-title"
        sx={{ mb: 2 }}
      >
        {t('access.users.edit')}
      </Typography>
      {state.status === 'loading' ? (
        <Stack
          role="status"
          aria-label={t('access.users.loadingDetails')}
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', py: 2 }}
        >
          <CircularProgress size={28} />
          <Typography>{t('access.users.loadingDetails')}</Typography>
        </Stack>
      ) : (
        <Alert
          severity="error"
          action={
            state.failure.action === 'signIn' ? (
              <Button color="inherit" onClick={signOut}>
                {t('startup.signIn')}
              </Button>
            ) : state.failure.action === 'reload' ? (
              <Button color="inherit" onClick={onReload}>
                {t('access.users.reload')}
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
          <AlertTitle>{t('access.users.detailFailure')}</AlertTitle>
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
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 3 }}>
        <Button onClick={onClose}>{t('access.cancel')}</Button>
      </Stack>
    </Paper>
  );
}
