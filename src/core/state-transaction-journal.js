// @ts-check

import { jsonCloneSteps } from "./cooperative-work.js";
import { CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { cloneStateValue, stableStateValue, hashState, pruneActivityLog } from "./state-activity-model.js";

/** @typedef {import("./state-service.js").StateService} StateService */
/** @typedef {import("./state-activity-model.js").StateRecord} StateRecord */

/** @param {StateRecord} log
 * @param {StateService} state
 */
export function _prepareActivity(state, log) {
    const pruned = pruneActivityLog(log), ids = new Set(pruned.entries.map((/** @type {any} */ entry) => entry.id));
    state.sync?.notePruned("activity_log", log.entries.filter((/** @type {any} */ entry) => !ids.has(entry.id)));
    return pruned;
}

/** @param {StateRecord} log @param {boolean} [prepared]
 * @param {StateService} state
 */
export async function _writeActivity(state, log, prepared = false) { await state.domains.activity.write(prepared ? log : state._prepareActivity(log)); }

/** @param {StateRecord} domains @param {StateRecord} next @param {StateRecord} activity @param {string[]} [touchedDomains]
 * @param {StateService} state
 */
export async function _commit(state, domains, next, activity, touchedDomains = ["carList", "activity"]) {
    if (state.sync?.replicaId) activity.originReplicaId = state.sync.replicaId;
    const clone = (/** @type {any} */ value) => state.computation ? state.computation.run("state.clone", jsonCloneSteps(value)) : Promise.resolve(cloneStateValue(value));
    const pendingActivity = await clone(activity), pendingLog = state._prepareActivity({ ...domains.activity, entries: [ ...domains.activity.entries, pendingActivity ] });
    const touched = [ ...new Set([ ...touchedDomains, "activity" ]) ];
    const workPatch = domains.partialCarList && touched.includes("carList")
        ? state._workPatch(activity.changes.map((/** @type {StateRecord} */ change) => change.carNum), next.carList) : undefined;
    if (await state._commitAtomic(next, activity, pendingLog, touched, workPatch)) return;
    if (workPatch) throw new Error("作品行更新需要原子存储事务");
    const select = async (/** @type {StateRecord} */ source, includePendingActivity = false) => {
        /** @type {StateRecord} */ const result = {};
        for (const key of touched) result[key] = await clone(key === "activity" && includePendingActivity ? pendingLog : source[key]);
        return result;
    };
    const journal = { schema: 2, dataVersion: CURRENT_DATA_VERSION, id: activity.id, state: "prepared", createdAt: activity.createdAt, touchedDomains: touched, before: await select(domains), after: await select(next, true) };
    await state.storage.set("mutation_journal", journal);
    try {
        for (const key of touched) {
            if (key === "activity") await state._writeActivity(pendingLog, true);
            else await state.domains[key].write(next[key]);
        }
        activity.commitState = "committed", pendingLog.entries = pendingLog.entries.map((/** @param {StateRecord} entry */ entry => entry.id === activity.id ? activity : entry)), await state._writeActivity(pendingLog, true);
    } catch (error) {
        await state._recoverJournal(journal);
        throw error;
    }
    // All domain writes precede the durable committed marker. Cleanup must
    // not turn that successful mutation into a failed non-idempotent toggle.
    let handedOff = true;
    try { await state.sync?.recordCommittedActivity?.(activity, pendingLog.entries); }
    catch (error) { handedOff = false; try { state.logger?.warn?.("[状态] 已提交，同步待处理证明待恢复", error); } catch { /* A logger failure leaves the journal available for recovery. */ } }
    try { if (handedOff) await state.storage.remove("mutation_journal"); }
    catch (error) {
        try { state.logger?.warn?.("[状态] 已提交，事务日志待清理", error); } catch { /* Keep the durable result. */ }
    }
    if (touched.includes("carList")) state._rememberListSnapshot(activity.id, activity.changes, activity);
}

/** The same indexed rows back mutations and undo, including deletion and recreation.
     * @param {Iterable<string>} keys @param {StateRecord[]} records
 * @param {StateService} state
 */
export function _workPatch(state, keys, records) {
    const byNumber = new Map(records.map(record => [normalizeCarNum(record.carNum), record]));
    /** @type {StateRecord[]} */ const upserts = [];
    /** @type {string[]} */ const deletes = [];
    for (const key of new Set(keys)) {
        const record = byNumber.get(key);
        if (record) upserts.push(record);
        else deletes.push(key);
    }
    return { upserts, deletes };
}

/** @param {StateRecord} puts @param {{upserts: StateRecord[], deletes: string[]}} [workPatch]
 * @param {StateService} state
 */
export function _commitWrites(state, puts, workPatch) {
    if (!workPatch) return state.storage.commitLockedBatch({ puts, deletes: [] });
    delete puts[state.domains.carList.storageKey];
    return state.incrementalCarStore.patchWorks(workPatch.upserts, workPatch.deletes, { puts });
}

/** Use detached domain snapshots prepared under the shared mutation lock.
     * @param {StateRecord} next @param {StateRecord} activity @param {StateRecord} log @param {string[]} touched
     * @param {{upserts: StateRecord[], deletes: string[]}} [workPatch]
 * @param {StateService} state
 */
export async function _commitAtomic(state, next, activity, log, touched, workPatch) {
    if (!workPatch && !state.storage.canCommitLockedBatch) return false;
    const committed = { ...activity, commitState: "committed" };
    const committedLog = { ...log, entries: log.entries.map((/** @type {StateRecord} */ entry) => entry.id === activity.id ? committed : entry) };
    const puts = Object.fromEntries(touched.map(key => [state.domains[key].storageKey, key === "activity" ? committedLog : next[key]]));
    const sync = await state.sync?.prepareCommittedMutation?.(Object.keys(puts), committed, committedLog.entries);
    if (!await state._commitWrites({ ...puts, ...sync?.puts }, workPatch)) return false;
    activity.commitState = "committed";
    // Post-commit bookkeeping cannot turn a durable toggle into a retry.
    try { sync?.committed(); } catch (error) { try { state.logger?.warn?.("[状态] 已提交，通知待恢复", error); } catch { /* A logger failure leaves the committed toggle intact. */ } }
    if (touched.includes("carList")) state._rememberListSnapshot(activity.id, activity.changes, activity);
    return true;
}

/** Persist an undo mutation atomically with sync receipts under the shared lock.
     * @param {StateRecord} nextState @param {StateRecord} log @param {string[]} touchedDomains @param {string} undoJournalId
     * @param {{upserts: StateRecord[], deletes: string[]}} [workPatch]
 * @param {StateService} state
 */
export async function _commitUndoAtomic(state, nextState, log, touchedDomains, undoJournalId, workPatch) {
    if (!workPatch && !state.storage.canCommitLockedBatch) return false;
    const puts = Object.fromEntries(touchedDomains.map(key => [state.domains[key].storageKey, key === "activity" ? log : nextState[key]]));
    const undoNotice = { id: undoJournalId, changes: [], commitState: "committed" };
    const sync = await state.sync?.prepareCommittedMutation?.(Object.keys(puts), undoNotice, log.entries);
    if (!await state._commitWrites({ ...puts, ...sync?.puts }, workPatch)) return false;
    try { sync?.committed(); } catch (error) { try { state.logger?.warn?.("[状态] 撤销已提交，通知待恢复", error); } catch { /* A logger failure leaves the committed undo intact. */ } }
    state._listSnapshot = null;
    return true;
}

/** @param {StateRecord} journal
 * @param {StateService} state
 */
export async function _recoverJournal(state, journal) {
    if (journal.dataVersion !== undefined && (!Number.isInteger(journal.dataVersion) || journal.dataVersion < 0 || journal.dataVersion > CURRENT_DATA_VERSION)) throw new Error("状态恢复日志来自不支持的数据版本，请更新 JHS");
    if (journal.schema != null && ![1, 2].includes(journal.schema) || !journal.before || !journal.after) throw new Error("状态恢复日志格式无效，已保留原数据");
    const touched = Array.isArray(journal.touchedDomains) ? journal.touchedDomains : ["carList", "actresses", "decisions", "activity"];
    if (touched.some((/** @type {string} */ key) => !Object.hasOwn(state.domains, key))) throw new Error("状态恢复日志包含未知数据域");
    if (journal.dataVersion >= 4 && touched.some((/** @type {string} */ key) => !Object.hasOwn(journal.before, key) || !Object.hasOwn(journal.after, key))) throw new Error("状态恢复日志缺少数据域快照，已保留原数据");
    const log = await state.getActivityLog(), activity = log.entries.find((/** @param {StateRecord} entry */ entry => entry.id === journal.id));
    if ("committed" === activity?.commitState) {
        if (journal.schema !== 2) {
            for (const key of touched.filter((/** @type {string} */ key) => key !== "activity")) await state.domains[key].write(journal.after[key]);
        }
        await state.sync?.recordCommittedActivity?.(activity, log.entries);
    } else {
        const current = await state._readDomains(touched), keys = touched.filter((key) => key !== "activity");
        const conflict = keys.some((key => {
            const value = stableStateValue(current[key]);
            return value !== stableStateValue(journal.before[key]) && value !== stableStateValue(journal.after[key]);
        }));
        if (conflict) {
            // 冲突时保留业务数据，但先把证据归档，避免静默丢失诊断线索。
            const archive = {
                journal: cloneStateValue(journal),
                detectedAt: new Date().toISOString(),
                currentStateHash: await hashState(Object.fromEntries(keys.map((key) => [key, current[key]]))),
            };
            try {
                const archives = await state.storage.get("mutation_journal_conflicts") || [];
                archives.push(archive), archives.length > 20 && archives.splice(0, archives.length - 20);
                await state.storage.set("mutation_journal_conflicts", archives), await state.storage.remove("mutation_journal");
            } catch (archiveError) {
                try { state.logger?.error?.("[状态] 冲突事务归档失败，保留原事务日志", archiveError); }
                catch { /* Preserve the archive failure and the active journal. */ }
                throw archiveError;
            }
            try { state.logger?.warn?.("[状态] 检测到未完成状态事务且数据已变化，已归档证据并保留当前数据"); }
            catch { /* Recovery is already durable. */ }
            try { state.notifications?.info?.("检测到未完成的状态事务，已保留当前数据并归档冲突证据"); }
            catch { /* Recovery is already durable. */ }
            return;
        }
        for (const key of touched.filter((/** @type {string} */ key) => key !== "activity")) await state.domains[key].write(journal.before[key]);
        journal.before.activity ? await state._writeActivity(journal.before.activity) : (log.entries = log.entries.filter((/** @param {StateRecord} entry */ entry => entry.id !== journal.id)), await state._writeActivity(log));
    }
    await state.storage.remove("mutation_journal");
}

/** @param {StateService} state */
export async function _recoverWithoutLock(state) {
    const journal = await state.storage.get("mutation_journal");
    return journal ? (await state._recoverJournal(journal), !0) : !1;
}
