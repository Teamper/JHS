import { normalizeMovieCarNum } from '@jhs/core';
import type { MobileDatabase } from '../sqlite/MobileDatabase.ts';
import { magnetHash, receiptPrefix, v28ReceiptKey } from './receiptKeys.ts';

type ReceiptStore = Pick<Storage, 'getItem' | 'setItem'>;
type LegacyReceipt = { attemptId?: string; providerId?: string };

function readReceipt(raw: string): LegacyReceipt | null {
  try { return JSON.parse(raw); } catch { return null; }
}

export async function migrateV28Receipts(database: MobileDatabase, target: ReceiptStore) {
  const keys = (await database.keys()).filter(key => key.startsWith(receiptPrefix));
  if (!keys.length) return;

  const { offline_history: history, ...receipts } = await database.readAtomicSnapshot([...keys, 'offline_history']);
  const attempts = new Map(Array.isArray(history.value) ? history.value.map(row => [row?.id, row]) : []);
  const copied: typeof receipts = {};
  for (const [key, entry] of Object.entries(receipts)) {
    if (!entry.exists) continue;
    const raw = typeof entry.value === 'string' ? entry.value : JSON.stringify(entry.value);
    const receipt = readReceipt(raw);
    const attempt = receipt?.attemptId ? attempts.get(receipt.attemptId) : undefined;
    const existing = target.getItem(key);
    if (existing === null) {
      const resource = attempt?.resource;
      const carNum = normalizeMovieCarNum(attempt?.carNum);
      const matches = attempt && attempt.providerId === receipt?.providerId && carNum && typeof resource === 'string'
        && magnetHash(resource) && await v28ReceiptKey(resource) === key;
      if (target.getItem(key) !== null) continue;
      target.setItem(key, matches ? JSON.stringify({ ...receipt, resource, carNum }) : raw);
    } else if (existing !== raw) {
      // A resumed copy must keep a newer result. Leave a conflicting attempt in the source for a later run.
      const saved = readReceipt(existing);
      if (!receipt?.attemptId || receipt.attemptId !== saved?.attemptId || receipt.providerId !== saved?.providerId) continue;
    }
    copied[key] = entry;
  }
  const deletes = Object.keys(copied);
  if (deletes.length) await database.commitAtomicBatch({ expected: copied, puts: {}, deletes });
}
