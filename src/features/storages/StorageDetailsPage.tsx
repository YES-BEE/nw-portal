import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CircularProgress, Stack } from '@mui/material';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from '../configurations/ConfigurationDetails';
import { getStorageUnit, storageFailure } from './storagesApi';
import { StorageFailureAlert } from './StorageFailureAlert';
import type { StorageUnitResponse, StorageFailure } from './types';
import { usePageMetadata } from '../../app/usePageMetadata';
type State =
  | { status: 'loading' }
  | {
      status: 'ready';
      record: StorageUnitResponse;
    }
  | { status: 'error'; failure: StorageFailure };
export function StorageDetailsPage() {
  const { storageId } = useParams();
  return <StorageDetails key={storageId} storageId={storageId} />;
}
function StorageDetails({ storageId }: { storageId?: string }) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<State>(
    storageId
      ? { status: 'loading' }
      : {
          status: 'error',
          failure: { kind: 'invalidRequest', action: 'none' },
        },
  );
  const [attempt, setAttempt] = useState(0);
  usePageMetadata(
    t('storages.detailsPageTitle'),
    t('storages.detailsDescription'),
  );
  useEffect(() => {
    const controller = new AbortController();
    if (storageId)
      void getStorageUnit(storageId, controller.signal).then(
        (record) => {
          if (!controller.signal.aborted) setState({ status: 'ready', record });
        },
        (error) => {
          if (!controller.signal.aborted)
            setState({ status: 'error', failure: storageFailure(error) });
        },
      );
    return () => controller.abort();
  }, [storageId, attempt]);
  function reload() {
    setState({ status: 'loading' });
    setAttempt((v) => v + 1);
  }
  const record = state.status === 'ready' ? state.record : null;
  return (
    <>
      <ConfigurationDetailHeader
        title={record?.code || t('storages.detailsTitle')}
        listTitle={t('storages.title')}
        listPath="/configurations/storages"
        backLabel={t('storages.backToList')}
      />
      {state.status === 'loading' && (
        <Stack sx={{ py: 3 }}>
          <CircularProgress size={28} aria-label={t('common.loading')} />
        </Stack>
      )}
      {state.status === 'error' && (
        <StorageFailureAlert
          failure={state.failure}
          onReload={reload}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && (
        <ConfigurationDetails
          fields={[
            { label: t('storages.number'), value: state.record.code },
            { label: t('storages.station'), value: state.record.station_code },
            { label: t('storages.name'), value: state.record.name },
            {
              label: t('storages.area'),
              value: state.record.storage_area_code,
            },
            {
              label: t('storages.status'),
              value: t(
                state.record.active ? 'access.active' : 'access.inactive',
              ),
            },
          ]}
        />
      )}
    </>
  );
}
