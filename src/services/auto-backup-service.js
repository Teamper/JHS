// @ts-check

import { LifecycleScope } from "../core/lifecycle-scope.js";
import { AUTO_BACKUP_KEYS, autoBackupFileName, autoBackupPolicy, backupEnabled } from "../core/auto-backup-policy.js";
import { assertSupportedDataVersion } from "../core/migration.js";
import { uploadWebDavBackup } from "./backup-service.js";

export const AUTO_BACKUP_LOCK = "jhs_webdav_auto_backup_v1";
const FOLDER = "JHS-数据备份";
const RETRIES = [1, 2, 4, 8, 16, 30];

/** Page-owned scheduling; persisted checkpoints are shared by same-origin tabs. */
export class AutoBackupService extends EventTarget {
    /** @param {any} dependencies */
    constructor(dependencies) {
        super();
        this.deps = dependencies;
        this.locks = dependencies.locks === undefined ? globalThis.navigator?.locks : dependencies.locks;
        this.clock = dependencies.clock ?? (() => Date.now());
        this.upload = dependencies.upload ?? uploadWebDavBackup;
        this.window = dependencies.window ?? globalThis.window;
        this.timer = 0;
        this.running = false;
        this.suspended = false;
        this.committing = false;
        this.message = "";
        /** @type {LifecycleScope | null} */ this.operation = null;
        /** @type {LifecycleScope | null} */ this.owner = null;
    }
    /** @param {LifecycleScope} scope @param {Document} document */
    start(scope, document) {
        this.owner = scope;
        this.deps.tracker.enabled = backupEnabled(this.deps.settings.snapshot().webDavAutoBackupEnabled);
        scope.listen(this.deps.settings, "settings.changed", (/** @type {any} */ event) => {
            if (this.committing) return;
            const names = event.detail?.names ?? [];
            if (!names.some((/** @type {string} */ name) => [...AUTO_BACKUP_KEYS, "webDavProfileRevision", "webDavUrl", "webDavUsername", "trustedLocalOrigins"].includes(name))) return;
            this.cancel();
            this.deps.tracker.enabled = backupEnabled(this.deps.settings.snapshot().webDavAutoBackupEnabled);
            this.schedule(0);
        });
        scope.listen(this.deps.tracker, "changes", () => {
            this.schedule(0);
            void this.deps.events?.emit("backup-data-changed").catch(() => {});
        });
        if (this.deps.events) scope.addCleanup(this.deps.events.on("backup-data-changed", () => { this.schedule(0); }));
        scope.listen(this.window, "pagehide", () => { this.suspended = true; this.cancel(); });
        scope.listen(this.window, "pageshow", () => { this.suspended = false; this.schedule(0); });
        scope.listen(this.window, "online", () => this.schedule(0));
        scope.listen(document, "visibilitychange", () => { if (!document.hidden) this.schedule(0); });
        scope.addCleanup(() => { this.suspended = true; this.cancel(); this.deps.tracker.enabled = false; });
        this.schedule(1000);
    }
    cancel() {
        this.window?.clearTimeout(this.timer);
        this.timer = 0;
        this.operation?.dispose();
    }
    /** @param {number} delay */
    schedule(delay) {
        this.window?.clearTimeout(this.timer);
        if (this.suspended || this.owner?.disposed) return;
        this.timer = this.window?.setTimeout(() => { this.timer = 0; void this.check(); }, delay) ?? 0;
    }
    notify() { this.dispatchEvent(new Event("status")); }
    async getStatus() {
        const state = await this.deps.tracker.read(), policy = autoBackupPolicy(this.deps.settings.snapshot());
        const validationExpired = policy.enabled && (!state.verifiedRevision || state.verifiedRevision !== String(this.deps.settings.snapshot().webDavProfileRevision || ""));
        return { ...state, pendingChanges: Math.max(0, state.totalRevision - state.backedUpRevision), nextDueAt: policy.interval && state.lastSuccessAt ? state.lastSuccessAt + policy.minutes * 60000 : 0, busy: this.running, enabled: policy.enabled, message: this.message || (validationExpired ? "连接信息已变更，请重新验证并启用" : this.deps.tracker.needsBackup || state.needsBackup ? "更新计数保存异常，将安排一次完整备份" : state.error) };
    }
    async check() {
        if (this.running || this.suspended || this.owner?.disposed) return;
        try {
            const policy = autoBackupPolicy(this.deps.settings.snapshot());
            if (!policy.enabled) { this.notify(); return; }
            if (!this.locks?.request) { this.message = "当前浏览器不支持跨页互斥，自动备份已暂停"; this.notify(); return; }
            const state = await this.deps.tracker.read(), now = this.clock();
            if (state.paused || state.verifiedRevision !== String(this.deps.settings.snapshot().webDavProfileRevision || "") || !state.verifiedRevision) { this.notify(); return; }
            if (state.retryAt > now) { this.schedule(Math.min(state.retryAt - now, 60000)); return; }
            const due = this.deps.tracker.needsBackup || state.needsBackup || policy.changes && state.totalRevision - state.backedUpRevision >= policy.changeCount || policy.interval && now >= state.lastSuccessAt + policy.minutes * 60000;
            if (due) await this.run(false);
        } catch { this.message = "自动备份状态无法读取，请检查本地存储后重新验证"; }
        finally {
            this.notify();
            if (backupEnabled(this.deps.settings.snapshot().webDavAutoBackupEnabled) && !this.timer) this.schedule(60000);
        }
    }
    /** Explicitly verify a saved connection by creating its first real backup. @param {any} [options] */
    async enable(options = {}) {
        autoBackupPolicy({ ...this.deps.settings.snapshot(), webDavAutoBackupEnabled: "yes" });
        if (!this.locks?.request) throw new Error("当前浏览器不支持跨页互斥，无法启用自动备份");
        if (this.running) throw new Error("已有备份正在执行，请稍后重试");
        await this.deps.webdav.saveProfile({});
        this.deps.tracker.enabled = true;
        try { await this.run(true, options.scope); }
        finally { this.deps.tracker.enabled = backupEnabled(this.deps.settings.snapshot().webDavAutoBackupEnabled); this.notify(); }
    }
    /** @param {boolean} explicit @param {LifecycleScope} [parent] */
    async run(explicit, parent) {
        if (this.running) return;
        parent?.assertActive();
        this.running = true;
        this.message = "";
        const scope = new LifecycleScope("webdav-auto-backup");
        this.operation = scope;
        const releaseParent = parent?.addCleanup(() => scope.dispose());
        this.notify();
        try {
            await this.locks.request(AUTO_BACKUP_LOCK, { ifAvailable: true }, async (/** @type {any} */ lock) => {
                if (!lock) { if (explicit) throw new Error("其他页面正在备份，请稍后重试"); return; }
                scope.assertActive();
                const { profile, revision } = await this.deps.webdav.getProfileSnapshot();
                scope.assertActive();
                if (!profile.url || !profile.username || !profile.password) throw Object.assign(new Error("WebDAV 连接不完整"), { code: "WEBDAV_PROFILE_INCOMPLETE" });
                const policy = autoBackupPolicy({ ...this.deps.settings.snapshot(), ...(explicit ? { webDavAutoBackupEnabled: "yes" } : {}) });
                const state = await this.deps.tracker.update(() => {}), now = this.clock();
                scope.assertActive();
                if (!explicit && (!policy.enabled || state.paused || state.retryAt > now || state.verifiedRevision !== revision || !(this.deps.tracker.needsBackup || state.needsBackup || policy.changes && state.totalRevision - state.backedUpRevision >= policy.changeCount || policy.interval && now >= state.lastSuccessAt + policy.minutes * 60000))) return;
                let coveredRecoveryToken = "", coveredMemoryRecoveryToken = "";
                const uploaded = await this.upload({
                    webdav: this.deps.webdav, profile, scope, folderName: FOLDER, fileName: autoBackupFileName(state.sourceId, now),
                    exportSnapshot: () => this.deps.tracker.coordinator.runExclusive(async () => {
                        await assertSupportedDataVersion(this.deps.storage);
                        await this.deps.storage.stateService?.recoverPendingTransactionWithoutLock?.();
                        const data = await this.deps.storage._exportPortableDataWithoutLock(true);
                        const checkpoint = await this.deps.tracker.read();
                        coveredRecoveryToken = String(checkpoint.recoveryToken || "");
                        coveredMemoryRecoveryToken = this.deps.tracker.recoveryToken;
                        return { data, revision: checkpoint.totalRevision };
                    }),
                });
                await this.assertCurrent(scope, revision, explicit);
                let files;
                if (explicit) {
                    files = await uploaded.client.listManagedBackups(FOLDER, state.sourceId);
                    if (!files.includes(uploaded.fileName)) throw Object.assign(new Error("上传后未能确认备份文件"), { code: "WEBDAV_VERIFY_MISSING" });
                    await this.assertCurrent(scope, revision, explicit);
                }
                await this.deps.tracker.update((/** @type {any} */ current) => {
                    scope.assertActive();
                    current.backedUpRevision = Math.max(current.backedUpRevision, uploaded.coveredRevision);
                    current.lastSuccessAt = this.clock(); current.verifiedRevision = revision;
                    current.retryAt = 0; current.failures = 0; current.error = ""; current.cleanupError = ""; current.paused = false;
                    current.needsBackup = String(current.recoveryToken || "") !== coveredRecoveryToken;
                });
                this.deps.tracker.needsBackup = this.deps.tracker.recoveryToken !== coveredMemoryRecoveryToken;
                if (explicit) {
                    this.committing = true;
                    try { await this.deps.settings.runExclusive(async () => {
                        scope.assertActive();
                        if (String(this.deps.settings.snapshot().webDavProfileRevision || "") !== revision) throw new DOMException("连接已变更", "AbortError");
                        await this.deps.settings.updateWithoutLock((/** @type {any} */ draft) => { draft.webDavAutoBackupEnabled = "yes"; });
                    }); } finally { this.committing = false; }
                }
                try {
                    files ??= await uploaded.client.listManagedBackups(FOLDER, state.sourceId);
                    for (const name of files.filter((/** @type {string} */ name) => name !== uploaded.fileName).slice(Math.max(0, policy.keepCount - 1))) {
                        await this.assertCurrent(scope, revision);
                        await uploaded.client.deleteManagedBackup(FOLDER, name, state.sourceId);
                    }
                } catch (error) {
                    if (scope.disposed) return;
                    await this.deps.tracker.update((/** @type {any} */ current) => { current.cleanupError = "备份已成功，旧自动备份清理未完成，请检查删除权限或连接"; });
                }
                this.schedule(0);
            });
        } catch (error) {
            if (scope.disposed || /** @type {any} */ (error)?.name === "AbortError") { if (explicit) throw error; return; }
            const failure = /** @type {any} */ (error), status = Number(failure?.details?.status);
            const code = String(failure?.code || "");
            const paused = [401, 403].includes(status) || /CREDENTIAL|PROFILE_INCOMPLETE|INVALID_URL|ORIGIN|FORBIDDEN|UNTRUSTED/.test(code);
            const reason = code === "WEBDAV_PROFILE_INCOMPLETE" ? "请填写并保存服务地址、用户名和密码" : code === "WEBDAV_VERIFY_MISSING" ? "已上传，但列表中未找到备份，请检查列出权限" : code === "WEBDAV_CREDENTIAL_UNREADABLE" ? "密码无法读取，请重新输入并保存" : status >= 100 && status <= 599 ? `服务返回 HTTP ${status}，请检查连接与权限` : /TIMEOUT/.test(code) ? "网络请求超时，请检查连接" : "请检查已保存的连接、上传及列出权限";
            this.message = explicit ? `自动备份验证失败：${reason}` : paused ? "连接或授权已失效，请重新验证并启用" : "自动备份失败，将稍后重试";
            try { await this.deps.tracker.update((/** @type {any} */ state) => {
                state.error = this.message; state.paused = paused;
                state.failures += 1; state.retryAt = this.clock() + RETRIES[Math.min(state.failures - 1, RETRIES.length - 1)] * 60000;
            }); } catch { this.message = "自动备份状态保存失败，请检查本地存储"; }
            if (explicit) throw new Error(this.message);
        } finally {
            releaseParent?.();
            scope.dispose();
            if (this.operation === scope) this.operation = null;
            this.running = false;
            this.notify();
        }
    }
    /** Re-read the profile revision and enable flag before committing or deleting. @param {LifecycleScope} scope @param {string} revision @param {boolean} [verifying] */
    async assertCurrent(scope, revision, verifying = false) {
        scope.assertActive();
        await this.deps.settings.load();
        scope.assertActive();
        if (String(this.deps.settings.snapshot().webDavProfileRevision || "") !== revision) throw new DOMException("连接已变更", "AbortError");
        if (!verifying && !backupEnabled(this.deps.settings.snapshot().webDavAutoBackupEnabled)) throw new DOMException("自动备份已关闭", "AbortError");
    }
}
