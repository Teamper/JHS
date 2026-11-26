import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CURRENT_DATA_VERSION, LifecycleScope } from '@jhs/core';
import { initialSchema } from '../src/data/sqlite/schema.ts';
import { applyLegacySnapshot, migrationKey } from '../src/platform/migration/v28Migration.ts';
import { sampleLibrary, sampleMovies } from '../src/data/models/samples.ts';
import { createWorkspace, visibleWork } from '../src/data/workspace/createWorkspace.ts';
import { CatalogSource } from '../src/data/catalog/CatalogSource.ts';
import { scanFollow } from '../src/data/catalog/scanFollow.ts';
import { sqlite } from './sqlite.ts';

test('schema v1 upgrades in place and backfills every legacy work without changing portable values', async () => {
  const { db, store } = sqlite();
  try {
    db.exec(initialSchema + 'PRAGMA user_version = 1');
    const rows = [{ carNum: 'JHS-007', title: '京都の窓', custom: { kept: true } }, { carNum: 'JHS-002', remark: '海风笔记' }];
    const values = { car_list: [], jhs_privacy_enabled_v1: true, import_snapshot: { id: 'v1' } };
    for (const [key, value] of Object.entries(values)) db.prepare('INSERT INTO jhs_values VALUES (?, ?)').run(key, JSON.stringify(value));
    const insert = db.prepare('INSERT INTO works VALUES (?, ?, ?, ?, ?, ?, ?, ?)');
    insert.run(0, JSON.stringify(rows[0]), 'JHS-007', 'JHS-007', 'jhs-007\u001f京都の窓', null, null, 0);
    insert.run(1, JSON.stringify(rows[1]), 'JHS-002', 'JHS-002', 'jhs-002\u001f海风笔记', null, null, 0);
    const before = db.prepare('SELECT * FROM works ORDER BY position').all();
    await Promise.all([store.initialize(), store.initialize()]);
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 2);
    assert.deepEqual(db.prepare('SELECT * FROM works ORDER BY position').all(), before);
    assert.deepEqual(await store.getItem('car_list'), rows);
    assert.deepEqual(await store.getItem('import_snapshot'), values.import_snapshot);
    assert.equal(await store.getItem('jhs_privacy_enabled_v1'), true);
    assert.deepEqual((await store.queryMovies({ text: '京都の', flags: [], sort: 'code' })).items.map(row => row.carNum), ['JHS-007']);
    assert.deepEqual((await store.queryMovies({ text: '海风', flags: [], sort: 'code' })).items.map(row => row.carNum), ['JHS-002']);
  } finally { db.close(); }
});

test('SQLite preserves source row order and rejects failed or stale atomic writes', async () => {
  const { db, store } = sqlite();
  try {
    await store.initialize();
    const works = [{ carNum: 'JHS-008', names: '日本語の窓' }, { carNum: 'JHS-002', names: '沿河' }, { carNum: '未确认', url: 'https://example.invalid/legacy' }];
    await store.setItem('car_list', works);
    assert.deepEqual(await store.getItem('car_list'), works);
    const page = await store.queryMovies({ text: '日本語', flags: [], sort: 'code' });
    assert.deepEqual(page.items.map(row => row.carNum), ['JHS-008']);
    const expected = await store.readAtomicSnapshot(['car_list', 'activity_log']);
    await store.setItem('activity_log', { entries: [] });
    await assert.rejects(store.commitAtomicBatch({ expected, puts: { car_list: [] } }), /片库已更新/);
    await assert.rejects(store.commitLockedBatch({ puts: { car_list: [], invalid: undefined } }), /JSON/);
    assert.deepEqual(await store.getItem('car_list'), works);
    assert.deepEqual(await store.getItem('activity_log'), { entries: [] });
  } finally { db.close(); }
});

test('a database from a newer app version is rejected before changing its contents', async () => {
  const { db, store } = sqlite();
  try {
    db.exec(initialSchema + 'PRAGMA user_version = 3');
    db.prepare('INSERT INTO jhs_values VALUES (?, ?)').run('sentinel', 'true');
    await assert.rejects(store.initialize(), /较新的 JHS/);
    assert.equal(db.prepare('PRAGMA user_version').get()!.user_version, 3);
    assert.equal(db.prepare('SELECT value FROM jhs_values WHERE key = ?').get('sentinel')!.value, 'true');
  } finally { db.close(); }
});

test('shared state, backup import and export round-trip through mobile storage', async () => {
  const { db, store } = sqlite();
  try {
    const workspace = await createWorkspace(store, true);
    const movie = sampleMovies[0]!;
    const watched = (await workspace.state.getState(movie.carNum)).stateFlags.watched;
    const count = (await workspace.queue()).filter(row => row.status === 'pending').length;
    const update = await workspace.toggle(movie, 'watched');
    assert.ok(update.transactionId);
    assert.equal((await workspace.state.getState(movie.carNum)).stateFlags.watched, !watched);
    assert.equal((await workspace.queue()).filter(row => row.status === 'pending').length, count);
    assert.ok((await workspace.state.undoTransaction(update.transactionId)).reverted.length);
    assert.equal((await workspace.state.getState(movie.carNum)).stateFlags.watched, watched);
    const remark = await workspace.saveRemark(movie, '试记');
    assert.ok(remark.transactionId);
    assert.equal((await workspace.state.getState(movie.carNum)).remark, '试记');
    const exported = JSON.parse(await workspace.backup());
    assert.equal(exported.data_version, CURRENT_DATA_VERSION);
    await assert.rejects(workspace.previewBackup(JSON.stringify({ ...exported, data_version: CURRENT_DATA_VERSION + 1 })));
    const old = await workspace.previewBackup(JSON.stringify({ data_version: 1, car_list: [{ carNum: 'JHS-002', names: '旧片库', status: 'favorite' }] }));
    await workspace.restoreBackup(old.incoming);
    assert.equal((await workspace.state.getState('JHS-002')).stateFlags.favorite, true);
    assert.ok((await workspace.backupService.getSnapshotList()).length);
    await workspace.restoreBackup(exported);
    assert.equal((await workspace.state.getState(movie.carNum)).remark, '试记');
  } finally { db.close(); }
});

test('collections compose with flags and search, and a batched removal is one editable undo', async () => {
  const { db, store } = sqlite();
  try {
    const workspace = await createWorkspace(store, true);
    const targets = [sampleMovies[0]!, sampleMovies[3]!];
    await workspace.mark(targets, 'favorite', true);
    const added = await workspace.changeCollection(targets, 'empty', true);
    assert.equal(added.changed.length, 2);
    const filter = { text: '', flags: ['favorite'] as const, sort: 'code' as const, collection: 'empty', includeCount: true };
    const list = () => store.queryMovies({ ...filter, flags: [...filter.flags] });
    assert.equal((await list()).count, 2);
    const moved = await workspace.changeCollection(targets, 'empty', false);
    assert.equal((await list()).count, 0);
    await workspace.saveRemark(targets[0], '后来添加的备注');
    assert.equal((await workspace.state.undoTransaction(moved.transactionId!)).reverted.length, 2);
    assert.equal((await list()).count, 2);
    assert.equal((await store.queryMovies({ ...filter, flags: [...filter.flags], text: '后来添加的备注' })).items[0]?.carNum, targets[0].carNum);
    const removed = await workspace.removeWorks(targets);
    assert.equal((await list()).count, 0);
    assert.equal((await workspace.state.undoTransaction(removed.transactionId!)).reverted.length, 2);
    assert.equal((await list()).count, 2);
  } finally { db.close(); }
});

test('an unavailable actor leaves queued works intact while other scans commit and abort stops late reads', async () => {
  const { db, store } = sqlite();
  const scope = new LifecycleScope('test-follow');
  try {
    await store.initialize();
    await store.setItem('favorite_actresses', [
      { starId: 'unavailable', name: '旧演员', newVideoList: [{ carNum: 'ABC-111', title: '保留节目' }] },
      { starId: 'current', name: '新演员', newVideoList: [{ carNum: 'ABC-222', title: '已有节目' }] },
    ]);
    const workspace = await createWorkspace(store, false);
    const catalog = new CatalogSource({ async request({ url }) {
      const id = new URL(url).pathname.split('/').at(-1);
      assert.equal(new URL(url).searchParams.get('t'), 'd');
      return { finalUrl: url, status: id === 'unavailable' ? 404 : 200,
        data: '<div class="movie-list"><a href="/v/new"><div class="video-title"><strong>ABC-999</strong> 新作</div></a></div>' };
    } });
    const result = await scanFollow(workspace, catalog, scope, true);
    assert.equal(result.unavailable, 1);
    const healthKey = 'jhs_new_video_source_health_v1';
    const health = JSON.parse(String(await store.getItem(healthKey)));
    assert.equal(health.entries['https://javdb.com/actors/unavailable'].code, 'NOT_FOUND');
    assert.ok(health.entries['https://javdb.com/actors/unavailable'].retryAt > Date.now());
    assert.equal(Object.hasOwn(JSON.parse(await workspace.backup()), healthKey), false);
    const freshScope = new LifecycleScope('test-follow-reopened');
    try {
      const reopened = await scanFollow({ ...workspace }, new CatalogSource({
        async request() { assert.fail('Persisted failures and fresh scans should be deferred.'); },
      }), freshScope, false);
      assert.equal(reopened.skippedUnavailable, 1);
    } finally { freshScope.dispose(); }
    const failure = result.failures.find(item => item.id === 'current')?.error;
    assert.equal(result.success, 1, failure instanceof Error ? failure.stack : undefined);
    const queue = await workspace.queue();
    assert.deepEqual(queue.map(item => item.movie.carNum).sort(), ['ABC-111', 'ABC-222', 'ABC-999']);
    scope.dispose();
    await assert.rejects(scanFollow(workspace, catalog, scope, true));

    const pending = new LifecycleScope('test-follow-pending');
    const entered = Promise.withResolvers<void>();
    const unblock = Promise.withResolvers<void>();
    const late = new CatalogSource({ async request({ url }) {
      entered.resolve();
      await unblock.promise;
      return { finalUrl: url, status: 200, data: '<div class="movie-list"><a href="/v/late"><div class="video-title"><strong>ABC-777</strong> 迟到</div></a></div>' };
    } });
    const aborted = assert.rejects(scanFollow(workspace, late, pending, true));
    await entered.promise;
    pending.dispose();
    unblock.resolve();
    await aborted;
    assert.deepEqual(await workspace.queue(), queue);

    const held = Promise.withResolvers<void>();
    const release = Promise.withResolvers<void>();
    const barrier = workspace.coordinator.runExclusive(async () => { held.resolve(); await release.promise; });
    await held.promise;
    const writing = new AbortController();
    const write = assert.rejects(workspace.state.updateFavoriteActress({ starId: 'current', newVideoList: [] },
      { scan: true, signal: writing.signal }), { name: 'AbortError' });
    writing.abort();
    release.resolve();
    await Promise.all([barrier, write]);
    assert.deepEqual(await workspace.queue(), queue);
  } finally { scope.dispose(); db.close(); }
});

test('continue browsing re-evaluates the rule domains without deleting its history', async () => {
  const { db, store } = sqlite();
  try {
    const workspace = await createWorkspace(store, true);
    const title = sampleMovies[0]!, other = sampleMovies[3]!;
    await workspace.visit(title);
    await workspace.visit(other);
    await workspace.toggle(title, 'blocked');
    const afterBlock = await workspace.visibility();
    assert.deepEqual((await workspace.recent()).filter(movie => visibleWork(afterBlock, movie)).map(movie => movie.carNum), [other.carNum]);
    await workspace.toggle(title, 'blocked');
    const afterRestore = await workspace.visibility();
    assert.equal((await workspace.recent()).filter(movie => visibleWork(afterRestore, movie)).length, 2);
    await store.setItem('filter_keyword_title', ['走进']);
    await store.setItem('blacklist', [{ starId: 'sample-1', name: '另一个显示名' }]);
    const afterRules = await workspace.visibility();
    assert.equal((await workspace.recent()).filter(movie => visibleWork(afterRules, movie)).length, 0);
    assert.equal((await workspace.recent()).length, 2);
  } finally { db.close(); }
});

test('undoing a follow decision publishes a follow change with the restored queue', async () => {
  const { db, store } = sqlite();
  try {
    const workspace = await createWorkspace(store, true);
    const movie = sampleMovies[0]!;
    const snooze = await workspace.decide(movie, 'snoozed');
    const observed: string[] = [];
    const remove = workspace.events.subscribe(event => observed.push(event.domain));
    await workspace.state.undoTransaction(snooze.transactionId!);
    assert.ok(observed.includes('follow'));
    assert.equal((await workspace.queue()).find(item => item.movie.carNum === movie.carNum)?.status, 'pending');
    remove();
  } finally { db.close(); }
});

test('10,000 works support indexed search and one-row state mutations', async t => {
  const { db, store, statements } = sqlite();
  try {
    await store.initialize();
    const works = sampleLibrary(10_000);
    works[2049] = { ...works[2049], title: '海边雾汀', names: '新しい窓' };
    await store.commitLockedBatch({ puts: { car_list: works, data_version: CURRENT_DATA_VERSION } });
    const workspace = await createWorkspace(store, false);
    const first = await store.queryMovies({ text: '', sort: 'updated', flags: [] });
    assert.equal(first.items.length, 40);
    assert.equal(first.next, 40);
    for (const [text, indexed] of [['JHS-2050', true], ['海边雾汀', true], ['新しい窓', true], ['雾汀', false]] as const) {
      const durations: number[] = [];
      statements.length = 0;
      for (let i = 0; i < 30; i++) {
        const start = performance.now();
        const result = await store.queryMovies({ text, sort: 'code', flags: [] });
        durations.push(performance.now() - start);
        assert.equal(result.items[0]?.carNum, 'JHS-2050');
      }
      assert.equal(statements[0]?.includes('works_fts MATCH'), indexed);
      assert.equal(statements[0]?.includes('instr(search'), !indexed);
      reportLatency(t, text + ' search', durations);
    }
    const movie = (await store.queryMovies({ text: 'JHS-2050', sort: 'code', flags: [] })).items[0]!;
    const beforeFlags = (await workspace.state.getState(movie.carNum)).stateFlags;
    const untargeted = db.prepare('SELECT value FROM works WHERE position = 40').get();
    statements.length = 0;
    const updates: number[] = [];
    for (let i = 0; i < 30; i++) {
      const start = performance.now();
      assert.ok((await workspace.saveRemark(movie, `局部写入第${i}次`)).transactionId);
      updates.push(performance.now() - start);
    }
    assert.equal(statements.filter(sql => sql.startsWith('UPDATE works SET')).length, 30);
    reportLatency(t, 'single-work remark', updates);
    const [left, right] = await Promise.all([workspace.toggle(movie, 'favorite'), workspace.toggle(movie, 'favorite')]);
    assert.notEqual(left.transactionId, right.transactionId);
    assert.equal((await workspace.state.getState(movie.carNum)).stateFlags.favorite, beforeFlags.favorite);
    assert.deepEqual((await workspace.state.undoTransaction(right.transactionId)).reverted, [movie.carNum]);
    assert.equal((await workspace.state.getState(movie.carNum)).stateFlags.favorite, !beforeFlags.favorite);
    assert.ok(statements.every(sql => !sql.includes('SELECT value FROM works ORDER BY position') && !sql.includes('FROM json_each(?) WHERE true')));
    assert.deepEqual(db.prepare('SELECT value FROM works WHERE position = 40').get(), untargeted);

    db.exec(`CREATE TRIGGER reject_history BEFORE INSERT ON jhs_values WHEN new.key = 'activity_log' BEGIN SELECT RAISE(ABORT, 'history write failed'); END;`);
    const seen: string[] = [];
    const unsubscribe = workspace.events.subscribe(event => seen.push(event.domain));
    await assert.rejects(workspace.saveRemark(movie, '事务失败文本'), /history write failed/);
    assert.deepEqual(seen, []);
    unsubscribe();
    assert.equal((await workspace.state.getState(movie.carNum)).remark, '局部写入第29次');
    assert.equal((await store.queryMovies({ text: '事务失败文本', flags: [], sort: 'code' })).items.length, 0);
    assert.equal((await store.queryMovies({ text: '局部写入第29次', flags: [], sort: 'code' })).items[0]?.carNum, 'JHS-2050');
  } finally { db.close(); }
});

function reportLatency(test: { diagnostic: (text: string) => void }, label: string, durations: number[]) {
  durations.sort((a, b) => a - b);
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1]!;
  test.diagnostic(`${label} n=${durations.length}, P95=${p95.toFixed(2)} ms`);
  assert.ok(p95 < 100, `${label}: ${p95.toFixed(2)} ms`);
}

test('V28 snapshot staging preserves replica identity and blocklists and is safe to resume', async () => {
  const { db, store } = sqlite();
  try {
    await store.initialize();
    const key = 'jhs_offline_receipt_v1:sample';
    const replica = { replicaId: 'existing-replica', clock: 91, pending: { name: 'awaiting-confirmation.json' } };
    const values = { data_version: CURRENT_DATA_VERSION, car_list: [{ carNum: 'JHS-022', remark: '已存旧记录' }],
      jhs_webdav_sync_state_v1: replica, blacklist: [{ starId: 'one' }], [key]: { state: 'pending' } };
    const snapshot = JSON.stringify({ schema: 1, store: 'JAV-JHS/appData', entries: Object.entries(values) });
    await assert.rejects(applyLegacySnapshot(store, JSON.stringify({ schema: 1, store: 'JAV-JHS/appData',
      entries: [['data_version', CURRENT_DATA_VERSION + 1]] })));
    assert.deepEqual(await store.keys(), []);
    await applyLegacySnapshot(store, snapshot);
    assert.equal(await store.getItem(migrationKey), 'imported');
    assert.deepEqual(await store.getItem('jhs_webdav_sync_state_v1'), replica);
    assert.deepEqual(await store.getItem(key), values[key]);
    await store.setItem('blacklist', [{ starId: 'later' }]);
    await applyLegacySnapshot(store, snapshot);
    assert.deepEqual(await store.getItem('blacklist'), [{ starId: 'later' }]);
  } finally { db.close(); }
});
