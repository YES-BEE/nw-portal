import type { AccessRolesDeniedResponse, AccessRolesFailure } from './types';

export class AccessRolesError extends Error {
  readonly failure: AccessRolesFailure;

  constructor(failure: AccessRolesFailure) {
    super(failure.message);
    this.name = 'AccessRolesError';
    this.failure = failure;
  }
}

function safeText(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const text = value.trim();
  // Proxy pages and stack traces are not suitable presentation messages.
  return text &&
    !/<\/?[a-z!][^>]*>/i.test(text) &&
    !/\n\s*at\s|\b(?:java\.[\w.]+Exception|Traceback \(most recent call last\))/i.test(
      text,
    )
    ? text
    : undefined;
}

function isAccessDenied(
  value: Record<string, unknown>,
  status: number,
): value is Record<string, unknown> & AccessRolesDeniedResponse {
  return (
    status === 403 &&
    value.status === 403 &&
    value.code === 'ACCESS_DENIED' &&
    typeof value.type === 'string' &&
    typeof value.title === 'string' &&
    typeof value.detail === 'string' &&
    (value.instance === undefined || typeof value.instance === 'string')
  );
}

export function parseAccessRolesFailure(
  body: unknown,
  status: number,
): AccessRolesFailure {
  let value = body;
  if (typeof value === 'string') {
    const text = value;
    try {
      value = JSON.parse(text);
    } catch {
      if (text.trim().startsWith('[') || text.trim().startsWith('{'))
        value = undefined;
    }
  }
  const problem =
    value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : undefined;
  const message =
    safeText(problem?.detail) ??
    safeText(problem?.message) ??
    safeText(problem?.title) ??
    safeText(problem?.error) ??
    safeText(value);
  const denied = problem && isAccessDenied(problem, status);
  const kind: AccessRolesFailure['kind'] =
    status === 401
      ? 'authentication'
      : status === 403
        ? denied && problem.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 406
          ? 'representation'
          : status >= 500 && status <= 599
            ? 'service'
            : 'http';
  return {
    kind,
    status,
    message,
    ...(denied ? { code: problem.code as 'ACCESS_DENIED' } : {}),
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : kind === 'access' || kind === 'representation'
          ? 'none'
          : 'retry',
  };
}
