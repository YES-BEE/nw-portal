import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { signOut } from '../auth/session';
import type { TrolleysFailure } from './types';

export function TrolleyFailureAlert({
  failure,
  onRetry,
  onReload,
}: {
  failure: TrolleysFailure;
  onRetry?: () => void;
  onReload: () => void;
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
            {t('trolleys.reload')}
          </Button>
        ) : failure.action === 'retry' && onRetry ? (
          <Button color="inherit" onClick={onRetry}>
            {t('startup.retry')}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{t('trolleys.failureTitle')}</AlertTitle>
      {failure.message || t(`trolleys.failures.${failure.kind}`)}
      {!failure.message && failure.status !== undefined && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {t('trolleys.failureStatus', { status: failure.status })}
        </Typography>
      )}
    </Alert>
  );
}
