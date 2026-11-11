import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import {
  createStorageArea,
  getStorageArea,
  getStorageTags,
  storageFailure,
  updateStorageArea,
} from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';
import type {
  StorageAreaResponse,
  StorageFailure,
  StorageTagOptionResponse,
} from './types';

export function StorageForm({
  storageId,
  onClose,
  onSaved,
  onReload,
}: {
  storageId?: string;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [source, setSource] = useState<StorageAreaResponse | null>(null);
  const [tags, setTags] = useState<StorageTagOptionResponse[]>([]);
  const [number, setNumber] = useState('');
  const [station, setStation] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [failure, setFailure] = useState<StorageFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const pending = useRef<AbortController | null>(null);
  const container = useRef<HTMLElement | null>(null);
  useEffect(() => {
    container.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
    const controller = new AbortController();
    void Promise.all([
      storageId
        ? getStorageArea(storageId, controller.signal)
        : Promise.resolve(null),
      getStorageTags(controller.signal),
    ]).then(
      ([record, options]) => {
        if (controller.signal.aborted) return;
        setSource(record);
        setTags(options);
        setNumber(record?.storageNumber || '');
        setStation(record?.stationNumber || '');
        setDescription(record?.description || '');
        setSelected(
          record?.nfcUid
            ? options.find(
                (tag) => tag.uid.toUpperCase() === record.nfcUid!.toUpperCase(),
              )?.id || 'current'
            : '',
        );
        setLoading(false);
        setLoaded(true);
      },
      (error) => {
        if (!controller.signal.aborted) {
          setFailure(storageFailure(error));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [storageId, attempt]);
  useEffect(() => () => pending.current?.abort(), []);
  const available = tags.filter(
    (tag) =>
      tag.status === 'ACTIVE' &&
      (!tag.assigned ||
        tag.uid.toUpperCase() === source?.nfcUid?.toUpperCase()),
  );
  const numberError =
    failure?.fieldErrors?.storageNumber ||
    (submitted && !number.trim()
      ? t('storages.errors.numberRequired')
      : undefined);
  const stationError =
    failure?.fieldErrors?.stationNumber ||
    failure?.fieldErrors?.stationId ||
    (submitted && !station.trim()
      ? t('storages.errors.stationRequired')
      : undefined);
  const tagError =
    failure?.fieldErrors?.tagId ||
    failure?.fieldErrors?.nfcUid ||
    failure?.fieldErrors?.nfcUids ||
    (submitted && !selected ? t('storages.errors.tagRequired') : undefined);
  function edited() {
    setFailure(null);
  }
  async function save() {
    if (pending.current || !loaded) return;
    setSubmitted(true);
    if (!number.trim() || !station.trim() || !selected) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    const body = {
      storageNumber: number.trim(),
      stationNumber: station.trim(),
      description: description.trim(),
      ...(source ? { name: source.name } : {}),
      ...(selected === 'current' && source?.nfcUid
        ? { nfcUid: source.nfcUid }
        : { tagId: selected }),
    };
    try {
      if (storageId)
        await updateStorageArea(storageId, body, controller.signal);
      else await createStorageArea(body, controller.signal);
      if (!controller.signal.aborted) onSaved();
    } catch (error: unknown) {
      if (!controller.signal.aborted) setFailure(storageFailure(error));
    } finally {
      pending.current = null;
      if (!controller.signal.aborted) setSaving(false);
    }
  }
  return (
    <Paper
      component="section"
      ref={container}
      variant="outlined"
      aria-labelledby="storage-form-heading"
      sx={{ borderRadius: 2, overflow: 'hidden', scrollMarginTop: '84px' }}
    >
      <Stack
        direction="row"
        sx={{
          justifyContent: 'space-between',
          alignItems: 'center',
          px: 3,
          py: 2.5,
          borderBottom: 1,
          borderColor: 'divider',
        }}
      >
        <Box>
          <Typography
            component="h2"
            id="storage-form-heading"
            sx={{ fontSize: 17, fontWeight: 600 }}
          >
            {t(storageId ? 'storages.edit' : 'storages.add')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('storages.formDescription')}
          </Typography>
        </Box>
        <IconButton
          size="small"
          disabled={saving}
          aria-label={t('storages.close')}
          onClick={onClose}
        >
          <CloseIcon fontSize="small" />
        </IconButton>
      </Stack>
      <Box
        component="form"
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {failure && (
            <StorageFailureAlert
              failure={failure}
              onReload={onReload}
              onRetry={
                !loaded
                  ? () => {
                      setFailure(null);
                      setLoading(true);
                      setAttempt((v) => v + 1);
                    }
                  : undefined
              }
            />
          )}
          {loading && (
            <CircularProgress size={28} aria-label={t('common.loading')} />
          )}
          {loaded && (
            <Box
              sx={{
                display: 'grid',
                gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
                gap: 2.5,
              }}
            >
              <TextField
                required
                autoFocus
                label={t('storages.number')}
                placeholder={t('storages.numberPlaceholder')}
                value={number}
                disabled={saving}
                error={!!numberError}
                helperText={numberError}
                slotProps={{ htmlInput: { maxLength: 80 } }}
                onChange={(e) => {
                  setNumber(e.target.value);
                  edited();
                }}
              />
              <TextField
                required
                label={t('storages.station')}
                placeholder={t('storages.stationPlaceholder')}
                value={station}
                disabled={saving}
                error={!!stationError}
                helperText={stationError}
                slotProps={{ htmlInput: { maxLength: 50 } }}
                onChange={(e) => {
                  setStation(e.target.value);
                  edited();
                }}
              />
              <TextField
                required
                select
                label={t('storages.tag')}
                value={selected}
                disabled={saving}
                error={!!tagError}
                helperText={tagError}
                slotProps={{
                  inputLabel: { shrink: true },
                  select: { displayEmpty: true },
                }}
                onChange={(e) => {
                  setSelected(e.target.value);
                  edited();
                }}
              >
                <MenuItem value="">{t('storages.selectTag')}</MenuItem>
                {selected === 'current' && (
                  <MenuItem value="current">
                    {t('storages.currentTag')}
                  </MenuItem>
                )}
                {available.map((tag) => (
                  <MenuItem key={tag.id} value={tag.id}>
                    {tag.name}
                  </MenuItem>
                ))}
              </TextField>
              {!available.length && selected !== 'current' && (
                <Alert severity="info">{t('storages.noTags')}</Alert>
              )}
              <TextField
                label={t('storages.description')}
                placeholder={t('storages.descriptionPlaceholder')}
                multiline
                minRows={3}
                value={description}
                disabled={saving}
                error={!!failure?.fieldErrors?.description}
                helperText={failure?.fieldErrors?.description}
                onChange={(e) => {
                  setDescription(e.target.value);
                  edited();
                }}
                sx={{ gridColumn: '1 / -1' }}
              />
            </Box>
          )}
        </Box>
        <Stack
          direction="row"
          sx={{
            justifyContent: 'flex-end',
            gap: 1.5,
            px: 3,
            py: 2,
            borderTop: 1,
            borderColor: 'divider',
          }}
        >
          <Button variant="outlined" disabled={saving} onClick={onClose}>
            {t('storages.cancel')}
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={
              loading ||
              !loaded ||
              saving ||
              (!available.length && selected !== 'current') ||
              failure?.action === 'signIn' ||
              failure?.action === 'reload' ||
              failure?.kind === 'access'
            }
          >
            {t(saving ? 'storages.saving' : 'storages.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
