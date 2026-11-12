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
  MenuItem,
  TextField,
} from '@mui/material';
import {
  assignLotTrolley,
  getAvailableLotTrolleys,
  lotsFailure,
  unassignLotTrolley,
} from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import type { LotResponse, LotsFailure } from './types';
import type { TrolleyResponse } from '../trolleys/types';
import { canMapLotTrolley } from './lotDisplay';

type Lookup =
  | { status: 'loading' }
  | { status: 'ready'; items: TrolleyResponse[] }
  | { status: 'error'; failure: LotsFailure };
export function LotTrolleyDialog({
  lot,
  onClose,
  onSaved,
  onReload,
}: {
  lot: LotResponse;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const unassign = !!lot.trolley_id;
  const [lookup, setLookup] = useState<Lookup>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [selected, setSelected] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<LotsFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  useEffect(() => {
    if (unassign) return;
    const controller = new AbortController();
    void getAvailableLotTrolleys(controller.signal).then(
      (items) => {
        if (!controller.signal.aborted) setLookup({ status: 'ready', items });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setLookup({ status: 'error', failure: lotsFailure(error) });
      },
    );
    return () => controller.abort();
  }, [attempt, unassign]);
  useEffect(() => () => pending.current?.abort(), []);
  function reloadOptions() {
    setSelected('');
    setSubmitted(false);
    setFailure(null);
    setLookup({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  async function save() {
    if (pending.current || !canMapLotTrolley(lot.status)) return;
    setSubmitted(true);
    if (
      !unassign &&
      (!selected ||
        lookup.status !== 'ready' ||
        !lookup.items.some((row) => row.id === selected))
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      if (unassign) await unassignLotTrolley(lot.id, controller.signal);
      else
        await assignLotTrolley(
          lot.id,
          { trolleyId: selected },
          controller.signal,
        );
      if (!controller.signal.aborted) onSaved();
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
      aria-labelledby="lot-trolley-title"
      onClose={saving ? undefined : onClose}
    >
      <DialogTitle id="lot-trolley-title">
        {t(
          unassign ? 'lots.trolley.unassignTitle' : 'lots.trolley.assignTitle',
          { number: lot.lot_number },
        )}
      </DialogTitle>
      <DialogContent>
        {unassign ? (
          <DialogContentText>
            {t('lots.trolley.unassignMessage', {
              number: lot.lot_number,
              trolley: lot.trolley_code,
            })}
          </DialogContentText>
        ) : (
          <>
            {lookup.status === 'loading' && (
              <CircularProgress size={28} aria-label={t('common.loading')} />
            )}
            {lookup.status === 'error' && (
              <LotFailureAlert
                failure={lookup.failure}
                onReload={onReload}
                onRetry={reloadOptions}
              />
            )}
            {lookup.status === 'ready' && (
              <TextField
                select
                fullWidth
                required
                label={t('lots.trolley.available')}
                value={selected}
                disabled={saving || !lookup.items.length}
                error={
                  lookup.items.length > 0 &&
                  (!!failure?.fieldErrors?.trolleyId ||
                    (submitted && !selected))
                }
                helperText={
                  !lookup.items.length
                    ? t('lots.trolley.empty')
                    : failure?.fieldErrors?.trolleyId ||
                      (submitted && !selected
                        ? t('lots.trolley.required')
                        : undefined)
                }
                onChange={(event) => {
                  setSelected(event.target.value);
                  setFailure(null);
                }}
              >
                <MenuItem value="">{t('lots.trolley.placeholder')}</MenuItem>
                {lookup.items.map((trolley) => (
                  <MenuItem key={trolley.id} value={trolley.id}>
                    {trolley.code}
                  </MenuItem>
                ))}
              </TextField>
            )}
          </>
        )}
        {failure && (
          <>
            <LotFailureAlert failure={failure} onReload={onReload} />
            <Button
              variant="outlined"
              size="small"
              disabled={saving}
              onClick={onReload}
            >
              {t('lots.trolley.reloadLot')}
            </Button>
          </>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('lots.close')}
        </Button>
        <Button
          variant="contained"
          disabled={
            saving ||
            !canMapLotTrolley(lot.status) ||
            (!unassign &&
              (lookup.status !== 'ready' || !lookup.items.length)) ||
            failure?.kind === 'access' ||
            failure?.action === 'signIn' ||
            failure?.action === 'reload'
          }
          onClick={() => void save()}
        >
          {t(
            saving
              ? 'lots.saving'
              : unassign
                ? 'lots.trolley.unassign'
                : 'lots.trolley.assign',
          )}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
