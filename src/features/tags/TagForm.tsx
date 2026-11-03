import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  IconButton,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import { loadTags } from '../configurations/tagRegistry';
import type { RegisteredTag } from '../configurations/tagRegistry';
import { loadTagAssignments, normalizeTag, getTagFieldErrors } from './tagData';

export function TagForm({
  initial,
  editing,
  onSave,
  onClose,
}: {
  initial: RegisteredTag;
  editing: boolean;
  onSave: (tag: RegisteredTag) => void;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const container = useRef<HTMLElement>(null);
  const status = loadTagAssignments();
  const fieldErrors = submitted
    ? getTagFieldErrors(
        normalizeTag(draft),
        loadTags().records,
        new Set(status.assignments.keys()),
        status.unavailable,
      )
    : {};
  const locked =
    editing &&
    (status.unavailable ||
      status.assignments.has(initial.actual.toUpperCase()));

  useEffect(() => {
    container.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalized = normalizeTag(draft);
    const latest = loadTagAssignments();
    const issues = getTagFieldErrors(
      normalized,
      loadTags().records,
      new Set(latest.assignments.keys()),
      latest.unavailable,
    );
    setSubmitted(true);
    if (Object.keys(issues).length === 0) onSave(normalized);
  }

  return (
    <Paper
      component="section"
      ref={container}
      variant="outlined"
      aria-labelledby="tag-form-heading"
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
            id="tag-form-heading"
            sx={{ fontSize: 17, fontWeight: 600 }}
          >
            {t(editing ? 'tags.edit' : 'tags.add')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('tags.formDescription')}
          </Typography>
        </Box>
        <Tooltip title={t('tags.close')}>
          <IconButton
            size="small"
            aria-label={t('tags.close')}
            onClick={onClose}
          >
            <CloseIcon />
          </IconButton>
        </Tooltip>
      </Stack>
      <Box component="form" noValidate onSubmit={submit}>
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 2.5,
            }}
          >
            <TextField
              label={t('tags.name')}
              error={Boolean(fieldErrors.name)}
              helperText={
                fieldErrors.name
                  ? t(`tags.errors.${fieldErrors.name}`)
                  : undefined
              }
              value={draft.name}
              onChange={(event) =>
                setDraft({ ...draft, name: event.target.value })
              }
              placeholder={t('tags.namePlaceholder')}
              autoFocus
              required
              slotProps={{ htmlInput: { maxLength: 80 } }}
            />
            <TextField
              label={t('tags.actual')}
              error={Boolean(fieldErrors.actual)}
              value={draft.actual}
              onChange={(event) =>
                setDraft({ ...draft, actual: event.target.value })
              }
              placeholder={t('tags.actualPlaceholder')}
              required
              slotProps={{
                htmlInput: { maxLength: 120 },
                input: { readOnly: locked },
              }}
              helperText={
                fieldErrors.actual
                  ? t(`tags.errors.${fieldErrors.actual}`)
                  : locked
                    ? t(
                        status.unavailable
                          ? 'tags.assignmentsUnavailable'
                          : 'tags.lockedHint',
                      )
                    : undefined
              }
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
            {t('tags.cancel')}
          </Button>
          <Button variant="contained" type="submit">
            {t('tags.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
