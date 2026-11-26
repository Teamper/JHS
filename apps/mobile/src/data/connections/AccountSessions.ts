import { JhsError, LifecycleScope, throwIfAborted } from '@jhs/core';
import type { SessionNative, SessionSite } from '../../platform/session/types.ts';

export const sites = ['javdb', 'one115', 'pan123'] as const;
export const siteNames = { javdb: 'JavDB', one115: '115 云盘', pan123: '123 云盘' } as const;
export type Account = { binding: string; label: string; accountId?: string; v28Binding?: string };
type AccountState = { account: Account | null; busy: boolean; checked: boolean; version: number; error?: string };
type Probe = (site: SessionSite, scope: LifecycleScope) => Promise<Account | null>;
type Credential = { save(token: string): Promise<void>; clear(): Promise<void> };

export async function sha256(value: string) {
  const bytes = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes), byte => byte.toString(16).padStart(2, '0')).join('');
}

export function accountBinding(site: SessionSite, identity: string) {
  return sha256(JSON.stringify(['jhs-mobile-account-v1', site, identity]));
}

export class AccountSessions extends EventTarget {
  private readonly owners = new Map(sites.map(site => [site, new LifecycleScope('account:' + site)]));
  private state = Object.fromEntries(sites.map(site => [site, { account: null, busy: false, checked: false, version: 0 }])) as Record<SessionSite, AccountState>;
  private readonly checks = { javdb: 0, one115: 0, pan123: 0 };
  private activeLogin = false;
  private readonly native: SessionNative | null;
  readonly available: boolean;
  private readonly probe: Probe;
  private readonly credential: Credential;
  private readonly onRetire: (site: SessionSite) => Promise<void>;
  private readonly onIdentityChange: (site: SessionSite, previous: Account | null) => void;

  constructor(native: SessionNative | null, available: boolean, probe: Probe, credential: Credential,
    onRetire: (site: SessionSite) => Promise<void>, onIdentityChange: (site: SessionSite, previous: Account | null) => void) {
    super();
    this.native = native;
    this.available = available;
    this.probe = probe;
    this.credential = credential;
    this.onRetire = onRetire;
    this.onIdentityChange = onIdentityChange;
  }

  get = (site: SessionSite) => this.state[site];

  private update(site: SessionSite, patch: Partial<AccountState>) {
    this.state[site] = { ...this.state[site], ...patch };
    this.dispatchEvent(new Event('change'));
  }

  private retire(site: SessionSite) {
    this.owners.get(site)!.dispose();
    this.owners.set(site, new LifecycleScope('account:' + site));
    this.update(site, { version: this.state[site].version + 1 });
  }

  async run<T>(site: SessionSite, signal: AbortSignal | undefined, action: (scope: LifecycleScope) => Promise<T>) {
    if (!this.available) throw new JhsError('UNSUPPORTED', '当前环境无法使用原生账号会话。');
    if (this.state[site].busy) throw new JhsError('ABORTED', '账号会话正在更换，请稍后重试。');
    throwIfAborted(signal);
    const scope = new LifecycleScope('request:' + site);
    const stop = () => scope.dispose();
    const detach = this.owners.get(site)!.addCleanup(stop);
    signal?.addEventListener('abort', stop, { once: true });
    try {
      const result = await action(scope);
      scope.assertActive();
      return result;
    } finally { signal?.removeEventListener('abort', stop); detach(); }
  }

  private async read(site: SessionSite, scope: LifecycleScope) {
    try { return await this.probe(site, scope); }
    catch (error) {
      if (error instanceof JhsError && error.code === 'AUTH_REQUIRED') return null;
      throw error;
    }
  }

  async check(site: SessionSite, signal?: AbortSignal) {
    const version = this.state[site].version;
    const check = ++this.checks[site];
    const account = await this.run(site, signal, scope => this.read(site, scope));
    if (this.state[site].version !== version || this.checks[site] !== check) throw new JhsError('ABORTED', '账号状态已刷新。');
    const previous = this.state[site].account;
    if (previous && previous.binding !== account?.binding) {
      this.retire(site);
      this.update(site, { account, checked: true, error: undefined });
      this.onIdentityChange(site, previous);
      await this.onRetire(site);
    } else this.update(site, { account, checked: true, error: undefined });
    return account;
  }

  private async transition(site: SessionSite, change: () => Promise<Account | null>) {
    if (!this.available || !this.native) throw new JhsError('UNSUPPORTED', '请在支持独立会话的 Android 或 iOS 上连接账号。');
    if (this.state[site].busy) throw new JhsError('ABORTED', '账号会话正在更换。');
    const previous = this.state[site].account;
    this.update(site, { busy: true, account: null, error: undefined });
    this.retire(site);
    try {
      await this.onRetire(site);
      const account = await change();
      this.update(site, { busy: false, account, checked: true });
      if (previous?.binding !== account?.binding) this.onIdentityChange(site, previous);
      return account;
    } catch (error) {
      this.update(site, { busy: false, account: null, checked: true, error: error instanceof Error ? error.message : '连接失败。' });
      if (previous) this.onIdentityChange(site, previous);
      throw error;
    }
  }

  async login(site: SessionSite, url?: string) {
    if (this.activeLogin) throw new JhsError('ABORTED', '请先关闭当前登录窗口。');
    this.activeLogin = true;
    try {
      return await this.transition(site, async () => {
        const result = await this.native!.openLogin(site, url ?? null);
        if (site === 'pan123' && result.completed && result.token) await this.credential.save(result.token);
        return this.read(site, this.owners.get(site)!);
      });
    } finally { this.activeLogin = false; }
  }

  clear(site: SessionSite) {
    return this.transition(site, async () => {
      if (site === 'pan123') await this.credential.clear();
      await this.native!.clearSession(site);
      return null;
    });
  }
}
