// @ts-check
import { ComputationBudget } from "./cooperative-work.js";
import { SYNC_DOMAINS, historyRank, joinSyncModelsAsync, materializeSyncDataAsync, maximumClockAsync, projectSyncDataAsync, pruneSyncHistoryAsync, syncJsonAsync, syncLayout, versionSyncDiffAsync } from "./webdav-sync-model.js";
import { equalSyncValuesAsync, stringifySyncDataAsync, needsHistoryPruneAsync, changedSyncKeysAsync } from "./webdav-sync-model.js";
/** @typedef {Record<string, any>} Dict */

/** @param {any} payload @param {ComputationBudget} work */
async function reconcile({ state, data, pruned, touched, lastPendingAt = 0, now }, work) {
    if (!state.joined) {
        return { state, changed: false };
    }
    // Cached worker graphs are immutable inputs. Only writable containers and
    // changed records are copied by this reconciliation.
    state = { ...state, model: { records: { ...state.model.records }, frontiers: { ...state.model.frontiers } }, shadow: { ...state.shadow } };
    const domains = new Set(touched ? [...touched, ...Object.keys(pruned)].filter(key => SYNC_DOMAINS.includes(key)) : SYNC_DOMAINS);
    const selected = (/** @type {string} */ key) => domains.has(key.split("/")[0]);
    work.diagnostics?.recordWork("sync.reconcileDomains", domains.size);
    const model = touched ? { records: Object.fromEntries(Object.entries(state.model.records).filter(([key]) => selected(key))), frontiers: { ...state.model.frontiers } } : state.model;
    const beforeFrontiers = (await syncJsonAsync(model.frontiers, work));
    for (const [domain, frontier] of Object.entries(pruned)) model.frontiers[domain] = [model.frontiers[domain] || "", frontier].sort().at(-1);
    const next = (await projectSyncDataAsync(data, model.frontiers, work));
    const before = Object.fromEntries(Object.entries(state.shadow).filter(([key, fields]) => {
        const domain = key.split("/")[0];
        return selected(key) && (!["activity_log", "offline_history"].includes(domain) || historyRank(/** @type {Dict} */ (fields).value) > (model.frontiers[domain] || ""));
    }));
    const clock = Math.max(state.counter, (await maximumClockAsync(model, work))) + 1;
    if (!Number.isSafeInteger(clock)) throw new Error("同步逻辑版本已超出安全范围");
    const difference = (await versionSyncDiffAsync(model, before, next, [clock, state.replicaId], work, true));
    const beforeCount = Object.keys(difference.model.records).length;
    const result = (domains.has("activity_log") || domains.has("offline_history")) && await needsHistoryPruneAsync(difference.model, work) ? (await pruneSyncHistoryAsync(difference.model, data, now, work)) : difference.model;
    const layout = domains.has("setting") ? syncLayout(data.setting) : state.layout;
    const prunedProjection = beforeFrontiers === (await syncJsonAsync(result.frontiers, work)) ? next : (await projectSyncDataAsync(data, result.frontiers, work));
    const changed = difference.changed || (await syncJsonAsync(layout, work)) !== (await syncJsonAsync(state.layout, work)) || beforeFrontiers !== (await syncJsonAsync(result.frontiers, work)) || beforeCount !== Object.keys(result.records).length;
    if (changed) {
        state.counter = difference.changed ? clock : state.counter;
        if (touched) {
            for (const key of Object.keys(state.model.records)) if (selected(key)) delete state.model.records[key];
            Object.assign(state.model.records, result.records); state.model.frontiers = result.frontiers;
            for (const key of Object.keys(state.shadow)) if (selected(key)) delete state.shadow[key];
            Object.assign(state.shadow, prunedProjection);
        } else { state.model = result; state.shadow = prunedProjection; }
        state.layout = layout;
        const alreadyDirty = state.dirty || !!state.pending;
        state.dirty = true;
        const changedAt = lastPendingAt || now;
        state.dirtySinceAt ||= touched && !alreadyDirty ? changedAt : changedAt - 30000;
        state.lastLocalChangeAt = changedAt;
        state.localRevision = (state.localRevision || 0) + 1;
        if (domains.has("activity_log")) {
            const eligible = new Set(state.undoEligible);
            const present = new Set(data.activity_log.entries.map((/** @type {any} */ entry) => entry.id));
            state.undoEligible = [...eligible].filter(id => present.has(id));
        }
    }
    return { state, changed };
}

/** Pure jobs shared by the worker and cooperative fallback.
 * @param {string} job @param {any} payload @param {ComputationBudget} work */
export async function runSyncJob(job, payload, work) {
    switch (job) {
        case "reconcile": return reconcile(payload, work);
        case "join": return joinSyncModelsAsync(payload.left, payload.right, work);
        case "project": return projectSyncDataAsync(payload.data, payload.frontiers, work);
        case "materialize": return materializeSyncDataAsync(payload.model, payload.local, payload.undoEligible, work);
        case "equal": return equalSyncValuesAsync(payload.left, payload.right, work);
        case "verified": return await equalSyncValuesAsync(payload.model, payload.verifiedModel, work)
            && await equalSyncValuesAsync(payload.data, payload.verifiedData, work)
            && await equalSyncValuesAsync(payload.eligible, payload.verifiedEligible, work);
        case "stringify": return stringifySyncDataAsync(payload, work);
        case "parse": return JSON.parse(payload);
        default: throw new TypeError("未知同步计算任务");
    }
}

/** Preserve record sharing across the thread boundary by returning changed entries.
 * @param {Dict} base @param {Dict} result @param {ComputationBudget} work */
export async function encodeReconciliation(base, result, work) {
    if (!result.changed) return { changed: false };
    /** @type {Dict} */ const recordPuts = {}, shadowPuts = {};
    /** @type {string[]} */ const recordDeletes = [], shadowDeletes = [];
    const records = result.state.model.records;
    for (const key of new Set([...Object.keys(base.model.records), ...Object.keys(records)])) {
        if (!Object.hasOwn(records, key)) recordDeletes.push(key);
        else if (records[key] !== base.model.records[key]) Object.defineProperty(recordPuts, key, { value: records[key], enumerable: true });
    }
    for (const key of await changedSyncKeysAsync(base.shadow, result.state.shadow, work)) {
        if (!Object.hasOwn(result.state.shadow, key)) shadowDeletes.push(key);
        else Object.defineProperty(shadowPuts, key, { value: result.state.shadow[key], enumerable: true });
    }
    const { model, shadow, ...state } = result.state;
    const { records: omitted, ...modelMetadata } = model;
    return { changed: true, state, delta: { recordPuts, recordDeletes, shadowPuts, shadowDeletes, modelMetadata } };
}

/** @param {Dict} base @param {Dict} result */
export function decodeReconciliation(base, result) {
    if (!result.changed) return { ...result, state: base };
    if (!result.delta) return result;
    const { delta, ...reply } = result;
    const records = { ...base.model.records, ...delta.recordPuts }, shadow = { ...base.shadow, ...delta.shadowPuts };
    for (const key of delta.recordDeletes) delete records[key];
    for (const key of delta.shadowDeletes) delete shadow[key];
    return { ...reply, state: { ...result.state, model: { records, ...delta.modelMetadata }, shadow } };
}
