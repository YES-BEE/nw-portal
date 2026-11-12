export function getDashboardPollIntervalMs(): number {
  const seconds = Number(import.meta.env.VITE_DASHBOARD_POLL_INTERVAL_SECONDS);
  const interval = seconds * 1000;
  return Number.isFinite(interval) && interval >= 1000 && interval <= 2147483647
    ? interval
    : 10000;
}
