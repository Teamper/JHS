import { sha256 } from './AccountSessions.ts';

export const receiptPrefix = 'jhs_offline_receipt_v1:';

export async function v28ReceiptKey(resource: string) {
  return receiptPrefix + await sha256(resource.trim());
}

export function magnetHash(resource: string) {
  const hash = URL.canParse(resource) && new URL(resource).protocol === 'magnet:'
    ? new URL(resource).searchParams.getAll('xt').flatMap(xt => /^urn:btih:([a-f0-9]{40}|[a-z2-7]{32})$/i.exec(xt)?.[1] ?? []) : [];
  if (hash.length !== 1) return null;
  const value = hash[0].toLowerCase();
  if (value.length === 40) return value;
  let bits = 0, bucket = 0, hex = '';
  for (const character of value) {
    bucket = (bucket << 5) | 'abcdefghijklmnopqrstuvwxyz234567'.indexOf(character);
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      hex += ((bucket >> bits) & 255).toString(16).padStart(2, '0');
    }
  }
  return hex;
}
