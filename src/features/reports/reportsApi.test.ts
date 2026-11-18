import { beforeEach, expect, it, vi } from 'vitest';
import { CanceledError } from 'axios';
import { apiClient } from '../../api/client';
import { getReportCatalog, parseReportsFailure } from './reportsApi';
beforeEach(() => vi.restoreAllMocks());
it.each([
  [401, 'authentication', 'signIn'],
  [403, 'access', 'none'],
  [404, 'notFound', 'none'],
  [400, 'invalidRequest', 'none'],
  [503, 'service', 'retry'],
])('handles backend status %s', async (status, kind, action) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status,
    data: { detail: 'Backend explanation' },
  });
  await expect(getReportCatalog()).rejects.toMatchObject({
    failure: { kind, action, message: 'Backend explanation' },
  });
});
it('handles revoked roles, non-JSON errors, network failures and cancellation', async () => {
  expect(
    parseReportsFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ).action,
  ).toBe('signIn');
  expect(
    parseReportsFailure('<html>error</html>', 502).message,
  ).toBeUndefined();
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValue(new Error('offline'));
  await expect(getReportCatalog()).rejects.toMatchObject({
    failure: { kind: 'network' },
  });
  get.mockRejectedValue(new CanceledError());
  await expect(getReportCatalog()).rejects.toBeInstanceOf(CanceledError);
});
