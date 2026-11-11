import { useTagName } from './useTagName';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import {
  Alert,
  AlertTitle,
  Button,
  CircularProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from '../configurations/ConfigurationDetails';
import { signOut } from '../auth/session';
import { getProcess, ProcessesError } from './processesApi';
import type { ProcessResponse, ProcessesFailure } from './types';
import { DeviceTable } from './DeviceTable';

type DetailState =
  | { status: 'loading' }
  | { status: 'ready'; process: ProcessResponse }
  | { status: 'error'; failure: ProcessesFailure };

export function ProcessDetailsPage() {
  const { processId } = useParams();
  return <ProcessDetails key={processId} processId={processId} />;
}

function ProcessDetails({ processId }: { processId: string | undefined }) {
  const { t } = useTranslation('translation');
  const [state, setState] = useState<DetailState>(
    processId
      ? { status: 'loading' }
      : {
          status: 'error',
          failure: { kind: 'invalidRequest', action: 'none' },
        },
  );
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    if (!processId) return () => controller.abort();
    void getProcess(processId, controller.signal).then(
      (process) => {
        if (!controller.signal.aborted) setState({ status: 'ready', process });
      },
      (error: unknown) => {
        if (!controller.signal.aborted)
          setState({
            status: 'error',
            failure:
              error instanceof ProcessesError
                ? error.failure
                : { kind: 'network', action: 'retry' },
          });
      },
    );
    return () => controller.abort();
  }, [processId, attempt]);
  useEffect(() => {
    document.title = t('processes.detailsPageTitle');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('processes.detailsDescription'));
  }, [t]);

  const record = state.status === 'ready' ? state.process : null;
  const tagName = useTagName(!!record);
  return (
    <>
      <ConfigurationDetailHeader
        title={record?.name ?? t('processes.detailsTitle')}
        listTitle={t('processes.title')}
        listPath="/configurations/processes"
        backLabel={t('processes.backToList')}
      />
      {state.status === 'loading' && (
        <Stack
          role="status"
          aria-label={t('processes.loadingDetails')}
          direction="row"
          spacing={2}
          sx={{ alignItems: 'center', py: 3 }}
        >
          <CircularProgress size={28} />
          <Typography>{t('processes.loadingDetails')}</Typography>
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
          <AlertTitle>{t('processes.detailsFailure')}</AlertTitle>
          {state.failure.message ||
            t(`processes.failures.${state.failure.kind}.description`)}
          {!state.failure.message && state.failure.status !== undefined && (
            <Typography variant="caption" sx={{ display: 'block', mt: 0.5 }}>
              {t('processes.failureStatus', { status: state.failure.status })}
            </Typography>
          )}
        </Alert>
      )}
      {record && (
        <>
          <ConfigurationDetails
            fields={[
              { label: t('processes.name'), value: record.name },
              { label: t('processes.station'), value: record.stationNumber },
              {
                label: t('processes.description'),
                value: record.description ?? '',
              },
              {
                label: t('processes.trackingLevelHeading'),
                value: t(
                  record.nfcMode === 'PROCESS'
                    ? 'processes.processMode'
                    : 'processes.deviceMode',
                ),
              },
              {
                label: t('processes.quality'),
                value: t(record.quality ? 'processes.yes' : 'processes.no'),
              },
              {
                label: t('processes.statusColumn'),
                value: t(record.active ? 'access.active' : 'access.inactive'),
              },
              {
                label: t('processes.targetDuration'),
                value:
                  record.target_duration_seconds === null
                    ? ''
                    : t('processes.durationSeconds', {
                        count: record.target_duration_seconds,
                      }),
              },
              ...(record.nfcMode === 'PROCESS'
                ? [
                    {
                      label: t('processes.processTag'),
                      value: tagName(record.nfcUid),
                    },
                  ]
                : [
                    {
                      label: t('processes.countLabel'),
                      value: String(record.deviceCount),
                    },
                  ]),
            ]}
          />
          {record.nfcMode === 'DEVICES' && (
            <DeviceTable
              key={record.id}
              devices={record.devices.map((device) => ({
                id: device.id,
                name: device.name,
                description: device.description ?? '',
                tag: tagName(device.nfcUid),
              }))}
            />
          )}
        </>
      )}
    </>
  );
}
