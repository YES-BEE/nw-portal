import { describe, expect, it } from 'vitest';
import { parseLoginFailure } from './loginFailure';

const base = {
  type: 'about:blank',
  title: 'Failure',
  detail: 'Request validation failed',
  instance: '/api/v1/auth/login',
};

describe('documented login failure responses', () => {
  it.each([
    {
      status: 401,
      code: 'AUTHENTICATION_FAILED',
      detail: 'Bad credentials',
      kind: 'credentials',
    },
    {
      status: 403,
      code: 'ACCESS_DENIED',
      detail: 'Role does not allow this application channel',
      kind: 'access',
    },
    {
      status: 400,
      code: 'VALIDATION_FAILED',
      fieldErrors: {
        username: 'must not be blank',
        password: 'must not be blank',
        clientType: 'must not be blank',
      },
      kind: 'validation',
    },
    {
      status: 400,
      code: 'VALIDATION_FAILED',
      fieldErrors: { clientType: 'must match "PC|PAD"' },
      kind: 'validation',
    },
  ])(
    'recognizes $code with HTTP $status for JSON objects and strings',
    ({ kind, ...problem }) => {
      const body = { ...base, ...problem };
      for (const value of [body, JSON.stringify(body)]) {
        expect(parseLoginFailure(value, problem.status)).toMatchObject({
          kind,
          status: problem.status,
          code: problem.code,
          message: body.detail,
        });
      }
    },
  );
  it('uses only known field names and accepts partial field errors', () => {
    expect(
      parseLoginFailure(
        {
          ...base,
          status: 400,
          code: 'VALIDATION_FAILED',
          fieldErrors: { username: 'Required', unexpected: 'Ignore' },
        },
        400,
      )?.fieldErrors,
    ).toEqual({ username: 'Required' });
  });
  it.each([
    { body: { detail: 'Backend detail' }, message: 'Backend detail' },
    { body: { message: 'Backend message' }, message: 'Backend message' },
    { body: { title: 'Backend title' }, message: 'Backend title' },
    { body: { error: 'Backend error' }, message: 'Backend error' },
    {
      body: { detail: 'Preferred detail', message: 'Other text' },
      message: 'Preferred detail',
    },
    { body: 'Backend plain text', message: 'Backend plain text' },
  ])(
    'uses backend text even without Problem Detail metadata: $message',
    ({ body, message }) => {
      expect(parseLoginFailure(body, 401)).toMatchObject({
        status: 401,
        kind: 'credentials',
        message,
        messageSource: 'backend',
      });
    },
  );
  it.each([
    null,
    '',
    '<html>Unavailable</html>',
    '{invalid',
    {},
    { detail: null },
  ])(
    'uses the HTTP status when no usable backend text is available: %j',
    (body) => {
      expect(parseLoginFailure(body, 401, 'Unauthorized')).toMatchObject({
        status: 401,
        message: 'Unauthorized',
        messageSource: 'http',
      });
      expect(parseLoginFailure(body, 401).message).toBe('401');
    },
  );
  it('uses transport status even if JSON status or error code differs', () => {
    expect(
      parseLoginFailure(
        { status: 500, code: 'UNKNOWN', message: 'Backend rejected login' },
        401,
      ),
    ).toMatchObject({
      status: 401,
      kind: 'credentials',
      code: 'UNKNOWN',
      message: 'Backend rejected login',
    });
  });
  it('keeps a backend message while discarding malformed field values', () => {
    expect(
      parseLoginFailure(
        {
          message: 'Validation failed',
          fieldErrors: { username: 42, password: 'Backend password error' },
        },
        400,
      ),
    ).toMatchObject({
      message: 'Validation failed',
      fieldErrors: { password: 'Backend password error' },
    });
  });
});
