import { loadTags } from '../configurations/tagRegistry';
import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert } from '@mui/material';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from '../configurations/ConfigurationDetails';
import { loadStorages } from './storageData';

export function StorageDetailsPage() {
  const { storageId } = useParams();
  const { t } = useTranslation('translation');
  const [data] = useState(loadStorages);
  const record = data.records.find((storage) => storage.id === storageId);

  useEffect(() => {
    document.title = t('storages.detailsPageTitle');
    document
      .querySelector('meta[name="description"]')
      ?.setAttribute('content', t('storages.detailsDescription'));
  }, [t]);

  return (
    <>
      <ConfigurationDetailHeader
        title={record?.number ?? t('storages.detailsTitle')}
        listTitle={t('storages.title')}
        listPath="/configurations/storages"
        backLabel={t('storages.backToList')}
      />
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('storages.loadWarning')}
        </Alert>
      )}
      {record ? (
        <ConfigurationDetails
          fields={[
            { label: t('storages.number'), value: record.number },
            { label: t('storages.description'), value: record.description },
            {
              label: t('storages.tag'),
              value:
                loadTags().records.find((tag) => tag.actual === record.tag)
                  ?.name || t('tags.nameUnavailable'),
            },
          ]}
        />
      ) : (
        <Alert severity="info">{t('common.recordNotFound')}</Alert>
      )}
    </>
  );
}
