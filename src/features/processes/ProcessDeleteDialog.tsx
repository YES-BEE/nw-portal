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
import { deleteProcess, ProcessesError } from './processesApi';
import type { ProcessResponse, ProcessesFailure } from './types';

export function ProcessDeleteDialog({
  process,
  onClose,
  onDeleted,
  onReload,
}: {
  process: ProcessResponse;
  onClose: () => void;
  onDeleted: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<ProcessesFailure | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function confirmDelete() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFailure(null);
    try {
      await deleteProcess(process.id, controller.signal);
      if (!controller.signal.aborted) onDeleted();
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setFailure(
          error instanceof ProcessesError
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
      aria-labelledby="delete-process-title"
      aria-describedby="delete-process-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="delete-process-title">
        {t('processes.deleteTitle')}
      </DialogTitle>
      <DialogContent aria-busy={pending}>
        <DialogContentText id="delete-process-description">
          {t('processes.deleteMessage', { name: process.name })}
        </DialogContentText>
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>{t('processes.deleteFailure')}</AlertTitle>
            {failure.message ||
              t(
                failure.kind === 'invalidRequest' || failure.kind === 'conflict'
                  ? 'processes.deleteBlocked'
                  : `processes.failures.${failure.kind}.description`,
              )}
            {!failure.message && failure.status !== undefined && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('processes.failureStatus', { status: failure.status })}
              </Typography>
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={pending} onClick={onClose}>
          {t('processes.cancel')}
        </Button>
        {failure?.action === 'signIn' ? (
          <Button onClick={signOut}>{t('startup.signIn')}</Button>
        ) : failure?.action === 'reload' ? (
          <Button onClick={onReload}>{t('processes.reload')}</Button>
        ) : !failure || failure.action === 'retry' ? (
          <Button
            color="primary"
            variant="contained"
            disabled={pending}
            onClick={() => void confirmDelete()}
          >
            {t(
              pending
                ? 'processes.deleting'
                : failure
                  ? 'startup.retry'
                  : 'processes.deleteAction',
            )}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
