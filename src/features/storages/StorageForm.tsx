import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  Box,
  Button,
  Checkbox,
  Chip,
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
  createStorageUnit,
  getStorageUnit,
  getStorageAreaOptions,
  getStorageTags,
  storageFailure,
  updateStorageUnit,
} from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';
import type {
  StorageUnitResponse,
  StorageAreaOptionResponse,
  StorageFailure,
  StorageTagOptionResponse,
} from './types';

export function StorageForm({
  storageId,
  initialAreaId,
  onClose,
  onSaved,
  onReload,
}: {
  storageId?: string;
  initialAreaId?: string;
  onClose: () => void;
  onSaved: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [source, setSource] = useState<StorageUnitResponse | null>(null);
  const [areas, setAreas] = useState<StorageAreaOptionResponse[]>([]);
  const [tags, setTags] = useState<StorageTagOptionResponse[]>([]);
  const [code, setCode] = useState('');
  const [name, setName] = useState('');
  const [areaId, setAreaId] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
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
        ? getStorageUnit(storageId, controller.signal)
        : Promise.resolve(null),
      storageId
        ? Promise.resolve([])
        : getStorageAreaOptions(controller.signal),
      storageId ? Promise.resolve([]) : getStorageTags(controller.signal),
    ]).then(
      ([record, areaOptions, tagOptions]) => {
        if (controller.signal.aborted) return;
        setSource(record);
        setAreas(areaOptions);
        setTags(tagOptions);
        setCode(record?.code ?? '');
        setName(record?.name ?? '');
        setAreaId(record?.storage_area_id ?? initialAreaId ?? '');
        setSelectedTags([]);
        setLoaded(true);
        setLoading(false);
      },
      (error) => {
        if (!controller.signal.aborted) {
          setFailure(storageFailure(error));
          setLoading(false);
        }
      },
    );
    return () => controller.abort();
  }, [storageId, initialAreaId, attempt]);
  useEffect(() => () => pending.current?.abort(), []);
  const available = tags.filter(
    (tag) => tag.status === 'ACTIVE' && !tag.assigned,
  );
  const area = areas.find((item) => item.id === areaId);
  const codeError =
    failure?.fieldErrors?.code ||
    (submitted && !code.trim()
      ? t('storages.errors.numberRequired')
      : undefined);
  const nameError =
    failure?.fieldErrors?.name ||
    (submitted && !name.trim() ? t('storages.errors.nameRequired') : undefined);
  const areaError =
    failure?.fieldErrors?.storageAreaId ||
    failure?.fieldErrors?.stationId ||
    (submitted && !storageId && !area
      ? t('storages.errors.areaRequired')
      : undefined);
  function edited() {
    setFailure(null);
  }
  async function save() {
    if (pending.current || !loaded) return;
    setSubmitted(true);
    if (!code.trim() || !name.trim() || (!storageId && !area)) return;
    const controller = new AbortController();
    pending.current = controller;
    setSaving(true);
    setFailure(null);
    try {
      const body = { code: code.trim(), name: name.trim() };
      if (storageId)
        await updateStorageUnit(storageId, body, controller.signal);
      else
        await createStorageUnit(
          areaId,
          {
            ...body,
            nfcUids: selectedTags.map(
              (id) => available.find((tag) => tag.id === id)!.uid,
            ),
          },
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
            {t(
              storageId
                ? 'storages.editDescription'
                : 'storages.formDescription',
            )}
          </Typography>
        </Box>
        <IconButton
          disabled={saving}
          onClick={onClose}
          aria-label={t('storages.close')}
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
                      setAttempt((value) => value + 1);
                    }
                  : undefined
              }
            />
          )}
          {loading && (
            <CircularProgress size={28} aria-label={t('common.loading')} />
          )}
          {loaded && (
            <>
              {!storageId && !areas.length && (
                <Alert severity="info" sx={{ mb: 2 }}>
                  {t('storages.noAreas')}
                </Alert>
              )}
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
                  value={code}
                  disabled={saving}
                  error={!!codeError}
                  helperText={codeError}
                  slotProps={{ htmlInput: { maxLength: 80 } }}
                  onChange={(event) => {
                    setCode(event.target.value);
                    edited();
                  }}
                />
                <TextField
                  required
                  label={t('storages.name')}
                  value={name}
                  disabled={saving}
                  error={!!nameError}
                  helperText={nameError}
                  slotProps={{ htmlInput: { maxLength: 150 } }}
                  onChange={(event) => {
                    setName(event.target.value);
                    edited();
                  }}
                />
                {storageId ? (
                  <TextField
                    label={t('storages.area')}
                    value={source?.storage_area_code ?? ''}
                    slotProps={{ input: { readOnly: true } }}
                  />
                ) : (
                  <TextField
                    select
                    required
                    label={t('storages.area')}
                    value={areaId}
                    disabled={saving || !areas.length}
                    error={!!areaError}
                    helperText={areaError}
                    slotProps={{
                      inputLabel: { shrink: true },
                      select: { displayEmpty: true },
                    }}
                    onChange={(event) => {
                      setAreaId(event.target.value);
                      edited();
                    }}
                  >
                    <MenuItem value="">{t('storages.selectArea')}</MenuItem>
                    {areas.map((item) => (
                      <MenuItem key={item.id} value={item.id}>
                        {item.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
                <TextField
                  label={t('storages.station')}
                  value={source?.station_code ?? area?.station_code ?? ''}
                  helperText={t('storages.stationDerived')}
                  slotProps={{ input: { readOnly: true } }}
                />
                {!storageId && (
                  <TextField
                    select
                    fullWidth
                    label={t('storages.tag')}
                    value={selectedTags}
                    disabled={saving || !available.length}
                    error={!!failure?.fieldErrors?.nfcUids}
                    helperText={
                      failure?.fieldErrors?.nfcUids ||
                      (!available.length
                        ? t('storages.noTags')
                        : t('storages.tagsOptional'))
                    }
                    sx={{ gridColumn: '1 / -1', width: '100%', maxWidth: 420 }}
                    slotProps={{
                      inputLabel: { shrink: true },
                      select: {
                        multiple: true,
                        displayEmpty: true,
                        renderValue: () =>
                          selectedTags.length ? (
                            <Box
                              sx={{
                                display: 'flex',
                                flexWrap: 'wrap',
                                gap: 0.5,
                              }}
                            >
                              {selectedTags.map((id) => (
                                <Chip
                                  key={id}
                                  size="small"
                                  label={
                                    available.find((tag) => tag.id === id)?.name
                                  }
                                />
                              ))}
                            </Box>
                          ) : (
                            t('storages.selectTag')
                          ),
                      },
                    }}
                    onChange={(event) => {
                      setSelectedTags(
                        typeof event.target.value === 'string'
                          ? event.target.value.split(',')
                          : (event.target.value as string[]),
                      );
                      edited();
                    }}
                  >
                    {available.map((tag) => (
                      <MenuItem key={tag.id} value={tag.id}>
                        <Checkbox
                          size="small"
                          checked={selectedTags.includes(tag.id)}
                        />
                        {tag.name}
                      </MenuItem>
                    ))}
                  </TextField>
                )}
              </Box>
            </>
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
              (!storageId && !areas.length) ||
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
