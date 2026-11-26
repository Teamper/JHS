import { PORTABLE_DATA_KEYS, validatePortableData } from '@jhs/core';

export const migrationKey = 'jhs_mobile_storage_v1';
const localKeys = new Set([
  ...PORTABLE_DATA_KEYS, 'data_version', 'snapshots', 'data_health_warnings', 'mutation_journal', 'mutation_journal_conflicts',
  'jhs_webdav_sync_state_v1', 'jhs_webdav_sync_pending_v1', 'jhs_webdav_sync_journal_v1', 'jhs_webdav_auto_backup_state_v1',
]);

type SnapshotEntry = { exists: boolean; value?: unknown };
type MigrationStore = {
  keys(): Promise<string[]>;
  readAtomicSnapshot(keys: string[]): Promise<Record<string, SnapshotEntry>>;
  commitAtomicBatch(batch: { expected: Record<string, SnapshotEntry>; puts: Record<string, unknown> }): Promise<unknown>;
};

export async function applyLegacySnapshot(database: MigrationStore, text: string) {
  const snapshot = JSON.parse(text);
  if (snapshot?.schema !== 1 || snapshot.store !== 'JAV-JHS/appData' || !Array.isArray(snapshot.entries)) {
    throw new Error('旧片库副本的版本或存储标识无效。');
  }
  const values = new Map<string, unknown>();
  for (const entry of snapshot.entries) {
    if (!Array.isArray(entry) || entry.length !== 2 || typeof entry[0] !== 'string' || values.has(entry[0])
      || !(localKeys.has(entry[0]) || entry[0].startsWith('jhs_offline_receipt_v1:'))) throw new Error('旧片库副本包含无效的数据项。');
    values.set(entry[0], entry[1]);
  }
  if (values.size === 0) throw new Error('旧片库副本为空。');
  const puts = Object.fromEntries(values);
  validatePortableData(puts);

  const keys = [...new Set([...await database.keys(), migrationKey, ...values.keys()])];
  const expected = await database.readAtomicSnapshot(keys);
  if (expected[migrationKey]?.value === 'imported' || expected[migrationKey]?.value === 'active') return;
  if (Object.values(expected).some(entry => entry.exists)) throw new Error('已存在本机片库，请先导出备份再迁移。');
  await database.commitAtomicBatch({ expected, puts: { ...puts, data_version: puts.data_version ?? 0, [migrationKey]: 'imported' } });
}
