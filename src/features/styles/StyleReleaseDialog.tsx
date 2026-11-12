import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
} from '@mui/material';
import { releaseStyle, stylesFailure } from './stylesApi';
import type { StyleResponse, StylesFailure } from './types';
import { StyleFailureAlert } from './StyleFailureAlert';
export function StyleReleaseDialog({
  style,
  onClose,
  onSaved,
  onReload,
}: {
  style: StyleResponse;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<StylesFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function save() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      await releaseStyle(style.id, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(stylesFailure(error));
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
      aria-labelledby="style-release-title"
    >
      <DialogTitle id="style-release-title">
        {t('styles.releaseTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t('styles.releaseMessage', { number: style.style_number })}
        </DialogContentText>
        {failure && <StyleFailureAlert failure={failure} onReload={onReload} />}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('access.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={saving || (!!failure && failure.action !== 'retry')}
          onClick={() => void save()}
        >
          {t(saving ? 'styles.saving' : 'styles.release')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
