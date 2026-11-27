import { useEffect, useRef, useState } from 'react';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import {
  createStorageArea,
  getStorageTags,
  getStorageStations,
  storageFailure,
} from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';
import type {
  StorageAreaResponse,
  StorageFailure,
  StorageTagOptionResponse,
  StorageStationOption,
} from './types';

export function StorageAreaForm({
  onClose,
  onSaved,
  onReload,
}: {
  onClose: () => void;
  onSaved: (area: StorageAreaResponse) => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [stationId, setStationId] = useState('');
  const [stations, setStations] = useState<StorageStationOption[]>([]);
  const [storageNumber, setStorageNumber] = useState('');
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [tagId, setTagId] = useState('');
  const [tags, setTags] = useState<StorageTagOptionResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<StorageFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  const container = useRef<HTMLElement | null>(null);
  useEffect(() => {
    container.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    const controller = new AbortController();
    void Promise.all([
      getStorageTags(controller.signal),
      getStorageStations(controller.signal),
    ]).then(
      ([items, stationOptions]) => {
        if (controller.signal.aborted) return;
        setTags(
          items.filter((tag) => tag.status === 'ACTIVE' && !tag.assigned),
        );
        setStations(stationOptions);
        setLoaded(true);
        setLoading(false);
      },
      (error: unknown) => {
        if (!controller.signal.aborted) {
          setFailure(storageFailure(error));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [attempt]);
  useEffect(() => () => pending.current?.abort(), []);
  const required = (value: string) =>
    submitted && !value.trim() ? t('storages.areas.required') : undefined;
  const tagError =
    failure?.fieldErrors?.tagId ||
    failure?.fieldErrors?.nfcUid ||
    failure?.fieldErrors?.nfcUids ||
    required(tagId);
  async function save() {
    if (pending.current || !loaded) return;
    setSubmitted(true);
    if (
      !stations.some((station) => station.id === stationId) ||
      !storageNumber.trim() ||
      !tags.some((tag) => tag.id === tagId)
    )
      return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      const area = await createStorageArea(
        {
          stationId,
          storageNumber: storageNumber.trim(),
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          tagId,
        },
        controller.signal,
      );
      if (!controller.signal.aborted) onSaved(area);
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(storageFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  const disabled =
    loading ||
    saving ||
    !loaded ||
    failure?.action === 'signIn' ||
    failure?.action === 'reload' ||
    failure?.kind === 'access';
  return (
    <Paper
      component="section"
      ref={container}
      variant="outlined"
      aria-labelledby="area-form-heading"
      sx={{ p: 3, borderRadius: 2, scrollMarginTop: '84px' }}
    >
      <Typography component="h2" id="area-form-heading" variant="h6">
        {t('storages.areas.add')}
      </Typography>
      <Typography color="text.secondary" sx={{ mb: 2 }}>
        {t('storages.areas.description')}
      </Typography>
      {failure && (
        <StorageFailureAlert
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
        <CircularProgress size={24} aria-label={t('common.loading')} />
      )}
      {!loading && loaded && !tags.length && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('storages.areas.noTags')}
        </Alert>
      )}
      {!loading && loaded && !stations.length && (
        <Alert severity="info" sx={{ mb: 2 }}>
          {t('storages.areas.noStations')}
        </Alert>
      )}
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Stack spacing={2}>
          <TextField
            select
            required
            label={t('storages.station')}
            value={stationId}
            disabled={disabled || !stations.length}
            onChange={(event) => {
              setStationId(event.target.value);
              setFailure(null);
            }}
            error={
              !!(
                failure?.fieldErrors?.stationNumber ||
                failure?.fieldErrors?.stationId ||
                required(stationId)
              )
            }
            helperText={
              failure?.fieldErrors?.stationNumber ||
              failure?.fieldErrors?.stationId ||
              required(stationId)
            }
          >
            {stations.map((station) => (
              <MenuItem key={station.id} value={station.id}>
                {station.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            required
            label={t('storages.areas.number')}
            value={storageNumber}
            disabled={disabled}
            slotProps={{ htmlInput: { maxLength: 80 } }}
            onChange={(event) => {
              setStorageNumber(event.target.value);
              setFailure(null);
            }}
            error={
              !!(failure?.fieldErrors?.storageNumber || required(storageNumber))
            }
            helperText={
              failure?.fieldErrors?.storageNumber || required(storageNumber)
            }
          />
          <TextField
            label={t('storages.areas.name')}
            value={name}
            disabled={disabled}
            onChange={(event) => {
              setName(event.target.value);
              setFailure(null);
            }}
            error={!!failure?.fieldErrors?.name}
            helperText={failure?.fieldErrors?.name}
          />
          <TextField
            label={t('storages.areas.notes')}
            value={description}
            multiline
            minRows={2}
            disabled={disabled}
            onChange={(event) => {
              setDescription(event.target.value);
              setFailure(null);
            }}
            error={!!failure?.fieldErrors?.description}
            helperText={failure?.fieldErrors?.description}
          />
          <TextField
            select
            required
            label={t('storages.areas.tag')}
            sx={{ width: '100%', maxWidth: 420, alignSelf: 'flex-start' }}
            value={tagId}
            disabled={disabled || !tags.length}
            onChange={(event) => {
              setTagId(event.target.value);
              setFailure(null);
            }}
            error={!!tagError}
            helperText={tagError || t('storages.areas.tagRequired')}
          >
            {tags.map((tag) => (
              <MenuItem key={tag.id} value={tag.id}>
                {tag.name}
              </MenuItem>
            ))}
          </TextField>
          <Stack direction="row" spacing={1}>
            <Button
              type="submit"
              variant="contained"
              disabled={disabled || !tags.length || !stations.length}
            >
              {t(saving ? 'storages.saving' : 'storages.areas.save')}
            </Button>
            <Button disabled={saving} onClick={onClose}>
              {t('storages.cancel')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </Paper>
  );
}
