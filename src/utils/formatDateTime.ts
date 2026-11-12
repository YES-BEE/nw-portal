// Keep date order consistent while using the browser's local time zone by default.
export function formatDateTime(
  value: string | Date,
  options: { seconds?: boolean; timeZone?: string } = {},
): string {
  return new Intl.DateTimeFormat('en-GB', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    ...(options.seconds === false ? {} : { second: '2-digit' as const }),
    hour12: false,
    ...(options.timeZone ? { timeZone: options.timeZone } : {}),
  }).format(typeof value === 'string' ? new Date(value) : value);
}
