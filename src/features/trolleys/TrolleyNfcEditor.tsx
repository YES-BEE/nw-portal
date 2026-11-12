import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Button,
  CircularProgress,
  Paper,
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

export type TrolleyNfcChange =
  { mode: 'assign' } | { mode: 'replace' | 'unassign'; tagId: string };
export function TrolleyNfcEditor({
  trolley,
  change,
  onClose,
  onSaved,
}: {
  trolley: TrolleyResponse;
  change: TrolleyNfcChange;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { t } = useTranslation('translation');
  const [tags, setTags] = useState<TagDetailsResponse[]>([]);
  const [loading, setLoading] = useState(change.mode !== 'unassign');
  const [attempt, setAttempt] = useState(0);
  const [failure, setFailure] = useState<TrolleysFailure | null>(null);
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
    if (change.mode === 'unassign') return;
    const controller = new AbortController();
    void getTrolleyNfcTags(controller.signal, false).then(
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
  }, [attempt, change.mode]);
  useEffect(() => () => pending.current?.abort(), []);
  function retry() {
    setFailure(null);
    setLoading(true);
    setAttempt((v) => v + 1);
  }
  async function save() {
    setSubmitted(true);
    if (
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
        const current = await getTrolleyNfcTags(controller.signal, true);
        const currentAssignments = current.filter(
          (tag) =>
            tag.assigned &&
            tag.asset_type === 'TROLLEY' &&
            tag.trolley_id === trolley.id,
        );
        const expected =
          change.mode === 'replace' && !previousRemoved ? change.tagId : null;
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
        const fresh = await getTag(change.tagId, controller.signal);
        if (!fresh.assigned || fresh.trolley_id !== trolley.id)
          throw new TagsError({
            kind: 'conflict',
            action: 'reload',
            message: t('trolleys.nfc.assignmentChanged'),
          });
        await unassignTrolleyNfcTag(
          change.tagId,
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
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (!controller.signal.aborted) fail(error);
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  const available = tags.filter((tag) => !tag.assigned);
  const blocked =
    saving ||
    failure?.action === 'signIn' ||
    failure?.action === 'reload' ||
    failure?.kind === 'access';
  return (
    <Paper
      component="form"
      noValidate
      variant="outlined"
      sx={{ p: 2, maxWidth: 520 }}
      onSubmit={(event) => {
        event.preventDefault();
        void save();
      }}
    >
      <Stack spacing={2}>
        <Typography sx={{ fontWeight: 700 }}>
          {t(`trolleys.nfc.${change.mode}`)} - {trolley.code}
        </Typography>
        {failure && (
          <TrolleyFailureAlert
            failure={failure}
            onReload={onSaved}
            onRetry={
              change.mode !== 'unassign' &&
              !loading &&
              !tags.length &&
              !selected
                ? retry
                : undefined
            }
          />
        )}
        {loading && (
          <CircularProgress size={24} aria-label={t('common.loading')} />
        )}
        {!loading && (
          <>
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
                slotProps={{
                  inputLabel: { shrink: true },
                  select: {
                    displayEmpty: true,
                    renderValue: (value) =>
                      value ? (
                        available.find((tag) => tag.id === value)?.name
                      ) : (
                        <Typography
                          component="span"
                          color="text.secondary"
                          sx={{ fontSize: 'inherit' }}
                        >
                          {t('trolleys.nfc.tagPlaceholder')}
                        </Typography>
                      ),
                  },
                }}
                disabled={saving || previousRemoved || !available.length}
                error={submitted && !selected && available.length > 0}
                helperText={
                  !available.length ? t('trolleys.nfc.noAvailable') : undefined
                }
                onChange={(e) => setSelected(e.target.value)}
              >
                {available.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
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
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end' }}>
          {failure && (
            <Button disabled={saving} onClick={onSaved}>
              {t('trolleys.nfc.review')}
            </Button>
          )}
          <Button variant="outlined" disabled={saving} onClick={onClose}>
            {t('access.cancel')}
          </Button>
          <Button
            variant="contained"
            disabled={
              blocked ||
              loading ||
              (change.mode !== 'unassign' && !available.length)
            }
            type="submit"
          >
            {t(
              previousRemoved
                ? 'trolleys.nfc.finishReplacement'
                : 'trolleys.nfc.save',
            )}
          </Button>
        </Stack>
      </Stack>
    </Paper>
  );
}
