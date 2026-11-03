import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  IconButton,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { loadTags } from '../configurations/tagRegistry';
import { loadProcesses } from '../processes/processData';
import {
  normalizeStorage,
  processTags,
  getStorageFieldErrors,
} from './storageData';
import type { StorageConfiguration } from './types';

interface StorageFormProps {
  initial: StorageConfiguration;
  editing: boolean;
  records: StorageConfiguration[];
  onSave: (record: StorageConfiguration) => void;
  onClose: () => void;
}

export function StorageForm({
  initial,
  editing,
  records,
  onSave,
  onClose,
}: StorageFormProps) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const fieldErrors = submitted
    ? getStorageFieldErrors(
        normalizeStorage(draft),
        records,
        loadProcesses().records,
      )
    : {};
  const container = useRef<HTMLElement>(null);
  const unavailable = new Set(
    [
      ...records
        .filter((record) => record.id !== draft.id)
        .map((record) => record.tag),
      ...processTags(loadProcesses().records),
    ].map((tag) => tag.toUpperCase()),
  );

  useEffect(() => {
    container.current?.scrollIntoView?.({ block: 'start', behavior: 'smooth' });
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeStorage(draft);
    const issues = getStorageFieldErrors(
      normalized,
      records,
      loadProcesses().records,
    );
    setSubmitted(true);
    if (Object.keys(issues).length === 0) onSave(normalized);
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
          gap: 2,
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
            {t(editing ? 'storages.edit' : 'storages.add')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('storages.formDescription')}
          </Typography>
        </Box>
        <Tooltip title={t('storages.close')}>
          <IconButton
            size="small"
            aria-label={t('storages.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box component="form" onSubmit={submit} noValidate>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            <TextField
              label={t('storages.number')}
              error={Boolean(fieldErrors.number)}
              helperText={
                fieldErrors.number
                  ? t(`storages.errors.${fieldErrors.number}`)
                  : undefined
              }
              value={draft.number}
              onChange={(event) =>
                setDraft({ ...draft, number: event.target.value })
              }
              placeholder={t('storages.numberPlaceholder')}
              required
              autoFocus
              slotProps={{ htmlInput: { maxLength: 40 } }}
            />
            <TextField
              select
              label={t('storages.tag')}
              error={Boolean(fieldErrors.tag)}
              helperText={
                fieldErrors.tag
                  ? t(`storages.errors.${fieldErrors.tag}`)
                  : undefined
              }
              value={draft.tag}
              onChange={(event) =>
                setDraft({ ...draft, tag: event.target.value })
              }
              required
              sx={{
                width: { xs: '100%', sm: 320 },
                maxWidth: '100%',
                justifySelf: 'start',
              }}
            >
              <MenuItem value="">{t('storages.selectTag')}</MenuItem>
              {loadTags().records.map((tag) => (
                <MenuItem
                  key={tag.actual}
                  value={tag.actual}
                  disabled={unavailable.has(tag.actual.toUpperCase())}
                >
                  {t('storages.tagOption', { name: tag.name, id: tag.actual })}
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label={t('storages.description')}
              value={draft.description}
              onChange={(event) =>
                setDraft({ ...draft, description: event.target.value })
              }
              placeholder={t('storages.descriptionPlaceholder')}
              multiline
              minRows={3}
              sx={{ gridColumn: '1 / -1' }}
            />
          </Box>
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
          <Button variant="outlined" onClick={onClose}>
            {t('storages.cancel')}
          </Button>
          <Button variant="contained" type="submit">
            {t('storages.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
