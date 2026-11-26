import { load } from 'cheerio/slim';
import { SQLiteStorage } from 'expo-sqlite/kv-store';
import type { QueryClient } from '@tanstack/react-query';
import { CredentialService, DependencyContainer, DiagnosticsService, ExternalUrlPolicy, HttpService, IntegrationRegistry, JhsError,
  JavDbListService, MediaLibraryService, OfflineService, OfflineTaskQueryService, PAN123_CREDENTIAL_KEYS, Pan123CredentialService,
  ProviderRegistry, SERVICE, mediaLibrary, one115, pan123, parseBooleanSetting } from '@jhs/core';
import { JAVDB_ORIGIN, cheerioDocument, createJavDbWebLists } from '@jhs/parsers';
import { jhsSession } from '../../platform/session/jhsSession';
import { mobileHttp } from '../../platform/http/mobileHttp.ts';
import { androidDevice, secure } from '../../platform/device/nativeBridge.ts';
import type { Workspace } from '../workspace/createWorkspace.ts';
import { AccountSessions, accountBinding } from './AccountSessions.ts';
import { CloudOperations, type CloudSite, type TaskPage } from './CloudOperations.ts';
import { JavDbActions } from './JavDbActions.ts';
import { queryKeys } from '../queries/queryKeys.ts';
import { refreshJavDbCatalog } from '../queries/refreshJavDbCatalog.ts';
import { indexKeychainRevisions } from './keychainIndex.ts';
import { migrateV28Receipts } from './migrateV28Receipts.ts';

function createPanCredential() {
  const { token, metadata } = PAN123_CREDENTIAL_KEYS;
  const keys = [token, metadata, token + '_secret'];
  const values = new Map<string, unknown>();
  let ready: Promise<unknown> | undefined;
  const initialize = () => ready ??= Promise.all(keys.map(async key => { values.set(key, await secure.getValue(key)); }))
    .catch(error => { ready = undefined; throw error; });
  const service = new Pan123CredentialService({
    getLocal: () => null,
    getValue: (key, fallback) => values.get(key) ?? fallback,
    async setValue(key, value) { await secure.setValue(key, value); values.set(key, value); },
  }, {});
  return {
    async token() { await initialize(); return service.getStoredToken(); },
    async save(value: string) { await initialize(); await service.acceptLoginToken(value); },
    async clear() {
      await initialize();
      for (const key of keys) { await secure.removeValue(key); values.delete(key); }
    },
  };
}

function localLocks() {
  const running = new Map<string, Promise<unknown>>();
  return {
    async request<T>(name: string, settings: { ifAvailable: boolean } | ((lock: object) => Promise<T>), run?: (lock: object | null) => Promise<T>) {
      const start = typeof settings === 'function' ? settings : run!;
      const previous = running.get(name);
      if (previous && typeof settings !== 'function' && settings.ifAvailable) return run!(null);
      const operation = previous ? previous.catch(() => {}).then(() => start({})) : Promise.resolve().then(() => start({}));
      running.set(name, operation);
      try { return await operation; } finally { if (running.get(name) === operation) running.delete(name); }
    },
  };
}

export async function installConnections(workspace: Workspace, queryClient: QueryClient, diagnostics: DiagnosticsService) {
  const available = !workspace.sample && (await jhsSession?.available()) === true;
  const panCredential = available ? createPanCredential() : { token: async () => '', save: async () => {}, clear: async () => {} };
  const policy = new ExternalUrlPolicy();
  const http = new HttpService({
    request: options => {
      if (options.providerId === 'media-library' && new URL(options.url).protocol !== 'https:') {
        return Promise.reject(new JhsError('INVALID_URL', '媒体库连接需要 HTTPS 地址。'));
      }
      return mobileHttp.request({ ...options, ...(['one115', 'pan123'].includes(options.providerId) && { session: options.providerId }) });
    },
  }, policy);
  const dependencies = new DependencyContainer(diagnostics);
  dependencies.register(SERVICE.http, http);
  dependencies.register(SERVICE.settings, workspace.settings);
  const integrations = new IntegrationRegistry(dependencies, diagnostics);
  integrations.register(one115);
  integrations.register(pan123);
  integrations.register(mediaLibrary);
  const offline = new OfflineService(new ProviderRegistry(), integrations);

  const accountHttp = {
    request: (options: Record<string, unknown>, scope?: Parameters<HttpService['request']>[1]) => http.request({
      ...options, session: 'javdb', cacheScope: 'none',
    }, scope),
  };
  const documentFrom = (text: string, url: string) => cheerioDocument(load(text), url);
  const adapter = createJavDbWebLists(accountHttp, documentFrom);
  const database = workspace.database;
  const lists = new JavDbListService({
    integrations: { getAdapter: () => adapter },
    storage: { get: database.getItem.bind(database), set: database.setItem.bind(database), keys: database.keys.bind(database) },
    locks: localLocks(),
    context: () => ({ origin: JAVDB_ORIGIN, accountUrl: JAVDB_ORIGIN + '/users/profile' }),
  });
  const enabled = (site: CloudSite) => parseBooleanSetting(workspace.settings.snapshot()[site === 'one115' ? 'enable115Offline' : 'enable123Offline'], site === 'pan123');
  const taskCache = new Map<string, unknown>();
  const tasks = new OfflineTaskQueryService({
    settings: workspace.settings, token: panCredential.token,
    storage: { get: (key: string) => taskCache.get(key), set: (key: string, value: unknown) => { taskCache.set(key, value); } },
    offline: {
      listTasks: (site: CloudSite, { scope, page }: { scope: Parameters<CloudOperations['identity']>[1]; page: number }) =>
        accounts.run(site, scope.signal, async requestScope => {
          const before = await cloud!.identity(site, requestScope);
          const pageResult = await offline.listTasks(site, { scope: requestScope, token: before.token, page });
          const after = await cloud!.identity(site, requestScope);
          if (before.binding !== after.binding) throw new JhsError('AUTH_REQUIRED', '云盘账号已更换。');
          return pageResult;
        }),
    },
  });
  const accounts: AccountSessions = new AccountSessions(jhsSession, available, async (site, scope) => {
    if (site === 'javdb') {
      const account = (await lists.access(scope)).account;
      return account ? { binding: account.fingerprint, label: account.label } : null;
    }
    const account = await cloud!.identity(site, scope);
    if (site === 'pan123') await offline.listTasks(site, { scope, token: account.token, page: 1 });
    return { binding: account.binding, v28Binding: account.v28Binding, label: account.label, accountId: account.accountId };
  }, panCredential, async site => {
    if (site === 'javdb') await lists.stopAll();
    else {
      await queryClient.cancelQueries({ queryKey: queryKeys.cloud });
      await tasks.resetProvider(site);
      queryClient.removeQueries({ queryKey: queryKeys.cloud });
    }
  }, (site, previous) => {
    if (site === 'javdb') void refreshJavDbCatalog(queryClient, previous === null);
  });
  const store = available ? new SQLiteStorage('jhs-local-receipts.sqlite') : null;
  const receiptStorage = store && {
    getItem: key => store.getItemSync(key), setItem: (key, value) => store.setItemSync(key, value),
    removeItem: key => { store.removeItemSync(key); },
    key: index => store.getAllKeysSync()[index] ?? null, get length() { return store.getAllKeysSync().length; },
  } satisfies Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>;
  if (receiptStorage) await migrateV28Receipts(database, receiptStorage);
  const cloud: CloudOperations | null = receiptStorage
    ? new CloudOperations(accounts, offline, workspace.state, panCredential.token, receiptStorage, enabled) : null;
  const javdb = new JavDbActions(accounts, lists, accountHttp, documentFrom);
  const media = workspace.sample ? null : new MediaLibraryService({
    integrations, credential: new CredentialService(androidDevice ? secure : indexKeychainRevisions(database, secure)),
    settings: workspace.settings, urlPolicy: policy,
    storage: { listenValue: () => null },
  });
  return { accounts, cloud, javdb, media, enabled,
    async refreshTasks(force: boolean, signal?: AbortSignal): Promise<Partial<Record<CloudSite, TaskPage>>> {
      if (!cloud) return {};
      const sites: CloudSite[] = ['one115', 'pan123'];
      await Promise.allSettled(sites.filter(site => enabled(site) && !accounts.get(site).checked && !accounts.get(site).busy)
        .map(site => accounts.check(site, signal)));
      return tasks.refresh(force, signal);
    },
  };
}

export type Connections = Awaited<ReturnType<typeof installConnections>>;
