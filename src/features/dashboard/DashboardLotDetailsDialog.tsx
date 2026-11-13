import { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import { ConfigurationDetails } from '../configurations/ConfigurationDetails';
import { formatDateTime } from '../../utils/formatDateTime';
import { useLotLabels } from '../lots/lotDisplay';
import { getDashboardLot, dashboardFailure } from './dashboardApi';
import { DashboardFailureAlert } from './DashboardFailureAlert';
import type { DashboardLot, DashboardFailure, StationWip } from './types';
import { useDashboardProcessLabel } from './dashboardLabels';

export function DashboardLotDetailsDialog({
  id,
  stations,
  pollIntervalMs,
  onClose,
}: {
  id: string;
  stations: StationWip[];
  pollIntervalMs: number;
  onClose: () => void;
}) {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  const processLabel = useDashboardProcessLabel();
  const [lot, setLot] = useState<DashboardLot | null>(null);
  const [failure, setFailure] = useState<DashboardFailure | null>(null);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    let pending = false;
    async function load() {
      if (pending || controller.signal.aborted) return;
      pending = true;
      try {
        const data = await getDashboardLot(id, controller.signal);
        if (!controller.signal.aborted) {
          setLot(data);
          setFailure(null);
        }
      } catch (error: unknown) {
        if (!controller.signal.aborted) setFailure(dashboardFailure(error));
      } finally {
        pending = false;
      }
    }
    void load();
    const timer =
      pollIntervalMs > 0
        ? setInterval(() => void load(), pollIntervalMs)
        : undefined;
    return () => {
      clearInterval(timer);
      controller.abort();
    };
  }, [id, attempt, pollIntervalMs]);
  return (
    <Dialog
      open
      fullWidth
      maxWidth="sm"
      onClose={onClose}
      aria-labelledby="dashboard-lot-details-title"
    >
      <DialogTitle id="dashboard-lot-details-title">
        {t('lots.detailsTitle')}
        {lot ? ` · ${lot.lot_number}` : ''}
      </DialogTitle>
      <DialogContent>
        {!lot && !failure && (
          <CircularProgress size={28} aria-label={t('common.loading')} />
        )}
        {failure && (
          <DashboardFailureAlert
            failure={failure}
            onRetry={() => setAttempt((value) => value + 1)}
          />
        )}
        {lot && (
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
                label: t('lots.status'),
                value: labels.statusLabel(lot.status),
              },
              {
                label: t('dashboard.station'),
                value:
                  stations.find(
                    (station) => station.code === lot.current_station,
                  )?.name || '—',
              },
              {
                label: t('dashboard.process'),
                value: lot.current_process || '—',
              },
              {
                label: t('dashboard.processStatus'),
                value: lot.current_process_status
                  ? processLabel(lot.current_process_status)
                  : '—',
              },
              {
                label: t('lots.routeSequence'),
                value:
                  lot.current_route_sequence === null
                    ? '—'
                    : String(lot.current_route_sequence),
              },
              {
                label: t('dashboard.currentLocation'),
                value: lot.location_label || '—',
              },
              {
                label: t('lots.createdAt'),
                value: formatDateTime(lot.created_at),
              },
              {
                label: t('lots.completedAt'),
                value: lot.completed_at
                  ? formatDateTime(lot.completed_at)
                  : '—',
              },
            ]}
          />
        )}
      </DialogContent>
      <DialogActions>
        <Button variant="outlined" onClick={onClose}>
          {t('lots.close')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
