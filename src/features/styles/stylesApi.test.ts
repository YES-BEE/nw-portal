import { beforeEach, expect, it, vi } from 'vitest';
import { apiClient } from '../../api/client';
import {
  createStyle,
  getStyle,
  getStyles,
  getStyleRoute,
  getStyleProcessOptions,
  releaseStyle,
  reviseStyle,
  parseStylesFailure,
  updateStyleProcesses,
  getStyleRevisions,
} from './stylesApi';
import {
  styleResponse as style,
  styleRouteResponse as route,
  styleProcessOptions,
  styleRevisionResponse,
  styleHistoryItem,
} from '../../test/styles';
import { CanceledError } from 'axios';
beforeEach(() => vi.restoreAllMocks());
it('updates draft processes as an ordered JSON array and validates the returned route', async () => {
  const put = vi
    .spyOn(apiClient, 'put')
    .mockResolvedValue({ status: 200, data: route });
  const controller = new AbortController();
  expect(
    await updateStyleProcesses(
      'id/with space',
      [styleProcessOptions[0].id],
      controller.signal,
    ),
  ).toEqual(route);
  expect(put).toHaveBeenCalledWith(
    'styles/id%2Fwith%20space/processes',
    [styleProcessOptions[0].id],
    expect.objectContaining({ signal: controller.signal }),
  );
  put.mockResolvedValue({ status: 200, data: { processes: route } });
  await expect(updateStyleProcesses(style.id, ['p'])).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  put.mockResolvedValue({
    status: 409,
    data: {
      code: 'STYLE_IMMUTABLE',
      detail: 'Processes cannot change after Style release',
    },
  });
  await expect(updateStyleProcesses(style.id, ['p'])).rejects.toMatchObject({
    failure: {
      kind: 'conflict',
      message: 'Processes cannot change after Style release',
    },
  });
});
it('loads typed revision pages using backend paging/search and accepts empty arrays', async () => {
  const query = { page: 1, size: 10, search: 'process' };
  const page = { items: [styleHistoryItem], ...query, totalElements: 11 };
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: page });
  expect(await getStyleRevisions('id/with space', query)).toEqual({
    items: page.items,
    page: 1,
    size: 10,
    totalElements: 11,
  });
  expect(get).toHaveBeenCalledWith(
    'styles/id%2Fwith%20space/revisions',
    expect.objectContaining({ params: query }),
  );
  get.mockResolvedValue({ status: 200, data: [] });
  expect((await getStyleRevisions(style.id, query)).items).toEqual([]);
  get.mockResolvedValue({
    status: 200,
    data: [{ ...styleHistoryItem, affected_lot_count: '2' }],
  });
  await expect(getStyleRevisions(style.id, query)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('uses backend paging and search and accepts empty pages and empty arrays', async () => {
  const query = { page: 1, size: 10, search: 'Denim' };
  const get = vi.spyOn(apiClient, 'get').mockResolvedValue({
    status: 200,
    data: { items: [style], ...query, totalElements: 11 },
  });
  expect((await getStyles(query)).items).toEqual([style]);
  expect(get).toHaveBeenCalledWith(
    'styles',
    expect.objectContaining({ params: query }),
  );
  get.mockResolvedValue({ status: 200, data: [] });
  expect((await getStyles(query)).items).toEqual([]);
});
it('validates style responses and their requested identity', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: style });
  expect(await getStyle(style.id)).toEqual(style);
  await expect(getStyle('wrong-id')).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  get.mockResolvedValue({
    status: 200,
    data: { ...style, created_at: 'invalid' },
  });
  await expect(getStyle(style.id)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
});
it('creates a style with only supported backend fields and the chosen process order', async () => {
  const post = vi
    .spyOn(apiClient, 'post')
    .mockResolvedValue({ status: 200, data: style });
  const body = {
    styleNumber: style.style_number,
    description: style.description,
    processIds: styleProcessOptions.map((option) => option.id),
  };
  expect(await createStyle(body)).toEqual(style);
  expect(post).toHaveBeenCalledWith('styles', body, expect.any(Object));
});
it('validates the derived station route and treats a draft without a route as empty', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValue({ status: 200, data: route });
  expect(await getStyleRoute(style.id)).toEqual(route);
  get.mockResolvedValue({
    status: 200,
    data: [
      {
        ...route[0],
        processes: [{ ...route[0].processes[0], stationId: 'wrong' }],
      },
    ],
  });
  await expect(getStyleRoute(style.id)).rejects.toMatchObject({
    failure: { kind: 'invalidResponse' },
  });
  get.mockResolvedValue({
    status: 409,
    data: {
      code: 'STYLE_PROCESS_REQUIRED',
      detail: 'At least one Process is required',
    },
  });
  expect(await getStyleRoute(style.id)).toEqual([]);
});
it('releases a style without inventing a DELETE endpoint or request body', async () => {
  const post = vi.spyOn(apiClient, 'post').mockResolvedValue({
    status: 200,
    data: {
      ...style,
      status: 'RELEASED',
      released_at: '2026-11-12T00:00:00Z',
    },
  });
  expect((await releaseStyle(style.id)).status).toBe('RELEASED');
  expect(post).toHaveBeenCalledWith(
    `styles/${style.id}/release`,
    undefined,
    expect.any(Object),
  );
});
it.each(['unstarted', 'in-progress'] as const)(
  'uses the %s revision endpoint and validates its response',
  async (scope) => {
    const result = {
      ...styleRevisionResponse,
      scope: scope === 'unstarted' ? 'UNSTARTED' : 'ALL_IN_PROGRESS',
    };
    const post = vi
      .spyOn(apiClient, 'post')
      .mockResolvedValue({ status: 200, data: result });
    const body = {
      description: 'Changed',
      processIds: [styleProcessOptions[0].id],
      reason: 'Route correction',
    };
    expect(await reviseStyle(style.id, scope, body)).toEqual(result);
    expect(post).toHaveBeenCalledWith(
      `styles/${style.id}/revisions/${scope}`,
      body,
      expect.any(Object),
    );
    post.mockResolvedValue({
      status: 200,
      data: { ...result, affectedLots: -1 },
    });
    await expect(reviseStyle(style.id, scope, body)).rejects.toMatchObject({
      failure: { kind: 'invalidResponse' },
    });
  },
);
it('loads all lookup pages for style-only permissions', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockResolvedValueOnce({
      status: 200,
      data: {
        processes: {
          items: [styleProcessOptions[0]],
          page: 0,
          size: 1,
          totalElements: 2,
        },
      },
    })
    .mockResolvedValueOnce({
      status: 200,
      data: {
        processes: {
          items: [styleProcessOptions[1]],
          page: 1,
          size: 1,
          totalElements: 2,
        },
      },
    });
  expect(await getStyleProcessOptions()).toEqual(styleProcessOptions);
  expect(get).toHaveBeenLastCalledWith(
    'ui/lookups',
    expect.objectContaining({ params: { page: 1, size: 1 } }),
  );
});
it.each([
  [400, 'INVALID_ARGUMENT', 'invalidRequest', 'none'],
  [401, 'AUTHENTICATION_FAILED', 'authentication', 'signIn'],
  [403, 'ACCESS_DENIED', 'access', 'none'],
  [404, 'NOT_FOUND', 'notFound', 'reload'],
  [409, 'STYLE_IMMUTABLE', 'conflict', 'none'],
  [409, 'REPEATED_STATION_NOT_ALLOWED', 'conflict', 'none'],
  [409, 'ROUTE_EDIT_BLOCKED_IN_TRANSIT', 'conflict', 'none'],
  [503, undefined, 'service', 'retry'],
])('handles backend %s %s', async (status, code, kind, action) => {
  vi.spyOn(apiClient, 'get').mockResolvedValue({
    status,
    data: { code, detail: 'Backend explanation' },
  });
  await expect(getStyle(style.id)).rejects.toMatchObject({
    failure: { kind, action, message: 'Backend explanation' },
  });
});
it('maps backend field errors and changed-role failures', () => {
  expect(
    parseStylesFailure(
      {
        code: 'VALIDATION_FAILED',
        fieldErrors: {
          styleNumber: 'Required',
          'processIds[0]': 'must not be null',
        },
      },
      400,
    ),
  ).toMatchObject({
    kind: 'validation',
    fieldErrors: { styleNumber: 'Required', processIds: 'must not be null' },
  });
  expect(
    parseStylesFailure(
      { code: 'ACCESS_DENIED', detail: 'Role changed; log in again' },
      403,
    ),
  ).toMatchObject({ kind: 'roleChanged', action: 'signIn' });
});
it('preserves cancellation and normalizes network failures', async () => {
  const get = vi
    .spyOn(apiClient, 'get')
    .mockRejectedValue(new Error('Offline'));
  await expect(getStyle(style.id)).rejects.toMatchObject({
    failure: { kind: 'network' },
  });
  const cancelled = new CanceledError();
  get.mockRejectedValue(cancelled);
  await expect(getStyle(style.id)).rejects.toBe(cancelled);
});

it('accepts gaps in original process sequence numbers after inactive processes are excluded by the backend', async () => {
  const data = [
    { ...route[0], processes: [{ ...route[0].processes[0], sequence: 3 }] },
  ];
  vi.spyOn(apiClient, 'get').mockResolvedValue({ status: 200, data });
  expect(await getStyleRoute(style.id)).toEqual(data);
});
