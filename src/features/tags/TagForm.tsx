import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
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
import { signOut } from '../auth/session';
import { TagsError } from './tagsApi';
import type {
  CreateTagField,
  CreateTagRequest,
  TagDetailsResponse,
  TagsFailure,
  UpdateTagRequest,
} from './tagsApi';

type TagFormProps = { onClose: () => void; onReload?: () => void } & (
  | {
      initial?: never;
      onCreate: (body: CreateTagRequest, signal: AbortSignal) => Promise<void>;
      onUpdate?: never;
    }
  | {
      initial: TagDetailsResponse;
      onUpdate: (body: UpdateTagRequest, signal: AbortSignal) => Promise<void>;
      onCreate?: never;
    }
);

export function TagForm({
  onCreate,
  onClose,
  initial,
  onUpdate,
  onReload,
}: TagFormProps) {
  const { t } = useTranslation('translation');
  const [draft, setDraft] = useState<CreateTagRequest>({
    name: initial?.name ?? '',
    uid: initial?.uid ?? '',
  });
  const [submitted, setSubmitted] = useState(false);
  const [saving, setSaving] = useState(false);
  const [failure, setFailure] = useState<TagsFailure | null>(null);
  const pending = useRef<AbortController | null>(null);
  const container = useRef<HTMLElement>(null);
  useEffect(() => {
    container.current?.scrollIntoView?.({
      behavior: 'instant',
      block: 'start',
    });
    return () => pending.current?.abort();
  }, []);
  function fieldError(field: CreateTagField) {
    return (
      failure?.fieldErrors?.[field] ||
      (submitted && !draft[field].trim()
        ? t(
            field === 'name'
              ? 'tags.errors.nameRequired'
              : 'tags.errors.actualRequired',
          )
        : undefined)
    );
  }
  function update(field: CreateTagField, value: string) {
    setDraft((current) => ({ ...current, [field]: value }));
    setFailure((current) =>
      current
        ? {
            ...current,
            fieldErrors: { ...current.fieldErrors, [field]: undefined },
          }
        : null,
    );
  }
  return (
    <Paper
      component="section"
      ref={container}
      variant="outlined"
      aria-labelledby="tag-form-heading"
      sx={{ borderRadius: 2, overflow: 'hidden', scrollMarginTop: 84 }}
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
            {t(initial ? 'tags.edit' : 'tags.add')}
          </Typography>
          <Typography color="text.secondary" sx={{ fontSize: 13, mt: 0.5 }}>
            {t('tags.formDescription')}
          </Typography>
        </Box>
        <Tooltip title={t('tags.close')}>
          <Box component="span">
            <IconButton
              size="small"
              disabled={saving}
              aria-label={t('tags.close')}
              onClick={onClose}
            >
              <CloseIcon />
            </IconButton>
          </Box>
        </Tooltip>
      </Stack>
      <Box
        component="form"
        noValidate
        aria-busy={saving}
        onSubmit={async (event) => {
          event.preventDefault();
          if (pending.current) return;
          setSubmitted(true);
          if (!draft.name.trim() || !draft.uid.trim()) return;
          const controller = new AbortController();
          pending.current = controller;
          setSaving(true);
          setFailure(null);
          try {
            await (onUpdate ?? onCreate)(
              { name: draft.name.trim(), uid: draft.uid.trim() },
              controller.signal,
            );
          } catch (error: unknown) {
            if (!controller.signal.aborted)
              setFailure(
                error instanceof TagsError
                  ? error.failure
                  : { kind: 'network', action: 'retry' },
              );
          } finally {
            if (!controller.signal.aborted) {
              pending.current = null;
              setSaving(false);
            }
          }
        }}
      >
        <Box sx={{ p: { xs: 2, sm: 3 } }}>
          {failure && (
            <Alert
              severity="error"
              sx={{ mb: 2 }}
              action={
                failure.action === 'signIn' ? (
                  <Button color="inherit" onClick={signOut}>
                    {t('startup.signIn')}
                  </Button>
                ) : failure.action === 'reload' && onReload ? (
                  <Button color="inherit" onClick={onReload}>
                    {t('tags.details.reload')}
                  </Button>
                ) : undefined
              }
            >
              <AlertTitle>
                {t(initial ? 'tags.updateFailure' : 'tags.createFailure')}
              </AlertTitle>
              {failure.message ||
                t(`tags.failures.${failure.kind}.description`)}
              {!failure.message && failure.status !== undefined && (
                <Typography
                  variant="caption"
                  sx={{ display: 'block', mt: 0.5 }}
                >
                  {t('tags.failureStatus', { status: failure.status })}
                </Typography>
              )}
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
              label={t('tags.name')}
              value={draft.name}
              onChange={(event) => update('name', event.target.value)}
              error={Boolean(fieldError('name'))}
              helperText={fieldError('name')}
              disabled={saving}
              placeholder={t('tags.namePlaceholder')}
              autoFocus
              required
              slotProps={{ htmlInput: { maxLength: 150 } }}
            />
            <TextField
              label={t('tags.actual')}
              value={draft.uid}
              onChange={(event) => update('uid', event.target.value)}
              error={Boolean(fieldError('uid'))}
              helperText={fieldError('uid')}
              disabled={saving}
              placeholder={t('tags.actualPlaceholder')}
              required
              slotProps={{ htmlInput: { maxLength: 128 } }}
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
          <Button variant="outlined" disabled={saving} onClick={onClose}>
            {t('tags.cancel')}
          </Button>
          <Button
            variant="contained"
            type="submit"
            disabled={
              saving ||
              failure?.action === 'reload' ||
              failure?.action === 'signIn' ||
              failure?.kind === 'access' ||
              failure?.kind === 'representation'
            }
          >
            {t(saving ? 'tags.saving' : 'tags.save')}
          </Button>
        </Stack>
      </Box>
    </Paper>
  );
}
