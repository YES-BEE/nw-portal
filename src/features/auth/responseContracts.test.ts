import { describe, expect, it } from 'vitest';
import { isLoginResponse } from './loginApi';
import { isMeResponse } from './meApi';
import { loginResponse, meResponse } from '../../test/auth';
import { usersResponse } from '../../test/users';

describe('authentication response contracts', () => {
  const assignments = usersResponse[1].processAssignments;
  it('accepts the backend process assignment projection in login and profile responses', () => {
    expect(
      isLoginResponse({ ...loginResponse, processAssignments: assignments }),
    ).toBe(true);
    expect(
      isMeResponse({ ...meResponse, processAssignments: assignments }),
    ).toBe(true);
  });
  it.each([
    null,
    [{ processId: 'partial' }],
    [{ ...assignments[0], activeOnShift: 'true' }],
  ])('rejects malformed assignments: %j', (processAssignments) => {
    expect(isLoginResponse({ ...loginResponse, processAssignments })).toBe(
      false,
    );
    expect(isMeResponse({ ...meResponse, processAssignments })).toBe(false);
  });
  it.each([
    { status: undefined },
    { status: 'UNKNOWN' },
    { initial_password_expires_at: undefined },
    { initial_password_expires_at: 'not-a-date' },
  ])(
    'requires the current profile status and nullable password expiry: %j',
    (override) => {
      expect(isMeResponse({ ...meResponse, ...override })).toBe(false);
    },
  );
});
