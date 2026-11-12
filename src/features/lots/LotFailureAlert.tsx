import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { signOut } from '../auth/session';
import type { LotsFailure } from './types';
export function LotFailureAlert({
  failure,
  onReload,
  onRetry,
}: {
  failure: LotsFailure;
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
            {t('lots.reload')}
          </Button>
        ) : failure.action === 'retry' && onRetry ? (
          <Button color="inherit" onClick={onRetry}>
            {t('startup.retry')}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{t('lots.failureTitle')}</AlertTitle>
      {failure.message || t(`lots.failures.${failure.kind}`)}
      {!failure.message && failure.status !== undefined && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {t('lots.failureStatus', { status: failure.status })}
        </Typography>
      )}
    </Alert>
  );
}
