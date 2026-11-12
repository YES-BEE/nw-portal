import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  InputAdornment,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { createLots, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import type { LotStyleOption, CreateLotsResponse, LotsFailure } from './types';
export function LotForm({
  styles,
  initialStyleId,
  onClose,
  onCreated,
  onReload,
}: {
  styles: LotStyleOption[];
  initialStyleId?: string;
  onClose: () => void;
  onCreated: (batch: CreateLotsResponse) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [styleId, setStyleId] = useState(
    styles.some((style) => style.id === initialStyleId) ? initialStyleId! : '',
  );
  const [lotCount, setLotCount] = useState('1');
  const [quantity, setQuantity] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<LotsFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  const container = useRef<HTMLFormElement>(null);
  useEffect(() => {
    container.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    return () => pending.current?.abort();
  }, []);
  const quantityValue = Number(quantity);
  const validQuantity =
    !quantity.trim() ||
    (Number.isSafeInteger(quantityValue) &&
      quantityValue > 0 &&
      quantityValue <= 2147483647);
  const countValue = Number(lotCount);
  const validCount =
    !!lotCount.trim() &&
    Number.isInteger(countValue) &&
    countValue >= 1 &&
    countValue <= 1000;
  async function save() {
    if (pending.current) return;
    setSubmitted(true);
    if (!validCount || !styleId || !validQuantity) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      const lot = await createLots(
        styleId,
        {
          lotCount: countValue,
          ...(quantity.trim() ? { quantity: quantityValue } : {}),
        },
        controller.signal,
      );
      if (!controller.signal.aborted) onCreated(lot);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(lotsFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  return (
    <Paper
      component="form"
      ref={container}
      noValidate
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
      variant="outlined"
      aria-labelledby="lot-form-title"
      aria-describedby="lot-form-description"
      sx={{ p: 3, borderRadius: 2, scrollMarginTop: 84 }}
    >
      <Typography
        component="h2"
        id="lot-form-title"
        sx={{ fontSize: 17, fontWeight: 600, mb: 1 }}
      >
        {t('lots.formTitle')}
      </Typography>
      <Typography
        id="lot-form-description"
        color="text.secondary"
        sx={{ mb: 2 }}
      >
        {t('lots.formDescription')}
      </Typography>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2.5,
        }}
      >
        <TextField
          select
          required
          label={t('lots.style')}
          value={styleId}
          disabled={saving || !styles.length}
          error={submitted && !styleId}
          helperText={
            !styles.length
              ? t('lots.noStyles')
              : submitted && !styleId
                ? t('lots.styleRequired')
                : undefined
          }
          onChange={(event) => {
            setStyleId(event.target.value);
            setFailure(null);
          }}
        >
          <MenuItem value="">{t('lots.selectStyle')}</MenuItem>
          {styles.map((style) => (
            <MenuItem key={style.id} value={style.id}>
              {style.style_number}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          required
          type="number"
          label={t('lots.count')}
          placeholder={t('lots.countPlaceholder')}
          value={lotCount}
          disabled={saving}
          error={!!failure?.fieldErrors?.lotCount || (submitted && !validCount)}
          helperText={
            failure?.fieldErrors?.lotCount ||
            (submitted && !validCount ? t('lots.countInvalid') : undefined)
          }
          slotProps={{ htmlInput: { min: 1, max: 1000, step: 1 } }}
          onChange={(event) => {
            setLotCount(event.target.value);
            setFailure(null);
          }}
        />
        <TextField
          autoFocus
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
              : t('lots.quantityOptional'))
          }
          slotProps={{
            input: {
              endAdornment: <InputAdornment position="end">Kg</InputAdornment>,
            },
            htmlInput: { min: 1, max: 2147483647, step: 1 },
          }}
          onChange={(event) => {
            setQuantity(event.target.value);
            setFailure(null);
          }}
        />
      </Box>
      {failure && (
        <Box sx={{ mt: 2 }}>
          <LotFailureAlert failure={failure} onReload={onReload} />
        </Box>
      )}
      <Stack
        direction="row"
        spacing={1.5}
        sx={{ justifyContent: 'flex-end', mt: 3 }}
      >
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('access.cancel')}
        </Button>
        <Button
          type="submit"
          variant="contained"
          disabled={
            saving ||
            !styles.length ||
            failure?.action === 'signIn' ||
            failure?.action === 'reload' ||
            failure?.kind === 'access'
          }
        >
          {t(saving ? 'lots.saving' : 'lots.create')}
        </Button>
      </Stack>
    </Paper>
  );
}
