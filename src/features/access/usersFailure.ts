import { readProblemDetails, safeApiText } from '../../api/problemDetails';
import type { CreateUserField, UsersFailure, UsersOperation } from './types';

export class UsersError extends Error {
  readonly failure: UsersFailure;
  constructor(failure: UsersFailure) {
    super(failure.message);
    this.name = 'UsersError';
    this.failure = failure;
  }
}

export function parseUsersFailure(
  body: unknown,
  status: number,
  operation: UsersOperation = 'list',
): UsersFailure {
  const { problem, message } = readProblemDetails(body);
  const fields = problem?.fieldErrors;
  const validation =
    operation === 'create' &&
    status === 400 &&
    problem?.code === 'VALIDATION_FAILED' &&
    fields &&
    typeof fields === 'object' &&
    !Array.isArray(fields);
  const fieldErrors: Partial<Record<CreateUserField, string>> = {};
  if (validation)
    for (const field of [
      'username',
      'displayName',
      'initialPassword',
      'role',
      'processAssignments',
    ] as const) {
      const text = safeApiText((fields as Record<string, unknown>)[field]);
      if (text) fieldErrors[field] = text;
    }
  const roleChanged =
    status === 403 &&
    problem?.status === 403 &&
    problem.code === 'ACCESS_DENIED' &&
    typeof problem.type === 'string' &&
    typeof problem.title === 'string' &&
    problem.detail === 'Role changed; log in again' &&
    (problem.instance === undefined || typeof problem.instance === 'string');
  const kind: UsersFailure['kind'] =
    operation === 'create' && status === 400
      ? validation
        ? 'validation'
        : 'invalidRequest'
      : operation === 'create' && status === 404
        ? 'invalidRequest'
        : (operation === 'create' || operation === 'delete') && status === 409
          ? 'conflict'
          : (operation === 'detail' || operation === 'delete') && status === 404
            ? 'notFound'
            : (operation === 'detail' || operation === 'delete') &&
                status === 400
              ? 'invalidRequest'
              : status === 401
                ? 'authentication'
                : status === 403
                  ? roleChanged
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
    code: safeApiText(problem?.code),
    ...(Object.keys(fieldErrors).length ? { fieldErrors } : {}),
    action:
      kind === 'authentication' || kind === 'roleChanged'
        ? 'signIn'
        : operation === 'create' &&
            (kind === 'validation' ||
              kind === 'invalidRequest' ||
              kind === 'conflict')
          ? 'none'
          : kind === 'notFound' ||
              kind === 'invalidRequest' ||
              (operation === 'delete' && kind === 'conflict')
            ? 'reload'
            : kind === 'access' || kind === 'representation'
              ? 'none'
              : 'retry',
  };
}
