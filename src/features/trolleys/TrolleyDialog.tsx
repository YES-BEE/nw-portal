import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  createTrolley,
  getTrolley,
  setTrolleyStatus,
  updateTrolley,
  TrolleysError,
} from './trolleysApi';
import type { TrolleyResponse, TrolleysFailure } from './types';
import { TrolleyFailureAlert } from './TrolleyFailureAlert';

export type TrolleySelection =
  | { mode: 'create' }
  | { mode: 'view' | 'edit' | 'status'; record: TrolleyResponse };

export function TrolleyDialog({
  selection,
  onClose,
  onSaved,
  onReload,
}: {
  selection: TrolleySelection;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const initial = selection.mode === 'create' ? null : selection.record;
  const [record, setRecord] = useState(initial);
  const [code, setCode] = useState(initial?.code ?? '');
  const [loading, setLoading] = useState(
    selection.mode === 'edit' || selection.mode === 'view',
  );
  const [loaded, setLoaded] = useState(
    selection.mode === 'create' || selection.mode === 'status',
  );
  const [failure, setFailure] = useState<TrolleysFailure | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const id = initial?.id;
  const mode = selection.mode;
  useEffect(() => {
    const controller = new AbortController();
    if (id && (mode === 'edit' || mode === 'view'))
      void getTrolley(id, controller.signal).then(
        (value) => {
          if (!controller.signal.aborted) {
            setRecord(value);
            setCode(value.code);
            setLoading(false);
            setLoaded(true);
          }
        },
        (error: unknown) => {
          if (!controller.signal.aborted) {
            setLoading(false);
            setFailure(
              error instanceof TrolleysError
                ? error.failure
                : { kind: 'network', action: 'retry' },
            );
          }
        },
      );
    return () => {
      controller.abort();
      pending.current?.abort();
    };
  }, [id, mode, attempt]);
  const title =
    mode === 'create'
      ? 'create'
      : mode === 'view'
        ? 'details'
        : mode === 'edit'
          ? 'edit'
          : record?.active
            ? 'deleteTitle'
            : 'restoreTitle';
  const codeError =
    failure?.codeError ||
    (submitted && !code.trim() ? t('trolleys.codeRequired') : undefined);
  async function submit() {
    if (pending.current || !loaded || mode === 'view') return;
    setSubmitted(true);
    if (mode !== 'status' && !code.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      if (mode === 'create') await createTrolley({ code }, controller.signal);
      else if (mode === 'edit' && id)
        await updateTrolley(id, { code }, controller.signal);
      else if (mode === 'status' && record)
        await setTrolleyStatus(
          record.id,
          { active: !record.active },
          controller.signal,
        );
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (!controller.signal.aborted)
        setFailure(
          error instanceof TrolleysError
            ? error.failure
            : { kind: 'network', action: 'retry' },
        );
    } finally {
      if (!controller.signal.aborted) {
        pending.current = null;
        setSaving(false);
      }
    }
  }
  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      aria-labelledby="trolley-dialog-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="trolley-dialog-title">
        {t(`trolleys.${title}`)}
      </DialogTitle>
      <Stack
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        <DialogContent aria-busy={loading || saving}>
          {failure && (
            <TrolleyFailureAlert
              failure={failure}
              onReload={onReload}
              onRetry={
                !loaded
                  ? () => {
                      setFailure(null);
                      setLoading(true);
                      setAttempt((value) => value + 1);
                    }
                  : undefined
              }
            />
          )}
          {loading && (
            <Stack direction="row" spacing={2} sx={{ alignItems: 'center' }}>
              <CircularProgress size={24} aria-label={t('common.loading')} />
              <Typography>{t('common.loading')}</Typography>
            </Stack>
          )}
          {loaded && (mode === 'create' || mode === 'edit') && (
            <TextField
              placeholder={t('trolleys.codePlaceholder')}
              fullWidth
              autoFocus
              required
              label={t('trolleys.code')}
              value={code}
              disabled={saving}
              error={!!codeError}
              helperText={codeError}
              slotProps={{ htmlInput: { maxLength: 80 } }}
              onChange={(event) => {
                setCode(event.target.value);
                setFailure(null);
              }}
            />
          )}
          {loaded && mode === 'view' && record && (
            <Stack spacing={2}>
              <Typography>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {t('trolleys.code')}:{' '}
                </Typography>
                {record.code}
              </Typography>
              <Typography>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {t('trolleys.availability')}:{' '}
                </Typography>
                {record.status === 'AVAILABLE'
                  ? t('trolleys.available')
                  : record.status === 'IN_USE'
                    ? t('trolleys.inUse')
                    : record.status}
              </Typography>
              <Typography>
                <Typography component="span" sx={{ fontWeight: 700 }}>
                  {t('access.status')}:{' '}
                </Typography>
                {t(record.active ? 'access.active' : 'access.inactive')}
              </Typography>
            </Stack>
          )}
          {mode === 'status' && record && (
            <DialogContentText>
              {t(
                record.active
                  ? 'trolleys.deleteMessage'
                  : 'trolleys.restoreMessage',
                { code: record.code },
              )}
            </DialogContentText>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={saving}>
            {t(mode === 'view' ? 'trolleys.close' : 'access.cancel')}
          </Button>
          {mode !== 'view' && (
            <Button
              type="submit"
              variant="contained"
              disabled={
                loading ||
                !loaded ||
                saving ||
                failure?.action === 'signIn' ||
                failure?.action === 'reload' ||
                failure?.kind === 'access' ||
                (mode === 'status' && failure?.action === 'none')
              }
            >
              {t(
                saving
                  ? 'trolleys.saving'
                  : mode === 'status'
                    ? record?.active
                      ? 'access.delete'
                      : 'trolleys.restore'
                    : 'trolleys.save',
              )}
            </Button>
          )}
        </DialogActions>
      </Stack>
    </Dialog>
  );
}
