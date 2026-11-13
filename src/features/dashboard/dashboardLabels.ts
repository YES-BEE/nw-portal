import { useTranslation } from 'react-i18next';

export function useDashboardProcessLabel() {
  const { t } = useTranslation('translation');
  return (value: string) => {
    const known = (
      ['PENDING', 'IN_PROGRESS', 'PAUSED', 'BLOCKED'] as const
    ).find((status) => status === value);
    return known ? t(`dashboard.processStatusValues.${known}`) : value;
  };
}
