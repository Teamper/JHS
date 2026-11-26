import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { test } from 'node:test';
import { QueryClient } from '@tanstack/react-query';
import { load } from 'cheerio/slim';
import { CURRENT_DATA_VERSION, CredentialService, DependencyContainer, DiagnosticsService, ExternalUrlPolicy, HttpService, IntegrationRegistry, JhsError, JavDbListService,
  LifecycleScope, OfflineService, ProviderRegistry, SERVICE, one115, pan123, type StateService } from '@jhs/core';
import { cheerioDocument, createJavDbWebLists, parseJavDbListPage, parseJavDbWebAccount, saveWebReview } from '@jhs/parsers';
import { AccountSessions, accountBinding } from '../src/data/connections/AccountSessions.ts';
import { CloudOperations, type CloudSite } from '../src/data/connections/CloudOperations.ts';
import { validateMediaDraft } from '../src/data/connections/mediaDraft.ts';
import { indexKeychainRevisions } from '../src/data/connections/keychainIndex.ts';
import { migrateV28Receipts } from '../src/data/connections/migrateV28Receipts.ts';
import { CatalogSource } from '../src/data/catalog/CatalogSource.ts';
import { refreshJavDbCatalog } from '../src/data/queries/refreshJavDbCatalog.ts';
import { createWorkspace } from '../src/data/workspace/createWorkspace.ts';
import { requestSession } from '../src/platform/http/sessionHttp.ts';
import { applyLegacySnapshot } from '../src/platform/migration/v28Migration.ts';
import type { SessionNative } from '../src/platform/session/types.ts';
import { sqlite } from './sqlite.ts';

const site = 'https://javdb.com';
const documentFrom = (text: string, url: string) => cheerioDocument(load(text), url);
const fixture = (path: string) => readFileSync(new URL('../../../tests/fixtures/' + path, import.meta.url), 'utf8');
const ready = { async save() {}, async clear() {} };
const native: SessionNative = {
  async available() { return true; },
  async setPrivacy() {},
  async openLogin() { return { completed: true }; },
  async request() { throw new Error('unexpected native request'); },
  async cancel() {},
  async clearSession() {},
};

test('session HTTP cancels the native request and refuses a late response', async () => {
  const gate = Promise.withResolvers<{ status: number; url: string; headers: string; body: string }>();
  const entered = Promise.withResolvers<string>();
  const canceled: string[] = [];
  const controller = new AbortController();
  const url = site + '/users/profile';
  const bridge = { ...native,
    async request(options: Parameters<SessionNative['request']>[0]) {
      assert.equal(options.session, 'javdb');
      assert.equal(options.timeout, 12000);
      entered.resolve(options.requestId);
      return gate.promise;
    },
    async cancel(requestId: string) { canceled.push(requestId); },
  };
  const request = requestSession(bridge, { session: 'javdb', url, signal: controller.signal });
  const id = await entered.promise;
  controller.abort();
  gate.resolve({ status: 200, url, headers: '', body: 'late' });
  await assert.rejects(request, { name: 'AbortError' });
  assert.deepEqual(canceled, [id]);
  const redirect = { ...native, async request() { return { status: 302, url, headers: 'Location: /login\n', body: '' }; } };
  await assert.rejects(requestSession(redirect, { session: 'javdb', url }), { code: 'AUTH_REQUIRED' });
  assert.equal((await requestSession(redirect, { session: 'javdb', url, requestOptions: { redirect: 'manual' } })).status, 302);
});

test('account switch cancels only the retired site and rejects old results', async () => {
  let binding = 'old';
  const changes: string[] = [];
  const gate = Promise.withResolvers<void>();
  const bridge = { ...native, async openLogin() { await gate.promise; binding = 'new'; return { completed: true }; } };
  const accounts = new AccountSessions(bridge, true, async () => ({ binding, label: binding }), ready, async () => {}, site => changes.push(site));
  await accounts.check('javdb');
  let own!: AbortSignal;
  const response = Promise.withResolvers<number>();
  const old = accounts.run('javdb', undefined, scope => { own = scope.signal; return response.promise; });
  const other = accounts.run('one115', undefined, async scope => { await gate.promise; assert.equal(scope.signal.aborted, false); return 'kept'; });
  const login = accounts.login('javdb');
  assert.equal(own.aborted, true);
  await assert.rejects(accounts.run('javdb', undefined, async () => 'blocked'), { code: 'ABORTED' });
  gate.resolve();
  assert.equal((await login)?.binding, 'new');
  assert.equal(await other, 'kept');
  response.resolve(123);
  await assert.rejects(old, { name: 'AbortError' });
  assert.deepEqual(changes, ['javdb']);
});

test('canceling 123 re-login preserves the original credential and account', async () => {
  let token = 'original-fixture';
  let completed = false;
  const bridge = { ...native, async openLogin() {
    assert.equal(token, 'original-fixture');
    return { completed, token: 'replacement-fixture' };
  } };
  const credential = { async save(value: string) { token = value; }, async clear() { token = ''; } };
  const accounts = new AccountSessions(bridge, true,
    async () => token ? { binding: await accountBinding('pan123', token), label: 'fixture' } : null,
    credential, async () => {}, () => {});
  const before = await accounts.check('pan123');
  assert.ok(before);
  assert.deepEqual(await accounts.login('pan123'), before);
  assert.equal(token, 'original-fixture');
  completed = true;
  assert.notEqual((await accounts.login('pan123'))?.binding, before.binding);
  assert.equal(token, 'replacement-fixture');
});

test('the first JavDB login resets auth errors and keeps loaded public pages for the retry', async () => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const needsLogin = ['catalog', 'list', { source: 'javdb', section: 'ranking' }] as const;
  const loaded = ['catalog', 'list', { source: 'fc2', section: 'latest' }] as const;
  const javbus = ['catalog', 'detail', 'javbus', 'fixture'] as const;
  const retained = { pages: [{ next: 2 }], pageParams: [1] };
  let loggedIn = false;
  const bridge = { ...native, async openLogin() { loggedIn = true; return { completed: true }; } };
  let refresh: Promise<void> | undefined;
  const accounts = new AccountSessions(bridge, true, async () => loggedIn ? { binding: 'signed-in', label: 'fixture' } : null,
    ready, async () => {}, (site, previous) => { if (site === 'javdb') refresh = refreshJavDbCatalog(client, previous === null); });
  const options = { queryKey: needsLogin, async queryFn() {
    if (!loggedIn) throw new JhsError('AUTH_REQUIRED', 'Sign in first');
    return retained;
  } };
  client.setQueryData(loaded, retained);
  client.setQueryData(javbus, 'public-detail');
  await assert.rejects(client.fetchQuery(options), { code: 'AUTH_REQUIRED' });
  assert.equal(await accounts.check('javdb'), null);
  await accounts.login('javdb');
  assert.ok(refresh);
  await refresh;
  assert.equal(client.getQueryState(needsLogin)?.error, null);
  assert.equal(client.getQueryState(needsLogin)?.status, 'pending');
  assert.equal(client.getQueryState(loaded)?.isInvalidated, true);
  assert.deepEqual(client.getQueryData(loaded), retained);
  assert.equal(client.getQueryState(javbus)?.isInvalidated, false);
  assert.deepEqual(await client.fetchQuery(options), retained);
  client.clear();
});

test('an authenticated retry continues the same catalog page with the public first page preserved', async () => {
  let active = false;
  const accounts = new AccountSessions({ ...native, async openLogin() { active = true; return { completed: true }; } }, true,
    async () => active ? { binding: 'account', label: '样片' } : null, ready, async () => {}, () => {});
  const attempts: [number, string | undefined][] = [];
  const catalog = new CatalogSource({ async request({ url, session }) {
    const page = Number(new URL(url).searchParams.get('page') ?? 1);
    attempts.push([page, session]);
    if (page === 2 && !session) return { status: 302, finalUrl: url, responseHeaders: 'Location: /login\n', data: '' };
    const data = `<div class="movie-list"><a class="box" href="/v/result-${page}"><div class="video-title"><strong>JHS-00${page}</strong>样片</div></a></div><a class="pagination-next" href="?page=${page + 1}">more</a>`;
    return { status: 200, finalUrl: url, data };
  } }, accounts);
  const query = { source: 'javdb', section: 'latest', text: '' } as const;
  const signal = new AbortController().signal;
  const first = await catalog.list(query, signal);
  assert.equal(first.next, 2);
  await assert.rejects(catalog.list({ ...query, page: first.next! }, signal), { code: 'AUTH_REQUIRED' });
  await accounts.login('javdb');
  const second = await catalog.list({ ...query, page: first.next! }, signal);
  assert.deepEqual([...first.items, ...second.items].map(item => item.carNum), ['JHS-001', 'JHS-002']);
  assert.deepEqual(attempts, [[1, undefined], [2, undefined], [2, undefined], [2, 'javdb']]);
});

test('JavDB lists read and verify through Cheerio with no DOMParser global', async () => {
  assert.equal(globalThis.DOMParser, undefined);
  const accountHtml = fixture('integrations/javdb/web-account.html');
  const rows = fixture('integrations/javdb/web-lists.html');
  assert.equal(parseJavDbWebAccount(accountHtml, site, documentFrom)?.identity, 'id:fixture-user-17');
  assert.deepEqual(parseJavDbListPage({ lists: rows }, site + '/users/simple_lists', null, documentFrom).lists[1],
    { id: 'list-2', name: '私人 <清单>', count: 3, checked: false, disabled: false });
  let checked = false, submissions = 0;
  const adapter = createJavDbWebLists({ async request(options) {
    const path = new URL(options.url).pathname;
    if (path === '/users/profile') return { status: 200, data: accountHtml };
    if (path === '/users/simple_lists') return { status: 200, data: { lists: rows.replace('data-list-id="list-2"', 'data-list-id="list-2"' + (checked ? ' checked' : '')) } };
    submissions++;
    checked = true;
    throw new JhsError('TIMEOUT', 'response lost after applying the change');
  } }, documentFrom);
  const stored = new Map<string, unknown>();
  const lists = new JavDbListService({ integrations: { getAdapter: () => adapter },
    context: () => ({ origin: site, accountUrl: site + '/users/profile' }),
    storage: { get: (key: string) => stored.get(key), set: (key: string, value: unknown) => stored.set(key, structuredClone(value)), keys: () => [...stored.keys()] },
    locks: { request: (_name: string, options: unknown, run?: (lock: object) => unknown) => (run ?? options as (lock: object) => unknown)({}) },
  });
  const access = await lists.access();
  const entries = await lists.directory(access, 'video-1');
  const task = await lists.createTask({ movies: [{ url: site + '/v/video-1', carNum: 'JHS-001' }],
    lists: [entries[1]], checked: true, expectedAccount: access.account!.fingerprint });
  assert.equal((await lists.resume(task.id)).counts.success, 1);
  assert.equal((await lists.resume(task.id)).counts.success, 1);
  assert.equal(submissions, 1);
});

test('JavDB review reads back ambiguous submission and never posts for a changed account', async () => {
  const scope = new LifecycleScope('review-fixture');
  let selected = false, sends = 0, checks = 0, switching = false;
  const app = { services: {
    javdbLists: { access: async () => ({ account: { fingerprint: switching && checks++ > 0 ? 'B' : 'A' } }) },
    http: { async request(options: Record<string, any>) {
      if (options.method === 'POST') {
        options.onDispatch();
        selected = true;
        sends++;
        throw new JhsError('TIMEOUT', 'response lost');
      }
      return { status: 200, finalUrl: options.url, data: `<meta name="csrf-token" content="fixture"><div class="review-buttons">
        <form method="POST" action="/v/video-1/reviews/want_to_watch"><button aria-pressed="${selected}">想看</button></form></div>` };
    } },
  } };
  try {
    assert.equal(await saveWebReview('video-1', 'want', 0, app, scope, documentFrom), 'JavDB 想看已更新');
    assert.equal(await saveWebReview('video-1', 'want', 0, app, scope, documentFrom), '已在 JavDB 想看清单');
    selected = false;
    switching = true;
    await assert.rejects(saveWebReview('video-1', 'want', 0, app, scope, documentFrom), /账号已变化/);
    assert.equal(sends, 1);
  } finally { scope.dispose(); }
});

test('JavDB watched uses the advertised score form and an existing edit form prevents a second write', async () => {
  const scope = new LifecycleScope('watched-fixture');
  const action = '/v/video-1/reviews';
  let updated = false, submissions = 0;
  const app = { services: {
    javdbLists: { access: async () => ({ account: { fingerprint: 'sample' } }) },
    http: { async request(options: Record<string, any>) {
      if (options.method === 'POST') {
        assert.equal(options.url, site + action);
        assert.equal(new URLSearchParams(options.body).get('video_review[score]'), '4');
        assert.equal(options.retryCount, 0);
        submissions++;
        updated = true;
        return { status: 302, finalUrl: options.url };
      }
      const data = updated ? `<div class="review-buttons"><div class="review-title"><a href="/users/watched_videos">看过</a></div></div>
          <form id="edit_review" method="post" action="${action}/record-1"><input name="video_review[status]" value="watched" checked></form>`
        : `<form id="new_review" method="post" action="${action}"><input name="authenticity_token" value="sample">
          <input name="video_review[status]" value="watched"></form>`;
      return { status: 200, finalUrl: options.url, data };
    } },
  } };
  try {
    assert.equal(await saveWebReview('video-1', 'watched', 4, app, scope, documentFrom), 'JavDB 看过已更新');
    assert.equal(await saveWebReview('video-1', 'watched', 4, app, scope, documentFrom), '已在 JavDB 标记看过');
    assert.equal(submissions, 1);
  } finally { scope.dispose(); }
});

for (const provider of ['one115', 'pan123'] as const) {
  test(`${provider}: ambiguous offline receipt is retained, account-bound, and verified once`, async () => {
    const hash = '0123456789012345678901234567890123456789';
    const resource = 'magnet:?xt=urn:btih:' + hash;
    let uid = '173', token = 'fixture-only', dispatched = 0, evidence = false;
    const store = new Map<string, string>();
    const history = new Map<string, any>();
    const diagnostics = new DiagnosticsService(), container = new DependencyContainer(diagnostics);
    const http = new HttpService({ async request(options) {
      const url = new URL(options.url);
      const json = (data: unknown) => ({ status: 200, finalUrl: url.href, data });
      if (url.searchParams.get('ac') === 'space') return json({ sign: 'fixture-sign', uid });
      if (url.searchParams.get('ac') === 'task_lists') return json(evidence ? JSON.parse(fixture('one115-offline-tasks.json')) : { state: true, tasks: [] });
      if (url.pathname.endsWith('/task/resolve')) return json({ code: 0, data: { list: [{ id: 'fixture-resource-id', files: [{ id: 'file-1', size: 20 }] }] } });
      if (url.pathname.endsWith('/task/list')) {
        const payload = JSON.parse(fixture('pan123-offline-tasks.json'));
        if (evidence) payload.data.list[0].resource_id = 'fixture-resource-id';
        return json(payload);
      }
      options.onDispatch();
      dispatched++;
      throw new JhsError('TIMEOUT', 'response lost');
    } }, new ExternalUrlPolicy());
    container.register(SERVICE.http, http);
    container.register(SERVICE.settings, { snapshot: () => ({}) });
    const integrations = new IntegrationRegistry(container, diagnostics);
    integrations.register(one115);
    integrations.register(pan123);
    const offline = new OfflineService(new ProviderRegistry(), integrations);
    const accounts = new AccountSessions(native, true, async (site: CloudSite) =>
      ({ binding: await accountBinding(site, site === 'one115' ? uid : token), label: 'fixture' }), ready, async () => {}, () => {});
    const state = {
      async appendOfflineHistory(row: any) { history.set(row.id, row); },
      async confirmOfflineSubmission({ attemptId }: { attemptId: string }) {
        const row = history.get(attemptId);
        if (!row || row.submissionOutcome !== 'unknown') return false;
        row.submissionOutcome = 'exists';
        return true;
      },
    } as unknown as StateService;
    const makeCloud = () => new CloudOperations(accounts, offline, state, async () => token, {
      get length() { return store.size; }, key: index => [...store.keys()][index] ?? null,
      getItem: key => store.get(key) ?? null, setItem: (key, value) => { store.set(key, value); },
      removeItem: key => { store.delete(key); },
    }, () => true);
    await accounts.check(provider);
    let cloud = makeCloud();
    assert.equal(await cloud.submit(provider, resource, 'JHS-001'), 'pending');
    assert.equal(await cloud.submit(provider, resource, 'JHS-001'), 'pending');
    assert.equal(dispatched, 1);
    cloud = makeCloud();
    const receipt = cloud.pending()[0];
    assert.ok(receipt);
    assert.equal(await cloud.verify(receipt), false);
    const original = { uid, token };
    uid = '285'; token = 'changed-fixture';
    await accounts.check(provider);
    assert.deepEqual(cloud.pending(), []);
    await assert.rejects(cloud.verify(receipt), { code: 'AUTH_REQUIRED' });
    ({ uid, token } = original);
    await accounts.check(provider);
    evidence = true;
    assert.equal(await cloud.verify(receipt), true);
    assert.equal(history.get(receipt.attemptId).submissionOutcome, 'exists');
    assert.deepEqual(cloud.pending(), []);
    assert.equal(dispatched, 1);
  });
}

test('V28 receipts move from the legacy snapshot into local SQLite and verify on the original account', async t => {
  const main = sqlite();
  const target = new DatabaseSync(':memory:');
  t.after(() => { main.db.close(); target.close(); });
  target.exec('CREATE TABLE receipts (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
  const storage = {
    get length() { return Number(target.prepare('SELECT count(*) AS count FROM receipts').get()!.count); },
    key: (index: number) => target.prepare('SELECT key FROM receipts ORDER BY key LIMIT 1 OFFSET ?').get(index)?.key as string ?? null,
    getItem: (key: string) => target.prepare('SELECT value FROM receipts WHERE key = ?').get(key)?.value as string ?? null,
    setItem: (key: string, value: string) => { target.prepare('INSERT OR REPLACE INTO receipts(key, value) VALUES (?, ?)').run(key, value); },
    removeItem: (key: string) => { target.prepare('DELETE FROM receipts WHERE key = ?').run(key); },
  };
  const digest = (value: string) => createHash('sha256').update(value).digest('hex');
  const hash = '0123456789012345678901234567890123456789';
  const base = 'magnet:?xt=urn:btih:';
  let uid = '173';
  const token = 'v28-fixture-only';
  const entries = [
    { id: 'v28-115', providerId: '115', resource: base + hash, carNum: 'JHS-001', identity: uid },
    { id: 'v28-123', providerId: '123', resource: base + 'a'.repeat(40), carNum: 'JHS-002', identity: token },
    { id: 'v28-orphan', providerId: '115', resource: base + 'b'.repeat(40), carNum: 'JHS-003', identity: uid },
  ];
  const local = entries.map(({ id, providerId, resource, identity }) => [
    'jhs_offline_receipt_v1:' + digest(resource), JSON.stringify({ attemptId: id, providerId,
      accountBinding: digest(JSON.stringify(['offline-account-v1', providerId, identity])), state: 'pending', at: Date.now() - 86_400_000 }),
  ] as const);
  const history = entries.slice(0, 2).map(({ id, providerId, resource, carNum }) => ({
    id, providerId, resource, carNum, resourceType: 'magnet', status: 'pending', submissionOutcome: 'unknown',
  }));
  await main.store.initialize();
  await applyLegacySnapshot(main.store, JSON.stringify({ schema: 1, store: 'JAV-JHS/appData',
    entries: [...local, ['data_version', CURRENT_DATA_VERSION], ['offline_history', history]],
  }));
  const workspace = await createWorkspace(main.store, false);
  let written = 0;
  await assert.rejects(migrateV28Receipts(main.store, { ...storage,
    setItem(key, value) { if (written++ > 0) throw new Error('target write interrupted'); storage.setItem(key, value); },
  }), /target write interrupted/);
  assert.equal(storage.length, 1);
  for (const [key, raw] of local) assert.equal(await main.store.getItem(key), raw);
  await migrateV28Receipts(main.store, storage);
  assert.equal(storage.length, 3);
  for (const [key] of local) assert.equal(await main.store.getItem(key), null);
  await migrateV28Receipts(main.store, storage);

  let panEvidence = false, resolves = 0;
  const diagnostics = new DiagnosticsService(), container = new DependencyContainer(diagnostics);
  const http = new HttpService({ async request({ url: href }) {
    const url = new URL(href);
    const json = (data: unknown) => ({ status: 200, finalUrl: url.href, data });
    if (url.searchParams.get('ac') === 'space') return json({ sign: 'v28-fixture', uid });
    if (url.searchParams.get('ac') === 'task_lists') return json(JSON.parse(fixture('one115-offline-tasks.json')));
    if (url.pathname.endsWith('/task/list')) {
      const data = JSON.parse(fixture('pan123-offline-tasks.json'));
      if (panEvidence) data.data.list[0].resource_id = 'v28-resource-id';
      return json(data);
    }
    if (url.pathname.endsWith('/task/resolve')) {
      resolves++;
      return json({ code: 0, data: { list: [{ id: 'v28-resource-id', files: [{ id: 'file-1', size: 20 }] }] } });
    }
    assert.fail('Migration and verification must never submit to the cloud');
  } }, new ExternalUrlPolicy());
  container.register(SERVICE.http, http);
  container.register(SERVICE.settings, { snapshot: () => ({}) });
  const integrations = new IntegrationRegistry(container, diagnostics);
  integrations.register(one115);
  integrations.register(pan123);
  const offline = new OfflineService(new ProviderRegistry(), integrations);
  const accounts = new AccountSessions(native, true, async (site, scope) => cloud.identity(site as CloudSite, scope), ready, async () => {}, () => {});
  const cloud = new CloudOperations(accounts, offline, workspace.state, async () => token, storage, () => true);
  await accounts.check('one115');
  await accounts.check('pan123');
  const receipt115 = cloud.pending().find(item => item.attemptId === 'v28-115');
  const receipt123 = cloud.pending().find(item => item.attemptId === 'v28-123');
  assert.ok(receipt115 && receipt123);
  assert.equal(cloud.pending().length, 2);
  uid = 'other';
  await accounts.check('one115');
  assert.equal(cloud.pending().some(item => item.providerId === 'one115'), false);
  await assert.rejects(cloud.verify(receipt115), { code: 'AUTH_REQUIRED' });
  uid = '173';
  await accounts.check('one115');
  const alternateLink = receipt115.resource + '&dn=another-title';
  assert.equal(await cloud.submit('one115', alternateLink, receipt115.carNum), 'pending');
  assert.equal(await cloud.verify(receipt115), true);
  assert.equal(await cloud.submit('one115', alternateLink, receipt115.carNum), 'already');
  assert.equal(await cloud.verify(receipt123), false);
  assert.equal(resolves, 0);
  panEvidence = true;
  assert.equal(await cloud.verify(receipt123), true);
  assert.equal(resolves, 1);
  assert.deepEqual((await workspace.state.getOfflineHistory()).map(row => [row.id, row.submissionOutcome]), [
    ['v28-115', 'exists'], ['v28-123', 'exists'],
  ]);
  assert.equal(cloud.pending().length, 0);
  assert.equal(await cloud.submit('one115', entries[2].resource, entries[2].carNum), 'pending');
  assert.equal(cloud.pending()[0].attemptId, 'v28-orphan');
});

test('media HTTPS and API key validation preserve the credential only on the same connection', () => {
  const previous = validateMediaDraft({ id: 'emby-1', type: 'emby', name: 'Fixture', address: 'https://media.example.test',
    apiKey: 'fixture-key', userId: 'account', enabled: true });
  const draft = { ...previous, type: 'emby' as const, apiKey: '' };
  assert.equal(validateMediaDraft(draft, previous).apiKey, 'fixture-key');
  assert.throws(() => validateMediaDraft({ ...draft, address: 'http://media.example.test' }, previous), { field: 'address' });
  assert.throws(() => validateMediaDraft({ ...draft, address: 'https://other.example.test' }, previous), { field: 'apiKey' });
  assert.throws(() => validateMediaDraft({ ...draft, userId: 'other' }, previous), { field: 'apiKey' });
});

test('Android, iOS, and Web expose the same session functions and request fields', () => {
  const mobile = new URL('../', import.meta.url);
  const file = (path: string) => readFileSync(new URL(path, mobile), 'utf8');
  const android = file('modules/jhs-session/android/src/main/java/io/github/teamper/jhs/session/JhsSessionModule.kt');
  const ios = file('modules/jhs-session/ios/JhsSessionModule.swift');
  const contract = file('src/platform/session/types.ts');
  const functions = [...contract.matchAll(/^  (\w+)\(/gm)].map(match => match[1]).sort();
  for (const platform of [android, ios]) {
    assert.deepEqual([...platform.matchAll(/AsyncFunction\("(\w+)"\)/g)].map(match => match[1]).sort(), functions);
  }
  const fields = [...contract.split('export type SessionNative')[0].matchAll(/^  (\w+)\??:/gm)].map(match => match[1]).sort();
  for (const platform of [android, ios]) {
    assert.deepEqual([...platform.matchAll(/@Field (?:val|var) (\w+):/g)].map(match => match[1]).sort(), fields);
  }
  const web = file('src/platform/session/jhsSession.web.ts');
  for (const name of functions) assert.match(web, new RegExp('\\b' + name + ':'));
});

test('media credential revisions survive a Keychain backend that cannot enumerate keys', async () => {
  const keychain = new Map<string, unknown>(), database = new Map<string, unknown>();
  const create = () => new CredentialService(indexKeychainRevisions({
    async getItem(key) { return database.get(key) ?? null; },
    async setItem(key, value) { database.set(key, value); },
  }, {
    async getValue(key, fallback) { return keychain.get(key) ?? fallback; },
    async setValue(key, value) { keychain.set(key, value); },
    async removeValue(key) { keychain.delete(key); },
  }), null);
  const initial = create();
  const key = 'jhs_media_connections_v1';
  const saved = await initial.setVersioned(key, 'fixture-media-key', null);
  assert.ok(saved.revision);
  assert.equal(JSON.stringify([...database.values()]).includes('fixture-media-key'), false);
  assert.equal(JSON.stringify([...keychain.values()]).includes('fixture-media-key'), false);
  assert.equal((await create().readVersioned(key)).value, 'fixture-media-key');
});
