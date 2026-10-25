// @ts-check

import { ComputationBudget } from "./cooperative-work.js";
import { changedSyncKeysAsync, equalSyncValuesAsync, syncRecordMapAsync, needsHistoryPruneAsync } from "./webdav-sync-model.js";
import { assertSupportedDataVersion } from "./migration.js";
import { normalizeCarNum } from "./constants.js";
import { SyncPendingLedger } from "./sync-pending-ledger.js";
import { SYNC_DOMAINS, SYNC_LEGACY_DEFAULTS, emptySyncModel, historyRank, joinSyncModelsAsync, materializeSyncDataAsync, maximumClockAsync, projectSyncDataAsync, pruneSyncHistoryAsync, syncCloneAsync, syncJsonAsync, syncLayout, validateSyncStateAsync, versionSyncDiffAsync, visibleSyncRecordsAsync, withSyncRetentionDefaults } from "./webdav-sync-model.js";

/** @typedef {Record<string, any>} Dict */
export const SYNC_STATE_KEY = "jhs_webdav_sync_state_v1";
export const SYNC_JOURNAL_KEY = "jhs_webdav_sync_journal_v1";

/** Confirmed remote models are already durably joined into state.model. @param {Dict} state */
function compactSyncMetadata(state) {
    for (const item of Object.values(state.confirmed || {})) delete item.model;
    if (state.pending) delete state.pending.model;
    return state;
}
/** @param {Dict} a @param {Dict} b */
function sameSyncRevision(a, b) { return ["generation", "metadataRevision", "epoch", "replicaId"].every(key => a[key] === b[key]); }

/** Durable local sidecar. All *WithoutLock methods require the business lock. */
export class WebDavSyncStore extends EventTarget {
    /** @param {any} dependencies */
    constructor(dependencies) {
        super();
        this.deps = dependencies;
        this.forage = dependencies.forage;
        this.coordinator = dependencies.coordinator;
        this.recoverBeforeMutation = () => this.recoverWithoutLock();
        this.ledger = new SyncPendingLedger(this.forage, dependencies.clock);
        this.undoEpoch = "";
        /** @type {Set<string>} */ this.baseEligible = new Set();
        this.hasDeferred = false;
        /** @type {Promise<any> | null} */ this.reconciliation = null;
        /** @type {ReturnType<typeof setTimeout> | null} */ this.reconciliationTimer = null;
        this.backgroundAbort = new AbortController();
        /** @type {WeakSet<ComputationBudget>} */ this.idleBudgets = new WeakSet();
        this.enabled = false;
        this.error = "";
        this.replicaId = "";
        /** @type {Set<string>} */ this.eligible = new Set();
        /** @type {{touched: Set<string>, pruned: Dict} | null} */ this.current = null;
        /** Detached, process-owned snapshots; later rounds still perform a complete missed-write repair.
         * @type {{model: Dict, data: Dict, eligibility: string[], binding: string, maintenanceAt: number} | null} */ this.verifiedMerge = null;
        this.notificationPending = false;
        this.notificationError = "";
        this.notificationRetryAt = 0;
        /** @type {Promise<void> | null} */ this.notificationDrain = null;
        this.coordinator.afterRelease = () => { this.scheduleNotifications(); this.scheduleReconciliation(); };
    }
    /** @returns {Promise<Dict>} */
    async read() {
        for (;;) {
        const before = await this.ledger.read();
        const state = await this.forage.getItem(SYNC_STATE_KEY);
        const pending = await this.ledger.read();
        if (before.epoch !== pending.epoch) continue;
        return this.readStateSnapshot(state, pending);
        }
    }
    /** Interpret an epoch-verified read, or a snapshot owned by the shared lock. @param {Dict | null} state @param {Dict} pending @returns {Dict} */
    readStateSnapshot(state, pending) {
        if (state && (state.schema !== 1 || !state.model?.records || !state.shadow || !Array.isArray(state.undoEligible))) throw new Error("同步状态损坏或版本不受支持，请保留数据并使用恢复入口");
        // A crashed reset may leave a new ledger epoch beside an old sidecar.
        // Fail closed until initialization repairs it; never spin on storage.
        if (state?.undoEpoch && state.undoEpoch !== pending.epoch) state.undoEligible = [];
        if (state) {
            this.replicaId = state.replicaId; this.installUndo(state.undoEligible, pending);
            if (Object.keys(pending.domains).length) {
                state.dirty = true;
                state.dirtySinceAt = Math.min(state.dirtySinceAt || Infinity, pending.firstPendingAt || this.deps.clock?.() || Date.now());
                state.lastLocalChangeAt = Math.max(state.lastLocalChangeAt || 0, pending.lastPendingAt || state.dirtySinceAt);
                this.hasDeferred = true;
            }
            return compactSyncMetadata(state);
        }
        return { schema: 1, replicaId: "", counter: 0, seq: 0, localRevision: 0, publishedRevision: 0, joined: false, binding: "", model: emptySyncModel(), shadow: {}, layout: {}, dirty: false, dirtySinceAt: 0, lastLocalChangeAt: 0, pending: null, confirmed: {}, known: {}, deleting: [], lastSuccessAt: 0, retryAt: 0, failures: 0, error: "", cleanupError: "", paused: false, undoEligible: [] };
    }
    async initialize() {
        return this.coordinator.runExclusive(async () => {
            // The registered hook already completed recovery inside this same lock.
            if (this.coordinator.beforeMutation !== this.recoverBeforeMutation) await this.recoverWithoutLock();
            const [pending, stored] = await Promise.all([this.ledger.read(), this.forage.getItem(SYNC_STATE_KEY)]);
            const state = this.readStateSnapshot(stored, pending);
            const needsReplica = !state.replicaId;
            if (needsReplica) {
                state.replicaId = crypto.randomUUID();
                const activity = await this.forage.getItem("activity_log");
                state.undoEligible = (activity?.entries || []).filter((/** @type {any} */ entry) => entry.commitState === "committed").map((/** @type {any} */ entry) => entry.id);
            }
            // First creation, legacy adoption and interrupted resets persist ledger before sidecar.
            // All reads here remain under this same shared lock; public read() still verifies epochs.
            if (needsReplica || state.undoEpoch !== pending.epoch) await this.writeWithoutLock(state, pending);
            return state;
        });
    }
    /** @param {Dict} state @param {Dict | null} [pending] */
    async writeWithoutLock(state, pending = null) {
        const current = pending ?? await this.ledger.read();
        current.metadataRevision++;
        if (!Number.isSafeInteger(current.metadataRevision)) throw new Error("同步元数据版本已超出安全范围");
        current.replicaId = state.replicaId;
        state.undoEpoch = current.epoch;
        await this.ledger.write(current);
        this.deps.diagnostics?.recordWork("sync.metadataWrites");
        await this.forage.setItem(SYNC_STATE_KEY, compactSyncMetadata(state));
        this.replicaId = state.replicaId; this.installUndo(state.undoEligible, current);
    }
    /** @param {(state: Dict) => void | Promise<void>} change */
    update(change) { return this.coordinator.runExclusive(async () => { const state = await this.read(); await change(state); await this.writeWithoutLock(state); return state; }); }
    begin() { this.current = this.enabled ? { touched: new Set(), pruned: {} } : null; }
    /** @param {string} key */
    async capture(key) {
        if (!SYNC_DOMAINS.includes(key) || !this.current) return;
        // Persist before every write, including the pending/committed activity pair.
        await this.ledger.capture(key, this.current.pruned[key]);
        this.current.touched.add(key); this.hasDeferred = true;
    }
    /** @param {string} domain @param {any[]} entries */
    notePruned(domain, entries) { if (this.current && entries.length) this.current.pruned[domain] = [this.current.pruned[domain] || "", ...entries.map(historyRank)].sort().at(-1); }
    /** @param {boolean} succeeded */
    async finish(succeeded) {
        const current = this.current; this.current = null;
        if (!current?.touched.size) return;
        if (Object.keys(current.pruned).length) {
            try {
                const pending = await this.ledger.read();
                for (const [domain, floor] of Object.entries(current.pruned)) pending.candidates[domain] = [pending.candidates[domain] || "", floor].sort().at(-1);
                await this.ledger.write(pending);
            } catch { this.error = "业务数据已保存，同步裁剪进度待恢复"; }
        }
        // Failed/partial writes are repaired from their recovered final data too.
        this.hasDeferred = true;
    }
    /** @param {string} id */
    canUndo(id) { return this.eligible.has(id); }
    /** Install only a baseline paired with its verified epoch. @param {string[] | null} freshBase @param {Dict} pending */
    installUndo(freshBase, pending) {
        if (this.undoEpoch && this.undoEpoch !== pending.epoch) this.baseEligible.clear();
        if (freshBase !== null) this.baseEligible = new Set(freshBase);
        this.undoEpoch = pending.epoch;
        this.eligible = new Set([...this.baseEligible, ...(pending.replicaId === this.replicaId ? pending.localUndoIds : [])]);
    }
    async refreshUndo() {
        for (;;) {
        const pending = await this.ledger.read();
        let base = null;
        if (this.undoEpoch && this.undoEpoch !== pending.epoch) {
            const current = await this.forage.getItem(SYNC_STATE_KEY);
            const latest = await this.ledger.read();
            if (latest.epoch !== pending.epoch) continue;
            base = current?.undoEpoch === pending.epoch ? current.undoEligible : [];
        }
        this.installUndo(base, pending);
        return;
        }
    }
    /** The activity committed marker is durable, but its business journal has not yet been removed. @param {Dict} activity @param {Dict[]} [entries] */
    async recordCommittedActivity(activity, entries) {
        if (!this.enabled || !activity.originReplicaId || activity.originReplicaId !== this.replicaId || activity.commitState !== "committed") return;
        const pending = await this.ledger.read();
        if (pending.replicaId !== this.replicaId) return;
        const present = new Set((entries || (await this.forage.getItem("activity_log"))?.entries || []).filter((/** @type {Dict} */ entry) => entry.commitState === "committed").map((/** @type {Dict} */ entry) => entry.id));
        pending.localUndoIds = [...new Set([...pending.localUndoIds, activity.id])].filter(id => present.has(id));
        await this.ledger.write(pending);
        await this.refreshUndo();
    }
    /** Called under the shared lock when user data is replaced. */
    async resetUndoWithoutLock() {
        const state = await this.read();
        const pending = await this.ledger.read(); pending.epoch = crypto.randomUUID(); pending.localUndoIds = [];
        await this.ledger.write(pending); this.baseEligible.clear(); await this.refreshUndo();
        if (state.replicaId) { state.undoEligible = []; await this.writeWithoutLock(state); }
    }
    // Wake transport before another tab can drain the shared intent without a local reconciliation event.
    requestReconciliation() { this.hasDeferred = true; this.dispatchEvent(new Event("changes")); this.scheduleReconciliation(); }
    scheduleReconciliation() {
        if (!this.enabled || !this.hasDeferred || !this.deps.backgroundWork || this.reconciliationTimer || this.reconciliation || this.backgroundAbort.signal.aborted) return;
        this.reconciliationTimer = setTimeout(() => {
            this.reconciliationTimer = null;
            void (async () => {
                await this.deps.backgroundWork.waitForTurn({ signal: this.backgroundAbort.signal });
                await this.flushPending({ work: new ComputationBudget({ signal: this.backgroundAbort.signal, diagnostics: this.deps.diagnostics }) });
            })().catch(error => { if (error?.name !== "AbortError") this.error = "业务数据已保存，同步进度待修复；稍后将重新核对完整数据"; });
        }, 250);
    }
    dispose() { this.backgroundAbort.abort(); if (this.reconciliationTimer) clearTimeout(this.reconciliationTimer); this.reconciliationTimer = null; }
    /** Wait outside the lock after each time slice, so a user save in another frame/tab can finish first. @param {ComputationBudget} work */
    idleBudget(work) {
        if (this.idleBudgets.has(work)) return work;
        const budget = new ComputationBudget({ ...work, yieldTask: async () => { await work.yieldTask(); await this.coordinator.waitForIdle(); } });
        this.idleBudgets.add(budget);
        return budget;
    }
    /** @param {readonly string[]} [domains] @returns {Promise<Dict>} */
    async readData(domains = SYNC_DOMAINS) {
        const values = await Promise.all(domains.map(async key => [key, await this.forage.getItem(key)]));
        return Object.fromEntries(values.map(([key, value]) => [key, value ?? (["setting", "new_video_decisions"].includes(key) ? {} : key === "activity_log" ? { entries: [] } : [])]));
    }
    /** Must run before every subsequent writer, even after a page crash. @returns {Promise<{notificationId: string, carNums: string[], domains?: string[], changedNames?: string[]} | null>} */
    async recoverWithoutLock() {
        // Independent reads start under the caller's lock; intent validation still precedes every write.
        let [, journal] = await Promise.all([this.ledger.read(), this.forage.getItem(SYNC_JOURNAL_KEY)]);
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
        return { notificationId: journal.notificationId, carNums: journal.carNums, domains: journal.domains, changedNames: journal.changedNames };
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
            await this.notifyApplied(notice.carNums, notice);
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
    /** Full checks repair missed writes; successful mutations reconcile only their captured domains. @param {Dict} [pruned] @param {Set<string> | null} [touched] @param {ComputationBudget} [work] */
    async reconcileWithoutLock(pruned = {}, touched = null, work = new ComputationBudget({ diagnostics: this.deps.diagnostics })) {
        await assertSupportedDataVersion(this.deps.storage);
        await this.deps.storage?.stateService?.recoverPendingTransactionWithoutLock?.();
        const snapshot = await this.captureReconciliation(touched);
        const result = await this.computeReconciliation(snapshot.state, snapshot.data, { ...snapshot.pruned, ...pruned }, snapshot.domains, work, snapshot.pending.lastPendingAt);
        if (result.changed || snapshot.eligibilityChanged) await this.writeWithoutLock(result.state);
        await this.acknowledgeReconciliation(snapshot.pending, result.state, snapshot.domains);
        return result.state;
    }
    /** Pure computation over a detached snapshot; never holds the storage lock in the background path. */
    /** @param {Dict} state @param {Dict} data @param {Dict} pruned @param {Set<string> | null} touched @param {ComputationBudget} work @param {number} [lastPendingAt] */
    async computeReconciliation(state, data, pruned, touched, work, lastPendingAt = 0) {
        if (!state.joined) {
            return { state, changed: false };
        }
        const domains = new Set(touched ? [...touched, ...Object.keys(pruned)].filter(key => SYNC_DOMAINS.includes(key)) : SYNC_DOMAINS);
        const selected = (/** @type {string} */ key) => domains.has(key.split("/")[0]);
        this.deps.diagnostics?.recordWork("sync.reconcileDomains", domains.size);
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
        const result = (domains.has("activity_log") || domains.has("offline_history")) && await needsHistoryPruneAsync(difference.model, work) ? (await pruneSyncHistoryAsync(difference.model, data, this.deps.clock?.() ?? Date.now(), work)) : difference.model;
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
            const changedAt = lastPendingAt || this.deps.clock?.() || Date.now();
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
    /** Caller owns the shared lock. @param {Set<string> | null} touched */
    async captureReconciliation(touched) {
        const pending = await this.ledger.read(), state = await this.read();
        const domains = touched ? new Set([...touched, ...Object.keys(pending.domains), ...Object.keys(pending.candidates)]) : null;
        const data = await this.readData(domains ? [...domains] : SYNC_DOMAINS);
        const present = data.activity_log ? new Set(data.activity_log.entries.filter((/** @type {any} */ entry) => entry.commitState === "committed").map((/** @type {any} */ entry) => entry.id)) : null;
        const undo = [...new Set([...state.undoEligible, ...(pending.replicaId === state.replicaId ? pending.localUndoIds : [])])].filter(id => !present || present.has(id));
        const eligibilityChanged = undo.length !== state.undoEligible.length || undo.some((id, index) => id !== state.undoEligible[index]); state.undoEligible = undo;
        const pruned = /** @type {Dict} */ ({});
        // A prepared pruning intent may outlive a failed domain write. Advance
        // only when recovered durable data contains no record at/below its floor.
        for (const [domain, floor] of Object.entries(pending.candidates)) {
            const entries = domain === "activity_log" ? data[domain]?.entries : data[domain];
            if (Array.isArray(entries) && entries.every(entry => historyRank(entry) > floor)) pruned[domain] = floor;
        }
        return { pending, state, data, domains, pruned, eligibilityChanged };
    }
    /** Caller owns the shared lock. @param {Dict} covered @param {Dict} state @param {Set<string> | null} domains */
    async acknowledgeReconciliation(covered, state, domains) {
        const current = await this.ledger.read();
        for (const [domain, generation] of Object.entries(covered.domains)) {
            if ((!domains || domains.has(domain)) && current.domains[domain] === generation) { delete current.domains[domain]; delete current.candidates[domain]; }
        }
        // Retain the bounded local receipt index after draining domains: another
        // tab may still have an older in-memory copy of sidecar.undoEligible.
        if (current.epoch === covered.epoch) current.localUndoIds = current.localUndoIds.filter((/** @type {string} */ id) => state.undoEligible.includes(id) || !covered.localUndoIds.includes(id));
        this.hasDeferred = Object.keys(current.domains).length > 0;
        if (!this.hasDeferred) { current.firstPendingAt = 0; current.lastPendingAt = 0; }
        await this.ledger.write(current);
        this.error = "";
    }
    /** Caller owns the business lock. Proofs never outlive the transport round which owns them.
     * @param {Dict | undefined} round @param {Dict} state @param {Dict} local @param {Dict | null} [expected] */
    async rememberRound(round, state, local, expected = null) {
        if (!round || round.active === false || round.signal?.aborted) return;
        const pending = await this.ledger.read();
        round.proof = expected && !sameSyncRevision(pending, expected) ? null : { owner: this, binding: round.binding, pending, state, local };
    }
    /** Caller owns the lock; sidecar revision is accepted only after its successful commit/acknowledgement.
     * @param {Dict | undefined} round @param {boolean} [consume] */
    async reuseRound(round, consume = false) {
        const proof = round?.proof;
        if (!proof || proof.owner !== this || round?.active === false || round?.signal?.aborted || proof.binding !== round?.binding) return null;
        await assertSupportedDataVersion(this.deps.storage);
        const pending = await this.ledger.read();
        if (!sameSyncRevision(pending, proof.pending) || Object.keys(pending.domains).length || this.notificationPending
            || await this.forage.getItem("mutation_journal") || await this.forage.getItem(SYNC_JOURNAL_KEY)) { round.proof = null; return null; }
        if (consume) round.proof = null;
        return { pending, state: proof.state, local: proof.local, recovered: null };
    }
    /** Optimistic reconciliation: locks protect snapshot/commit, never the record traversal between them. */
    /** @param {{full?: boolean, work?: ComputationBudget, round?: Dict}} [options] */
    async flushPending({ full = false, work = new ComputationBudget({ diagnostics: this.deps.diagnostics }), round } = {}) {
        work = this.idleBudget(work);
        work.assertActive();
        if (full && round) {
            const reusable = await this.coordinator.runExclusive(() => this.reuseRound(round));
            if (reusable) return reusable.state;
        }
        if (this.reconciliation) { await this.reconciliation; work.assertActive(); if (!full) return this.read(); }
        const run = async () => {
            for (;;) {
                work.assertActive();
                const snapshot = await this.coordinator.runExclusive(async () => {
                    await assertSupportedDataVersion(this.deps.storage);
                    await this.deps.storage?.stateService?.recoverPendingTransactionWithoutLock?.();
                    const pending = await this.ledger.read();
                    if (!full && !Object.keys(pending.domains).length) { this.hasDeferred = false; return null; }
                    return this.captureReconciliation(full ? null : new Set(Object.keys(pending.domains)));
                });
                if (!snapshot) return null;
                const result = await this.computeReconciliation(snapshot.state, snapshot.data, snapshot.pruned, snapshot.domains, work, snapshot.pending.lastPendingAt);
                work.assertActive();
                const committed = await this.coordinator.runExclusive(async () => {
                    const current = await this.ledger.read(), before = snapshot.pending;
                    if (current.generation !== before.generation || current.metadataRevision !== before.metadataRevision || current.epoch !== before.epoch || current.replicaId !== before.replicaId) return false;
                    work.assertActive();
                    if (result.changed || snapshot.eligibilityChanged) await this.writeWithoutLock(result.state);
                    await this.acknowledgeReconciliation(before, result.state, snapshot.domains);
                    if (full) await this.rememberRound(round, result.state, snapshot.data);
                    return true;
                });
                if (!committed) continue;
                this.dispatchEvent(new Event("changes"));
                return result.state;
            }
        };
        const promise = run(); this.reconciliation = promise;
        try { return await promise; }
        catch (error) { if (/** @type {any} */ (error)?.name !== "AbortError") this.error = "业务数据已保存，同步进度待修复；稍后将重新核对完整数据"; throw error; }
        finally { if (this.reconciliation === promise) this.reconciliation = null; }
    }
    /** Remote application has a dedicated roll-forward journal; no full import or operation replay. @param {Dict[]} remote @param {string} binding @param {() => Promise<void>} assertCurrent @param {Dict} [confirmed] @param {any} [options] */
    async merge(remote, binding, assertCurrent, confirmed = {}, options = {}) {
        const work = this.idleBudget(new ComputationBudget({ diagnostics: this.deps.diagnostics, ...options }));
        const round = options.round;
        let changed = false;
        /** @type {string[]} */ let carNums = [];
        await this.flushPending({ full: true, work, round });
        for (;;) {
            const snapshot = await this.coordinator.runExclusive(async () => {
                const reusable = await this.reuseRound(round, true);
                if (reusable) return reusable;
                const recovered = await this.recoverWithoutLock(), pending = await this.ledger.read();
                if (Object.keys(pending.domains).length) return null;
                return { recovered, pending, state: await this.read(), local: await this.readData() };
            });
            if (!snapshot) { await this.flushPending({ full: true, work, round }); continue; }
            const { local, recovered } = snapshot;
            let state = snapshot.state;
            const previousState = { ...state, confirmed: { ...state.confirmed }, model: { ...state.model, frontiers: { ...state.model.frontiers } } };
            await assertCurrent();
            const first = !state.joined || state.binding !== binding;
            const verified = this.verifiedMerge, now = this.deps.clock?.() ?? Date.now();
            // A process-local proof only: every check still repairs missed local writes.
            // Any model/data change, restart, recovery or maintenance boundary falls back.
            if (!first && !remote.length && !recovered && !this.notificationPending && !state.pending && state.retentionPolicyInitialized
                && verified?.binding === binding && now < verified.maintenanceAt) {
                if (await equalSyncValuesAsync(state.model, verified.model, work) && await equalSyncValuesAsync(local, verified.data, work)
                    && await equalSyncValuesAsync(state.undoEligible, verified.eligibility, work)) {
                    await this.coordinator.runExclusive(() => this.rememberRound(round, state, local, snapshot.pending));
                    return;
                }
            }
            if (first) {
                if (state.binding && state.binding !== binding) state = { ...state, replicaId: crypto.randomUUID(), seq: 0, counter: 0, pending: null, confirmed: {}, known: {}, deleting: [], model: emptySyncModel(), shadow: {}, joined: false };
            }
            let cloud = emptySyncModel();
            for (const model of remote) cloud = (await joinSyncModelsAsync(cloud, model, work));
            if (first) {
                const localProjection = (await projectSyncDataAsync(local, cloud.frontiers, work));
                const before = (await visibleSyncRecordsAsync(cloud, work)), combined = (await syncCloneAsync(before, work));
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
                state.counter = Math.max(state.counter, (await maximumClockAsync(cloud, work))) + 1;
                state.model = (await versionSyncDiffAsync(cloud, before, combined, [state.counter, state.replicaId], work)).model;
                state.joined = true; state.binding = binding; state.dirty = true; state.localRevision = (state.localRevision || 0) + 1;
                state.dirtySinceAt = (this.deps.clock?.() ?? Date.now()) - 30000;
                state.lastLocalChangeAt = this.deps.clock?.() ?? Date.now();
            } else if (remote.length) state.model = (await joinSyncModelsAsync(state.model, cloud, work));
            else state.model = { ...state.model, frontiers: { ...state.model.frontiers, activity_log: state.model.frontiers.activity_log || "", offline_history: state.model.frontiers.offline_history || "" } };
            if (!first && !state.retentionPolicyInitialized) {
                const before = (await visibleSyncRecordsAsync(state.model, work)), after = (await syncCloneAsync(before, work));
                for (const [key, value] of Object.entries(SYNC_LEGACY_DEFAULTS)) if (!Object.hasOwn(state.model.records, `setting/${key}`)) after[`setting/${key}`] = { value };
                const clock = Math.max(state.counter, (await maximumClockAsync(state.model, work))) + 1;
                const difference = (await versionSyncDiffAsync(state.model, before, after, [clock, state.replicaId], work));
                if (difference.changed) {
                    state.model = difference.model; state.counter = clock; state.dirty = true;
                    state.localRevision = (state.localRevision || 0) + 1;
                    state.dirtySinceAt ||= (this.deps.clock?.() ?? Date.now()) - 30000;
                    state.lastLocalChangeAt = this.deps.clock?.() ?? Date.now();
                }
            }
            state.retentionPolicyInitialized = true;
            (await validateSyncStateAsync(state.model, this.deps.validateSetting, work));
            if (await needsHistoryPruneAsync(state.model, work)) state.model = (await pruneSyncHistoryAsync({ records: { ...state.model.records }, frontiers: { ...state.model.frontiers } }, local, this.deps.clock?.() ?? Date.now(), work));
            state.counter = Math.max(state.counter, (await maximumClockAsync(state.model, work)));
            Object.assign(state.confirmed, confirmed);
            if (remote.length && options.lastSuccessAt !== undefined) state.lastSuccessAt = options.lastSuccessAt;
            const after = (await materializeSyncDataAsync(state.model, local, state.undoEligible, work));
            const beforeCars = await syncRecordMapAsync(local.car_list, "carNum", work);
            const afterCars = await syncRecordMapAsync(after.car_list, "carNum", work);
            carNums = [...new Set([...beforeCars.keys(), ...afterCars.keys()])].filter(id => beforeCars.get(id) !== afterCars.get(id));
            state.shadow = (await projectSyncDataAsync(after, state.model.frontiers, work));
            state.layout = syncLayout(after.setting);
            const domains = /** @type {string[]} */ ([]);
            for (const key of SYNC_DOMAINS) {
                if (!(await equalSyncValuesAsync(local[key], after[key], work))) domains.push(key);
            }
            const changedNames = await changedSyncKeysAsync(local.setting, after.setting, work);
            if (domains.includes("activity_log")) {
                const oldEntries = await syncRecordMapAsync(local.activity_log.entries || [], "id", work);
                const newEntries = await syncRecordMapAsync(after.activity_log.entries || [], "id", work);
                const changedIds = new Set([...oldEntries.keys(), ...newEntries.keys()].filter(id => oldEntries.get(id) !== newEntries.get(id)));
                const affected = [...local.activity_log.entries, ...after.activity_log.entries].filter((/** @type {any} */ entry) => changedIds.has(entry.id));
                carNums = [...new Set([...carNums, ...affected.flatMap((/** @type {any} */ entry) => (entry.changes || []).map((/** @type {any} */ change) => change.carNum).filter(Boolean))])];
            }
            changed = domains.length > 0;
            // Even an unchanged materialization may advance deletion/field versions.
            const metadataChanged = !(await equalSyncValuesAsync(previousState, state, work));
            const committed = await this.coordinator.runExclusive(async () => {
                const current = await this.ledger.read(), before = snapshot.pending;
                if (current.generation !== before.generation || current.metadataRevision !== before.metadataRevision || current.epoch !== before.epoch || current.replicaId !== before.replicaId) return false;
                await assertCurrent();
                if (first) await this.deps.storage?._createSnapshotWithoutMutation?.("多端同步接入前", "sync-join");
                if (changed) {
                    if (!first && new Set(local.blacklist_car_list.map((/** @type {any} */ item) => normalizeCarNum(item.carNum))).size < local.blacklist_car_list.length) await this.deps.storage?._createSnapshotWithoutMutation?.("同步屏蔽影片整理前", "sync-repair");
                    const pending = await this.forage.getItem(SYNC_JOURNAL_KEY);
                    const journal = { schema: 1, state: "prepared", after, afterState: state, binding, notificationId: crypto.randomUUID(), carNums: [...new Set([...(pending?.carNums || []), ...carNums])],
                        ...(pending && !Array.isArray(pending.domains) ? {} : { domains: [...new Set([...(pending?.domains || []), ...domains])], changedNames: [...new Set([...(pending?.changedNames || []), ...changedNames])] }) };
                    await assertCurrent();
                    await this.forage.setItem(SYNC_JOURNAL_KEY, journal);
                    await this.recoverWithoutLock();
                } else if (metadataChanged) {
                    await assertCurrent();
                    await this.writeWithoutLock(state);
                }
                await this.rememberRound(round, state, after);
                return true;
            });
            if (!committed) { await this.flushPending({ full: true, work, round }); continue; }
            let maintenanceAt = Infinity;
            if ((after.activity_log.entries || []).length > 1000) for (const entry of after.activity_log.entries) {
                const due = Date.parse(entry.createdAt) + 30 * 86400000 + 1;
                if (due > now) maintenanceAt = Math.min(maintenanceAt, due);
            }
            this.verifiedMerge = { model: state.model, data: after, eligibility: state.undoEligible, binding, maintenanceAt };
            break;
        }
        await this.flushAppliedNotifications();
    }
    /** @param {string[]} carNums @param {{notificationId?: string, domains?: string[], changedNames?: string[]}} [notice] */
    async notifyApplied(carNums, notice = {}) {
        this.deps.storage?._invalidateCache?.(); this.deps.storage?.invalidateSettingCache?.();
        let failed = false;
        if (!notice.domains || notice.domains.includes("setting")) try { await this.deps.settings?.refresh(); } catch { failed = true; }
        for (const type of ["car-state-changed", "actress-changed", "new-video-changed", "blacklist-rules-changed", "filter-rules-changed", "offline-history-changed", "activity-log-changed", "settings-changed"]) {
            const eventDomains = /** @type {Record<string, string[]>} */ ({
                "car-state-changed": ["car_list", "activity_log"], "actress-changed": ["favorite_actresses"],
                "new-video-changed": ["favorite_actresses", "new_video_decisions"],
                "blacklist-rules-changed": ["blacklist", "blacklist_car_list"],
                "filter-rules-changed": ["filter_keyword_title", "filter_keyword_review"],
                "offline-history-changed": ["offline_history"], "activity-log-changed": ["activity_log"], "settings-changed": ["setting"],
            });
            if (notice.domains && !eventDomains[type].some(domain => notice.domains?.includes(domain))) continue;
            try { await this.deps.events?.emit(type, { source: "remote-sync", scope: notice.domains ? "items" : "all", carNums, notificationId: notice.notificationId, changedDomains: notice.domains, changedNames: notice.changedNames }); } catch { failed = true; }
        }
        if (failed) throw new Error("同步界面刷新尚未完成");
    }
}
