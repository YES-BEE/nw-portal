import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { getTag, updateTag, TagsError } from './tagsApi';
import type { TagDetailsResponse, TagsFailure } from './tagsApi';
import { TagForm } from './TagForm';

type EditorState =
  | { status: 'loading' }
  | { status: 'ready'; tag: TagDetailsResponse }
  | { status: 'error'; failure: TagsFailure };

export function TagEditor({
  tagId,
  onClose,
  onReload,
  onUpdated,
}: {
  tagId: string;
  onClose: () => void;
  onReload: () => void;
  onUpdated: () => void;
}) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<EditorState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getTag(tagId, controller.signal).then(
      (tag) => {
        if (!controller.signal.aborted) setState({ status: 'ready', tag });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof TagsError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [tagId, attempt]);
  if (state.status === 'ready')
    return (
      <TagForm
        initial={state.tag}
        onClose={onClose}
        onReload={onReload}
        onUpdate={async (body, signal) => {
          await updateTag(tagId, body, signal);
          if (!signal.aborted) onUpdated();
        }}
      />
    );
  return (
    <Paper
      component="section"
      variant="outlined"
      aria-labelledby="tag-editor-title"
      sx={{ p: 3, borderRadius: 2 }}
    >
      <Typography
        component="h2"
        id="tag-editor-title"
        variant="h6"
        sx={{ mb: 2 }}
      >
        {t('tags.edit')}
      </Typography>
      {state.status === 'loading' ? (
        <Stack
          role="status"
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center' }}
        >
          <CircularProgress size={28} />
          <Typography>{t('tags.details.loading')}</Typography>
        </Stack>
      ) : (
        <Alert
          severity="error"
          action={
            state.failure.action === 'signIn' ? (
              <Button color="inherit" onClick={signOut}>
                {t('startup.signIn')}
              </Button>
            ) : state.failure.action === 'reload' ? (
              <Button color="inherit" onClick={onReload}>
                {t('tags.details.reload')}
              </Button>
            ) : state.failure.action === 'retry' ? (
              <Button
                color="inherit"
                onClick={() => {
                  setState({ status: 'loading' });
                  setAttempt((value) => value + 1);
                }}
              >
                {t('startup.retry')}
              </Button>
            ) : undefined
          }
        >
          <AlertTitle>{t('tags.details.failure')}</AlertTitle>
          {state.failure.message ||
            t(`tags.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {t('tags.failureStatus', { status: state.failure.status })}
            </Typography>
          )}
        </Alert>
      )}
      <Stack direction="row" sx={{ justifyContent: 'flex-end', mt: 2 }}>
        <Button onClick={onClose}>{t('tags.cancel')}</Button>
      </Stack>
    </Paper>
  );
}
