// @ts-check
import { formatUiDateTime } from "./ui-date-time.js";
import { CURRENT_DATA_VERSION, normalizeCarNum } from "./constants.js";
import { assertMovieStateEligible } from "./movie-identity.js";
import { STATE_FLAG_NAMES, createEmptyStateFlags, normalizeStateFlags, syncLegacyStatus } from "./state-model.js";
import { createStateDomainRegistry } from "./state-domains.js";
import { cloneStateValue, stableStateValue, getStatePath, setStatePath, uniqueStateKeys, assertStateMutationEligible, createNewVideoEffectReader, canRestoreNewVideoEffect, restoreNewVideoEffect, pruneActivityLog } from "./state-activity-model.js";
import { assertSupportedDataVersion } from "./migration.js";
import { StorageMutationCoordinator } from "./storage-mutation-coordinator.js";
import { FavoriteActressRepository } from "./favorite-actress-repository.js";
import { BlacklistRepository } from "./blacklist-repository.js";
import { createIndexedMap } from "./storage-index.js";
import { _prepareActivity, _writeActivity, _commit, _workPatch, _commitWrites, _commitAtomic, _commitUndoAtomic, _recoverJournal, _recoverWithoutLock } from "./state-transaction-journal.js";
/** @typedef {import("./state-activity-model.js").StateRecord} StateRecord */
/** @typedef {keyof import("./state-model.js").StateFlags} StateFlag */
/** @template {(...args: any[]) => unknown} F @typedef {Parameters<F> extends [any, ...infer Args] ? Args : never} JournalArgs */
export class StateService {
    /** @param {import("../services/storage-service.js").StorageService} storage
     * @param {StateRecord} eventBus
     * @param {Pick<StorageMutationCoordinator, "runExclusive">} [mutationCoordinator]
     * @param {{now?: () => string, currentUrl?: () => string, origin?: () => string, actorClock?: () => string,
     * sync?: any, logger?: any, notifications?: any, incrementalCarStore?: any}} [runtime] */
    constructor(storage, eventBus, mutationCoordinator = new StorageMutationCoordinator(), runtime = {}) {
        /** @type {any} */ this.computation = null;
        this.now = runtime.now ?? (() => formatUiDateTime(new Date()));
        this.currentUrl = runtime.currentUrl ?? (() => window.location.href);
        this.storage = storage;
        this.eventBus = eventBus;
        this.mutationCoordinator = mutationCoordinator;
        this.domains = createStateDomainRegistry(storage);
        this.sync = runtime.sync;
        this.logger = runtime.logger;
        this.notifications = runtime.notifications;
        this.incrementalCarStore = runtime.incrementalCarStore;
        this.actresses = new FavoriteActressRepository(storage, this.logger, runtime.actorClock ?? this.now);
        this.blacklist = new BlacklistRepository(storage, {
            now: this.now, origin: runtime.origin ?? (() => globalThis.location?.origin ?? window.location.origin),
            logger: this.logger, notifications: this.notifications,
        });
        /** @type {Array<{type: string, payload: StateRecord}> | null} */ this._notificationBatch = null;
        /** @type {StateRecord | null} */ this._listSnapshot = null;
    }
    /** @param {() => any} callback */
    _withLock(callback) {
        const execute = async () => {
            await assertSupportedDataVersion(this.storage);
            /** @type {Array<{type: string, payload: StateRecord}>} */ const notices = []; this._notificationBatch = notices;
            try { return { value: await callback(), notices }; }
            finally { this._notificationBatch = null; }
        };
        const run = this.mutationCoordinator.runExclusive(execute);
        return run.then(({ value, notices }) => { this._publishCommitted(notices); return value; });
    }
    /** Collect inside the transaction; publish only after its lock has been released. */
    /** @param {string} type @param {StateRecord} payload */
    async _notifyCommitted(type, payload) {
        if (this._notificationBatch) this._notificationBatch.push({ type, payload });
        else this._publishCommitted([{ type, payload }]);
    }
    /** @param {Array<{type: string, payload: StateRecord}>} notices */
    _publishCommitted(notices) {
        const report = (/** @type {unknown} */ error) => {
            try { (this.logger ?? console).warn?.("[JHS] 持久化已完成，但状态通知失败", error); }
            catch { /* Durable state must not be reclassified as failed by diagnostics. */ }
        };
        try {
            if (this.eventBus?.publishCommitted) this.eventBus.publishCommitted(notices);
            else for (const { type, payload } of notices) void Promise.resolve(this.eventBus?.emit?.(type, payload, { broadcastFirst: true })).catch(report);
        } catch (error) { report(error); }
    }
    async getActivityLog() {
        await this.sync?.refreshUndo?.();
        const log = pruneActivityLog(await this.domains.activity.read());
        if (this.sync) log.entries = log.entries.map((/** @type {StateRecord} */ entry) => ({ ...entry, undoAvailable: this.sync.canUndo(entry.id) }));
        return log;
    }
    /** List filtering needs committed recent changes, not history UI undo permissions or retention sorting. */
    async getListActivity() { return this.domains.activity.read(); }
    async getPersonalRatings() { return cloneStateValue(await this.domains.ratings.read()); }
    /** @param {string | string[]} carNums @param {number | null} rating */
    async setPersonalRating(carNums, rating) {
        if (rating !== null && (!Number.isInteger(rating) || rating < 1 || rating > 5)) throw new TypeError("个人评分须为 1 至 5 星整数");
        const targets = Array.isArray(carNums) ? [...carNums] : [carNums];
        assertStateMutationEligible(targets, {});
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const keys = uniqueStateKeys(targets.map(normalizeCarNum));
            const domains = await this._readDomains(["ratings", "activity"]), ratings = { ...domains.ratings };
            const now = new Date().toISOString(), changes = [];
            for (const carNum of keys) {
                const before = ratings[carNum] || null;
                if ((before?.rating ?? null) === rating) continue;
                const after = rating === null ? null : { rating, updatedAt: now };
                if (after) ratings[carNum] = after;
                else delete ratings[carNum];
                changes.push({ carNum, operation: "personal-rating", fields: ["rating"], before: cloneStateValue(before), after, undoState: "pending" });
            }
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: crypto.randomUUID(), type: "personal-rating", commitState: "pending", changes, createdAt: now, undoAttemptedAt: null };
            await this._commit(domains, { ratings }, activity, ["ratings", "activity"]);
            const changed = changes.map(change => change.carNum);
            await this._notifyCommitted("personal-rating-changed", { carNums: changed, transactionId: activity.id });
            await this._notifyCommitted("activity-log-changed", { transactionId: activity.id });
            return { changed, transactionId: activity.id };
        });
    }
    /** @param {string | string[]} carNums */
    clearPersonalRating(carNums) { return this.setPersonalRating(carNums, null); }
    /** A committed change can refresh its visible cards without rereading the library.
     * @param {string} transactionId @param {string[]} [carNums] */
    getCommittedListSnapshot(transactionId, carNums = []) {
        const snapshot = this._listSnapshot;
        return snapshot?.transactionId === transactionId && snapshot.revision === this.storage.carListRevision
            && carNums.every(key => snapshot.records.has(key)) ? snapshot : null;
    }
    clearCommittedListSnapshot() { this._listSnapshot = null; }
    /** Retain only changed records for immediate card refresh.
     * @param {string} transactionId @param {StateRecord[]} changes @param {StateRecord} activity */
    _rememberListSnapshot(transactionId, changes, activity) {
        if (changes.some(change => !["patch", "create"].includes(change.operation))) { this._listSnapshot = null; return; }
        const createdAt = Date.parse(activity.createdAt), recent = createdAt >= Date.now() - 7 * 864e5;
        this._listSnapshot = { transactionId, records: new Map(changes.map(change => [change.carNum, change.after])),
            recentCarNums: new Set(changes.filter(change => recent && change.fields.some((/** @type {string} */ field) => field.startsWith("stateFlags."))).map(change => change.carNum)), recentExpiresAt: createdAt + 7 * 864e5 + 1,
            revision: this.storage.carListRevision };
    }
    async getOfflineHistory() {
        return await this.domains.offlineHistory.read();
    }
    /** @param {StateRecord} record */
    async appendOfflineHistory(record) {
        return this._withLock(async () => {
            const { stateEligibility, ...savedRecord } = record;
            const history = await this.getOfflineHistory(), item = { id: savedRecord.id || globalThis.crypto?.randomUUID?.() || `offline_${Date.now()}`, createdAt: savedRecord.createdAt || new Date().toISOString(), ...savedRecord, carNum: normalizeCarNum(savedRecord.carNum) };
            history.push(item);
            if (history.length > 1e3) { const removed = history.splice(0, history.length - 1e3); this.sync?.notePruned("offline_history", removed); }
            await this.domains.offlineHistory.write(history);
            await this._notifyCommitted("offline-history-changed", { ids: [ item.id ] });
            return item;
        });
    }
    /** @param {{attemptId:string, providerId:string, resource:string}} attempt */
    async confirmOfflineSubmission({ attemptId, providerId, resource }) {
        return this._withLock(async () => {
            const history = /** @type {StateRecord[]} */ (await this.getOfflineHistory());
            const index = history.findIndex(item => item.id === attemptId && item.providerId === providerId
                && item.resource === resource && item.submissionOutcome === "unknown");
            if (index < 0) return false;
            const { errorCode, errorMessage, ...item } = history[index];
            const next = [...history];
            next[index] = { ...item, status: "submitted", submissionOutcome: "exists" };
            await this.domains.offlineHistory.write(next);
            await this._notifyCommitted("offline-history-changed", { ids: [attemptId] });
            return true;
        });
    }
    /** @param {string | string[]} ids */
    async removeOfflineHistory(ids) {
        return this._withLock(async () => {
            const keys = new Set(Array.isArray(ids) ? ids : [ ids ]), history = await this.getOfflineHistory(), next = history.filter((/** @param {StateRecord} item */ item => !keys.has(item.id)));
            if (next.length === history.length) return !1;
            await this.domains.offlineHistory.write(next);
            await this._notifyCommitted("offline-history-changed", { ids: [ ...keys ], removed: !0 });
            return !0;
        });
    }
    async getNewVideoDecisions() {
        return await this.domains.decisions.read();
    }
    getFavoriteActressList() { return this.actresses.read(); }
    /** Prune queued works after adding a title prefix under the current mutation lock. @param {string} prefix */
    async pruneNewVideoByTitleKeywordWithoutLock(prefix) {
        const actresses = await this.domains.actresses.read();
        let changed = false;
        const next = actresses.map((/** @type {StateRecord} */ actress) => {
            if (!Array.isArray(actress.newVideoList)) return actress;
            const newVideoList = actress.newVideoList.filter((/** @type {any} */ item) => {
                const code = typeof item === "string" ? item : item?.carNum;
                return typeof code !== "string" || !code.startsWith(prefix);
            });
            if (newVideoList.length === actress.newVideoList.length) return actress;
            changed = true;
            return { ...actress, newVideoList };
        });
        if (changed) await this.domains.actresses.write(next);
    }
    getCarList() { return this.domains.carList.read(); }

    /** @param {string[]} [carNums] */
    async getCarMap(carNums) {
        const records = carNums && this.incrementalCarStore
            ? await this.incrementalCarStore.getWorksByCarNums(uniqueStateKeys(carNums.map(normalizeCarNum)))
            : await this.getCarList();
        return createIndexedMap(records, "carNum");
    }

    getBlacklist() { return this.blacklist.readActors(); }
    async getBlacklistMap() { return createIndexedMap(await this.getBlacklist(), "starId"); }
    getBlacklistCarList() { return this.blacklist.readMovies(); }

    /** @param {StateRecord} item */
    addBlacklistItem(item) { return this._withLock(() => this.blacklist.addActor(item)); }
    /** @param {StateRecord} update */
    updateBlacklistItem(update) { return this._withLock(() => this.blacklist.updateActor(update)); }

    /** @param {StateRecord[]} records */
    batchSaveBlacklistCarList(records) {
        return this._withLock(async () => {
            const { changed, removedNewVideos } = await this.blacklist.addMovies(records);
            if (removedNewVideos.length) await this._notifyCommitted("new-video-changed", { reason: "blacklist-car-removed", carNums: removedNewVideos });
            if (changed.length) await this._notifyCommitted("blacklist-rules-changed", {});
            return { changed };
        });
    }

    /** @param {string} starId */
    removeBlacklistActor(starId) {
        return this._withLock(async () => {
            const result = await this.blacklist.removeActor(starId);
            if (result.removedCarRecords) await this._notifyCommitted("blacklist-rules-changed", {});
            return result;
        });
    }

    /** @param {StateRecord[]} actresses */
    addFavoriteActressList(actresses) { return this._withLock(() => this.actresses.add(actresses)); }
    /** @param {StateRecord} update @param {{scan?: boolean, keepUnseen?: boolean, signal?: AbortSignal}} [options] */
    updateFavoriteActress(update, options) { return this._withLock(() => this.actresses.update(update, options)); }
    getActressProfileBackfillState() { return this.actresses.readBackfillState(); }
    getActressProfileBackfillSnapshot() { return this.actresses.readBackfillSnapshot(); }
    /** @param {string[]} [starIds] */
    clearActressProfileBackfillAttempts(starIds) { return this._withLock(() => this.actresses.clearBackfillAttempts(starIds)); }
    /** @param {Array<{starId: string, actressProfile: StateRecord}>} updates @param {import("./actress-profile-backfill-state.js").ActressProfileBackfillProgress} [progress] */
    batchUpdateFavoriteActressProfiles(updates, progress) {
        if (!progress && (!Array.isArray(updates) || !updates.length)) return Promise.resolve(0);
        return this._withLock(() => this.actresses.updateProfiles(updates, progress));
    }
    /** @param {StateRecord} payload */
    rebindFavoriteActress(payload) { return this._withLock(() => this.actresses.rebind(payload)); }
    /** @param {unknown} starId */
    removeFavoriteActress(starId) { return this._withLock(() => this.actresses.remove(starId)); }

    /** Read one normalized state record for post-mutation verification. @param {unknown} carNum */
    async getState(carNum) {
        const key = normalizeCarNum(carNum);
        if (!key) return null;
        const record = this.incrementalCarStore ? await this.incrementalCarStore.getWorkByCarNum(key) : (await this.getCarMap()).get(key);
        return record ? cloneStateValue(record) : null;
    }
    /** @param {string[] | null} [requestedDomains] @param {string[]} [carNums] @returns {Promise<StateRecord>} */
    async _readDomains(requestedDomains = null, carNums) {
        const requested = new Set(requestedDomains ?? [ "carList", "actresses", "decisions", "activity" ]), read = (/** @type {string} */ domain) => requested.has(domain) ? this.domains[domain].read() : Promise.resolve(domain === "activity" ? { entries: [] } : domain === "decisions" ? {} : []);
        const incremental = requested.has("carList") && carNums ? this.incrementalCarStore : null;
        const [carList, actresses, decisions, activity, ratings] = await Promise.all([ incremental ? incremental.getWorksByCarNums(carNums) : read("carList"), read("actresses"), read("decisions"), read("activity"), requested.has("ratings") ? this.domains.ratings.read() : Promise.resolve({}) ]);
        return { carList, actresses, decisions, ratings, partialCarList: !!incremental, activity: { ...activity, entries: Array.isArray(activity.entries) ? activity.entries : [] } };
    }
    /** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {string[]} carNums */
    _removeHandledNewVideos(actresses, decisions, carNums) {
        if (!carNums.length) return { actresses, decisions };
        const keys = new Set(uniqueStateKeys(carNums.map(normalizeCarNum))), nextDecisions = { ...decisions };
        let decisionsChanged = false, actressesChanged = false;
        keys.forEach((key => { if (Object.hasOwn(nextDecisions, key)) decisionsChanged = true; delete nextDecisions[key]; }));
        const nextActresses = actresses.map((actress => {
            if (!Array.isArray(actress.newVideoList)) return actress;
            const newVideoList = actress.newVideoList.filter((item => !keys.has(/** @type {string} */ (normalizeCarNum("string" == typeof item ? item : item.carNum)))));
            if (newVideoList.length === actress.newVideoList.length) return actress;
            actressesChanged = true;
            return { ...actress, newVideoList };
        }));
        return { actresses: actressesChanged ? nextActresses : actresses, decisions: decisionsChanged ? nextDecisions : decisions };
    }
    /** @param {JournalArgs<typeof _prepareActivity>} args */
    _prepareActivity(...args) { return _prepareActivity(this, ...args); }
    /** @param {JournalArgs<typeof _writeActivity>} args */
    _writeActivity(...args) { return _writeActivity(this, ...args); }
    /** @param {JournalArgs<typeof _commit>} args */
    _commit(...args) { return _commit(this, ...args); }
    /** @param {JournalArgs<typeof _workPatch>} args */
    _workPatch(...args) { return _workPatch(this, ...args); }
    /** @param {JournalArgs<typeof _commitWrites>} args */
    _commitWrites(...args) { return _commitWrites(this, ...args); }
    /** @param {JournalArgs<typeof _commitAtomic>} args */
    _commitAtomic(...args) { return _commitAtomic(this, ...args); }
    /** @param {JournalArgs<typeof _commitUndoAtomic>} args */
    _commitUndoAtomic(...args) { return _commitUndoAtomic(this, ...args); }
    /** @param {JournalArgs<typeof _recoverJournal>} args */
    _recoverJournal(...args) { return _recoverJournal(this, ...args); }
    _recoverWithoutLock() { return _recoverWithoutLock(this); }
    async recoverPendingTransaction() {
        return this._withLock((() => this._recoverWithoutLock()));
    }
    /** Call only while the shared storage mutation lock is already held. */
    async recoverPendingTransactionWithoutLock() {
        return this._recoverWithoutLock();
    }
    /** @param {string | string[]} carNums @param {Partial<import("./state-model.js").StateFlags>} patch @param {StateRecord} [options] */
    async patch(carNums, patch, options = {}) {
        const keys = Array.isArray(carNums) ? [...carNums] : [carNums], flags = { ...patch };
        const invalidFlag = Object.keys(flags).find((key => !(/** @type {readonly string[]} */ (STATE_FLAG_NAMES)).includes(key) || "boolean" != typeof flags[/** @type {StateFlag} */ (key)]));
        if (invalidFlag) throw new TypeError(`无效状态字段: ${invalidFlag}`);
        const request = { ...options, record: cloneStateValue(options.record), records: cloneStateValue(options.records) };
        return this._withLock(() => this._patchWithoutLock(keys, flags, request));
    }
    /** @param {string[]} carNums @param {string} collection @param {boolean} selected @param {StateRecord} options */
    async setCollectionMembership(carNums, collection, selected, options) {
        if (!/^[a-z][a-z0-9-]{0,31}$/.test(collection) || typeof selected !== "boolean") throw new TypeError("清单标识或操作无效");
        return this.patch(carNums, {}, { ...options, type: "collection-membership", existingOnly: !selected,
            preserveNewVideo: true, collection: { id: collection, selected } });
    }
    /** @param {string[]} keys @param {Partial<import("./state-model.js").StateFlags>} patch @param {StateRecord} options @param {StateRecord | null} [preparedDomains] */
    async _patchWithoutLock(keys, patch, options, preparedDomains = null) {
        assertStateMutationEligible(keys, options);
        keys = uniqueStateKeys(keys.map(normalizeCarNum));
        // A toggle may reuse only the domains just read under this same lock.
        if (!preparedDomains) await this._recoverWithoutLock();
        const domains = preparedDomains ?? await this._readDomains(null, keys), map = new Map(domains.carList.map((/** @param {StateRecord} record */ record => [ normalizeCarNum(record.carNum), record ])));
        /** @type {StateRecord[]} */
        const changes = [];
        /** @type {string[]} */
        const handled = [];
        const records = Array.isArray(options.records) ? new Map(options.records.map((record => [ normalizeCarNum(record.carNum), record ]))) : new Map;
        keys.forEach((carNum => {
            const existing = map.get(carNum);
            if (!existing && options.existingOnly === true) return;
            const metadata = records.get(carNum) || options.record || {}, now = this.now(), before = existing ? cloneStateValue(existing) : null;
            const record = existing ? { ...existing, stateFlags: normalizeStateFlags(existing.stateFlags) } : { carNum, url: metadata.url || this.currentUrl(), names: metadata.names || "", createDate: now, stateFlags: createEmptyStateFlags() };
            /** @type {string[]} */
            const fields = [];
            [ "url", "names", "title", "publishTime", "starId", "remark", "fc2Source" ].forEach((field => {
                if ("fc2Source" === field && ![ "fc2", "123av" ].includes(metadata[field])) return;
                if (field === "names" && options.keepExistingNames && existing?.names) return;
                if (!Object.prototype.hasOwnProperty.call(metadata, field) || null == metadata[field] || !options.replaceMetadata && "" === metadata[field] || record[field] === metadata[field]) return;
                record[field] = metadata[field], fields.push(field);
            }));
            if (Array.isArray(metadata.actorNames)) {
                const submitted = /** @type {unknown[]} */ (metadata.actorNames);
                const incoming = submitted.filter(name => typeof name === "string").map(name => name.trim()).filter(Boolean);
                const previous = Array.isArray(record.actorNames) ? record.actorNames : [];
                if (incoming.some(name => !previous.includes(name))) {
                    record.actorNames = [...new Set([...previous, ...incoming])];
                    fields.push("actorNames");
                }
            }
            const membership = options.collection;
            if (membership && (record.collectionMembership?.[membership.id] === true) !== membership.selected) {
                record.collectionMembership = { ...record.collectionMembership, [membership.id]: membership.selected };
                fields.push("collectionMembership." + membership.id);
            }
            STATE_FLAG_NAMES.forEach((flag => Object.prototype.hasOwnProperty.call(patch, flag) && record.stateFlags[flag] !== patch[flag] && (patch[flag] && !options.preserveNewVideo && handled.push(carNum), record.stateFlags[flag] = patch[flag], fields.push(`stateFlags.${flag}`))));
            if (!fields.length && existing) return;
            record.updateDate = now, syncLegacyStatus(record), map.set(carNum, record), changes.push({ carNum, operation: existing ? "patch" : "create", fields, before, after: cloneStateValue(record), undoState: "pending" });
        }));
        if (!changes.length) return { changed: [], transactionId: null };
        const handledKeys = new Set(handled), readEffect = handled.length ? createNewVideoEffectReader(domains.actresses, domains.decisions, handledKeys) : null;
        changes.forEach((change => handledKeys.has(change.carNum) && readEffect && (change.newVideoEffect = readEffect(change.carNum))));
        const effects = this._removeHandledNewVideos(domains.actresses, domains.decisions, handled), activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: options.type || "state-patch", commitState: "pending", changes, createdAt: new Date().toISOString(), undoAttemptedAt: null };
        await this._commit(domains, { carList: [ ...map.values() ], ...effects }, activity, ["carList", ...(effects.actresses === domains.actresses ? [] : ["actresses"]), ...(effects.decisions === domains.decisions ? [] : ["decisions"]), "activity"]);
        await this._notifyCommitted("car-state-changed", { carNums: changes.map((change => change.carNum)), transactionId: activity.id });
        const affectedWorks = changes.filter(change => change.newVideoEffect && (change.newVideoEffect.actressItems.length || change.newVideoEffect.decision)).map(change => change.carNum);
        affectedWorks.length && await this._notifyCommitted("new-video-changed", { carNums: affectedWorks, reason: "state-handled" });
        await this._notifyCommitted("activity-log-changed", { transactionId: activity.id });
        return { changed: changes.map((change => change.carNum)), transactionId: activity.id };
    }
    /** @param {string} carNum @param {StateFlag} flag @param {StateRecord} [options] */
    async toggle(carNum, flag, options = {}) {
        if (!STATE_FLAG_NAMES.includes(flag)) throw new TypeError(`无效状态字段: ${flag}`);
        return this._withLock(async () => {
            assertStateMutationEligible([carNum], options);
            const key = /** @type {string} */ (normalizeCarNum(carNum));
            await this._recoverWithoutLock();
            const domains = await this._readDomains(null, [key]);
            let record = null;
            for (let index = domains.carList.length - 1; index >= 0; index--) if (normalizeCarNum(domains.carList[index].carNum) === key) { record = domains.carList[index]; break; }
            const flags = normalizeStateFlags(record?.stateFlags);
            return this._patchWithoutLock([ key ], { [flag]: !flags[flag] }, options, domains);
        });
    }
    /** @param {string | string[]} carNums */
    async remove(carNums) {
        const keys = new Set(uniqueStateKeys((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum)));
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains(null, [...keys]), changes = domains.carList.filter((/** @type {StateRecord} */ record) => keys.has(/** @type {string} */ (normalizeCarNum(record.carNum)))).map((/** @type {StateRecord} */ record) => ({ carNum: normalizeCarNum(record.carNum), operation: "delete", fields: [ "record" ], before: cloneStateValue(record), after: null, undoState: "pending" }));
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "record-delete", commitState: "pending", changes, createdAt: new Date().toISOString(), undoAttemptedAt: null };
            await this._commit(domains, { carList: domains.carList.filter((/** @type {StateRecord} */ record) => !keys.has(/** @type {string} */ (normalizeCarNum(record.carNum)))), actresses: domains.actresses, decisions: domains.decisions }, activity, ["carList", "activity"]);
            await this._notifyCommitted("car-records-removed", { carNums: changes.map((/** @type {StateRecord} */ change) => change.carNum), transactionId: activity.id });
            await this._notifyCommitted("activity-log-changed", { transactionId: activity.id });
            return { changed: changes.map((/** @type {StateRecord} */ change) => change.carNum), transactionId: activity.id };
        });
    }
    /** @param {string | string[]} carNums @param {"ignored" | "snoozed" | "dismissed" | null} action @param {string | null} [until] */
    async setNewVideoDecision(carNums, action, until = null) {
        if (![ "ignored", "snoozed", "dismissed", null ].includes(action)) throw new TypeError("无效新作决策");
        const targets = Array.isArray(carNums) ? [ ...carNums ] : [ carNums ];
        return this._withLock(async () => {
            targets.forEach(assertMovieStateEligible);
            const keys = uniqueStateKeys(targets.map(normalizeCarNum));
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), decisions = { ...domains.decisions }, now = new Date().toISOString();
            /** @type {StateRecord[]} */
            const changes = [];
            keys.forEach((carNum => {
                const before = cloneStateValue(decisions[carNum] || null), after = action ? { action, until: "snoozed" === action ? until : null, createdAt: before?.createdAt || now, updatedAt: now } : null;
                stableStateValue(before) === stableStateValue(after) || (after ? decisions[carNum] = after : delete decisions[carNum], changes.push({ carNum, operation: "new-video-decision", fields: [ "decision" ], before, after, undoState: "pending" }));
            }));
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-decision", commitState: "pending", changes, createdAt: now, undoAttemptedAt: null };
            const changed = changes.map((change => change.carNum));
            await this._commit(domains, { carList: domains.carList, actresses: domains.actresses, decisions }, activity, ["decisions", "activity"]);
            await this._notifyCommitted("new-video-changed", { carNums: changed, reason: action || "decision-restored" });
            await this._notifyCommitted("activity-log-changed", { transactionId: activity.id });
            return { changed, transactionId: activity.id };
        });
    }
    /** @param {string | string[]} carNums @param {string} [reason] */
    async removeFromNewVideoList(carNums, reason = "manual") {
        const targets = Array.isArray(carNums) ? [ ...carNums ] : [ carNums ];
        return this._withLock(async () => {
            targets.forEach(assertMovieStateEligible);
            const keys = uniqueStateKeys(targets.map(normalizeCarNum));
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), readEffect = createNewVideoEffectReader(domains.actresses, domains.decisions, keys), effectsByCar = new Map(keys.map(carNum => [carNum, readEffect(carNum)])), changed = keys.filter((carNum => {
                const effect = effectsByCar.get(carNum) ?? readEffect(carNum);
                return effect.actressItems.length > 0 || !!effect.decision && "dismissed" !== effect.decision.action;
            }));
            if (!changed.length) return { changed: [], transactionId: null };
            const now = new Date().toISOString(), decisions = { ...domains.decisions }, changes = changed.map((carNum => {
                const newVideoEffect = effectsByCar.get(carNum) ?? readEffect(carNum), afterDecision = { action: "dismissed", until: null, createdAt: newVideoEffect.decision?.createdAt || now, updatedAt: now };
                decisions[carNum] = afterDecision;
                return { carNum, operation: "new-video-remove", fields: [ "newVideoList", "decision" ], before: null, after: { removed: !0, reason }, newVideoEffect, afterDecision, undoState: "pending" };
            }));
            const effects = this._removeHandledNewVideos(domains.actresses, domains.decisions, changed), activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-remove", commitState: "pending", changes, createdAt: now, undoAttemptedAt: null };
            await this._commit(domains, { carList: domains.carList, actresses: effects.actresses, decisions }, activity, ["actresses", "decisions", "activity"]);
            await this._notifyCommitted("new-video-changed", { carNums: changed, reason });
            await this._notifyCommitted("activity-log-changed", { transactionId: activity.id });
            return { changed, transactionId: activity.id };
        });
    }
    /** @param {string} transactionId */
    async undoTransaction(transactionId) {
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            await this.sync?.refreshUndo?.();
            if (this.sync && !this.sync.canUndo(transactionId)) throw new Error("来自其他设备或恢复文件的操作只供查看，不能在本机撤销");
            const incremental = this.incrementalCarStore;
            const before = await this._readDomains([...(incremental ? [] : ["carList"]), "actresses", "decisions", "activity", "ratings"]);
            const domains = cloneStateValue(before), transaction = domains.activity.entries.find((/** @param {StateRecord} entry */ entry => entry.id === transactionId && "committed" === entry.commitState));
            if (!transaction) throw new Error("操作记录不存在或尚未提交");
            if (incremental) {
                const keys = uniqueStateKeys(transaction.changes.map((/** @type {StateRecord} */ change) => normalizeCarNum(change.carNum)));
                domains.carList = await incremental.getWorksByCarNums(keys);
            }
            const carMap = new Map(domains.carList.map((/** @param {StateRecord} record */ record => [ normalizeCarNum(record.carNum), cloneStateValue(record) ]))), decisions = { ...domains.decisions }, actresses = cloneStateValue(domains.actresses);
            /** @type {string[]} */
            const reverted = [];
            /** @type {string[]} */
            const conflicts = [];
            const touched = new Set(["activity"]);
            const touchedCars = new Set();
            for (const change of transaction.changes) {
                if ("reverted" === change.undoState) continue;
                if ("personal-rating" === change.operation) {
                    if (stableStateValue(domains.ratings[change.carNum] || null) !== stableStateValue(change.after)) {
                        change.undoState = "conflict";
                        conflicts.push(change.carNum);
                    } else {
                        if (change.before) domains.ratings[change.carNum] = cloneStateValue(change.before);
                        else delete domains.ratings[change.carNum];
                        change.undoState = "reverted";
                        reverted.push(change.carNum);
                        touched.add("ratings");
                    }
                    continue;
                }
                const current = carMap.get(change.carNum);
                const remainingFlags = /** @type {Record<string, boolean>} */ (current ? normalizeStateFlags(current.stateFlags) : createEmptyStateFlags());
                for (const field of change.fields || []) if (field.startsWith("stateFlags.")) remainingFlags[field.slice(11)] = getStatePath(change.before, field) === true;
                const restoreEffect = !Object.values(remainingFlags).some(Boolean);
                if (restoreEffect && change.newVideoEffect && !canRestoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect, change.afterDecision ?? null)) {
                    change.undoState = "conflict", conflicts.push(change.carNum); continue;
                }
                if ("delete" === change.operation) {
                    current ? (change.undoState = "conflict", conflicts.push(change.carNum)) : (carMap.set(change.carNum, cloneStateValue(change.before)), change.undoState = "reverted", reverted.push(change.carNum), touched.add("carList"));
                    if (!current) touchedCars.add(change.carNum);
                    continue;
                }
                if ("new-video-decision" === change.operation) {
                    const currentDecision = decisions[change.carNum] || null;
                    stableStateValue(currentDecision) !== stableStateValue(change.after) ? (change.undoState = "conflict", conflicts.push(change.carNum)) : (change.before ? decisions[change.carNum] = cloneStateValue(change.before) : delete decisions[change.carNum], change.undoState = "reverted", reverted.push(change.carNum), touched.add("decisions"));
                    continue;
                }
                if ("new-video-remove" === change.operation) {
                    if (restoreEffect) {
                        restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect);
                        touched.add("actresses");
                        touched.add("decisions");
                    }
                    change.undoState = "reverted";
                    reverted.push(change.carNum);
                    continue;
                }
                if (![ "patch", "create" ].includes(change.operation) || !current || change.fields.some((/** @param {string} field */ field => stableStateValue(getStatePath(current, field)) !== stableStateValue(getStatePath(change.after, field))))) {
                    change.undoState = "conflict", conflicts.push(change.carNum); continue;
                }
                const businessValue = (/** @type {StateRecord} */ record) => { const { updateDate, status, ...value } = record; return stableStateValue(value); };
                if (change.operation === "create" && !change.before && businessValue(current) === businessValue(change.after)) {
                    carMap.delete(change.carNum);
                } else {
                    for (const field of change.fields) {
                        const value = getStatePath(change.before, field);
                        setStatePath(current, field, value === undefined && field.startsWith("stateFlags.") ? false : value);
                    }
                    current.updateDate = this.now();
                    syncLegacyStatus(current);
                    carMap.set(change.carNum, current);
                }
                touchedCars.add(change.carNum);
                touched.add("carList"), restoreEffect && change.newVideoEffect && (restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect), touched.add("actresses"), touched.add("decisions")), change.undoState = "reverted", reverted.push(change.carNum);
            }
            transaction.undoAttemptedAt = new Date().toISOString();
            const log = this._prepareActivity(domains.activity), nextCars = [ ...carMap.values() ], touchedDomains = [...touched];
            /** @type {Record<string, any>} */
            const nextState = { carList: nextCars, actresses, decisions, ratings: domains.ratings, activity: log };
            /** @type {Record<string, any>} */
            const beforeMap = before;
            const journal = { schema: 2, dataVersion: CURRENT_DATA_VERSION, id: `undo_${transactionId}`, state: "prepared", createdAt: transaction.undoAttemptedAt, touchedDomains, before: Object.fromEntries(touchedDomains.map((key) => [key, cloneStateValue(beforeMap[key])])), after: Object.fromEntries(touchedDomains.map((key) => [key, cloneStateValue(nextState[key])])) };
            const workPatch = incremental && touchedCars.size ? this._workPatch(touchedCars, nextCars) : undefined;
            const committedAtomically = await this._commitUndoAtomic(nextState, log, touchedDomains, journal.id, workPatch);
            if (!committedAtomically) {
                if (workPatch) throw new Error("作品行撤销需要原子存储事务");
                try {
                    await this.storage.set("mutation_journal", journal);
                    for (const key of touchedDomains) {
                        if (key === "activity") await this._writeActivity(log, true);
                        else await this.domains[key].write(journal.after[key]);
                    }
                    await this.storage.remove("mutation_journal");
                    this._listSnapshot = null;
                } catch (error) {
                    await this._recoverWithoutLock();
                    throw error;
                }
            }
            reverted.length && await this._notifyCommitted("car-state-changed", { carNums: reverted, transactionId: journal.id, undoOf: transactionId });
            if (touched.has("actresses") || touched.has("decisions")) {
                await this._notifyCommitted("new-video-changed", { carNums: reverted, reason: "undo", transactionId: journal.id, undoOf: transactionId });
            }
            if (touched.has("ratings")) await this._notifyCommitted("personal-rating-changed", { carNums: reverted, transactionId: journal.id, undoOf: transactionId });
            await this._notifyCommitted("activity-log-changed", { transactionId, undo: !0 });
            return { reverted, conflicts };
        });
    }
}
