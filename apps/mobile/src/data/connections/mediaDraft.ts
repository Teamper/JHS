import { MediaConnectionValidationError, normalizeMediaConnection } from '@jhs/core';

export type MediaConnection = ReturnType<typeof normalizeMediaConnection>;
export type MediaDraft = Omit<MediaConnection, 'type'> & { type: 'emby' | 'jellyfin' };

export function validateMediaDraft(input: MediaDraft, previous?: MediaConnection) {
  const address = input.address.trim();
  if (!/^https:\/\//i.test(address)) throw new MediaConnectionValidationError('address', '请输入完整的 HTTPS 地址');
  // Validate the address before deciding whether a previously saved key may be reused.
  const parsed = normalizeMediaConnection({ ...input, address, apiKey: input.apiKey || 'validation' });
  const unchanged = previous?.address === parsed.address && previous.type === parsed.type && previous.userId === parsed.userId;
  return normalizeMediaConnection({ ...parsed, apiKey: input.apiKey.trim() || (unchanged ? previous.apiKey : '') });
}
