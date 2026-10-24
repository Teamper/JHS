// @ts-check

import { ComputationBudget } from "../core/cooperative-work.js";
import { stringifySyncDataAsync } from "../core/webdav-sync-model.js";
import { LifecycleScope } from "../core/lifecycle-scope.js";
import { CURRENT_DATA_VERSION } from "../core/constants.js";
import { encryptPortableBackup, decryptPortableBackup } from "../core/credential-crypto.js";
import { SYNC_FOLDER, parseSyncFileName, retainedSyncFiles, syncFileName, syncHash, syncJson, validateSyncEnvelopeAsync, materializeSyncData, syncLayout, syncRetention, withSyncRetentionDefaults } from "../core/webdav-sync-model.js";
import { nextSyncDelay, syncPublishDueAt } from "./webdav-sync-scheduling.js";

const RETRIES = [1, 2, 4, 8, 16, 30];
/** @param {any} error */
const requiresPause = error => [401, 403].includes(Number(error?.details?.status)) || ["SYNC_FUTURE_VERSION", "SYNC_PROFILE_CONFLICT"].includes(error?.code);
/** @param {any} error */
const isCancelled = error => error?.name === "AbortError" || error?.code === "ABORTED";
export const SYNC_NETWORK_LOCK = "jhs_webdav_sync_network_v1";
/** @typedef {import("../contracts/webdav-sync.js").WebDavSync} WebDavSync */
/** Page-owned transport. Immutable replica snapshots require no cross-device lock or CAS.
 * @implements {WebDavSync}
 */
export class WebDavSyncService extends EventTarget {
    /** @param {any} dependencies */
    constructor(dependencies) {
        super(); this.deps = dependencies; this.window = dependencies.window ?? globalThis.window; this.clock = dependencies.clock ?? (() => Date.now());
        this.locks = dependencies.locks === undefined ? globalThis.navigator?.locks : dependencies.locks;
        this.running = false; this.suspended = false; this.rerun = false; this.timer = 0; this.message = ""; this.nextDueAt = 0; this.scheduleGeneration = 0;
        this.needsReconcile = true; this.waitingForBackground = false; this.manualRequested = false;
        /** @type {LifecycleScope | null} */ this.operation = null;
        /** @type {LifecycleScope | null} */ this.owner = null;
        /** @type {Document | null} */ this.document = null;
    }
    async initialize() {
        await this.deps.preferences?.migrate();
        await this.deps.store.initialize();
    }
    /** @param {LifecycleScope} scope @param {Document} document */
    start(scope, document) {
        this.owner = scope; this.document = document; this.deps.store.enabled = true;
        this.deps.shared.watch(scope);
        scope.listen(this.deps.shared, "changed", () => { this.cancel(); this.rerun = true; this.schedule(0); });
        scope.listen(this.deps.store, "changes", () => { void this.reschedule(); });
        scope.listen(this.window, "pagehide", () => { this.suspended = true; this.cancel(); });
        scope.listen(this.window, "pageshow", () => { this.suspended = false; this.schedule(0, true); });
        scope.listen(this.window, "online", () => this.schedule(0, true));
        scope.listen(document, "visibilitychange", () => { if (!document.hidden) this.schedule(0, true); });
        scope.addCleanup(() => { this.suspended = true; this.cancel(); this.deps.store.enabled = false; });
        this.schedule(1000);
    }
    notify() { this.dispatchEvent(new Event("status")); }
    cancel() { this.scheduleGeneration++; this.window?.clearTimeout(this.timer); this.timer = 0; this.nextDueAt = 0; this.operation?.dispose(); }
    /** @param {number} delay @param {boolean} [force] @param {boolean} [manual] */
    schedule(delay, force = false, manual = false) {
        if (this.suspended || this.owner?.disposed) return;
        this.scheduleGeneration++;
        this.window?.clearTimeout(this.timer); this.nextDueAt = this.clock() + delay;
        this.timer = this.window?.setTimeout(() => { this.timer = 0; void (manual ? this.check() : this.check(force ? { scheduled: true, force: true } : { scheduled: true })); }, delay) ?? 0;
    }
    /** Re-read shared deadlines without holding the business lock while waiting for network. @param {boolean} [lockMiss] */
    async reschedule(lockMiss = false) {
        const generation = ++this.scheduleGeneration;
        let delay = this.document?.hidden ? 120000 : 30000;
        try {
            const state = await this.deps.store.read(), snapshot = await this.deps.shared.snapshot();
            const locallyPaused = await this.deps.shared.paused();
            if (generation !== this.scheduleGeneration || this.suspended || this.owner?.disposed) return;
            const profile = snapshot.profile;
            const next = locallyPaused ? null : profile.url && profile.username && profile.password && this.locks?.request
                ? nextSyncDelay(state, this.clock(), !!this.document?.hidden, snapshot.revision, lockMiss) : delay;
            if (next == null) { this.window?.clearTimeout(this.timer); this.timer = 0; this.nextDueAt = 0; return; }
            delay = next;
        } catch { /* Local storage/profile errors retain a bounded retry without network. */ }
        if (generation === this.scheduleGeneration) this.schedule(delay);
    }
    async getStatus() {
        const state = await this.deps.store.read();
        let configured = false, profileMessage = "", profileConflict = false;
        try { const { profile } = await this.deps.shared.snapshot(); configured = !!(profile.url && profile.username && profile.password); } catch (error) { profileMessage = /** @type {Error} */ (error).message; profileConflict = /** @type {any} */ (error).code === "SYNC_PROFILE_CONFLICT"; }
        const locallyPaused = await this.deps.shared.paused();
        return { profileConflict, busy: this.running, enabled: configured && !locallyPaused, paused: locallyPaused || state.paused, lastSuccessAt: state.lastSuccessAt, retryAt: state.retryAt, cleanupError: state.cleanupError, nextDueAt: this.nextDueAt, pendingChanges: Math.max(state.dirty || state.pending ? 1 : 0, (state.localRevision || 0) - (state.publishedRevision || 0)), message: profileMessage || this.deps.store.error || this.deps.store.notificationError || this.message || state.error || (!configured ? "保存有效 WebDAV 连接后将自动接入同步" : ""), replicas: Object.keys(state.confirmed || {}).length };
    }
    /** Explicit retry is not an opt-in upload or a second backup engine. */
    async enable() { return this.retry(); }
    async retry() { await this.deps.store.update((/** @type {any} */ state) => { state.paused = false; state.retryAt = 0; state.cleanupRetryAt = 0; state.error = ""; }); await this.check(); }
    /** @param {boolean} paused */
    async pause(paused) { await this.deps.shared.setPaused(paused); if (!paused) await this.retry(); }
    /** @param {any} scope @param {string} revision */
    async assertConnectionCurrent(scope, revision) {
        scope.assertActive();
        if ((await this.deps.shared.snapshot()).revision !== revision) throw new DOMException("同步连接已变更", "AbortError");
        scope.assertActive();
    }
    /** Automatic work also respects pause; explicit recovery keeps its own lifecycle. @param {any} scope @param {string} revision */
    async assertCurrent(scope, revision) {
        await this.assertConnectionCurrent(scope, revision);
        if (await this.deps.shared.paused()) throw new DOMException("自动同步已暂停", "AbortError");
        scope.assertActive();
    }
    /** @param {import("../contracts/webdav-sync.js").SyncCheckOptions} [options] */
    async check(options = {}) {
        if (this.running) {
            if (!options.scheduled) {
                this.manualRequested = true;
                if (this.waitingForBackground && this.operation) this.deps.backgroundWork?.expedite(this.operation.signal);
            }
            this.rerun = true; return;
        }
        if (this.suspended || this.owner?.disposed) return;
        this.running = true; this.rerun = false; this.message = ""; this.manualRequested = !options.scheduled;
        const scope = new LifecycleScope("webdav-sync"); this.operation = scope;
        /** @type {any} */ const round = { active: true, signal: scope.signal, binding: "", proof: null };
        let revision = "", lockMiss = false;
        this.notify();
        try {
            if (options.scheduled && !this.manualRequested && this.deps.backgroundWork) {
                this.waitingForBackground = true;
                try { await this.deps.backgroundWork.waitForTurn({ signal: scope.signal, allowHidden: true }); }
                finally { this.waitingForBackground = false; }
            }
            scope.assertActive();
            await this.deps.store.initialize();
            await this.deps.shared.migrate();
            const snapshot = await this.deps.shared.snapshot(), profile = snapshot.profile; revision = snapshot.revision;
            if (!profile.url || !profile.username || !profile.password || await this.deps.shared.paused()) return;
            if (!this.locks?.request) { this.message = "当前浏览器不支持可靠的同源互斥，自动同步已暂停"; return; }
            const current = await this.deps.store.read();
            if (current.paused && current.errorRevision === revision || current.retryAt > this.clock() && current.errorRevision === revision) return;
            await this.locks.request(SYNC_NETWORK_LOCK, { ifAvailable: true }, async (/** @type {any} */ lock) => {
                if (!lock) { lockMiss = true; return; }
                await this.assertCurrent(scope, revision);
                const binding = await syncHash(JSON.stringify([profile.url, profile.username]));
                round.binding = binding;
                // The same origin shares one poll window even when tabs wake at
                // different times. Local edits and explicit checks can run sooner.
                let latest = await this.deps.store.read();
                const now = this.clock();
                if (latest.errorRevision === revision && (latest.paused || latest.retryAt > now)) return;
                // A reopened page repairs the previous page's metadata crash gap
                // before deciding whether another tab already polled recently.
                if (this.needsReconcile || this.deps.store.error) {
                    latest = await this.deps.store.flushPending({ full: true, work: new ComputationBudget({ signal: scope.signal, diagnostics: this.deps.diagnostics }), round });
                    this.needsReconcile = false;
                }
                if (options.scheduled && !this.manualRequested && !options.force && (nextSyncDelay(latest, now, !!this.document?.hidden, revision) ?? Infinity) > 0) return;
                const origin = new URL(profile.url).origin;
                this.deps.urlPolicy?.authorizeLocalOrigin(origin);
                const client = this.deps.webdav.createClient(profile, { scope });
                await client.ensureFolder(SYNC_FOLDER);
                const files = await client.listSyncFiles();
                const remote = await this.pull(client, files, scope, revision, binding);
                await this.deps.store.merge(remote.models, binding, () => this.assertCurrent(scope, revision), remote.confirmed, { signal: scope.signal, round, lastSuccessAt: remote.models.length ? this.clock() : undefined });
                let state = await this.deps.store.read();
                let published = false;
                if ((state.dirty || state.pending) && (!options.scheduled || this.manualRequested || options.force || syncPublishDueAt(state, this.clock()) <= this.clock())) {
                    if (!state.pending) await this.preparePending(scope, revision, round);
                    await this.publish(client, scope, revision);
                    published = true;
                    state = await this.deps.store.read();
                }
                if ((published || state.cleanupError || state.deleting?.length) && !(state.cleanupRetryAt > this.clock())) await this.attemptCleanup(client, scope, revision);
                await this.assertCurrent(scope, revision);
                await this.deps.store.update(async (/** @type {any} */ value) => {
                    await this.assertCurrent(scope, revision);
                    value.retryAt = 0; value.failures = 0; value.error = ""; value.paused = false;
                    value.checkedRevision = revision; value.lastCheckAt = this.clock(); value.nextCheckAt = value.lastCheckAt + (this.document?.hidden ? 120000 : 30000);
                });
            });
        } catch (error) {
            const failure = /** @type {any} */ (error);
            if (!scope.disposed && !isCancelled(failure)) {
                const paused = requiresPause(failure);
                this.message = paused ? `同步已暂停：${failure.message || "请检查连接与权限"}` : `同步未完成，将自动重试：${failure.message || "请检查网络"}`;
                try { await this.deps.store.update(async (/** @type {any} */ state) => { scope.assertActive(); if (revision) await this.assertConnectionCurrent(scope, revision); state.failures++; state.error = this.message; state.errorRevision = revision; state.paused = paused; state.retryAt = this.clock() + RETRIES[Math.min(state.failures - 1, RETRIES.length - 1)] * 60000; }); }
                catch { this.message = this.deps.store.error || "同步状态无法持久化，已保留业务数据并暂停本轮同步"; }
            }
        } finally {
            round.active = false; round.proof = null;
            scope.dispose(); if (this.operation === scope) this.operation = null; this.running = false;
            this.notify();
            if (this.rerun) this.schedule(0, false, this.manualRequested);
            else await this.reschedule(lockMiss);
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
            if (cached && file.seq === cached.seq) continue;
            const envelope = await this.readEnvelope(client, file, scope);
            await this.assertCurrent(scope, revision);
            models.push(envelope.state); updates[id] = { seq: file.seq, name: file.name };
        }
        return { models, confirmed: { ...confirmed, ...updates } };
    }
    /** @param {any} client @param {any} file @param {any} [scope] */
    async readEnvelope(client, file, scope = this.operation) {
        if (file.schema !== 1) throw Object.assign(new Error("同步数据来自不支持的协议，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
        const content = await client.readSyncFile(file.name);
        if (await syncHash(content) !== file.hash) throw new Error("同步快照哈希不一致，未应用或清理任何数据");
        const work = new ComputationBudget({ signal: scope?.signal, diagnostics: this.deps.diagnostics });
        const envelope = await validateSyncEnvelopeAsync(JSON.parse(await decryptPortableBackup(content, work)), this.deps.validateSetting, work);
        if (envelope.replicaId !== file.replicaId || envelope.seq !== file.seq || envelope.createdAt !== file.createdAt) throw new Error("同步文件名与内容不一致");
        return envelope;
    }
    /** @param {any} scope @param {string} revision @param {any} [round] */
    async preparePending(scope, revision, round) {
        const state = await this.deps.store.flushPending({ full: true, work: new ComputationBudget({ signal: scope.signal, diagnostics: this.deps.diagnostics }), round });
        await this.assertCurrent(scope, revision);
        const seq = state.seq + 1, createdAt = new Date(this.clock()).toISOString();
        const envelope = { schema: 1, dataVersion: CURRENT_DATA_VERSION, replicaId: state.replicaId, seq, createdAt, state: state.model, recovery: { layout: state.layout } };
        const work = new ComputationBudget({ signal: scope.signal, diagnostics: this.deps.diagnostics });
        const content = await encryptPortableBackup(await stringifySyncDataAsync(envelope, work), work), hash = await syncHash(content);
        const pending = { name: syncFileName(state.replicaId, seq, createdAt, hash), content, hash, seq, coveredRevision: state.localRevision || 0, createdAt };
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
        await this.readEnvelope(client, parseSyncFileName(pending.name), scope);
        const listed = await client.listSyncFiles();
        if (!listed.some((/** @type {any} */ file) => file.name === pending.name)) throw new Error("快照已上传，等待目录列出确认");
        await this.assertCurrent(scope, revision);
        await this.deps.store.update(async (/** @type {any} */ value) => {
            await this.assertCurrent(scope, revision); if (value.pending?.name !== pending.name) throw new DOMException("上传确认已失效", "AbortError");
            value.publishedRevision = Math.max(value.publishedRevision || 0, pending.coveredRevision);
            value.dirty = (value.localRevision || 0) > value.publishedRevision;
            value.known[pending.name] = pending.hash;
            value.confirmed[value.replicaId] = { seq: pending.seq, name: pending.name };
            value.lastSuccessAt = this.clock();
            value.pending = null;
            if (!value.dirty) { value.dirtySinceAt = 0; value.lastLocalChangeAt = 0; }
        });
    }
    /** Ordinary cleanup retries are independent of publishing; fatal errors use the common pause path. @param {any} client @param {any} scope @param {string} revision */
    async attemptCleanup(client, scope, revision) {
        try { await this.cleanup(client, scope, revision); return true; }
        catch (error) {
            if (scope.disposed || isCancelled(error)) throw error;
            await this.assertCurrent(scope, revision);
            await this.deps.store.update(async (/** @type {any} */ value) => {
                await this.assertCurrent(scope, revision);
                value.cleanupError = "同步已成功，历史文件清理未完成，将在后续同步重试";
                if (!requiresPause(error)) {
                    value.cleanupFailures = (value.cleanupFailures || 0) + 1;
                    value.cleanupRetryAt = this.clock() + RETRIES[Math.min(value.cleanupFailures - 1, RETRIES.length - 1)] * 60000;
                }
            });
            if (requiresPause(error)) throw error;
            return false;
        }
    }
    /** @param {any[]} files @param {any} state */
    assertCleanupListing(files, state) {
        if (files.some(file => file.schema !== 1)) throw Object.assign(new Error("同步目录含更新协议，请更新 JHS"), { code: "SYNC_FUTURE_VERSION" });
        for (const [id, confirmed] of Object.entries(/** @type {Record<string, any>} */ (state.confirmed))) if (!files.some(file => file.replicaId === id && (file.seq > confirmed.seq || file.seq === confirmed.seq && file.name === confirmed.name))) throw new Error("目录确认中，暂停清理");
    }
    /** @param {any} client @param {any} scope @param {string} revision */
    async cleanup(client, scope, revision) {
        const files = await client.listSyncFiles(), state = await this.deps.store.read();
        this.assertCleanupListing(files, state);
        const { count, days } = syncRetention((await this.deps.store.readData(["setting"])).setting);
        const keep = retainedSyncFiles(files, state.replicaId, count, days, this.clock());
        const remove = new Set([...(state.deleting || []), ...files.filter((/** @type {any} */ file) => file.replicaId === state.replicaId && !keep.has(file.name)).map((/** @type {any} */ file) => file.name)]);
        for (const name of remove) {
            const file = parseSyncFileName(name);
            if (!file || file.replicaId !== state.replicaId) continue;
            if (keep.has(name)) {
                await this.deps.store.update(async (/** @type {any} */ value) => { await this.assertCurrent(scope, revision); value.deleting = value.deleting.filter((/** @type {string} */ item) => item !== name); });
                continue;
            }
            await this.assertCurrent(scope, revision);
            const content = await client.readSyncFile(name, true);
            if (content != null) {
                await this.readEnvelope(client, file, scope);
                await this.deps.store.update(async (/** @type {any} */ value) => { await this.assertCurrent(scope, revision); if (!value.deleting.includes(name)) value.deleting.push(name); });
                const latestFiles = await client.listSyncFiles(), latestState = await this.deps.store.read();
                this.assertCleanupListing(latestFiles, latestState);
                const retention = syncRetention((await this.deps.store.readData(["setting"])).setting);
                if (retainedSyncFiles(latestFiles, state.replicaId, retention.count, retention.days, this.clock()).has(name)) {
                    await this.deps.store.update(async (/** @type {any} */ value) => { await this.assertCurrent(scope, revision); value.deleting = value.deleting.filter((/** @type {string} */ item) => item !== name); });
                    continue;
                }
                await this.assertCurrent(scope, revision);
                await client.deleteSyncFile(name, state.replicaId);
                if (await client.readSyncFile(name, true) != null) throw new Error("历史文件删除尚未确认");
            }
            await this.deps.store.update(async (/** @type {any} */ value) => { await this.assertCurrent(scope, revision); value.deleting = value.deleting.filter((/** @type {string} */ item) => item !== name); delete value.known[name]; });
        }
        await this.deps.store.update(async (/** @type {any} */ value) => { await this.assertCurrent(scope, revision); value.cleanupError = ""; value.cleanupFailures = 0; value.cleanupRetryAt = 0; });
    }
    /** @param {any} [scope] */
    async listRecoveryFiles(scope = this.owner) {
        const { profile, revision } = await this.deps.shared.snapshot();
        const client = this.deps.webdav.createClient(profile, { scope });
        this.deps.urlPolicy?.authorizeLocalOrigin(new URL(profile.url).origin);
        const files = await client.listSyncFiles();
        if (scope) await this.assertConnectionCurrent(scope, revision);
        return files;
    }
    /** Restore values as a new local mutation, never the old replica/clock/queue. @param {string} name @param {boolean} [layout] @param {any} [scope] @param {{data?: boolean, preferences?: boolean}} [selection] */
    async restore(name, layout = false, scope = this.owner, selection = { data: true, preferences: true }) {
        if (!selection.data && !selection.preferences && !layout) throw new Error("请至少选择数据、偏好或布局中的一项");
        const file = parseSyncFileName(name); if (!file) throw new Error("恢复文件名无效");
        const { profile, revision } = await this.deps.shared.snapshot();
        this.deps.urlPolicy?.authorizeLocalOrigin(new URL(profile.url).origin);
        const client = this.deps.webdav.createClient(profile, { scope });
        const envelope = await this.readEnvelope(client, file, scope);
        if (scope) await this.assertConnectionCurrent(scope, revision);
        await this.deps.storage.importDataWithGuard({ data_version: CURRENT_DATA_VERSION }, {
            assertActive: () => this.assertConnectionCurrent(scope ?? { assertActive() {} }, revision),
            prepareData: async () => {
                const local = await this.deps.store.readData(), restored = materializeSyncData(envelope.state, local);
                /** @type {Record<string, any>} */ const data = { data_version: CURRENT_DATA_VERSION };
                if (selection.data) for (const key of Object.keys(restored)) if (key !== "setting") data[key] = restored[key];
                if (selection.preferences || layout) data.setting = selection.preferences ? withSyncRetentionDefaults(restored.setting, true) : { ...local.setting };
                if (layout) Object.assign(data.setting, syncLayout(envelope.recovery?.layout));
                return data;
            },
        });
        await this.deps.store.flushPending({ full: true });
        this.schedule(0);
    }
}
