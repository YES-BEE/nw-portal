import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { signOut } from '../auth/session';
import type { StylesFailure } from './types';
export function StyleFailureAlert({
  failure,
  onReload,
  onRetry,
}: {
  failure: StylesFailure;
  onReload: () => void;
  onRetry?: () => void;
}) {
  const { t } = useTranslation('translation');
  return (
    <Alert
      severity="error"
      sx={{ mb: 2 }}
      action={
        failure.action === 'signIn' ? (
          <Button color="inherit" onClick={signOut}>
            {t('startup.signIn')}
          </Button>
        ) : failure.action === 'reload' ? (
          <Button color="inherit" onClick={onReload}>
            {t('styles.reload')}
          </Button>
        ) : failure.action === 'retry' && onRetry ? (
          <Button color="inherit" onClick={onRetry}>
            {t('startup.retry')}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{t('styles.failureTitle')}</AlertTitle>
      {failure.message || t(`styles.failures.${failure.kind}`)}
      {!failure.message && failure.status !== undefined && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {t('styles.failureStatus', { status: failure.status })}
        </Typography>
      )}
    </Alert>
  );
}
