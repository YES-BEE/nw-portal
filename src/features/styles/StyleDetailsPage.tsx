import { useEffect, useRef, useState } from 'react';
import { Link as RouterLink, useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, Button, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useSession } from '../auth/useSession';
import { loadProcesses } from '../processes/processData';
import { ConfigurationDetails } from '../configurations/ConfigurationDetails';
import { canViewStyle, loadStyles } from './styleData';
import type { StyleMode } from './styleData';
import { usePageMetadata } from '../../app/usePageMetadata';
import { LotRouteStepper } from './LotRouteStepper';

export function StyleDetailsPage({ mode }: { mode: StyleMode }) {
  const { t } = useTranslation('translation');
  const { styleId } = useParams();
  const location = useLocation();
  const session = useSession();
  const [data] = useState(loadStyles);
  const processData = loadProcesses();
  const record = data.records.find(
    (style) => style.id === styleId && canViewStyle(style, session, mode),
  );
  const heading = useRef<HTMLHeadingElement>(null);
  const title = record?.number ?? t('styles.details');
  usePageMetadata(
    t('access.pageTitle', { title }),
    t('styles.detailsDescription'),
  );
  useEffect(() => {
    heading.current?.focus();
  }, [title]);
  const createdStyleId = (location.state as { createdStyleId?: unknown } | null)
    ?.createdStyleId;

  return (
    <>
      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        sx={{
          alignItems: { xs: 'flex-start', sm: 'center' },
          justifyContent: 'space-between',
          gap: 2,
          mb: 3,
        }}
      >
        <Typography
          ref={heading}
          tabIndex={-1}
          component="h1"
          sx={{ fontSize: 26, fontWeight: 700, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        <Button
          component={RouterLink}
          to={mode === 'own' ? '/new-style' : '/styles'}
          variant="outlined"
          startIcon={<ArrowBackIcon />}
        >
          {t(mode === 'own' ? 'styles.backToMine' : 'styles.backToList')}
        </Button>
      </Stack>
      {data.storageUnavailable && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          {t('styles.loadWarning')}
        </Alert>
      )}
      {record ? (
        <>
          {createdStyleId === record.id && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {t('styles.createdSuccess')}
            </Alert>
          )}
          {processData.storageUnavailable && (
            <Alert severity="warning" sx={{ mb: 2 }}>
              {t('styles.processesUnavailable')}
            </Alert>
          )}
          <LotRouteStepper
            processIds={record.steps}
            processes={
              processData.storageUnavailable ? [] : processData.records
            }
            lots={record.lots}
          />
          <ConfigurationDetails
            fields={[
              { label: t('styles.number'), value: record.number },
              { label: t('styles.created'), value: record.created },
              { label: t('styles.description'), value: record.description },
              { label: t('styles.client'), value: record.client },
              { label: t('styles.garments'), value: String(record.garments) },
              { label: t('styles.lots'), value: String(record.lots) },
              {
                label: t('styles.weight'),
                value: t('styles.weightValue', { value: record.weight }),
              },
              {
                label: t('styles.avg'),
                value: t('styles.weightValue', { value: record.avg }),
              },
              { label: t('styles.delivery'), value: record.delivery },
              { label: t('styles.createdBy'), value: record.createdBy ?? '' },
            ]}
          />
        </>
      ) : (
        <Alert severity="info">{t('styles.notFound')}</Alert>
      )}
    </>
  );
}
