import { readApiPage } from '../../api/collections';
import type { ApiPage, ListQuery } from '../../api/collections';
import type { PageQuery } from '../../api/collections';
import axios from 'axios';
import { apiClient } from '../../api/client';
import { readProblemDetails, safeApiText } from '../../api/problemDetails';

export interface TagResponse {
  id: string;
  name: string;
  uid: string;
  status: 'ACTIVE' | 'DELETED';
  assigned: boolean;
  asset_type: string | null;

  trolley_id: string | null;
  station_id: string | null;
  process_id: string | null;
  machine_id: string | null;
  storage_area_id: string | null;
  storage_location_id: string | null;
  version: number;
}

export type TagDetailsResponse = TagResponse;
export type CreateTagResponse = TagDetailsResponse;
export type UpdateTagResponse = TagDetailsResponse;

export interface DeleteTagResponse extends TagDetailsResponse {
  status: 'DELETED';
  assigned: false;
}

// MasterDataController.TagCommand: name <= 150, uid <= 128, both required.
export interface CreateTagRequest {
  name: string;
  uid: string;
}
export type UpdateTagRequest = CreateTagRequest;
export type CreateTagField = keyof CreateTagRequest;

export interface TagsFailure {
  kind:
    | 'authentication'
    | 'roleChanged'
    | 'access'
    | 'representation'
    | 'service'
    | 'http'
    | 'network'
    | 'invalidResponse'
    | 'validation'
    | 'invalidRequest'
    | 'notFound'
    | 'conflict';
  action: 'signIn' | 'retry' | 'reload' | 'none';
  status?: number;
  code?: string;
  message?: string;
  fieldErrors?: Partial<Record<CreateTagField, string>>;
}

export class TagsError extends Error {
  readonly failure: TagsFailure;
  constructor(failure: TagsFailure) {
    super(failure.message);
    this.name = 'TagsError';
    this.failure = failure;
  }
}

export function parseTagsFailure(
  body: unknown,
  status: number,
  operation: 'list' | 'create' | 'detail' | 'update' | 'delete' = 'list',
): TagsFailure {
  const { problem, message } = readProblemDetails(body);
  const fields = problem?.fieldErrors;
  const validation =
    (operation === 'create' || operation === 'update') &&
    status === 400 &&
    problem?.code === 'VALIDATION_FAILED' &&
    fields &&
    typeof fields === 'object' &&
    !Array.isArray(fields);
  const fieldErrors: Partial<Record<CreateTagField, string>> = {};
  if (validation)
    for (const field of ['name', 'uid'] as const) {
      const text = safeApiText((fields as Record<string, unknown>)[field]);
      if (text) fieldErrors[field] = text;
    }
  const roleChanged =
    status === 403 &&
    problem?.status === 403 &&
    problem.code === 'ACCESS_DENIED' &&
    problem.detail === 'Role changed; log in again' &&
    typeof problem.type === 'string' &&
    typeof problem.title === 'string' &&
    (problem.instance === undefined || typeof problem.instance === 'string');
  const kind: TagsFailure['kind'] =
    (operation === 'detail' ||
      operation === 'update' ||
      operation === 'delete') &&
    (status === 404 || (status === 409 && problem?.code === 'NOT_FOUND'))
      ? 'notFound'
      : (operation === 'detail' || operation === 'delete') && status === 400
        ? 'invalidRequest'
        : (operation === 'create' || operation === 'update') && status === 400
          ? validation
            ? 'validation'
            : 'invalidRequest'
          : (operation === 'create' ||
                operation === 'update' ||
                operation === 'delete') &&
              status === 409
            ? 'conflict'
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
        : kind === 'notFound' ||
            ((operation === 'detail' || operation === 'delete') &&
              kind === 'invalidRequest')
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

function isTag(value: unknown): value is TagResponse {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const tag = value as Record<string, unknown>;
  return (
    ['id', 'name', 'uid'].every(
      (key) => typeof tag[key] === 'string' && !!(tag[key] as string).trim(),
    ) &&
    (tag.status === 'ACTIVE' || tag.status === 'DELETED') &&
    typeof tag.assigned === 'boolean' &&
    (tag.asset_type === null || typeof tag.asset_type === 'string') &&
    hasTagReferences(tag)
  );
}

function hasTagReferences(details: Record<string, unknown>): boolean {
  const references = [
    'trolley_id',
    'station_id',
    'process_id',
    'machine_id',
    'storage_area_id',
    'storage_location_id',
  ] as const;
  return (
    references.every(
      (key) =>
        details[key] === null ||
        (typeof details[key] === 'string' && !!details[key].trim()),
    ) &&
    typeof details.version === 'number' &&
    Number.isSafeInteger(details.version) &&
    details.version >= 0
  );
}

export const isTagDetails = isTag;

export async function getTag(
  tagId: string,
  signal?: AbortSignal,
): Promise<TagDetailsResponse> {
  let response;
  try {
    response = await apiClient.get<unknown>(
      `nfc-tags/${encodeURIComponent(tagId)}`,
      {
        signal,
        timeout: 10000,
        validateStatus: () => true,
      },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new TagsError(
        parseTagsFailure(error.response.data, error.response.status, 'detail'),
      );
    throw new TagsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new TagsError(
      parseTagsFailure(response.data, response.status, 'detail'),
    );
  const data = response.data;
  if (!isTagDetails(data) || data.id.toLowerCase() !== tagId.toLowerCase())
    throw new TagsError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

export async function updateTag(
  tagId: string,
  body: UpdateTagRequest,
  signal?: AbortSignal,
): Promise<UpdateTagResponse> {
  let response;
  try {
    response = await apiClient.put<UpdateTagResponse>(
      `nfc-tags/${encodeURIComponent(tagId)}`,
      { name: body.name, uid: body.uid },
      { signal, timeout: 10000, validateStatus: () => true },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new TagsError(
        parseTagsFailure(error.response.data, error.response.status, 'update'),
      );
    throw new TagsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new TagsError(
      parseTagsFailure(response.data, response.status, 'update'),
    );
  if (
    !isTagDetails(response.data) ||
    response.data.id.toLowerCase() !== tagId.toLowerCase()
  )
    throw new TagsError({ kind: 'invalidResponse', action: 'retry' });
  return response.data;
}

export async function deleteTag(
  tagId: string,
  signal?: AbortSignal,
): Promise<DeleteTagResponse> {
  let response;
  try {
    response = await apiClient.delete<DeleteTagResponse>(
      `nfc-tags/${encodeURIComponent(tagId)}`,
      {
        signal,
        timeout: 10000,
        validateStatus: () => true,
      },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new TagsError(
        parseTagsFailure(error.response.data, error.response.status, 'delete'),
      );
    throw new TagsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new TagsError(
      parseTagsFailure(response.data, response.status, 'delete'),
    );
  const data = response.data;
  if (
    !isTagDetails(data) ||
    data.id.toLowerCase() !== tagId.toLowerCase() ||
    data.status !== 'DELETED' ||
    data.assigned !== false
  )
    throw new TagsError({ kind: 'invalidResponse', action: 'retry' });
  return data;
}

export async function createTag(
  body: CreateTagRequest,
  signal?: AbortSignal,
): Promise<CreateTagResponse> {
  let response;
  try {
    response = await apiClient.post<CreateTagResponse>(
      'nfc-tags',
      { name: body.name, uid: body.uid },
      { signal, timeout: 10000, validateStatus: () => true },
    );
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new TagsError(
        parseTagsFailure(error.response.data, error.response.status, 'create'),
      );
    throw new TagsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new TagsError(
      parseTagsFailure(response.data, response.status, 'create'),
    );
  if (!isTagDetails(response.data))
    throw new TagsError({ kind: 'invalidResponse', action: 'retry' });
  return response.data;
}

async function fetchTags(
  params?: PageQuery,
  signal?: AbortSignal,
): Promise<unknown> {
  let response;
  try {
    response = await apiClient.get<unknown>('nfc-tags', {
      params: { status: 'ACTIVE', ...params },
      signal,
      timeout: 10000,
      validateStatus: () => true,
    });
  } catch (error: unknown) {
    if (axios.isCancel(error)) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new TagsError(
        parseTagsFailure(error.response.data, error.response.status),
      );
    throw new TagsError({ kind: 'network', action: 'retry' });
  }
  if (response.status < 200 || response.status >= 300)
    throw new TagsError(parseTagsFailure(response.data, response.status));
  return response.data;
}

export async function getTagsPage(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ApiPage<TagResponse>> {
  return readApiPage(
    await fetchTags(query, signal),
    query,
    isTag,
    (item) => item.id,
    () => {
      throw new TagsError({ kind: 'invalidResponse', action: 'retry' });
    },
  );
}
