import type { ProcessConfiguration } from '../processes/types';
import type { StyleProcessOption, StyleRouteResponse } from './types';
export function styleProcesses(
  options: StyleProcessOption[],
): ProcessConfiguration[] {
  return options.map((process) => ({
    id: process.id,
    name: process.name,
    station: process.stationNumber,
    description: '',
    mode: 'process',
    processTag: '',
    devices: [],
  }));
}
export function orderedStyleProcesses(route: StyleRouteResponse): string[] {
  return route.flatMap((entry) =>
    entry.processes.map((process) => process.processId),
  );
}
