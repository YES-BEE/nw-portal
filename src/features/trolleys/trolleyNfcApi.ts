import axios, { type AxiosResponse } from 'axios';
import { apiClient } from '../../api/client';
import { collectApiItems } from '../../api/collections';
import {
  isTagDetails,
  parseTagsFailure,
  TagsError,
  type TagDetailsResponse,
} from '../tags/tagsApi';

// AssetAdministrationController.NfcReassignment and Reason.
export interface TrolleyNfcAssignmentRequest {
  assetType: 'TROLLEY';
  assetId: string;
  reason: string;
}
export interface NfcUnassignmentRequest {
  reason: string;
}
export type NfcAssignmentResponse = TagDetailsResponse;
// DELETE /nfc-assignments/{tagId} returns an empty success body.
export type NfcUnassignmentResponse = void;

const invalid = (): never => {
  throw new TagsError({ kind: 'invalidResponse', action: 'retry' });
};
async function request(
  send: () => Promise<AxiosResponse<unknown>>,
): Promise<unknown> {
  try {
    const response = await send();
    if (response.status < 200 || response.status >= 300)
      throw new TagsError(
        parseTagsFailure(response.data, response.status, 'update'),
      );
    return response.data;
  } catch (error: unknown) {
    if (axios.isCancel(error) || error instanceof TagsError) throw error;
    if (axios.isAxiosError(error) && error.response)
      throw new TagsError(
        parseTagsFailure(error.response.data, error.response.status, 'update'),
      );
    throw new TagsError({ kind: 'network', action: 'retry' });
  }
}
const options = (signal?: AbortSignal) => ({
  signal,
  timeout: 10000,
  validateStatus: () => true,
});

export async function getTrolleyNfcTags(
  signal?: AbortSignal,
): Promise<TagDetailsResponse[]> {
  // The backend has no asset-id filter. Its list projection includes all asset references.
  return collectApiItems(
    (page) =>
      request(() =>
        apiClient.get<unknown>('nfc-tags', {
          ...options(signal),
          params: { status: 'ACTIVE', ...page },
        }),
      ),
    isTagDetails,
    (tag) => tag.id,
    invalid,
  );
}
export async function assignTrolleyNfcTag(
  tagId: string,
  body: TrolleyNfcAssignmentRequest,
  signal?: AbortSignal,
): Promise<NfcAssignmentResponse> {
  const data = await request(() =>
    apiClient.put<unknown>(
      `nfc-assignments/${encodeURIComponent(tagId)}`,
      body,
      options(signal),
    ),
  );
  if (
    !isTagDetails(data) ||
    data.id !== tagId ||
    !data.assigned ||
    data.asset_type !== 'TROLLEY' ||
    data.trolley_id !== body.assetId
  )
    return invalid();
  return data;
}
export async function unassignTrolleyNfcTag(
  tagId: string,
  body: NfcUnassignmentRequest,
  signal?: AbortSignal,
): Promise<NfcUnassignmentResponse> {
  await request(() =>
    apiClient.delete<unknown>(`nfc-assignments/${encodeURIComponent(tagId)}`, {
      ...options(signal),
      data: body,
    }),
  );
}
