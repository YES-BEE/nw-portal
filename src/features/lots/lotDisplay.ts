import { useTranslation } from 'react-i18next';
import type { JsonValue } from './types';
const statuses = [
  'READY',
  'AT_STATION',
  'IN_STORAGE',
  'DISPATCHED',
  'IN_PROCESS',
  'READY_FOR_DISPATCH',
  'COMPLETED',
  'CANCELLED',
] as const;
const locations = [
  'TRANSIT',
  'TROLLEY',
  'PROCESS_AREA',
  'STORAGE',
  'COMPLETED',
  'CANCELLED',
] as const;
export function useLotLabels() {
  const { t } = useTranslation('translation');
  return {
    statusLabel: (value: string) => {
      const known = statuses.find((status) => status === value);
      return known ? t(`lots.statusValues.${known}`) : value;
    },
    locationLabel: (value: string | null) => {
      if (!value) return t('common.notProvided');
      const known = locations.find((location) => location === value);
      return known ? t(`lots.locationValues.${known}`) : value;
    },
  };
}
export function timelineNote(detail: JsonValue): string | undefined {
  let value = detail;
  // JDBC deployments may serialize a JSONB value as a JSON string or PGobject.
  if (
    value &&
    typeof value === 'object' &&
    !Array.isArray(value) &&
    value.type === 'jsonb' &&
    typeof value.value === 'string'
  )
    value = value.value;
  if (typeof value === 'string') {
    const raw = value;
    try {
      value = JSON.parse(value) as JsonValue;
    } catch {
      return raw;
    }
  }
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return undefined;
  for (const key of ['qcOutcome', 'reason', 'message'])
    if (typeof value[key] === 'string' && value[key].trim()) return value[key];
  return undefined;
}
