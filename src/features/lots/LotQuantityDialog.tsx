import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  InputAdornment,
  TextField,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { updateLot, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import { canEditLotQuantity } from './lotDisplay';
import type { LotResponse, LotsFailure } from './types';

export function LotQuantityDialog({
  lot,
  onClose,
  onSaved,
  onReload,
}: {
  lot: LotResponse;
  onClose: () => void;
  onSaved: (lot: LotResponse) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [quantity, setQuantity] = useState(
    lot.quantity === null ? '' : String(lot.quantity),
  );
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<LotsFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  const number = Number(quantity);
  const validQuantity =
    !!quantity.trim() &&
    Number.isInteger(number) &&
    number > 0 &&
    number <= 2147483647;
  const validReason = !!reason.trim() && reason.length <= 500;
  async function save() {
    if (pending.current || !canEditLotQuantity(lot.status)) return;
    setSubmitted(true);
    if (!validQuantity || !validReason) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      const updated = await updateLot(
        lot.id,
        { quantity: number, reason: reason.trim() },
        controller.signal,
      );
      if (!controller.signal.aborted) onSaved(updated);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(lotsFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  return (
    <Dialog
      open
      fullWidth
      maxWidth="xs"
      onClose={saving ? undefined : onClose}
      aria-labelledby="lot-quantity-title"
    >
      <DialogTitle id="lot-quantity-title">
        {t('lots.editQuantityTitle', { number: lot.lot_number })}
      </DialogTitle>
      <DialogContent>
        <Box
          component="form"
          id="lot-quantity-form"
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
        >
          <DialogContentText sx={{ mb: 2 }}>
            {t('lots.editQuantityHint')}
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            required
            type="number"
            label={t('lots.quantityPerLot')}
            placeholder={t('lots.quantityPlaceholder')}
            value={quantity}
            disabled={saving}
            error={
              !!failure?.fieldErrors?.quantity || (submitted && !validQuantity)
            }
            helperText={
              failure?.fieldErrors?.quantity ||
              (submitted && !validQuantity
                ? t('lots.quantityRequired')
                : undefined)
            }
            slotProps={{
              htmlInput: { min: 1, max: 2147483647, step: 1 },
              input: {
                endAdornment: (
                  <InputAdornment position="end">Kg</InputAdornment>
                ),
              },
            }}
            onChange={(event) => {
              setQuantity(event.target.value);
              setFailure(null);
            }}
            sx={{ mb: 2 }}
          />
          <TextField
            fullWidth
            required
            multiline
            minRows={2}
            label={t('lots.reason')}
            placeholder={t('lots.quantityReasonPlaceholder')}
            value={reason}
            disabled={saving}
            slotProps={{ htmlInput: { maxLength: 500 } }}
            error={
              !!failure?.fieldErrors?.reason || (submitted && !validReason)
            }
            helperText={
              failure?.fieldErrors?.reason ||
              (submitted && !validReason
                ? t('lots.quantityReasonRequired')
                : undefined)
            }
            onChange={(event) => {
              setReason(event.target.value);
              setFailure(null);
            }}
          />
          {failure && <LotFailureAlert failure={failure} onReload={onReload} />}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('lots.close')}
        </Button>
        <Button
          variant="contained"
          type="submit"
          form="lot-quantity-form"
          disabled={
            saving ||
            !canEditLotQuantity(lot.status) ||
            failure?.kind === 'access' ||
            failure?.kind === 'conflict' ||
            failure?.action === 'signIn' ||
            failure?.action === 'reload'
          }
        >
          {t(saving ? 'lots.saving' : 'lots.saveQuantity')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
