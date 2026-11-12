import { useEffect, useState } from 'react';
import { Alert, Box, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ConfigurationDetails } from '../configurations/ConfigurationDetails';
import { formatDateTime } from '../../utils/formatDateTime';
import { getLotQc, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import type { LotQcResponse, LotsFailure } from './types';

type State =
  | { status: 'loading' }
  | { status: 'ready'; result: LotQcResponse | null }
  | { status: 'error'; failure: LotsFailure };
export function LotQcResults({ lotId }: { lotId: string }) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<State>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    void getLotQc(lotId, controller.signal).then(
      (result) => {
        if (!controller.signal.aborted) setState({ status: 'ready', result });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({ status: 'error', failure: lotsFailure(error) });
      },
    );
    return () => controller.abort();
  }, [lotId, attempt]);
  function retry() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  const result = state.status === 'ready' ? state.result : null;
  if (state.status === 'error' && state.failure.kind === 'access') return null;
  return (
    <Box component="section" aria-labelledby="lot-qc-title" sx={{ mb: 3 }}>
      <Typography
        component="h2"
        id="lot-qc-title"
        sx={{ fontSize: 17, fontWeight: 600, mb: 2 }}
      >
        {t('lots.qc.title')}
      </Typography>
      {state.status === 'loading' && (
        <CircularProgress size={28} aria-label={t('lots.qc.loading')} />
      )}
      {state.status === 'error' && (
        <LotFailureAlert
          failure={state.failure}
          onReload={retry}
          onRetry={retry}
        />
      )}
      {state.status === 'ready' && !result && (
        <Alert severity="info">{t('lots.qc.empty')}</Alert>
      )}
      {result && (
        <ConfigurationDetails
          fields={[
            {
              label: t('lots.qc.outcome'),
              value: t(`lots.qc.outcomes.${result.outcome}`),
            },
            {
              label: t('lots.qc.inspected'),
              value: String(result.inspected_quantity),
            },
            { label: t('lots.qc.passed'), value: String(result.good_quantity) },
            {
              label: t('lots.qc.rejected'),
              value: String(result.rejected_quantity),
            },
            {
              label: t('lots.qc.remarks'),
              value: result.reason || t('common.notProvided'),
            },
            {
              label: t('lots.qc.completed'),
              value: result.completed_at
                ? formatDateTime(result.completed_at)
                : t('common.notProvided'),
            },
          ]}
        />
      )}
    </Box>
  );
}
