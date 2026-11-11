import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Typography,
} from '@mui/material';
import { signOut } from '../auth/session';
import { getTag, TagsError } from './tagsApi';
import type { TagDetailsResponse, TagsFailure } from './tagsApi';

type DetailsState =
  | { status: 'loading' }
  | { status: 'ready'; tag: TagDetailsResponse }
  | { status: 'error'; failure: TagsFailure };

export function TagDetailsDialog({
  tagId,
  onClose,
  onReload,
}: {
  tagId: string;
  onClose: () => void;
  onReload: () => void;
}) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<DetailsState>({ status: 'loading' });
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

  const tag = state.status === 'ready' ? state.tag : null;
  const assetType = (
    [
      'PROCESS',
      'MACHINE',
      'STATION',
      'TROLLEY',
      'STORAGE_AREA',
      'STORAGE_UNIT',
    ] as const
  ).find((type) => type === tag?.asset_type);
  const fields: [string, string | number][] = tag
    ? [
        [t('tags.name'), tag.name],
        [t('tags.status'), t(`tags.statusValues.${tag.status}`)],
        [t('tags.assigned'), t(tag.assigned ? 'tags.yes' : 'tags.no')],
        [
          t('tags.details.assetType'),
          assetType
            ? t(`tags.assetTypes.${assetType}`)
            : tag.asset_type || t('tags.details.none'),
        ],
      ]
    : [];

  return (
    <Dialog
      open
      onClose={onClose}
      aria-labelledby="tag-details-title"
      maxWidth="sm"
      fullWidth
    >
      <DialogTitle id="tag-details-title">
        {t('tags.details.title')}
      </DialogTitle>
      <DialogContent aria-busy={state.status === 'loading'}>
        {state.status === 'loading' && (
          <Stack
            role="status"
            aria-label={t('tags.details.loading')}
            direction="row"
            spacing={2}
            sx={{ alignItems: 'center', py: 2 }}
          >
            <CircularProgress size={28} />
            <Typography>{t('tags.details.loading')}</Typography>
          </Stack>
        )}
        {state.status === 'error' && (
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
              <Typography variant="caption" sx={{ mt: 0.5, display: 'block' }}>
                {t('tags.failureStatus', { status: state.failure.status })}
              </Typography>
            )}
          </Alert>
        )}
        {tag && (
          <Box
            component="dl"
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', sm: '170px minmax(0, 1fr)' },
              gap: 1.5,
              m: 0,
            }}
          >
            {fields.map(([label, value]) => (
              <Box key={label} sx={{ display: 'contents' }}>
                <Typography
                  component="dt"
                  color="text.secondary"
                  sx={{ fontSize: 13, fontWeight: 700 }}
                >
                  {label}
                </Typography>
                <Typography
                  component="dd"
                  sx={{ m: 0, overflowWrap: 'anywhere', fontSize: 13 }}
                >
                  {value}
                </Typography>
              </Box>
            ))}
          </Box>
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          {t('tags.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
