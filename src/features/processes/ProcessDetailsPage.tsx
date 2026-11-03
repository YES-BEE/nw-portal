import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from '../configurations/ConfigurationDetails';
import { loadProcesses } from './processData';
import { DeviceTable } from './DeviceTable';

export function ProcessDetailsPage() {
  const { processId } = useParams();
  const { t } = useTranslation('translation');
  const [data] = useState(loadProcesses);
  const record = data.records.find((process) => process.id === processId);

  useEffect(() => {
    document.title = t('processes.detailsPageTitle');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('processes.detailsDescription'));
  }, [t]);

  return (
    <>
      <ConfigurationDetailHeader
        title={record?.name ?? t('processes.detailsTitle')}
        listTitle={t('processes.title')}
        listPath="/configurations/processes"
        backLabel={t('processes.backToList')}
      />
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('processes.loadWarning')}
        </Alert>
      )}
      {record ? (
        <>
          <ConfigurationDetails
            fields={[
              { label: t('processes.name'), value: record.name },
              { label: t('processes.station'), value: record.station },
              { label: t('processes.description'), value: record.description },
              {
                label: t('processes.trackingLevelHeading'),
                value: t(
                  record.mode === 'process'
                    ? 'processes.processMode'
                    : 'processes.deviceMode',
                ),
              },
              ...(record.mode === 'process'
                ? [
                    {
                      label: t('processes.processTag'),
                      value: record.processTag,
                    },
                  ]
                : [
                    {
                      label: t('processes.countLabel'),
                      value: String(record.devices.length),
                    },
                  ]),
            ]}
          />
          {record.mode === 'devices' && (
            <DeviceTable key={record.id} devices={record.devices} />
          )}
        </>
      ) : (
        <Alert severity="info">{t('common.recordNotFound')}</Alert>
      )}
    </>
  );
}
