import { formatDateTime } from '../../utils/formatDateTime';
import { useEffect, useState } from 'react';
import { useLocation, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Alert, CircularProgress, Stack } from '@mui/material';
import {
  ConfigurationDetailHeader,
  ConfigurationDetails,
} from '../configurations/ConfigurationDetails';
import { usePageMetadata } from '../../app/usePageMetadata';
import {
  getStyle,
  getStyleRoute,
  getStyleProcessOptions,
  stylesFailure,
} from './stylesApi';
import { StyleFailureAlert } from './StyleFailureAlert';
import { StyleRevisionHistory } from './StyleRevisionHistory';
import { useSession } from '../auth/useSession';
import { LotRouteStepper } from './LotRouteStepper';
import { styleProcesses, orderedStyleProcesses } from './styleData';
import type {
  StyleMode,
  StyleResponse,
  StyleRouteResponse,
  StyleProcessOption,
  StylesFailure,
} from './types';
type State =
  | { status: 'loading' }
  | {
      status: 'ready';
      style: StyleResponse;
      route: StyleRouteResponse;
      options: StyleProcessOption[];
    }
  | { status: 'error'; failure: StylesFailure };
export function StyleDetailsPage({ mode }: { mode: StyleMode }) {
  const { styleId } = useParams();
  return <StyleDetails key={styleId} styleId={styleId} mode={mode} />;
}
function StyleDetails({
  styleId,
  mode,
}: {
  styleId?: string;
  mode: StyleMode;
}) {
  const { t } = useTranslation('translation');
  const location = useLocation();
  const session = useSession();
  const showHistory =
    mode === 'management' && session?.user.role !== 'STYLE_CONFIGURATOR';
  const [state, setState] = useState<State>(
    styleId
      ? { status: 'loading' }
      : {
          status: 'error',
          failure: { kind: 'invalidRequest', action: 'none' },
        },
  );
  const [attempt, setAttempt] = useState(0);
  const record = state.status === 'ready' ? state.style : null;
  usePageMetadata(
    t('access.pageTitle', {
      title: record?.style_number || t('styles.details'),
    }),
    t('styles.detailsDescription'),
  );
  useEffect(() => {
    const controller = new AbortController();
    if (styleId)
      void Promise.all([
        getStyle(styleId, controller.signal),
        getStyleRoute(styleId, controller.signal),
        getStyleProcessOptions(controller.signal),
      ]).then(
        ([style, route, options]) => {
          if (!controller.signal.aborted)
            setState({ status: 'ready', style, route, options });
        },
        (error) => {
          if (!controller.signal.aborted)
            setState({ status: 'error', failure: stylesFailure(error) });
        },
      );
    return () => controller.abort();
  }, [styleId, attempt]);
  function reload() {
    setState({ status: 'loading' });
    setAttempt((value) => value + 1);
  }
  const createdId = (location.state as { createdStyleId?: unknown } | null)
    ?.createdStyleId;
  return (
    <>
      <ConfigurationDetailHeader
        title={record?.style_number || t('styles.details')}
        listTitle={t(
          mode === 'own' ? 'navigation.newstyle' : 'navigation.styles',
        )}
        listPath={mode === 'own' ? '/new-style' : '/styles'}
        backLabel={t(
          mode === 'own' ? 'styles.backToMine' : 'styles.backToList',
        )}
      />
      {state.status === 'loading' && (
        <Stack sx={{ py: 3 }}>
          <CircularProgress size={28} aria-label={t('common.loading')} />
        </Stack>
      )}
      {state.status === 'error' && (
        <StyleFailureAlert
          failure={state.failure}
          onReload={reload}
          onRetry={reload}
        />
      )}
      {state.status === 'ready' && (
        <>
          {createdId === state.style.id && (
            <Alert severity="success" sx={{ mb: 3 }}>
              {t('styles.createdSuccess')}
            </Alert>
          )}
          <ConfigurationDetails
            fields={[
              { label: t('styles.number'), value: state.style.style_number },
              {
                label: t('styles.description'),
                value: state.style.description || '',
              },
              {
                label: t('styles.status'),
                value: t(`styles.statusValues.${state.style.status}`),
              },
              {
                label: t('styles.created'),
                value: formatDateTime(state.style.created_at),
              },
              {
                label: t('styles.released'),
                value: state.style.released_at
                  ? formatDateTime(state.style.released_at)
                  : t('styles.notReleased'),
              },
            ]}
          />
          {state.route.length ? (
            <LotRouteStepper
              processIds={orderedStyleProcesses(state.route)}
              processes={styleProcesses([
                ...state.options,
                ...state.route.flatMap((entry) =>
                  entry.processes
                    .filter(
                      (process) =>
                        !state.options.some(
                          (option) => option.id === process.processId,
                        ),
                    )
                    .map((process) => ({
                      id: process.processId,
                      name: process.processCode,
                      station_id: process.stationId,
                      stationNumber: process.stationCode,
                    })),
                ),
              ])}
              lots={0}
              description={t('styles.routePreviewHint')}
            />
          ) : (
            <Alert severity="info">{t('styles.noRoute')}</Alert>
          )}
          {showHistory && (
            <StyleRevisionHistory
              key={state.style.id}
              styleId={state.style.id}
            />
          )}
        </>
      )}
    </>
  );
}
