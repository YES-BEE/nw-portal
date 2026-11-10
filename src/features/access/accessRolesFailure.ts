import type {
  AccessRoleField,
  AccessRolesDeniedResponse,
  AccessRolesFailure,
  AccessRolesOperation,
} from './types';

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
  operation: AccessRolesOperation = 'list',
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
  const fieldErrors: Partial<Record<AccessRoleField, string>> = {};
  const fields = problem?.fieldErrors;
  const validation =
    operation !== 'list' &&
    status === 400 &&
    problem?.code === 'VALIDATION_FAILED' &&
    fields &&
    typeof fields === 'object' &&
    !Array.isArray(fields);
  if (validation) {
    for (const field of ['name', 'modules', 'pcAccess', 'padAccess'] as const) {
      const text = safeText((fields as Record<string, unknown>)[field]);
      if (text) fieldErrors[field] = text;
    }
  }
  const mutationKind: AccessRolesFailure['kind'] | undefined =
    operation === 'list'
      ? undefined
      : status === 400
        ? validation
          ? 'validation'
          : 'invalidRequest'
        : status === 404 && operation === 'update'
          ? 'notFound'
          : status === 409
            ? 'conflict'
            : undefined;
  const kind: AccessRolesFailure['kind'] =
    mutationKind ??
    (status === 401
      ? 'authentication'
      : status === 403
        ? denied && problem.detail === 'Role changed; log in again'
          ? 'roleChanged'
          : 'access'
        : status === 406
          ? 'representation'
          : status >= 500 && status <= 599
            ? 'service'
            : 'http');
  const code = safeText(problem?.code);
  return {
    kind,
    status,
    message,
    ...(denied || (operation !== 'list' && code) ? { code } : {}),
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : kind === 'notFound'
          ? 'reload'
          : kind === 'access' ||
              kind === 'representation' ||
              kind === 'validation' ||
              kind === 'invalidRequest' ||
              kind === 'conflict'
            ? 'none'
            : 'retry',
  };
}
