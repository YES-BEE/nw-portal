import { Alert, AlertTitle, Button, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { signOut } from '../auth/session';
import type { DashboardFailure } from './types';
export function DashboardFailureAlert({
  failure,
  onRetry,
}: {
  failure: DashboardFailure;
  onRetry: () => void;
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
        ) : failure.action === 'retry' ? (
          <Button color="inherit" onClick={onRetry}>
            {t('startup.retry')}
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{t('dashboard.failureTitle')}</AlertTitle>
      {failure.message || t(`dashboard.failures.${failure.kind}`)}
      {!failure.message && failure.status !== undefined && (
        <Typography variant="caption" sx={{ display: 'block' }}>
          {t('dashboard.failureStatus', { status: failure.status })}
        </Typography>
      )}
    </Alert>
  );
}
