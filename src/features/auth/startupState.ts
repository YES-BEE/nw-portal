export type StartupStatus = 'ready' | 'loading' | 'error';

let status: StartupStatus = 'ready';
const listeners = new Set<() => void>();

export function getStartupStatus() {
  return status;
}

export function setStartupStatus(next: StartupStatus) {
  if (status === next) return;
  status = next;
  for (const listener of listeners) listener();
}

export function subscribeStartup(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
