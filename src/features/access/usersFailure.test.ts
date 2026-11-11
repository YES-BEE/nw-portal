import { describe, expect, it } from 'vitest';
import { parseUsersFailure } from './usersFailure';

describe('users failure reasons from backend handlers', () => {
  it('normalizes safe create validation fields and ignores unknown or unsafe messages', () => {
    const failure = parseUsersFailure(
      {
        code: 'VALIDATION_FAILED',
        detail: 'Request validation failed',
        fieldErrors: {
          username: 'must not be blank',
          displayName: 'must not be blank',
          initialPassword: 'must not be blank',
          role: 'must not be blank',
          extra: 'ignored',
          processAssignments: '<html>Unsafe</html>',
        },
      },
      400,
      'create',
    );
    expect(failure).toMatchObject({
      kind: 'validation',
      action: 'none',
      fieldErrors: {
        username: 'must not be blank',
        displayName: 'must not be blank',
        initialPassword: 'must not be blank',
        role: 'must not be blank',
      },
    });
    expect(Object.keys(failure.fieldErrors!)).toHaveLength(4);
    expect(
      parseUsersFailure(
        { code: 'VALIDATION_FAILED', fieldErrors: [] },
        400,
        'create',
      ).kind,
    ).toBe('invalidRequest');
    expect(
      parseUsersFailure(
        { code: 'VALIDATION_FAILED', fieldErrors: { username: 'invalid' } },
        500,
        'create',
      ).kind,
    ).toBe('service');
    expect(
      parseUsersFailure({ code: 'DATA_CONFLICT' }, 409, 'create'),
    ).toMatchObject({
      kind: 'conflict',
      action: 'none',
      code: 'DATA_CONFLICT',
    });
    expect(
      parseUsersFailure({ code: 'NOT_FOUND' }, 404, 'create'),
    ).toMatchObject({ kind: 'invalidRequest', action: 'none' });
  });
  it('distinguishes a missing detail record from an unrecognized list endpoint', () => {
    const body = {
      code: 'NOT_FOUND',
      detail: 'Requested resource was not found',
    };
    expect(parseUsersFailure(body, 404, 'detail')).toMatchObject({
      kind: 'notFound',
      action: 'reload',
      message: body.detail,
    });
    expect(parseUsersFailure(body, 404, 'list')).toMatchObject({
      kind: 'http',
      action: 'retry',
    });
    expect(parseUsersFailure(body, 500, 'detail')).toMatchObject({
      kind: 'service',
      status: 500,
    });
    expect(parseUsersFailure('', 400, 'detail')).toMatchObject({
      kind: 'invalidRequest',
      action: 'reload',
    });
  });
  it.each([
    'Role does not allow this application channel',
    'Missing module access: users',
    'Missing permission: USERS',
  ])('preserves the actual access-denied reason: %s', (detail) => {
    expect(
      parseUsersFailure({ code: 'ACCESS_DENIED', detail }, 403),
    ).toMatchObject({
      kind: 'access',
      message: detail,
      code: 'ACCESS_DENIED',
      action: 'none',
    });
  });

  it('recognizes a role change only for a valid 403 application response', () => {
    const body = {
      type: 'about:blank',
      title: 'Forbidden',
      status: 403,
      detail: 'Role changed; log in again',
      code: 'ACCESS_DENIED',
    };
    expect(parseUsersFailure(JSON.stringify(body), 403)).toMatchObject({
      kind: 'roleChanged',
      action: 'signIn',
    });
    expect(parseUsersFailure({ ...body, code: 'UNKNOWN' }, 403).kind).toBe(
      'access',
    );
    expect(parseUsersFailure({ ...body, status: 401 }, 403).kind).toBe(
      'access',
    );
    expect(parseUsersFailure({ ...body, title: null }, 403).kind).toBe(
      'access',
    );
    expect(parseUsersFailure(body, 500).kind).toBe('service');
  });

  it.each([
    undefined,
    '',
    '<!DOCTYPE html><html>Proxy diagnostics</html>',
    '{broken',
    [],
    { unexpected: true },
    'java.lang.IllegalStateException\n at example.Service.run(Service.java:12)',
  ])('uses safe service fallbacks for unfamiliar bodies: %j', (body) => {
    expect(parseUsersFailure(body, 503)).toMatchObject({
      kind: 'service',
      message: undefined,
      action: 'retry',
    });
  });

  it('uses detail first and supports unfamiliar JSON and safe plain text', () => {
    expect(
      parseUsersFailure(
        { detail: 'Detail', message: 'Message', title: 'Title' },
        500,
      ).message,
    ).toBe('Detail');
    expect(parseUsersFailure({ message: 'Message' }, 500).message).toBe(
      'Message',
    );
    expect(parseUsersFailure({ title: 'Title' }, 500).message).toBe('Title');
    expect(parseUsersFailure({ error: 'Reason' }, 500).message).toBe('Reason');
    expect(parseUsersFailure('Maintenance in progress', 503).message).toBe(
      'Maintenance in progress',
    );
  });

  it('treats an empty unauthorized response as requiring sign-in, and 406 as a media-type failure', () => {
    expect(parseUsersFailure('', 401)).toMatchObject({
      kind: 'authentication',
      status: 401,
      action: 'signIn',
    });
    expect(parseUsersFailure('', 406)).toMatchObject({
      kind: 'representation',
      action: 'none',
    });
  });
});
