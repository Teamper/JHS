// @ts-check

import { assertSupportedDataVersion } from "./migration.js";
import { SYNC_DOMAINS, SYNC_LEGACY_DEFAULTS, emptySyncModel, historyRank, joinSyncModels, materializeSyncData, maximumClock, projectSyncData, pruneSyncHistory, syncClone, syncJson, syncLayout, validateSyncState, versionSyncDiff, visibleSyncRecords, withSyncRetentionDefaults } from "./webdav-sync-model.js";

/** @typedef {Record<string, any>} Dict */
export const SYNC_STATE_KEY = "jhs_webdav_sync_state_v1";
export const SYNC_JOURNAL_KEY = "jhs_webdav_sync_journal_v1";

/** Confirmed remote models are already durably joined into state.model. @param {Dict} state */
function compactSyncMetadata(state) {
    for (const item of Object.values(state.confirmed || {})) delete item.model;
    if (state.pending) delete state.pending.model;
    return state;
}

/** Durable local sidecar. All *WithoutLock methods require the business lock. */
export class WebDavSyncStore extends EventTarget {
    /** @param {any} dependencies */
    constructor(dependencies) {
        super();
        this.deps = dependencies;
        this.forage = dependencies.forage;
        this.coordinator = dependencies.coordinator;
        this.enabled = false;
        this.error = "";
        this.replicaId = "";
        /** @type {Set<string>} */ this.eligible = new Set();
        /** @type {{touched: Set<string>, pruned: Dict} | null} */ this.current = null;
        this.notificationPending = false;
        this.notificationError = "";
        this.notificationRetryAt = 0;
        /** @type {Promise<void> | null} */ this.notificationDrain = null;
        this.coordinator.afterRelease = () => this.scheduleNotifications();
    }
    /** @returns {Promise<Dict>} */
    async read() {
        const state = await this.forage.getItem(SYNC_STATE_KEY);
        if (state && (state.schema !== 1 || !state.model?.records || !state.shadow || !Array.isArray(state.undoEligible))) throw new Error("同步状态损坏或版本不受支持，请保留数据并使用恢复入口");
        if (state) { this.replicaId = state.replicaId; this.eligible = new Set(state.undoEligible); return compactSyncMetadata(state); }
        return { schema: 1, replicaId: "", counter: 0, seq: 0, localRevision: 0, publishedRevision: 0, joined: false, binding: "", model: emptySyncModel(), shadow: {}, layout: {}, dirty: false, dirtySinceAt: 0, lastLocalChangeAt: 0, pending: null, confirmed: {}, known: {}, deleting: [], lastSuccessAt: 0, retryAt: 0, failures: 0, error: "", cleanupError: "", paused: false, undoEligible: [] };
    }
    async initialize() {
        return this.coordinator.runExclusive(async () => {
            await this.recoverWithoutLock();
            let state = await this.read();
            if (!state.replicaId) {
                state.replicaId = crypto.randomUUID();
                const activity = await this.forage.getItem("activity_log");
                state.undoEligible = (activity?.entries || []).filter((/** @type {any} */ entry) => entry.commitState === "committed").map((/** @type {any} */ entry) => entry.id);
                await this.writeWithoutLock(state);
            }
            return state;
        });
    }
    /** @param {Dict} state */
    async writeWithoutLock(state) { await this.forage.setItem(SYNC_STATE_KEY, compactSyncMetadata(state)); this.replicaId = state.replicaId; this.eligible = new Set(state.undoEligible); }
    /** @param {(state: Dict) => void | Promise<void>} change */
    update(change) { return this.coordinator.runExclusive(async () => { const state = await this.read(); await change(state); await this.writeWithoutLock(state); return state; }); }
    begin() { this.current = this.enabled ? { touched: new Set(), pruned: {} } : null; }
    /** @param {string} key */
    async capture(key) { if (SYNC_DOMAINS.includes(key)) this.current?.touched.add(key); }
    /** @param {string} domain @param {any[]} entries */
    notePruned(domain, entries) { if (this.current && entries.length) this.current.pruned[domain] = entries.map(historyRank).sort().at(-1); }
    /** @param {boolean} succeeded */
    async finish(succeeded) {
        const current = this.current; this.current = null;
        if (!current?.touched.size) return;
        try {
            if (succeeded) await this.reconcileWithoutLock(current.pruned, current.touched);
            this.error = "";
        } catch { this.error = "业务数据已保存，同步进度待修复；稍后将重新核对完整数据"; }
        this.dispatchEvent(new Event("changes"));
    }
    /** @param {string} id */
    canUndo(id) { return this.eligible.has(id); }
    /** @param {readonly string[]} [domains] @returns {Promise<Dict>} */
    async readData(domains = SYNC_DOMAINS) {
        const values = await Promise.all(domains.map(async key => [key, await this.forage.getItem(key)]));
        return Object.fromEntries(values.map(([key, value]) => [key, value ?? (["setting", "new_video_decisions"].includes(key) ? {} : key === "activity_log" ? { entries: [] } : [])]));
    }
    /** Must run before every subsequent writer, even after a page crash. @returns {Promise<{notificationId: string, carNums: string[]} | null>} */
    async recoverWithoutLock() {
        let journal = await this.forage.getItem(SYNC_JOURNAL_KEY);
        if (!journal) return null;
        await assertSupportedDataVersion(this.deps.storage);
        if (journal.schema !== 1 || !journal.after || journal.afterState?.schema !== 1 || !SYNC_DOMAINS.every(key => Object.hasOwn(journal.after, key))) throw new Error("同步恢复日志版本无效，已停止写入以保留本地数据");
        // Old v1 journals have no notification marker. Upgrade it before replay
        // so a crash cannot erase the outstanding refresh or change its identity.
        if (!journal.notificationId || !Array.isArray(journal.carNums)) {
            const previous = await this.forage.getItem("car_list") || [];
            const modeled = Object.keys(journal.afterState.model?.records || {}).filter(key => key.startsWith("car_list/")).map(key => decodeURIComponent(key.slice(9)));
            journal = { ...journal, notificationId: journal.notificationId || crypto.randomUUID(), carNums: [...new Set([...previous, ...journal.after.car_list].map((/** @type {any} */ car) => car.carNum).concat(modeled))] };
            await this.forage.setItem(SYNC_JOURNAL_KEY, journal);
        }
        if (journal.state !== "committed") {
            for (const key of SYNC_DOMAINS) await this.forage.setItem(key, journal.after[key]);
            await this.writeWithoutLock(journal.afterState);
            await this.forage.setItem(SYNC_JOURNAL_KEY, { ...journal, state: "committed" });
            this.deps.storage?._invalidateCache?.();
            this.deps.storage?.invalidateSettingCache?.();
        }
        this.notificationPending = true;
        return { notificationId: journal.notificationId, carNums: journal.carNums };
    }
    /** Post-lock scheduling must not join the business caller's promise chain. */
    scheduleNotifications() {
        if (!this.notificationPending || this.notificationDrain || (this.deps.clock?.() ?? Date.now()) < this.notificationRetryAt) return;
        const drain = Promise.resolve().then(() => this.drainNotifications());
        this.notificationDrain = drain;
        const settled = () => {
            this.notificationDrain = null;
            this.scheduleNotifications();
        };
        void drain.then(settled, settled);
    }
    /** Normal sync can await refresh after releasing its business lock; settings writers must not. */
    async flushAppliedNotifications() {
        this.scheduleNotifications();
        while (this.notificationDrain) await this.notificationDrain;
    }
    async drainNotifications() {
        try {
            const notice = await this.coordinator.runExclusive(async () => {
                const recovered = await this.recoverWithoutLock();
                if (!recovered) this.notificationPending = false;
                return recovered;
            });
            if (!notice) { this.notificationError = ""; return; }
            await this.notifyApplied(notice.carNums);
            await this.coordinator.runExclusive(async () => {
                const current = await this.forage.getItem(SYNC_JOURNAL_KEY);
                if (current?.state === "committed" && current.notificationId === notice.notificationId) {
                    await this.forage.removeItem(SYNC_JOURNAL_KEY);
                    this.notificationPending = false;
                } else this.notificationPending = !!current;
            });
            this.notificationRetryAt = 0;
            this.notificationError = "";
        } catch {
            this.notificationPending = true;
            this.notificationRetryAt = (this.deps.clock?.() ?? Date.now()) + 30000;
            this.notificationError = "业务数据已同步，界面刷新未完成，将自动重试";
        }
    }
    /** Full checks repair missed writes; successful mutations reconcile only their captured domains. @param {Dict} [pruned] @param {Set<string> | null} [touched] */
    async reconcileWithoutLock(pruned = {}, touched = null) {
        await assertSupportedDataVersion(this.deps.storage);
        await this.deps.storage?.stateService?.recoverPendingTransactionWithoutLock?.();
        const state = await this.read();
        if (!state.joined) {
            const activity = await this.forage.getItem("activity_log");
            const ids = [...new Set([...state.undoEligible, ...(activity?.entries || []).filter((/** @type {any} */ entry) => entry.originReplicaId === state.replicaId && entry.commitState === "committed").map((/** @type {any} */ entry) => entry.id)])];
            if (syncJson(ids) !== syncJson(state.undoEligible)) { state.undoEligible = ids; await this.writeWithoutLock(state); }
            return state;
        }
        const domains = new Set(touched ? [...touched, ...Object.keys(pruned)].filter(key => SYNC_DOMAINS.includes(key)) : SYNC_DOMAINS);
        const selected = (/** @type {string} */ key) => domains.has(key.split("/")[0]);
        const data = await this.readData([...domains]);
        const model = touched ? { records: Object.fromEntries(Object.entries(state.model.records).filter(([key]) => selected(key))), frontiers: { ...state.model.frontiers } } : state.model;
        const beforeModel = syncJson(model);
        for (const [domain, frontier] of Object.entries(pruned)) model.frontiers[domain] = [model.frontiers[domain] || "", frontier].sort().at(-1);
        const next = projectSyncData(data, model.frontiers);
        const before = Object.fromEntries(Object.entries(state.shadow).filter(([key, fields]) => {
            const domain = key.split("/")[0];
            return selected(key) && (!["activity_log", "offline_history"].includes(domain) || historyRank(/** @type {Dict} */ (fields).value) > (model.frontiers[domain] || ""));
        }));
        const clock = Math.max(state.counter, maximumClock(model)) + 1;
        if (!Number.isSafeInteger(clock)) throw new Error("同步逻辑版本已超出安全范围");
        const difference = versionSyncDiff(model, before, next, [clock, state.replicaId]);
        const result = domains.has("activity_log") || domains.has("offline_history") ? pruneSyncHistory(difference.model, data, this.deps.clock?.() ?? Date.now()) : difference.model;
        const layout = domains.has("setting") ? syncLayout(data.setting) : state.layout;
        const changed = difference.changed || syncJson(layout) !== syncJson(state.layout) || beforeModel !== syncJson(result);
        if (changed) {
            state.counter = difference.changed ? clock : state.counter;
            if (touched) {
                for (const key of Object.keys(state.model.records)) if (selected(key)) delete state.model.records[key];
                Object.assign(state.model.records, result.records); state.model.frontiers = result.frontiers;
                for (const key of Object.keys(state.shadow)) if (selected(key)) delete state.shadow[key];
                Object.assign(state.shadow, projectSyncData(data, state.model.frontiers));
            } else { state.model = result; state.shadow = projectSyncData(data, state.model.frontiers); }
            state.layout = layout;
            const alreadyDirty = state.dirty || !!state.pending;
            state.dirty = true;
            const changedAt = this.deps.clock?.() ?? Date.now();
            state.dirtySinceAt ||= touched && !alreadyDirty ? changedAt : changedAt - 30000;
            state.lastLocalChangeAt = changedAt;
            state.localRevision = (state.localRevision || 0) + 1;
            if (domains.has("activity_log")) {
                const eligible = new Set(state.undoEligible);
                for (const entry of data.activity_log.entries || []) if (entry.originReplicaId === state.replicaId && entry.commitState === "committed") eligible.add(entry.id);
                state.undoEligible = [...eligible].filter(id => data.activity_log.entries.some((/** @type {any} */ entry) => entry.id === id));
            }
            await this.writeWithoutLock(state);
        }
        this.error = "";
        return state;
    }
    /** Remote application has a dedicated roll-forward journal; no full import or operation replay. @param {Dict[]} remote @param {string} binding @param {() => Promise<void>} assertCurrent @param {Dict} [confirmed] */
    async merge(remote, binding, assertCurrent, confirmed = {}) {
        let changed = false;
        /** @type {string[]} */ let carNums = [];
        await this.coordinator.runExclusive(async () => {
            await this.recoverWithoutLock();
            let state = await this.reconcileWithoutLock();
            const local = await this.readData();
            await assertCurrent();
            const first = !state.joined || state.binding !== binding;
            if (first) {
                await this.deps.storage?._createSnapshotWithoutMutation?.("多端同步接入前", "sync-join");
                if (state.binding && state.binding !== binding) state = { ...state, replicaId: crypto.randomUUID(), seq: 0, counter: 0, pending: null, confirmed: {}, known: {}, deleting: [], model: emptySyncModel(), shadow: {}, joined: false };
            }
            let cloud = emptySyncModel();
            for (const model of remote) cloud = joinSyncModels(cloud, model);
            if (first) {
                const localProjection = projectSyncData(local, cloud.frontiers);
                const before = visibleSyncRecords(cloud), combined = syncClone(before);
                for (const [key, fields] of Object.entries(localProjection)) {
                    if (!Object.hasOwn(cloud.records, key)) combined[key] = fields;
                    else if (before[key]) for (const [name, value] of Object.entries(/** @type {Dict} */ (fields))) {
                        if ((name.startsWith("f:") || name.startsWith("video:")) && !Object.hasOwn(cloud.records[key].fields, name)) combined[key][name] = value;
                    }
                }
                // A snapshot with no business records still identifies an old
                // library. Missing old policy means 10/30, not this device's UI defaults.
                const existingLibrary = remote.length > 0 || Object.keys(confirmed).length > 0;
                const policy = withSyncRetentionDefaults(existingLibrary ? {} : local.setting, existingLibrary);
                for (const key of Object.keys(SYNC_LEGACY_DEFAULTS)) if (!Object.hasOwn(cloud.records, `setting/${key}`)) combined[`setting/${key}`] = { value: policy[key] };
                state.counter = Math.max(state.counter, maximumClock(cloud)) + 1;
                state.model = versionSyncDiff(cloud, before, combined, [state.counter, state.replicaId]).model;
                state.joined = true; state.binding = binding; state.dirty = true; state.localRevision = (state.localRevision || 0) + 1;
                state.dirtySinceAt = (this.deps.clock?.() ?? Date.now()) - 30000;
                state.lastLocalChangeAt = this.deps.clock?.() ?? Date.now();
            } else state.model = joinSyncModels(state.model, cloud);
            if (!first && !state.retentionPolicyInitialized) {
                const before = visibleSyncRecords(state.model), after = syncClone(before);
                for (const [key, value] of Object.entries(SYNC_LEGACY_DEFAULTS)) if (!Object.hasOwn(state.model.records, `setting/${key}`)) after[`setting/${key}`] = { value };
                const clock = Math.max(state.counter, maximumClock(state.model)) + 1;
                const difference = versionSyncDiff(state.model, before, after, [clock, state.replicaId]);
                if (difference.changed) {
                    state.model = difference.model; state.counter = clock; state.dirty = true;
                    state.localRevision = (state.localRevision || 0) + 1;
                    state.dirtySinceAt ||= (this.deps.clock?.() ?? Date.now()) - 30000;
                    state.lastLocalChangeAt = this.deps.clock?.() ?? Date.now();
                }
            }
            state.retentionPolicyInitialized = true;
            validateSyncState(state.model, this.deps.validateSetting);
            state.model = pruneSyncHistory(state.model, local, this.deps.clock?.() ?? Date.now());
            state.counter = Math.max(state.counter, maximumClock(state.model));
            Object.assign(state.confirmed, confirmed);
            const after = materializeSyncData(state.model, local, state.undoEligible);
            carNums = [...new Set([...local.car_list, ...after.car_list].map((/** @type {any} */ car) => car.carNum))];
            state.shadow = projectSyncData(after, state.model.frontiers);
            state.layout = syncLayout(after.setting);
            changed = SYNC_DOMAINS.some(key => syncJson(local[key]) !== syncJson(after[key]));
            // Even an unchanged materialization may advance deletion/field versions.
            const previous = await this.read();
            if (changed) {
                const pending = await this.forage.getItem(SYNC_JOURNAL_KEY);
                const journal = { schema: 1, state: "prepared", after, afterState: state, binding, notificationId: crypto.randomUUID(), carNums: [...new Set([...(pending?.carNums || []), ...carNums])] };
                await assertCurrent();
                await this.forage.setItem(SYNC_JOURNAL_KEY, journal);
                await this.recoverWithoutLock();
            } else if (syncJson(previous) !== syncJson(state)) {
                await assertCurrent();
                await this.writeWithoutLock(state);
            }
        });
        await this.flushAppliedNotifications();
    }
    /** @param {string[]} carNums */
    async notifyApplied(carNums) {
        this.deps.storage?._invalidateCache?.(); this.deps.storage?.invalidateSettingCache?.();
        let failed = false;
        try { await this.deps.settings?.refresh(); } catch { failed = true; }
        for (const type of ["car-state-changed", "actress-changed", "new-video-changed", "blacklist-rules-changed", "filter-rules-changed", "offline-history-changed", "activity-log-changed", "settings-changed"]) {
            try { await this.deps.events?.emit(type, { source: "remote-sync", scope: "all", carNums }); } catch { failed = true; }
        }
        if (failed) throw new Error("同步界面刷新尚未完成");
    }
}
