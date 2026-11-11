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
import {
  deleteStorageArea,
  setStorageAreaStatus,
  storageFailure,
} from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';
import type { StorageAreaResponse, StorageFailure } from './types';
export function StorageStatusDialog({
  record,
  onClose,
  onSaved,
  onReload,
}: {
  record: StorageAreaResponse;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<StorageFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => () => pending.current?.abort(), []);
  async function save() {
    if (pending.current) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      if (record.active) await deleteStorageArea(record.id, controller.signal);
      else
        await setStorageAreaStatus(
          record.id,
          { active: true },
          controller.signal,
        );
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(storageFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  return (
    <Dialog
      open
      onClose={saving ? undefined : onClose}
      fullWidth
      maxWidth="xs"
      aria-labelledby="storage-status-title"
    >
      <DialogTitle id="storage-status-title">
        {t(record.active ? 'storages.deleteTitle' : 'storages.restoreTitle')}
      </DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          {t(
            record.active
              ? 'storages.deleteMessage'
              : 'storages.restoreMessage',
            { number: record.storageNumber },
          )}
        </DialogContentText>
        {failure && (
          <StorageFailureAlert failure={failure} onReload={onReload} />
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('storages.cancel')}
        </Button>
        <Button
          variant="contained"
          disabled={saving || (!!failure && failure.action !== 'retry')}
          onClick={() => void save()}
        >
          {t(
            saving
              ? 'storages.saving'
              : record.active
                ? 'storages.deleteAction'
                : 'storages.restore',
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
