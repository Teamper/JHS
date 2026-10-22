// @ts-check

import { assertSupportedDataVersion } from "./migration.js";
import { SYNC_DOMAINS, emptySyncModel, historyRank, joinSyncModels, materializeSyncData, maximumClock, projectSyncData, pruneSyncHistory, syncClone, syncJson, syncLayout, validateSyncState, versionSyncDiff, visibleSyncRecords } from "./webdav-sync-model.js";

/** @typedef {Record<string, any>} Dict */
export const SYNC_STATE_KEY = "jhs_webdav_sync_state_v1";
export const SYNC_JOURNAL_KEY = "jhs_webdav_sync_journal_v1";

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
    }
    /** @returns {Promise<Dict>} */
    async read() {
        const state = await this.forage.getItem(SYNC_STATE_KEY);
        if (state && (state.schema !== 1 || !state.model?.records || !state.shadow || !Array.isArray(state.undoEligible))) throw new Error("同步状态损坏或版本不受支持，请保留数据并使用恢复入口");
        if (state) { this.replicaId = state.replicaId; this.eligible = new Set(state.undoEligible); return state; }
        return { schema: 1, replicaId: "", counter: 0, seq: 0, localRevision: 0, publishedRevision: 0, joined: false, binding: "", model: emptySyncModel(), shadow: {}, layout: {}, dirty: false, pending: null, confirmed: {}, known: {}, deleting: [], lastSuccessAt: 0, retryAt: 0, failures: 0, error: "", cleanupError: "", paused: false, undoEligible: [] };
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
    async writeWithoutLock(state) { await this.forage.setItem(SYNC_STATE_KEY, state); this.replicaId = state.replicaId; this.eligible = new Set(state.undoEligible); }
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
            if (succeeded) await this.reconcileWithoutLock(current.pruned);
            this.error = "";
        } catch { this.error = "业务数据已保存，同步进度待修复；稍后将重新核对完整数据"; }
        this.dispatchEvent(new Event("changes"));
    }
    /** @param {string} id */
    canUndo(id) { return this.eligible.has(id); }
    /** @returns {Promise<Dict>} */
    async readData() {
        const values = await Promise.all(SYNC_DOMAINS.map(async key => [key, await this.forage.getItem(key)]));
        return Object.fromEntries(values.map(([key, value]) => [key, value ?? (["setting", "new_video_decisions"].includes(key) ? {} : key === "activity_log" ? { entries: [] } : [])]));
    }
    /** Must run before every subsequent writer, even after a page crash. */
    async recoverWithoutLock() {
        const journal = await this.forage.getItem(SYNC_JOURNAL_KEY);
        if (!journal) return;
        await assertSupportedDataVersion(this.deps.storage);
        if (journal.schema !== 1 || !journal.after || journal.afterState?.schema !== 1 || !SYNC_DOMAINS.every(key => Object.hasOwn(journal.after, key))) throw new Error("同步恢复日志版本无效，已停止写入以保留本地数据");
        if (journal.state !== "committed") {
            for (const key of SYNC_DOMAINS) await this.forage.setItem(key, journal.after[key]);
            await this.writeWithoutLock(journal.afterState);
            await this.forage.setItem(SYNC_JOURNAL_KEY, { ...journal, state: "committed" });
        }
        await this.forage.removeItem(SYNC_JOURNAL_KEY);
        this.deps.storage?._invalidateCache?.();
        this.deps.storage?.invalidateSettingCache?.();
    }
    /** Bind final durable business values to versions; never infer from notification counts. @param {Dict} [pruned] */
    async reconcileWithoutLock(pruned = {}) {
        await assertSupportedDataVersion(this.deps.storage);
        await this.deps.storage?.stateService?.recoverPendingTransactionWithoutLock?.();
        const state = await this.read();
        if (!state.joined) {
            const activity = await this.forage.getItem("activity_log");
            const ids = [...new Set([...state.undoEligible, ...(activity?.entries || []).filter((/** @type {any} */ entry) => entry.originReplicaId === state.replicaId && entry.commitState === "committed").map((/** @type {any} */ entry) => entry.id)])];
            if (syncJson(ids) !== syncJson(state.undoEligible)) { state.undoEligible = ids; await this.writeWithoutLock(state); }
            return state;
        }
        const data = await this.readData();
        const beforeModel = syncJson(state.model);
        for (const [domain, frontier] of Object.entries(pruned)) state.model.frontiers[domain] = [state.model.frontiers[domain] || "", frontier].sort().at(-1);
        const next = projectSyncData(data, state.model.frontiers);
        const before = Object.fromEntries(Object.entries(state.shadow).filter(([key, fields]) => !["activity_log", "offline_history"].includes(key.split("/")[0]) || historyRank(/** @type {Dict} */ (fields).value) > (state.model.frontiers[key.split("/")[0]] || "")));
        const clock = Math.max(state.counter, maximumClock(state.model)) + 1;
        if (!Number.isSafeInteger(clock)) throw new Error("同步逻辑版本已超出安全范围");
        const difference = versionSyncDiff(state.model, before, next, [clock, state.replicaId]);
        state.model = pruneSyncHistory(difference.model, data, this.deps.clock?.() ?? Date.now());
        const layout = syncLayout(data.setting);
        const changed = difference.changed || syncJson(layout) !== syncJson(state.layout) || beforeModel !== syncJson(state.model);
        if (changed) {
            state.counter = difference.changed ? clock : state.counter;
            state.shadow = projectSyncData(data, state.model.frontiers);
            state.layout = layout;
            state.dirty = true;
            state.localRevision = (state.localRevision || 0) + 1;
            const eligible = new Set(state.undoEligible);
            for (const entry of data.activity_log.entries || []) if (entry.originReplicaId === state.replicaId && entry.commitState === "committed") eligible.add(entry.id);
            state.undoEligible = [...eligible].filter(id => data.activity_log.entries.some((/** @type {any} */ entry) => entry.id === id));
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
                state.counter = Math.max(state.counter, maximumClock(cloud)) + 1;
                state.model = versionSyncDiff(cloud, before, combined, [state.counter, state.replicaId]).model;
                state.joined = true; state.binding = binding; state.dirty = true; state.localRevision = (state.localRevision || 0) + 1;
            } else state.model = joinSyncModels(state.model, cloud);
            validateSyncState(state.model);
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
            if (changed || syncJson(previous) !== syncJson(state)) {
                const journal = { schema: 1, state: "prepared", after, afterState: state, binding };
                await assertCurrent();
                await this.forage.setItem(SYNC_JOURNAL_KEY, journal);
                await this.recoverWithoutLock();
            }
        });
        if (changed) await this.notifyApplied(carNums);
    }
    /** @param {string[]} carNums */
    async notifyApplied(carNums) {
        this.deps.storage?._invalidateCache?.(); this.deps.storage?.invalidateSettingCache?.();
        await this.deps.settings?.refresh();
        for (const type of ["car-state-changed", "actress-changed", "new-video-changed", "blacklist-rules-changed", "filter-rules-changed", "offline-history-changed", "activity-log-changed", "settings-changed"]) {
            try { await this.deps.events?.emit(type, { source: "remote-sync", scope: "all", carNums }); } catch { /* Data is committed; a UI listener must not reclassify it. */ }
        }
    }
}
