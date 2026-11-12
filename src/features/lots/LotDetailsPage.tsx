import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, CircularProgress, Stack } from '@mui/material';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from '../configurations/ConfigurationDetails';
import { usePageMetadata } from '../../app/usePageMetadata';
import { formatDateTime } from '../../utils/formatDateTime';
import { getLot, lotsFailure } from './lotsApi';
import { LotFailureAlert } from './LotFailureAlert';
import { LotCancelDialog } from './LotCancelDialog';
import { LotTimeline } from './LotTimeline';
import { LotQcResults } from './LotQcResults';
import { LotTrolleyDialog } from './LotTrolleyDialog';
import { canMapLotTrolley } from './lotDisplay';
import { useLotLabels } from './lotDisplay';
import type { LotResponse, LotsFailure } from './types';
type State =
  | { status: 'loading' }
  | { status: 'ready'; lot: LotResponse }
  | { status: 'error'; failure: LotsFailure };
export function LotDetailsPage() {
  const { lotId } = useParams();
  return <LotDetails key={lotId} lotId={lotId} />;
}
function LotDetails({ lotId }: { lotId?: string }) {
  const { t } = useTranslation('translation');
  const location = useLocation();
  const labels = useLotLabels();
  const [state, setState] = useState<State>(
    lotId
      ? { status: 'loading' }
      : {
          status: 'error',
          failure: { kind: 'invalidRequest', action: 'none' },
        },
  );
  const [attempt, setAttempt] = useState(0);
  const [cancelling, setCancelling] = useState(false);
  const [mapping, setMapping] = useState(false);
  const lot = state.status === 'ready' ? state.lot : null;
  const createdId = (location.state as { createdLotId?: unknown } | null)
    ?.createdLotId;
  usePageMetadata(t('lots.detailsPageTitle'), t('lots.detailsDescription'));
  useEffect(() => {
    const controller = new AbortController();
    if (lotId)
      void getLot(lotId, controller.signal).then(
        (value) => {
          if (!controller.signal.aborted)
            setState({ status: 'ready', lot: value });
        },
        (error) => {
          if (!controller.signal.aborted)
            setState({ status: 'error', failure: lotsFailure(error) });
        },
      );
    return () => controller.abort();
  }, [lotId, attempt]);
  function reload() {
    setCancelling(false);
    setMapping(false);
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  return (
    <>
      <ConfigurationDetailHeader
        title={lot?.lot_number || t('lots.detailsTitle')}
        listTitle={t('lots.title')}
        listPath="/lots"
        backLabel={t('lots.backToList')}
      />
      {state.status === 'loading' && (
        <Stack sx={{ py: 3 }}>
          <CircularProgress size={28} aria-label={t('common.loading')} />
        </Stack>
      )}
      {state.status === 'error' && (
        <LotFailureAlert
          failure={state.failure}
          onReload={reload}
          onRetry={reload}
        />
      )}
      {lot && (
        <>
          {createdId === lot.id && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {t('lots.createdSuccess')}
            </Alert>
          )}
          <ConfigurationDetails
            fields={[
              { label: t('lots.number'), value: lot.lot_number },
              { label: t('lots.style'), value: lot.style_number },
              {
                label: t('lots.quantity'),
                value:
                  lot.quantity === null
                    ? t('lots.quantityUnset')
                    : String(lot.quantity),
              },
              {
                label: t('trolleys.code'),
                value: lot.trolley_code || t('lots.trolley.notAssigned'),
              },
              {
                label: t('lots.status'),
                value: labels.statusLabel(lot.status),
              },
              {
                label: t('lots.location'),
                value: labels.locationLabel(lot.current_location_type),
              },
              {
                label: t('lots.routeSequence'),
                value:
                  lot.current_route_sequence === null
                    ? ''
                    : String(lot.current_route_sequence),
              },
              {
                label: t('lots.createdAt'),
                value: formatDateTime(lot.created_at),
              },
              {
                label: t('lots.completedAt'),
                value: lot.completed_at
                  ? formatDateTime(lot.completed_at)
                  : t('common.notProvided'),
              },
            ]}
          />
          {!['COMPLETED', 'CANCELLED'].includes(lot.status) && (
            <Stack
              direction="row"
              spacing={1.5}
              sx={{ justifyContent: 'flex-end', flexWrap: 'wrap', mb: 3 }}
            >
              {canMapLotTrolley(lot.status) && (
                <Button variant="outlined" onClick={() => setMapping(true)}>
                  {t(
                    lot.trolley_id
                      ? 'lots.trolley.unassign'
                      : 'lots.trolley.assign',
                  )}
                </Button>
              )}
              <Button variant="contained" onClick={() => setCancelling(true)}>
                {t('lots.cancel')}
              </Button>
            </Stack>
          )}
          <LotQcResults key={`qc-${attempt}`} lotId={lot.id} />
          <LotTimeline key={attempt} lotId={lot.id} />
          {mapping && (
            <LotTrolleyDialog
              lot={lot}
              onClose={() => setMapping(false)}
              onReload={reload}
              onSaved={reload}
            />
          )}
          {cancelling && (
            <LotCancelDialog
              lot={lot}
              onClose={() => setCancelling(false)}
              onReload={reload}
              onCancelled={reload}
            />
          )}
        </>
      )}
    </>
  );
}
