import { Alert, Button } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { signOut } from '../auth/session';
import type { ReportsFailure } from './types';

export function ReportFailureAlert({
  failure,
  onRetry,
}: {
  failure: ReportsFailure;
  onRetry: () => void;
}) {
  const { t } = useTranslation('translation');
  return (
    <Alert
      severity="error"
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
      {failure.message || t(`reports.failures.${failure.kind}`)}
    </Alert>
  );
}
