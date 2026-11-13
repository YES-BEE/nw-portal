import type { UserProcessAssignment } from './types';

export function isUserProcessAssignment(
  value: unknown,
): value is UserProcessAssignment {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const assignment = value as Record<string, unknown>;
  return (
    ['processId', 'processName', 'stationId', 'stationNumber'].every(
      (key) => typeof assignment[key] === 'string',
    ) &&
    ['activeOnShift', 'processActive', 'stationActive'].every(
      (key) => typeof assignment[key] === 'boolean',
    )
  );
}
