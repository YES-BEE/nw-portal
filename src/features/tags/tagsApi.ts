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
}

export interface CreateTagResponse extends TagResponse {
  trolley_id: string | null;
  station_id: string | null;
  process_id: string | null;
  machine_id: string | null;
  storage_area_id: string | null;
  storage_location_id: string | null;
  version: number;
}

// MasterDataController.TagCommand: name <= 150, uid <= 128, both required.
export interface CreateTagRequest {
  name: string;
  uid: string;
}
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
    | 'conflict';
  action: 'signIn' | 'retry' | 'none';
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
  operation: 'list' | 'create' = 'list',
): TagsFailure {
  const { problem, message } = readProblemDetails(body);
  const fields = problem?.fieldErrors;
  const validation =
    operation === 'create' &&
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
    operation === 'create' && status === 400
      ? validation
        ? 'validation'
        : 'invalidRequest'
      : operation === 'create' && status === 409
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
    (tag.asset_type === null || typeof tag.asset_type === 'string')
  );
}

export async function getTags(signal?: AbortSignal): Promise<TagResponse[]> {
  let response;
  try {
    response = await apiClient.get<unknown>('nfc-tags', {
      params: { status: 'ACTIVE' },
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
  const data = response.data;
  if (
    !Array.isArray(data) ||
    !data.every(isTag) ||
    new Set(data.map((tag) => tag.id)).size !== data.length
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
  return response.data;
}
