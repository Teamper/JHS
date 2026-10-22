// @ts-check

import { LifecycleScope } from "../core/lifecycle-scope.js";
import { CURRENT_DATA_VERSION } from "../core/constants.js";
import { encryptPortableBackup, decryptPortableBackup } from "../core/credential-crypto.js";
import { SYNC_FOLDER, parseSyncFileName, retainedSyncFiles, syncFileName, syncHash, syncJson, validateSyncEnvelope, materializeSyncData, syncLayout, syncRetention } from "../core/webdav-sync-model.js";

const RETRIES = [1, 2, 4, 8, 16, 30];
export const SYNC_NETWORK_LOCK = "jhs_webdav_sync_network_v1";
/** Page-owned transport. Immutable replica snapshots require no cross-device lock or CAS. */
export class WebDavSyncService extends EventTarget {
    /** @param {any} dependencies */
    constructor(dependencies) {
        super(); this.deps = dependencies; this.window = dependencies.window ?? globalThis.window; this.clock = dependencies.clock ?? (() => Date.now());
        this.locks = dependencies.locks === undefined ? globalThis.navigator?.locks : dependencies.locks;
        this.running = false; this.suspended = false; this.rerun = false; this.timer = 0; this.firstChangeAt = 0; this.message = ""; this.nextDueAt = 0;
        /** @type {LifecycleScope | null} */ this.operation = null;
        /** @type {LifecycleScope | null} */ this.owner = null;
        /** @type {Document | null} */ this.document = null;
    }
    /** @param {LifecycleScope} scope @param {Document} document */
    start(scope, document) {
        this.owner = scope; this.document = document; this.deps.store.enabled = true;
        this.deps.shared.watch(scope);
        scope.listen(this.deps.shared, "changed", () => { this.cancel(); this.rerun = true; this.schedule(0); });
        scope.listen(this.deps.store, "changes", () => {
            if (this.timer && this.nextDueAt <= this.clock()) return;
            const now = this.clock(); this.firstChangeAt ||= now;
            this.schedule(Math.min(5000, Math.max(0, this.firstChangeAt + 30000 - now)));
        });
        scope.listen(this.window, "pagehide", () => { this.suspended = true; this.cancel(); });
        scope.listen(this.window, "pageshow", () => { this.suspended = false; this.schedule(0); });
        scope.listen(this.window, "online", () => this.schedule(0));
        scope.listen(document, "visibilitychange", () => { if (!document.hidden) this.schedule(0); });
        scope.addCleanup(() => { this.suspended = true; this.cancel(); this.deps.store.enabled = false; });
        this.schedule(1000);
    }
    notify() { this.dispatchEvent(new Event("status")); }
    cancel() { this.window?.clearTimeout(this.timer); this.timer = 0; this.operation?.dispose(); }
    /** @param {number} delay */
    schedule(delay) {
        if (this.suspended || this.owner?.disposed) return;
        this.window?.clearTimeout(this.timer); this.nextDueAt = this.clock() + delay;
        this.timer = this.window?.setTimeout(() => { this.timer = 0; void this.check(); }, delay) ?? 0;
    }
    async getStatus() {
        const state = await this.deps.store.read();
        let configured = false, profileMessage = "", profileConflict = false;
        try { const { profile } = await this.deps.shared.snapshot(); configured = !!(profile.url && profile.username && profile.password); } catch (error) { profileMessage = /** @type {Error} */ (error).message; profileConflict = /** @type {any} */ (error).code === "SYNC_PROFILE_CONFLICT"; }
        const locallyPaused = await this.deps.shared.paused();
        return { profileConflict, busy: this.running, enabled: configured && !locallyPaused, paused: locallyPaused || state.paused, lastSuccessAt: state.lastSuccessAt, retryAt: state.retryAt, cleanupError: state.cleanupError, nextDueAt: this.nextDueAt, pendingChanges: Math.max(0, (state.localRevision || 0) - (state.publishedRevision || 0)), message: profileMessage || this.deps.store.error || this.message || state.error || (!configured ? "保存有效 WebDAV 连接后将自动接入同步" : ""), replicas: Object.keys(state.confirmed || {}).length };
    }
    /** Explicit retry is not an opt-in upload or a second backup engine. */
    async enable() { return this.retry(); }
    async retry() { await this.deps.store.update((/** @type {any} */ state) => { state.paused = false; state.retryAt = 0; state.error = ""; }); await this.check(); }
    /** @param {boolean} paused */
    async pause(paused) { await this.deps.shared.setPaused(paused); if (!paused) await this.retry(); }
    /** @param {any} scope @param {string} revision */
    async assertCurrent(scope, revision) {
        scope.assertActive();
        if (await this.deps.shared.paused() || (await this.deps.shared.snapshot()).revision !== revision) throw new DOMException("同步连接已变更或暂停", "AbortError");
        scope.assertActive();
    }
    async check() {
        if (this.running) { this.rerun = true; return; }
        if (this.suspended || this.owner?.disposed) return;
        this.running = true; this.rerun = false; this.message = "";
        const scope = new LifecycleScope("webdav-sync"); this.operation = scope;
        let revision = "";
        this.notify();
        try {
            await this.deps.store.initialize();
            await this.deps.shared.migrate();
            const snapshot = await this.deps.shared.snapshot(), profile = snapshot.profile; revision = snapshot.revision;
            if (!profile.url || !profile.username || !profile.password || await this.deps.shared.paused()) return;
            if (!this.locks?.request) { this.message = "当前浏览器不支持可靠的同源互斥，自动同步已暂停"; return; }
            const current = await this.deps.store.read();
            if (current.paused && current.errorRevision === revision || current.retryAt > this.clock() && current.errorRevision === revision) return;
            await this.locks.request(SYNC_NETWORK_LOCK, { ifAvailable: true }, async (/** @type {any} */ lock) => {
                if (!lock) return;
                await this.assertCurrent(scope, revision);
                await this.deps.store.coordinator.runExclusive(() => this.deps.store.reconcileWithoutLock());
                const origin = new URL(profile.url).origin;
                this.deps.urlPolicy?.authorizeLocalOrigin(origin);
                const client = this.deps.webdav.createClient(profile, { scope });
                await client.ensureFolder(SYNC_FOLDER);
                const binding = await syncHash(JSON.stringify([profile.url, profile.username]));
                const files = await client.listSyncFiles();
                const remote = await this.pull(client, files, scope, revision, binding);
                await this.deps.store.merge(remote.models, binding, () => this.assertCurrent(scope, revision), remote.confirmed);
                let state = await this.deps.store.read();
                if (state.dirty || state.pending) {
                    if (!state.pending) await this.preparePending(scope, revision);
                    await this.publish(client, scope, revision);
                    state = await this.deps.store.read();
                    try { await this.cleanup(client, scope, revision); }
                    catch (error) {
                        if (scope.disposed) throw error;
                        await this.deps.store.update((/** @type {any} */ value) => { value.cleanupError = "同步已成功，历史文件清理未完成，将在后续同步重试"; });
                        if ([401, 403].includes(Number(/** @type {any} */ (error)?.details?.status))) throw error;
                    }
                } else if (state.cleanupError || state.deleting?.length) {
                    try { await this.cleanup(client, scope, revision); } catch { /* Retry independently of publishing. */ }
                }
                await this.assertCurrent(scope, revision);
                await this.deps.store.update(async (/** @type {any} */ value) => { await this.assertCurrent(scope, revision); value.lastSuccessAt = this.clock(); value.retryAt = 0; value.failures = 0; value.error = ""; value.paused = false; });
                this.firstChangeAt = 0;
            });
        } catch (error) {
            const failure = /** @type {any} */ (error);
            if (!scope.disposed && failure?.name !== "AbortError") {
                const status = Number(failure?.details?.status);
                const paused = [401, 403].includes(status) || ["SYNC_FUTURE_VERSION", "SYNC_PROFILE_CONFLICT"].includes(failure?.code);
                this.message = paused ? `同步已暂停：${failure.message || "请检查连接与权限"}` : `同步未完成，将自动重试：${failure.message || "请检查网络"}`;
                try { await this.deps.store.update((/** @type {any} */ state) => { state.failures++; state.error = this.message; state.errorRevision = revision; state.paused = paused; state.retryAt = this.clock() + RETRIES[Math.min(state.failures - 1, RETRIES.length - 1)] * 60000; }); }
                catch { this.message = this.deps.store.error || "同步状态无法持久化，已保留业务数据并暂停本轮同步"; }
            }
        } finally {
            scope.dispose(); if (this.operation === scope) this.operation = null; this.running = false;
            this.notify();
            if (!this.timer) this.schedule(this.rerun ? 0 : this.document?.hidden ? 120000 : 30000);
        }
    }
    /** @param {any} client @param {any[]} files @param {any} scope @param {string} revision @param {string} binding */
    async pull(client, files, scope, revision, binding) {
        const state = await this.deps.store.read(), confirmed = state.binding === binding ? state.confirmed : {};
        /** @type {Map<string, any>} */ const newest = new Map();
        for (const file of files) {
            if (file.schema !== 1) throw Object.assign(new Error("同步目录含更新协议，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
            const old = newest.get(file.replicaId);
            if (old?.seq === file.seq && old.name !== file.name) throw new Error("同一副本序号存在不同快照，已保留文件等待处理");
            if (!old || file.seq > old.seq) newest.set(file.replicaId, file);
        }
        /** @type {any[]} */ const models = [];
        /** @type {Record<string, any>} */ const updates = {};
        for (const id of new Set([...Object.keys(confirmed), ...newest.keys()])) {
            const cached = confirmed[id], file = newest.get(id);
            if (cached && (!file || file.seq < cached.seq || file.seq === cached.seq && file.name !== cached.name)) throw new Error("同步目录暂未列出已确认版本，保留当前数据并稍后重试");
            if (cached && file.seq === cached.seq) { models.push(cached.model); continue; }
            const envelope = await this.readEnvelope(client, file);
            await this.assertCurrent(scope, revision);
            models.push(envelope.state); updates[id] = { seq: file.seq, name: file.name, model: envelope.state };
        }
        return { models, confirmed: { ...confirmed, ...updates } };
    }
    /** @param {any} client @param {any} file */
    async readEnvelope(client, file) {
        if (file.schema !== 1) throw Object.assign(new Error("同步数据来自不支持的协议，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
        const content = await client.readSyncFile(file.name);
        if (await syncHash(content) !== file.hash) throw new Error("同步快照哈希不一致，未应用或清理任何数据");
        const envelope = validateSyncEnvelope(JSON.parse(await decryptPortableBackup(content)));
        if (envelope.replicaId !== file.replicaId || envelope.seq !== file.seq || envelope.createdAt !== file.createdAt) throw new Error("同步文件名与内容不一致");
        return envelope;
    }
    /** @param {any} scope @param {string} revision */
    async preparePending(scope, revision) {
        const state = await this.deps.store.coordinator.runExclusive(() => this.deps.store.reconcileWithoutLock());
        await this.assertCurrent(scope, revision);
        const seq = state.seq + 1, createdAt = new Date(this.clock()).toISOString();
        const envelope = { schema: 1, dataVersion: CURRENT_DATA_VERSION, replicaId: state.replicaId, seq, createdAt, state: state.model, recovery: { layout: state.layout } };
        const content = await encryptPortableBackup(JSON.stringify(envelope)), hash = await syncHash(content);
        const pending = { name: syncFileName(state.replicaId, seq, createdAt, hash), content, hash, seq, coveredRevision: state.localRevision || 0, model: state.model, createdAt };
        await this.assertCurrent(scope, revision);
        await this.deps.store.update(async (/** @type {any} */ value) => {
            await this.assertCurrent(scope, revision); if (value.pending || value.replicaId !== state.replicaId || value.binding !== state.binding) throw new DOMException("同步快照已失效", "AbortError");
            value.seq = seq; value.pending = pending;
        });
    }
    /** @param {any} client @param {any} scope @param {string} revision */
    async publish(client, scope, revision) {
        const state = await this.deps.store.read(), pending = state.pending;
        await this.assertCurrent(scope, revision);
        const existing = await client.readSyncFile(pending.name, true);
        if (existing == null) await client.writeSyncFile(pending.name, pending.content);
        else if (await syncHash(existing) !== pending.hash) throw new Error("不可变同步文件发生冲突，拒绝覆盖");
        await this.assertCurrent(scope, revision);
        await this.readEnvelope(client, parseSyncFileName(pending.name));
        const listed = await client.listSyncFiles();
        if (!listed.some((/** @type {any} */ file) => file.name === pending.name)) throw new Error("快照已上传，等待目录列出确认");
        await this.assertCurrent(scope, revision);
        await this.deps.store.update(async (/** @type {any} */ value) => {
            await this.assertCurrent(scope, revision); if (value.pending?.name !== pending.name) throw new DOMException("上传确认已失效", "AbortError");
            value.publishedRevision = Math.max(value.publishedRevision || 0, pending.coveredRevision);
            value.dirty = (value.localRevision || 0) > value.publishedRevision;
            value.known[pending.name] = pending.hash;
            value.confirmed[value.replicaId] = { seq: pending.seq, name: pending.name, model: pending.model };
            value.lastSuccessAt = this.clock();
            value.pending = null;
        });
    }
    /** @param {any} client @param {any} scope @param {string} revision */
    async cleanup(client, scope, revision) {
        const files = await client.listSyncFiles(), state = await this.deps.store.read();
        for (const [id, confirmed] of Object.entries(/** @type {Record<string, any>} */ (state.confirmed))) if (!files.some((/** @type {any} */ file) => file.replicaId === id && file.seq >= confirmed.seq)) throw new Error("目录确认中，暂停清理");
        const { count, days } = syncRetention(this.deps.settings.snapshot());
        const keep = retainedSyncFiles(files, state.replicaId, count, days, this.clock());
        const remove = new Set([...(state.deleting || []), ...files.filter((/** @type {any} */ file) => file.replicaId === state.replicaId && !keep.has(file.name)).map((/** @type {any} */ file) => file.name)]);
        for (const name of remove) {
            const file = parseSyncFileName(name);
            if (!file || file.replicaId !== state.replicaId || keep.has(name)) continue;
            await this.assertCurrent(scope, revision);
            const content = await client.readSyncFile(name, true);
            if (content != null) {
                await this.readEnvelope(client, file);
                await this.deps.store.update((/** @type {any} */ value) => { if (!value.deleting.includes(name)) value.deleting.push(name); });
                await this.assertCurrent(scope, revision);
                await client.deleteSyncFile(name, state.replicaId);
                if (await client.readSyncFile(name, true) != null) throw new Error("历史文件删除尚未确认");
            }
            await this.deps.store.update((/** @type {any} */ value) => { value.deleting = value.deleting.filter((/** @type {string} */ item) => item !== name); delete value.known[name]; });
        }
        await this.deps.store.update((/** @type {any} */ value) => { value.cleanupError = ""; });
    }
    /** @param {any} [scope] */
    async listRecoveryFiles(scope = this.owner) {
        const { profile, revision } = await this.deps.shared.snapshot();
        const client = this.deps.webdav.createClient(profile, { scope });
        this.deps.urlPolicy?.authorizeLocalOrigin(new URL(profile.url).origin);
        const files = await client.listSyncFiles();
        if (scope) await this.assertCurrent(scope, revision);
        return files;
    }
    /** Restore values as a new local mutation, never the old replica/clock/queue. @param {string} name @param {boolean} [layout] @param {any} [scope] @param {{data?: boolean, preferences?: boolean}} [selection] */
    async restore(name, layout = false, scope = this.owner, selection = { data: true, preferences: true }) {
        if (!selection.data && !selection.preferences && !layout) throw new Error("请至少选择数据、偏好或布局中的一项");
        const file = parseSyncFileName(name); if (!file) throw new Error("恢复文件名无效");
        const { profile, revision } = await this.deps.shared.snapshot();
        this.deps.urlPolicy?.authorizeLocalOrigin(new URL(profile.url).origin);
        const client = this.deps.webdav.createClient(profile, { scope });
        const envelope = await this.readEnvelope(client, file);
        if (scope) await this.assertCurrent(scope, revision);
        const local = await this.deps.store.readData(), data = materializeSyncData(envelope.state, local);
        if (!selection.data) for (const key of Object.keys(data)) if (key !== "setting") data[key] = local[key];
        if (!selection.preferences) data.setting = { ...local.setting };
        if (layout) Object.assign(data.setting, syncLayout(envelope.recovery?.layout));
        await this.deps.storage.importDataWithGuard({ ...data, data_version: CURRENT_DATA_VERSION }, { assertActive: () => this.assertCurrent(scope ?? { assertActive() {} }, revision) });
        if (selection.data) await this.deps.store.update((/** @type {any} */ value) => { value.undoEligible = []; });
        this.schedule(0);
    }
}
