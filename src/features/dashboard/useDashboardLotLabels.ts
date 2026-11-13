import { useTranslation } from 'react-i18next';
import { useLotLabels } from '../lots/lotDisplay';

export function useDashboardLotLabels() {
  const { t } = useTranslation('translation');
  const labels = useLotLabels();
  return {
    statusLabel: (status: string) =>
      status === 'DISPATCHED' || status === 'READY_FOR_DISPATCH'
        ? t(`dashboard.statusValues.${status}`)
        : labels.statusLabel(status),
  };
}
