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
import { deleteTag, TagsError } from './tagsApi';
import type { TagResponse, TagsFailure } from './tagsApi';

export function TagDeleteDialog({
  tag,
  onClose,
  onDeleted,
  onReload,
}: {
  tag: TagResponse;
  onClose: () => void;
  onDeleted: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [pending, setPending] = useState(false);
  const [failure, setFailure] = useState<TagsFailure | null>(null);
  const request = useRef<AbortController | null>(null);
  useEffect(() => () => request.current?.abort(), []);
  async function confirmDelete() {
    if (request.current) return;
    const controller = new AbortController();
    request.current = controller;
    setPending(true);
    setFailure(null);
    try {
      await deleteTag(tag.id, controller.signal);
      if (!controller.signal.aborted) onDeleted();
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setFailure(
          error instanceof TagsError
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
      aria-labelledby="delete-tag-title"
      aria-describedby="delete-tag-description"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="delete-tag-title">{t('tags.deleteTitle')}</DialogTitle>
      <DialogContent aria-busy={pending}>
        <DialogContentText id="delete-tag-description">
          {t('tags.deleteMessage', { name: tag.name, actual: tag.uid })}
        </DialogContentText>
        {failure && (
          <Alert severity="error" sx={{ mt: 2 }}>
            <AlertTitle>{t('tags.deleteFailure')}</AlertTitle>
            {failure.message ||
              t(
                failure.code === 'NFC_STILL_ASSIGNED'
                  ? 'tags.deleteBlocked'
                  : `tags.failures.${failure.kind}.description`,
              )}
            {!failure.message && failure.status !== undefined && (
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('tags.failureStatus', { status: failure.status })}
              </Typography>
            )}
          </Alert>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={pending} onClick={onClose}>
          {t('tags.cancel')}
        </Button>
        {failure?.action === 'signIn' ? (
          <Button onClick={signOut}>{t('startup.signIn')}</Button>
        ) : failure?.action === 'reload' ? (
          <Button onClick={onReload}>{t('tags.details.reload')}</Button>
        ) : !failure || failure.action === 'retry' ? (
          <Button
            color="primary"
            variant="contained"
            disabled={pending}
            onClick={() => void confirmDelete()}
          >
            {t(
              pending
                ? 'tags.deleting'
                : failure
                  ? 'startup.retry'
                  : 'tags.deleteAction',
            )}
          </Button>
        ) : null}
      </DialogActions>
    </Dialog>
  );
}
