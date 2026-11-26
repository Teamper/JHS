import { JhsError, LifecycleScope, OfflineService, OfflineSubmissionReceiptService, StateService, normalizeMovieCarNum } from '@jhs/core';
import { AccountSessions, accountBinding, sha256, siteNames, type Account } from './AccountSessions.ts';
import { magnetHash, receiptPrefix, v28ReceiptKey } from './receiptKeys.ts';

export type CloudSite = 'one115' | 'pan123';
export const cloudSites = ['one115', 'pan123'] as const;
export type Receipt = {
  attemptId: string; providerId: CloudSite; accountBinding: string; resource: string; carNum: string; resolutionId?: string; v28?: true;
};
type SavedReceipt = Omit<Receipt, 'resource' | 'carNum'> & Partial<Pick<Receipt, 'resource' | 'carNum'>> & { state: 'pending' | 'submitted' };
type CloudAccount = Account & { v28Binding: string; token?: string };
type Task = { id: string; name: string; status: string; progress: number; resourceId?: string };
export type TaskPage = { items: Task[]; total: number; page?: number; enabled?: boolean; needsLogin?: boolean; reason?: string };
const recentMs = 5 * 60_000;
const providerHistoryId = { one115: '115', pan123: '123' } as const;
type ReceiptStorage = ConstructorParameters<typeof OfflineSubmissionReceiptService>[0];

function bindingFor(account: Account | null, receipt: SavedReceipt | Receipt) {
  return receipt.v28 ? account?.v28Binding : account?.binding;
}

export class CloudOperations {
  private readonly running = new Set<string>();
  private readonly receipts: OfflineSubmissionReceiptService;
  private readonly accounts: AccountSessions;
  private readonly offline: OfflineService;
  private readonly state: StateService;
  private readonly token: () => Promise<string>;
  private readonly storage: ReceiptStorage;
  private readonly enabled: (site: CloudSite) => boolean;

  constructor(accounts: AccountSessions, offline: OfflineService, state: StateService, token: () => Promise<string>,
    storage: ReceiptStorage, enabled: (site: CloudSite) => boolean) {
    this.accounts = accounts;
    this.offline = offline;
    this.state = state;
    this.token = token;
    this.storage = storage;
    this.enabled = enabled;
    this.receipts = new OfflineSubmissionReceiptService(storage);
    this.receipts.prune(recentMs);
  }

  async identity(site: CloudSite, scope: LifecycleScope): Promise<CloudAccount> {
    const accountId: string | undefined = site === 'one115' ? (await this.offline.getAccountIdentity(site, { scope })).accountId : undefined;
    const token = site === 'pan123' ? await this.token() : undefined;
    scope.assertActive();
    const identity = accountId ?? token;
    if (!identity) throw new JhsError('AUTH_REQUIRED', '请先登录 ' + siteNames[site] + '。');
    const [binding, v28Binding] = await Promise.all([
      accountBinding(site, identity), sha256(JSON.stringify(['offline-account-v1', providerHistoryId[site], identity])),
    ]);
    scope.assertActive();
    return { binding, v28Binding, accountId, token, label: '已连接 ' + siteNames[site] };
  }

  private read(key: string): SavedReceipt | null {
    const saved = this.receipts.read(key, recentMs);
    if (saved?.providerId === '115') return { ...saved, providerId: 'one115', v28: true };
    if (saved?.providerId === '123') return { ...saved, providerId: 'pan123', v28: true };
    return saved;
  }

  private *entries() {
    for (let index = 0; index < this.storage.length; index++) {
      const key = this.storage.key(index);
      if (!key?.startsWith(receiptPrefix)) continue;
      const receipt = this.read(key);
      if (receipt) yield [key, receipt] as const;
    }
  }

  pending() {
    const entries: Receipt[] = [];
    for (const [, receipt] of this.entries()) {
      const { resource, carNum, providerId, accountBinding } = receipt;
      if (receipt.state === 'pending' && resource && carNum && cloudSites.includes(providerId) && accountBinding &&
        bindingFor(this.accounts.get(providerId).account, receipt) === accountBinding) entries.push({ ...receipt, resource, carNum });
    }
    return entries;
  }

  private findV28(site: CloudSite, hash: string, exactKey: string, binding: string, attemptId?: string) {
    const matches = (saved: SavedReceipt | null): saved is SavedReceipt =>
      !!saved?.v28 && saved.providerId === site && (!attemptId || saved.attemptId === attemptId)
      && (saved.state === 'pending' || saved.accountBinding === binding);
    const exact = this.read(exactKey);
    if (matches(exact) && exact.state === 'pending') return [exactKey, exact] as const;
    let submitted = matches(exact) ? [exactKey, exact] as const : undefined;
    // V28 hashed the entire link. Another link to the same torrent can have different trackers.
    for (const [key, saved] of this.entries()) {
      if (!matches(saved) || !saved.resource || magnetHash(saved.resource) !== hash) continue;
      if (saved.state === 'pending') return [key, saved] as const;
      submitted ??= [key, saved] as const;
    }
    return submitted;
  }

  private async withResult<T>(site: CloudSite, resource: string, signal: AbortSignal | undefined,
    action: (operation: { key: string; hash: string; account: CloudAccount; scope: LifecycleScope }) => Promise<T>) {
    if (!this.enabled(site)) throw new JhsError('UNSUPPORTED', '请先在设置中启用此离线服务。');
    const hash = magnetHash(resource);
    if (!hash) throw new JhsError('INVALID_URL', '磁力链接缺少可靠的 BTIH 标识。');
    const key = receiptPrefix + await accountBinding(site, hash);
    if (this.running.has(key)) throw new JhsError('OPERATION_FAILED', '这条离线任务正在核对。');
    this.running.add(key);
    try {
      return await this.accounts.run(site, signal, async scope => {
        const account = await this.identity(site, scope);
        scope.assertActive();
        return action({ key, hash, account, scope });
      });
    } finally { this.running.delete(key); }
  }

  private guard(scope: LifecycleScope, match: string | undefined, expected: string) {
    scope.assertActive();
    if (!expected || match !== expected) {
      throw new JhsError('AUTH_REQUIRED', '账号已变化，请使用原账号核实。');
    }
  }

  submit(site: CloudSite, resource: string, number: string, signal?: AbortSignal, retry?: Receipt) {
    const carNum = normalizeMovieCarNum(number);
    if (!carNum) throw new JhsError('INVALID_URL', '请先核对作品番号。');
    return this.withResult(site, resource, signal, async ({ key, hash, account, scope }) => {
      const exactV28 = await v28ReceiptKey(resource);
      scope.assertActive();
      const current = this.read(key);
      if (current?.state === 'submitted' && current.accountBinding === account.binding) return 'already';
      const [priorKey, previous] = (current?.state !== 'pending' && (!retry || retry.v28)
        ? this.findV28(site, hash, exactV28, account.v28Binding, retry?.attemptId) : undefined) ?? [key, current];
      if (previous?.state === 'submitted' && previous.accountBinding === bindingFor(account, previous)) return 'already';
      const writeKey = previous?.state === 'pending' ? priorKey : key;
      let raw = this.receipts.getRaw(writeKey);
      if (previous?.state === 'pending') {
        this.guard(scope, bindingFor(account, previous), previous.accountBinding);
        const pending = { ...previous, resource: previous.resource ?? resource, carNum: previous.carNum ?? carNum };
        if (!previous.resource || !previous.carNum) {
          // A crash may have saved the receipt before the old app wrote history. The exact link supplies the missing fields.
          this.receipts.write(writeKey, 'pending', pending, raw);
          raw = this.receipts.getRaw(writeKey);
        }
        if (!retry || retry.attemptId !== previous.attemptId) return 'pending';
        if (await this.lookup(pending, account, scope)) {
          await this.confirm(writeKey, pending, raw, scope);
          return 'already';
        }
      } else if (retry) throw new JhsError('OPERATION_FAILED', '回执已变化，请刷新任务。');
      const v28 = writeKey !== key;
      const attempt: Receipt = { attemptId: crypto.randomUUID(), providerId: site, accountBinding: v28 ? account.v28Binding : account.binding,
        resource: v28 ? previous?.resource ?? resource : resource, carNum, ...(v28 && { v28: true }) };
      let dispatched = false;
      this.receipts.write(writeKey, 'pending', attempt, raw);
      try {
        await this.offline.submitWithIntegration(site, attempt.resource, {
          scope, token: account.token, expectedAccountId: account.accountId,
          onResolved: (resolutionId: string) => { attempt.resolutionId = resolutionId; this.receipts.write(writeKey, 'pending', attempt); },
          onMutationDispatch: () => { scope.assertActive(); dispatched = true; },
        });
        const current = await this.identity(site, scope);
        this.guard(scope, current.binding, account.binding);
      } catch (error) {
        const definite = error instanceof JhsError && error.details?.submissionOutcome === 'rejected' && error.code !== 'TASK_EXISTS';
        if (!dispatched || definite) {
          this.receipts.restore(writeKey, raw);
          throw error;
        }
        if (!scope.disposed) await this.record(attempt, 'unknown', retry?.attemptId);
        return 'pending';
      }
      this.receipts.write(writeKey, 'submitted', attempt);
      await this.record(attempt, 'submitted', retry?.attemptId);
      return 'submitted';
    });
  }

  private record(receipt: Receipt, outcome: 'submitted' | 'unknown' | 'exists', retryOf?: string) {
    return this.state.appendOfflineHistory({
      id: receipt.attemptId, providerId: providerHistoryId[receipt.providerId], providerName: siteNames[receipt.providerId],
      resource: receipt.resource, carNum: receipt.carNum, resourceType: 'magnet',
      status: outcome === 'unknown' ? 'pending' : 'submitted', submissionOutcome: outcome, ...(retryOf && { retryOf }),
    });
  }

  private async lookup(receipt: Receipt, account: CloudAccount, scope: LifecycleScope) {
    const site = receipt.providerId;
    let target = site === 'one115' ? magnetHash(receipt.resource) : receipt.resolutionId;
    if (!target && (site === 'one115' || !receipt.v28)) return false;
    let read = 0;
    const visited = new Set<string>();
    for (let page = 1; page <= 20; page++) {
      const list: TaskPage = await this.offline.listTasks(site, { scope, token: account.token, page, includeEvidence: true });
      this.guard(scope, bindingFor(await this.identity(site, scope), receipt), receipt.accountBinding);
      if (!target && list.items.some(item => item.resourceId)) {
        const resolved = await this.offline.resolveWithIntegration(site, receipt.resource, { scope, token: account.token });
        this.guard(scope, bindingFor(await this.identity(site, scope), receipt), receipt.accountBinding);
        target = String(resolved.id);
      }
      if (target && list.items.some(item => (site === 'one115' ? item.id.toLowerCase() : item.resourceId) === target)) return true;
      const signature = JSON.stringify(list.items.map(item => item.id));
      if (!list.items.length || visited.has(signature)) return false;
      visited.add(signature);
      read += list.items.length;
      if (!list.total || read >= list.total) return false;
    }
    return false;
  }

  private async confirm(key: string, receipt: Receipt, expectedRaw: string | null, scope: LifecycleScope) {
    scope.assertActive();
    const providerId = providerHistoryId[receipt.providerId];
    const found = await this.state.confirmOfflineSubmission({ attemptId: receipt.attemptId, providerId, resource: receipt.resource });
    if (!found) {
      const history = await this.state.getOfflineHistory();
      scope.assertActive();
      const confirmed = Array.isArray(history) && history.some(item =>
        item.id === receipt.attemptId && item.providerId === providerId && item.resource === receipt.resource &&
        (item.submissionOutcome === 'submitted' || item.submissionOutcome === 'exists'));
      if (!confirmed) await this.record(receipt, 'exists');
    }
    scope.assertActive();
    this.receipts.write(key, 'submitted', receipt, expectedRaw);
  }

  verify(receipt: Receipt, signal?: AbortSignal) {
    return this.withResult(receipt.providerId, receipt.resource, signal, async ({ key, account, scope }) => {
      const receiptKey = receipt.v28 ? await v28ReceiptKey(receipt.resource) : key;
      const raw = this.receipts.getRaw(receiptKey), saved = this.read(receiptKey);
      if (saved?.state !== 'pending' || receipt.attemptId !== saved.attemptId || receipt.providerId !== saved.providerId) return false;
      this.guard(scope, bindingFor(account, saved), saved.accountBinding);
      const { resource, carNum } = saved;
      if (!resource || !carNum) return false;
      const pending = { ...saved, resource, carNum };
      if (!await this.lookup(pending, account, scope)) return false;
      await this.confirm(receiptKey, pending, raw, scope);
      return true;
    });
  }
}
