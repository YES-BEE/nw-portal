import { describe, expect, it } from 'vitest';
import { parseAccessRolesFailure } from './accessRolesFailure';

const denied = {
  type: 'about:blank',
  title: 'Forbidden',
  status: 403,
  code: 'ACCESS_DENIED',
  detail: 'Missing module access: roles',
  instance: '/api/v1/access-roles',
};

describe('access roles failure contract', () => {
  it.each([
    'Role does not allow this application channel',
    'Missing module access: roles',
    'Missing permission: ROLES',
  ])('preserves the backend access-denied reason: %s', (detail) => {
    expect(parseAccessRolesFailure({ ...denied, detail }, 403)).toEqual({
      kind: 'access',
      status: 403,
      code: 'ACCESS_DENIED',
      message: detail,
      action: 'none',
    });
  });

  it('recognizes role changes only with a valid application-defined response', () => {
    const changed = { ...denied, detail: 'Role changed; log in again' };
    expect(parseAccessRolesFailure(JSON.stringify(changed), 403)).toMatchObject(
      { kind: 'roleChanged', action: 'signIn' },
    );
    expect(
      parseAccessRolesFailure({ ...changed, status: 401 }, 403),
    ).toMatchObject({ kind: 'access', action: 'none' });
    expect(
      parseAccessRolesFailure({ ...changed, code: 'UNKNOWN' }, 403),
    ).toMatchObject({ kind: 'access', action: 'none' });
    expect(
      parseAccessRolesFailure({ ...changed, title: null }, 403),
    ).toMatchObject({ kind: 'access', action: 'none' });
  });

  it.each([
    [401, 'authentication', 'signIn'],
    [403, 'access', 'none'],
    [406, 'representation', 'none'],
    [500, 'service', 'retry'],
    [502, 'service', 'retry'],
    [503, 'service', 'retry'],
    [504, 'service', 'retry'],
    [404, 'http', 'retry'],
  ] as const)(
    'uses HTTP %s rather than trusting body status',
    (status, kind, action) => {
      expect(parseAccessRolesFailure({ status: 400 }, status)).toMatchObject({
        status,
        kind,
        action,
      });
    },
  );

  it.each([
    '',
    undefined,
    null,
    '<!DOCTYPE html><html>Proxy error</html>',
    '{broken',
    [],
    { unexpected: 'value' },
    'java.lang.IllegalStateException\n at example.Service.run(Service.java:12)',
  ])('tolerates missing or unsafe bodies: %j', (body) => {
    expect(parseAccessRolesFailure(body, 503)).toMatchObject({
      kind: 'service',
      message: undefined,
    });
  });

  it('prefers detail, and supports unfamiliar JSON or plain text reasons', () => {
    expect(
      parseAccessRolesFailure(
        { detail: 'Detail', message: 'Message', title: 'Title' },
        500,
      ).message,
    ).toBe('Detail');
    expect(parseAccessRolesFailure({ message: 'Message' }, 500).message).toBe(
      'Message',
    );
    expect(parseAccessRolesFailure({ title: 'Title' }, 500).message).toBe(
      'Title',
    );
    expect(parseAccessRolesFailure({ error: 'Reason' }, 500).message).toBe(
      'Reason',
    );
    expect(
      parseAccessRolesFailure('Maintenance in progress', 503).message,
    ).toBe('Maintenance in progress');
  });
});
