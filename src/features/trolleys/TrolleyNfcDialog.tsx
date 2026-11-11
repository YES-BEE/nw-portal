import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { getTag, TagsError, type TagDetailsResponse } from '../tags/tagsApi';
import {
  assignTrolleyNfcTag,
  getTrolleyNfcTags,
  unassignTrolleyNfcTag,
} from './trolleyNfcApi';
import { TrolleyFailureAlert } from './TrolleyFailureAlert';
import type { TrolleyResponse, TrolleysFailure } from './types';

type Change =
  | { mode: 'assign' }
  | { mode: 'replace' | 'unassign'; tag: TagDetailsResponse };
export function TrolleyNfcDialog({
  trolley,
  onClose,
}: {
  trolley: TrolleyResponse;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [tags, setTags] = useState<TagDetailsResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<TrolleysFailure | null>(null);
  const [change, setChange] = useState<Change | null>(null);
  const [selected, setSelected] = useState('');
  const [reason, setReason] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [previousRemoved, setPreviousRemoved] = useState(false);
  const pending = useRef<AbortController | null>(null);
  const fail = (error: unknown) => {
    const value =
      error instanceof TagsError
        ? error.failure
        : { kind: 'network' as const, action: 'retry' as const };
    setFailure({
      ...value,
      kind: value.kind === 'representation' ? 'invalidResponse' : value.kind,
    });
  };
  useEffect(() => {
    const controller = new AbortController();
    void getTrolleyNfcTags(controller.signal).then(
      (data) => {
        if (!controller.signal.aborted) {
          setTags(data);
          setLoading(false);
        }
      },
      (error) => {
        if (!controller.signal.aborted) {
          fail(error);
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => pending.current?.abort(), []);
  function reload() {
    setFailure(null);
    setLoading(true);
    setChange(null);
    setPreviousRemoved(false);
    setAttempt((v) => v + 1);
  }
  function start(value: Change) {
    setChange(value);
    setSelected('');
    setReason('');
    setSubmitted(false);
    setFailure(null);
    setPreviousRemoved(false);
  }
  async function save() {
    setSubmitted(true);
    if (
      !change ||
      pending.current ||
      !reason.trim() ||
      (change.mode !== 'unassign' && !selected)
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      if (change.mode !== 'unassign') {
        const current = await getTrolleyNfcTags(controller.signal);
        const currentAssignments = current.filter(
          (tag) =>
            tag.assigned &&
            tag.asset_type === 'TROLLEY' &&
            tag.trolley_id === trolley.id,
        );
        const expected =
          change.mode === 'replace' && !previousRemoved ? change.tag.id : null;
        if (
          currentAssignments.some((tag) => tag.id !== expected) ||
          (expected && !currentAssignments.some((tag) => tag.id === expected))
        )
          throw new TagsError({
            kind: 'conflict',
            action: 'reload',
            message: t('trolleys.nfc.assignmentChanged'),
          });
        const fresh = await getTag(selected, controller.signal);
        if (fresh.assigned || fresh.status !== 'ACTIVE')
          throw new TagsError({
            kind: 'conflict',
            action: 'reload',
            message: t('trolleys.nfc.tagUnavailable'),
          });
      }
      // Remove the previous tag first so replacement never assigns two tags.
      if (change.mode !== 'assign' && !previousRemoved) {
        const fresh = await getTag(change.tag.id, controller.signal);
        if (!fresh.assigned || fresh.trolley_id !== trolley.id)
          throw new TagsError({
            kind: 'conflict',
            action: 'reload',
            message: t('trolleys.nfc.assignmentChanged'),
          });
        await unassignTrolleyNfcTag(
          change.tag.id,
          { reason: reason.trim() },
          controller.signal,
        );
        if (!controller.signal.aborted && change.mode === 'replace')
          setPreviousRemoved(true);
      }
      if (change.mode !== 'unassign') {
        await assignTrolleyNfcTag(
          selected,
          { assetType: 'TROLLEY', assetId: trolley.id, reason: reason.trim() },
          controller.signal,
        );
      }
      if (!controller.signal.aborted) reload();
    } catch (error: unknown) {
      if (!controller.signal.aborted) fail(error);
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  const assigned = tags.filter(
    (tag) =>
      tag.assigned &&
      tag.asset_type === 'TROLLEY' &&
      tag.trolley_id === trolley.id,
  );
  const available = tags.filter((tag) => !tag.assigned);
  const blocked =
    saving ||
    failure?.action === 'signIn' ||
    failure?.action === 'reload' ||
    failure?.kind === 'access';
  return (
    <Dialog
      open
      fullWidth
      maxWidth="xs"
      onClose={() => {
        if (!saving) onClose();
      }}
    >
      <DialogTitle>
        {t('trolleys.nfc.title', { code: trolley.code })}
      </DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {failure && (
            <TrolleyFailureAlert
              failure={failure}
              onReload={reload}
              onRetry={change ? undefined : reload}
            />
          )}
          {loading ? (
            <CircularProgress size={24} aria-label={t('common.loading')} />
          ) : !change ? (
            <>
              <Typography sx={{ fontWeight: 700 }}>
                {t('trolleys.nfc.assigned')}
              </Typography>
              {!assigned.length && (
                <Typography>{t('trolleys.nfc.empty')}</Typography>
              )}
              {assigned.map((tag) => (
                <Stack key={tag.id} spacing={1}>
                  <Typography>
                    {tag.name} ({tag.uid})
                  </Typography>
                  <Stack direction="row" spacing={1}>
                    <Button
                      disabled={
                        !trolley.active ||
                        !!failure ||
                        !available.length ||
                        assigned.length > 1
                      }
                      onClick={() => start({ mode: 'replace', tag })}
                    >
                      {t('trolleys.nfc.replace')}
                    </Button>
                    <Button
                      disabled={!!failure}
                      onClick={() => start({ mode: 'unassign', tag })}
                    >
                      {t('trolleys.nfc.unassign')}
                    </Button>
                  </Stack>
                </Stack>
              ))}
              {!failure && !available.length && (
                <Alert severity="info">{t('trolleys.nfc.noAvailable')}</Alert>
              )}
              {!assigned.length && (
                <Button
                  variant="contained"
                  disabled={!trolley.active || !!failure || !available.length}
                  onClick={() => start({ mode: 'assign' })}
                >
                  {t('trolleys.nfc.assign')}
                </Button>
              )}
            </>
          ) : (
            <>
              <Typography>
                {change.mode === 'assign'
                  ? t('trolleys.nfc.assign')
                  : t(`trolleys.nfc.${change.mode}Named`, {
                      name: change.tag.name,
                      uid: change.tag.uid,
                    })}
              </Typography>
              {previousRemoved && !saving && (
                <Alert severity="warning">
                  {t('trolleys.nfc.partialReplacement')}
                </Alert>
              )}
              {change.mode !== 'unassign' && (
                <TextField
                  select
                  fullWidth
                  label={t('trolleys.nfc.tag')}
                  value={selected}
                  disabled={saving || previousRemoved}
                  error={submitted && !selected}
                  helperText={
                    !available.length
                      ? t('trolleys.nfc.noAvailable')
                      : undefined
                  }
                  onChange={(e) => setSelected(e.target.value)}
                >
                  {available.map((tag) => (
                    <MenuItem key={tag.id} value={tag.id}>
                      {tag.name} ({tag.uid})
                    </MenuItem>
                  ))}
                </TextField>
              )}
              <TextField
                required
                multiline
                minRows={2}
                label={t('trolleys.nfc.reason')}
                placeholder={t('trolleys.nfc.reasonPlaceholder')}
                value={reason}
                disabled={saving || previousRemoved}
                error={submitted && !reason.trim()}
                helperText={
                  submitted && !reason.trim()
                    ? t('trolleys.nfc.reasonRequired')
                    : undefined
                }
                onChange={(e) => setReason(e.target.value)}
              />
            </>
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        {failure && change && (
          <Button disabled={saving} onClick={reload}>
            {t('trolleys.nfc.review')}
          </Button>
        )}
        <Button variant="outlined" disabled={saving} onClick={onClose}>
          {t('trolleys.close')}
        </Button>
        {change && (
          <Button
            variant="contained"
            disabled={
              blocked ||
              loading ||
              (change.mode !== 'unassign' && !available.length)
            }
            onClick={() => void save()}
          >
            {t(
              previousRemoved
                ? 'trolleys.nfc.finishReplacement'
                : 'trolleys.nfc.save',
            )}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
