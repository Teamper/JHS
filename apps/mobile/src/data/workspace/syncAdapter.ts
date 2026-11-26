import { AppState } from 'react-native';
import { DOMParser } from '@xmldom/xmldom';
import { LifecycleScope, CredentialService, ExternalUrlPolicy, HttpService, WebDavService, WebDavSharedProfile, WebDavSyncService } from '@jhs/core';
import { mobileHttp } from '../../platform/http/mobileHttp.ts';
import { secure } from '../../platform/device/nativeBridge.ts';
import type { Workspace } from './createWorkspace.ts';

const origin = 'https://localhost';

export function davXml(text: string): Document {
  if (/<!DOCTYPE\b/i.test(text)) throw new Error('WebDAV 列表包含不受支持的文档类型。');
  return new DOMParser({ onError: (level, message) => {
    if (level !== 'warning') throw new Error(message);
  } }).parseFromString(text, 'text/xml') as unknown as Document;
}

export async function installSync(workspace: Workspace) {
  const { storage, settings, state, events, backupService, syncStore: store, validateSetting } = workspace;
  if (!store) throw new Error('当前片库未启用同步存储。');
  const scope = new LifecycleScope('mobile-sync');
  const appEvents = Object.assign(new EventTarget(), { setTimeout, clearTimeout });
  const visibility = Object.assign(new EventTarget(), { hidden: AppState.currentState !== 'active' });
  const credential = new CredentialService(secure);
  const policy = new ExternalUrlPolicy();
  const http = new HttpService(mobileHttp, policy);
  const webdav = new WebDavService(http, credential, settings, origin, davXml);
  const shared = new WebDavSharedProfile({ credential, storage: secure, origin,
    readLegacy: () => settings.runExclusive(() => webdav.readProfileWithoutLock()) });
  webdav.sharedProfile = shared;
  const locks = {
    held: false,
    async request<T>(_id: string, _options: { ifAvailable: true }, operation: (lock: object | null) => Promise<T>) {
      if (this.held) return operation(null);
      this.held = true;
      try { return await operation({}); }
      finally { this.held = false; }
    },
  };

  const sync = new WebDavSyncService({ store, settings, storage, backup: backupService, webdav, shared, locks, urlPolicy: policy,
    window: appEvents, validateSetting });
  await sync.initialize();
  state.sync = store;
  scope.listen(sync, 'status', () => events.emit({ domain: 'sync' }));
  const subscription = AppState.addEventListener('change', state => {
    const hidden = state !== 'active';
    if (hidden === visibility.hidden) return;
    visibility.hidden = hidden;
    appEvents.dispatchEvent(new Event(hidden ? 'pagehide' : 'pageshow'));
  });
  scope.addCleanup(() => { subscription.remove(); credential.dispose(); store.dispose(); state.sync = undefined; });

  return {
    start: () => sync.start(scope, visibility, () => !visibility.hidden),
    status: () => sync.getStatus(),
    async profile() {
      const { url, username, password } = await webdav.getProfile();
      return { url, username, hasPassword: !!password };
    },
    async save(url: string, username: string, password: string) {
      const target = new URL(url.trim());
      if (target.protocol !== 'https:' || target.username || target.password || target.search || target.hash || !username.trim()) {
        throw new Error('请输入有效的 HTTPS WebDAV 地址和用户名。');
      }
      const previous = await webdav.getProfile();
      const secret = password || (previous.url === target.href && previous.username === username ? previous.password : '');
      if (!secret) throw new Error('请填写当前连接的密码。');
      await webdav.saveProfile({ url: target.href, username, password: secret });
    },
    check: () => sync.check(),
    listVersions: (): Promise<{ name: string }[]> => sync.listRecoveryFiles(),
    restore: (name: string) => sync.restore(name),
    dispose: () => scope.dispose(),
  };
}

export type SyncControls = Awaited<ReturnType<typeof installSync>>;
