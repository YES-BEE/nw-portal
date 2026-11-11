import type {
  AccessRoleField,
  AccessRolesDeniedResponse,
  AccessRolesFailure,
  AccessRolesOperation,
} from './types';
import {
  readProblemDetails,
  safeApiText as safeText,
} from '../../api/problemDetails';

export class AccessRolesError extends Error {
  readonly failure: AccessRolesFailure;

  constructor(failure: AccessRolesFailure) {
    super(failure.message);
    this.name = 'AccessRolesError';
    this.failure = failure;
  }
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
  const { problem, message } = readProblemDetails(body);
  const denied = problem && isAccessDenied(problem, status);
  const fieldErrors: Partial<Record<AccessRoleField, string>> = {};
  const fields = problem?.fieldErrors;
  const validation =
    (operation === 'create' || operation === 'update') &&
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
        : status === 404 && (operation === 'update' || operation === 'delete')
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
        : kind === 'notFound' ||
            (operation === 'delete' && kind === 'invalidRequest')
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
