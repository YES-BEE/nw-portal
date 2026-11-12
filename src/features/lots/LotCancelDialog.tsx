import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  TextField,
} from '@mui/material';
import { cancelLot, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import type { LotResponse, LotsFailure } from './types';
export function LotCancelDialog({
  lot,
  onClose,
  onCancelled,
  onReload,
}: {
  lot: LotResponse;
  onClose: () => void;
  onCancelled: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<LotsFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function save() {
    if (pending.current) return;
    setSubmitted(true);
    if (!reason.trim()) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      await cancelLot(lot.id, { reason: reason.trim() }, controller.signal);
      if (!controller.signal.aborted) onCancelled();
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(lotsFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  const error =
    failure?.fieldErrors?.reason ||
    (submitted && !reason.trim() ? t('lots.reasonRequired') : undefined);
  return (
    <Dialog
      open
      fullWidth
      maxWidth="xs"
      onClose={saving ? undefined : onClose}
      aria-labelledby="lot-cancel-title"
    >
      <DialogTitle id="lot-cancel-title">{t('lots.cancelTitle')}</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t('lots.cancelMessage', { number: lot.lot_number })}
        </DialogContentText>
        <TextField
          required
          autoFocus
          fullWidth
          multiline
          minRows={2}
          label={t('lots.reason')}
          placeholder={t('lots.reasonPlaceholder')}
          disabled={saving}
          value={reason}
          error={!!error}
          helperText={error}
          slotProps={{ htmlInput: { maxLength: 500 } }}
          onChange={(event) => {
            setReason(event.target.value);
            setFailure(null);
          }}
        />
        {failure && <LotFailureAlert failure={failure} onReload={onReload} />}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('lots.close')}
        </Button>
        <Button
          variant="contained"
          disabled={
            saving ||
            failure?.action === 'signIn' ||
            failure?.action === 'reload' ||
            failure?.kind === 'access' ||
            failure?.kind === 'conflict'
          }
          onClick={() => void save()}
        >
          {t(saving ? 'lots.saving' : 'lots.cancel')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
