// @ts-check

import { normalizeCarNum } from "./constants.js";
import { STATE_DOMAIN_NAMES, createStateDomainRegistry } from "./state-domains.js";
import { STATE_FLAG_NAMES, createEmptyStateFlags, normalizeStateFlags, syncLegacyStatus } from "./state-model.js";

/** @typedef {Record<string, any>} StateRecord */
/** @typedef {keyof import("./state-model.js").StateFlags} StateFlag */

const ACTIVITY_SOFT_LIMIT = 1e3, ACTIVITY_HARD_LIMIT = 1e4, ACTIVITY_RETENTION_MS = 30 * 864e5;

/** @param {any} value @returns {any} */
function cloneStateValue(value) {
    return null == value ? value : JSON.parse(JSON.stringify(value));
}

/** @param {any} value @returns {string | undefined} */
function stableStateValue(value) {
    if (null === value || "object" != typeof value) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStateValue).join(",")}]`;
    return `{${Object.keys(value).sort().map((key => `${JSON.stringify(key)}:${stableStateValue(value[key])}`)).join(",")}}`;
}

/** @param {StateRecord} value @param {string} path @returns {any} */
function getStatePath(value, path) {
    return path.split(".").reduce(((current, key) => current?.[key]), value);
}

/** @param {StateRecord} value @param {string} path @param {any} next */
function setStatePath(value, path, next) {
    const keys = path.split("."), last = keys.pop(), target = keys.reduce(((current, key) => current[key] ||= {}), value);
    if (!last) return;
    void 0 === next ? delete target[last] : target[last] = cloneStateValue(next);
}

/** @param {Array<string | null>} values @returns {string[]} */
function uniqueStateKeys(values) {
    return [ ...new Set(values.filter((/** @returns {value is string} */ value => "string" === typeof value && !!value))) ];
}

/** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {unknown} carNum */
function captureNewVideoEffect(actresses, decisions, carNum) {
    const key = /** @type {string} */ (normalizeCarNum(carNum));
    /** @type {StateRecord[]} */
    const actressItems = [];
    actresses.forEach(((actress, actressIndex) => (actress.newVideoList || []).forEach(((/** @type {any} */ item, /** @type {number} */ itemIndex) => {
        normalizeCarNum("string" == typeof item ? item : item.carNum) === key && actressItems.push({ actressIndex, itemIndex, item: cloneStateValue(item) });
    }))));
    return { actressItems, decision: cloneStateValue(decisions[key] || null) };
}

/** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {unknown} carNum @param {StateRecord} effect */
function canRestoreNewVideoEffect(actresses, decisions, carNum, effect) {
    const key = /** @type {string} */ (normalizeCarNum(carNum));
    if (stableStateValue(decisions[key] || null) !== stableStateValue(null)) return !1;
    return (/** @type {StateRecord[]} */ (effect.actressItems)).every((entry => !(actresses[entry.actressIndex]?.newVideoList || []).some((/** @type {any} */ item) => normalizeCarNum("string" == typeof item ? item : item.carNum) === key)));
}

/** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {unknown} carNum @param {StateRecord} effect */
function restoreNewVideoEffect(actresses, decisions, carNum, effect) {
    (/** @type {StateRecord[]} */ (effect.actressItems)).forEach((entry => {
        const actress = actresses[entry.actressIndex];
        if (!actress) return;
        const list = [ ...(actress.newVideoList || []) ], index = Math.min(entry.itemIndex, list.length);
        list.splice(index, 0, cloneStateValue(entry.item)), actress.newVideoList = list;
    }));
    const key = /** @type {string} */ (normalizeCarNum(carNum));
    effect.decision ? decisions[key] = cloneStateValue(effect.decision) : delete decisions[key];
}

/** @param {StateRecord | null | undefined} log @param {number} [now] @returns {StateRecord} */
function pruneActivityLog(log, now = Date.now()) {
    const result = { entries: Array.isArray(log?.entries) ? log.entries : [], trackingStartedAt: log?.trackingStartedAt || new Date(now).toISOString(), coverageStart: log?.coverageStart || null, truncatedAt: log?.truncatedAt || null };
    const cutoff = now - ACTIVITY_RETENTION_MS;
    /** @type {StateRecord[]} */
    const recent = [];
    /** @type {StateRecord[]} */
    const older = [];
    result.entries.forEach((entry => (Date.parse(entry.createdAt) >= cutoff || "pending" === entry.commitState ? recent : older).push(entry)));
    older.sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt)))), recent.sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))));
    const olderAllowance = Math.max(0, ACTIVITY_SOFT_LIMIT - recent.length);
    result.entries = [ ...older.slice(-olderAllowance), ...recent ].sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))));
    if (result.entries.length > ACTIVITY_HARD_LIMIT) {
        const pending = result.entries.filter((entry => "pending" === entry.commitState)), committed = result.entries.filter((entry => "pending" !== entry.commitState));
        const committedAllowance = Math.max(0, ACTIVITY_HARD_LIMIT - pending.length);
        result.entries = [ ...(committedAllowance ? committed.slice(-committedAllowance) : []), ...pending ].sort(((left, right) => String(left.createdAt).localeCompare(String(right.createdAt))));
        result.truncatedAt = new Date(now).toISOString(), result.coverageStart = result.entries[0]?.createdAt || result.truncatedAt;
    }
    return result;
}

/** @param {readonly string[]} names @returns {string[]} */
function normalizeDomainNames(names) {
    return [ ...new Set(names.filter((name => STATE_DOMAIN_NAMES.includes(name)))) ];
}

/** @param {StateRecord} state @returns {StateRecord} */
function normalizeJournalState(state) {
    const source = state || {};
    return {
        ...(Object.prototype.hasOwnProperty.call(source, "carList") ? { carList: source.carList } : {}),
        ...(Object.prototype.hasOwnProperty.call(source, "favoriteActresses") ? { favoriteActresses: source.favoriteActresses } : Object.prototype.hasOwnProperty.call(source, "actresses") ? { favoriteActresses: source.actresses } : {}),
        ...(Object.prototype.hasOwnProperty.call(source, "newVideoDecisions") ? { newVideoDecisions: source.newVideoDecisions } : Object.prototype.hasOwnProperty.call(source, "decisions") ? { newVideoDecisions: source.decisions } : {}),
        ...(Object.prototype.hasOwnProperty.call(source, "activity") ? { activity: source.activity } : {}),
        ...(Object.prototype.hasOwnProperty.call(source, "offlineHistory") ? { offlineHistory: source.offlineHistory } : {}),
    };
}

/** @param {StateRecord} journal @returns {StateRecord} */
function normalizeJournal(journal) {
    const v2 = 2 === journal?.schemaVersion;
    const legacyNames = /** @type {Record<string, string>} */ ({ actresses: "favoriteActresses", decisions: "newVideoDecisions" });
    const touchedDomains = normalizeDomainNames(Array.isArray(journal?.touchedDomains) ? journal.touchedDomains.map((name => legacyNames[name] || name)) : [ "carList", "favoriteActresses", "newVideoDecisions", "activity" ]);
    return {
        ...journal,
        schemaVersion: v2 ? 2 : 1,
        touchedDomains: touchedDomains.length ? touchedDomains : [ "carList", "favoriteActresses", "newVideoDecisions", "activity" ],
        before: normalizeJournalState(journal?.before),
        after: normalizeJournalState(journal?.after),
    };
}

/** @param {StateRecord} state @param {string[]} names @returns {StateRecord} */
function pickStateDomains(state, names) {
    return Object.fromEntries(names.filter((name => Object.prototype.hasOwnProperty.call(state, name))).map((name => [ name, cloneStateValue(state[name]) ])));
}

export class StateService {
    /** @param {any} storage @param {StateRecord} eventBus @param {{runExclusive: (operation: () => any) => Promise<any>} | null} [mutationCoordinator] */
    constructor(storage, eventBus, mutationCoordinator = null) {
        this.storage = storage, this.eventBus = eventBus, this.mutationCoordinator = mutationCoordinator ?? storage.mutationCoordinator ?? null, this.domains = createStateDomainRegistry(storage, pruneActivityLog), this._queue = Promise.resolve(), this._recovering = !1;
    }
    /** @param {() => any} callback */
    _withLock(callback) {
        if (this.mutationCoordinator?.runExclusive) return this.mutationCoordinator.runExclusive(callback);
        const run = this._queue.then(callback, callback);
        return this._queue = run.catch((() => {})), run;
    }
    async getActivityLog() {
        return this.domains.activity.read();
    }
    async getOfflineHistory() {
        return this.domains.offlineHistory.read();
    }
    /** Read one normalized car record through the state-owned storage boundary. */
    /** @param {unknown} carNum */
    async getCar(carNum) {
        const key = normalizeCarNum(carNum);
        return key ? this.storage.getCar(key) : null;
    }
    /** @param {StateRecord} record */
    async appendOfflineHistory(record) {
        return this._withLock(async () => {
            const history = await this.domains.offlineHistory.read(), item = { id: record.id || globalThis.crypto?.randomUUID?.() || `offline_${Date.now()}`, createdAt: record.createdAt || new Date().toISOString(), ...record, carNum: normalizeCarNum(record.carNum) };
            history.push(item), history.length > 1e3 && history.splice(0, history.length - 1e3), await this.domains.offlineHistory.write(history), await this.eventBus.emit("offline-history-changed", { ids: [ item.id ] });
            return item;
        });
    }
    /** @param {string | string[]} ids */
    async removeOfflineHistory(ids) {
        return this._withLock(async () => {
            const keys = new Set(Array.isArray(ids) ? ids : [ ids ]), history = await this.domains.offlineHistory.read(), next = history.filter((/** @param {StateRecord} item */ item => !keys.has(item.id)));
            if (next.length === history.length) return !1;
            return await this.domains.offlineHistory.write(next), await this.eventBus.emit("offline-history-changed", { ids: [ ...keys ], removed: !0 }), !0;
        });
    }
    async getNewVideoDecisions() {
        return this.domains.newVideoDecisions.read();
    }
    /** @returns {Promise<StateRecord>} */
    async _readDomains(names = STATE_DOMAIN_NAMES) {
        const selected = normalizeDomainNames(names), values = await Promise.all(selected.map(async (name) => [ name, await this.domains[name].read() ]));
        return Object.fromEntries(values);
    }
    /** @param {StateRecord[]} actresses @param {StateRecord} decisions @param {string[]} carNums */
    _removeHandledNewVideos(actresses, decisions, carNums) {
        const keys = new Set(uniqueStateKeys(carNums.map(normalizeCarNum))), nextDecisions = { ...decisions };
        keys.forEach((key => delete nextDecisions[key]));
        const nextActresses = actresses.map((actress => {
            if (!Array.isArray(actress.newVideoList)) return actress;
            const newVideoList = actress.newVideoList.filter((item => !keys.has(/** @type {string} */ (normalizeCarNum("string" == typeof item ? item : item.carNum)))));
            if (newVideoList.length === actress.newVideoList.length) return actress;
            return { ...actress, newVideoList };
        }));
        return { actresses: nextActresses, decisions: nextDecisions };
    }
    /** @param {StateRecord} log */
    async _writeActivity(log) {
        await this.domains.activity.write(log);
    }
    /** @param {StateRecord} domains @param {StateRecord} next @param {StateRecord} activity @param {string[]} touchedDomains */
    async _commit(domains, next, activity, touchedDomains) {
        const touched = normalizeDomainNames(touchedDomains), pendingActivity = cloneStateValue(activity), pendingLog = { ...domains.activity, entries: [ ...domains.activity.entries, pendingActivity ] };
        if (!touched.includes("activity")) touched.push("activity");
        const before = pickStateDomains(domains, touched), after = pickStateDomains({ ...next, activity: pendingLog }, touched), journal = {
            schemaVersion: 2,
            id: activity.id,
            state: "prepared",
            createdAt: activity.createdAt,
            touchedDomains: touched,
            before,
            after,
        };
        await this.storage.forage.setItem("mutation_journal", journal);
        try {
            for (const name of [ "carList", "activity", "favoriteActresses", "newVideoDecisions", "offlineHistory" ]) {
                if (touched.includes(name)) await this.domains[name].write(after[name]);
            }
            activity.commitState = "committed", pendingLog.entries = pendingLog.entries.map((/** @param {StateRecord} entry */ entry => entry.id === activity.id ? activity : entry)), await this._writeActivity(pendingLog);
            journal.state = "committed", await this.storage.forage.setItem("mutation_journal", journal);
            await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
        } catch (error) {
            await this._recoverJournal(journal);
            throw error;
        }
    }
    /** @param {StateRecord} journal */
    async _recoverJournal(journal) {
        const normalized = normalizeJournal(journal), touched = normalized.touchedDomains, log = await this.getActivityLog(), activity = log.entries.find((/** @param {StateRecord} entry */ entry => entry.id === normalized.id));
        if ("committed" === normalized.state || "committed" === activity?.commitState) {
            const after = cloneStateValue(normalized.after);
            if (after.activity) after.activity.entries = after.activity.entries.map((/** @param {StateRecord} entry */ entry => entry.id === normalized.id ? { ...entry, commitState: "committed" } : entry));
            await this._writeDomains(after, touched);
        } else {
            const current = await this._readDomains(touched), keys = touched.filter((/** @param {string} key */ key => "activity" !== key));
            const conflict = keys.some((/** @param {string} key */ key => {
                const value = stableStateValue(current[key]);
                return value !== stableStateValue(normalized.before[key]) && value !== stableStateValue(normalized.after[key]);
            }));
            if (conflict) {
                // 冲突说明当前数据已被其他（可能已提交的）写入更新：回滚会破坏新数据，抛错会让整个脚本无法启动。
                // 保守策略：保留当前数据，丢弃陈旧事务日志，并提示用户。
                clog.warn("[状态] 检测到未完成状态事务且数据已变化，保留当前数据并丢弃陈旧事务日志"), show.info("检测到未完成的状态事务，已保留当前数据；如数据异常请在设置中运行数据健康检查");
                await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
                return;
            }
            if (Object.prototype.hasOwnProperty.call(normalized.before, "activity")) await this._writeDomains(normalized.before, touched);
            else {
                log.entries = log.entries.filter((/** @param {StateRecord} entry */ entry => entry.id !== normalized.id));
                await this._writeActivity(log);
            }
        }
        await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
    }
    /** @param {StateRecord} values @param {string[]} names */
    async _writeDomains(values, names) {
        for (const name of [ "carList", "activity", "favoriteActresses", "newVideoDecisions", "offlineHistory" ]) {
            if (names.includes(name) && Object.prototype.hasOwnProperty.call(values, name)) await this.domains[name].write(values[name]);
        }
    }
    /** @param {StateRecord} before @param {StateRecord} after @param {string} id @param {string} createdAt @param {string[]} touchedDomains */
    async _commitValues(before, after, id, createdAt, touchedDomains) {
        const touched = normalizeDomainNames(touchedDomains), journal = { schemaVersion: 2, id, state: "prepared", createdAt, touchedDomains: touched, before: pickStateDomains(before, touched), after: pickStateDomains(after, touched) };
        await this.storage.forage.setItem("mutation_journal", journal);
        try {
            await this._writeDomains(journal.after, touched);
            journal.state = "committed", await this.storage.forage.setItem("mutation_journal", journal), await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
        } catch (error) {
            await this._recoverJournal(journal);
            throw error;
        }
    }
    async _recoverWithoutLock() {
        const journal = await this.storage.forage.getItem("mutation_journal");
        return journal ? (await this._recoverJournal(journal), !0) : !1;
    }
    async recoverPendingTransactionWithoutLock() {
        return this._recoverWithoutLock();
    }
    async recoverPendingTransaction() {
        return this._withLock((() => this._recoverWithoutLock()));
    }
    /** @param {string | string[]} carNums @param {Partial<import("./state-model.js").StateFlags>} patch @param {StateRecord} [options] */
    async patch(carNums, patch, options = {}) {
        const keys = uniqueStateKeys((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum));
        if (!keys.length) throw new Error("番号为空");
        const invalidFlag = Object.keys(patch).find((key => !(/** @type {readonly string[]} */ (STATE_FLAG_NAMES)).includes(key) || "boolean" != typeof patch[/** @type {StateFlag} */ (key)]));
        if (invalidFlag) throw new TypeError(`无效状态字段: ${invalidFlag}`);
        return this._withLock((() => this._patchWithoutLock(keys, patch, options)));
    }
    /** @param {string[]} keys @param {Partial<import("./state-model.js").StateFlags>} patch @param {StateRecord} options */
    async _patchWithoutLock(keys, patch, options) {
        await this._recoverWithoutLock();
        const domains = await this._readDomains([ "carList", "activity" ]), map = new Map(domains.carList.map((/** @param {StateRecord} record */ record => [ normalizeCarNum(record.carNum), record ])));
        /** @type {StateRecord[]} */
        const changes = [];
        /** @type {string[]} */
        const handled = [];
        const records = Array.isArray(options.records) ? new Map(options.records.map((record => [ normalizeCarNum(record.carNum), record ]))) : new Map;
        keys.forEach((carNum => {
            const existing = map.get(carNum), metadata = records.get(carNum) || options.record || {}, now = utils.getNowStr(), before = existing ? cloneStateValue(existing) : null;
            const record = existing ? { ...existing, stateFlags: normalizeStateFlags(existing.stateFlags) } : { carNum, url: metadata.url || window.location.href, names: metadata.names || "", createDate: now, stateFlags: createEmptyStateFlags() };
            /** @type {string[]} */
            const fields = [];
            [ "url", "names", "publishTime", "starId", "remark", "fc2Source" ].forEach((field => {
                if ("fc2Source" === field && ![ "fc2", "123av" ].includes(metadata[field])) return;
                if (!Object.prototype.hasOwnProperty.call(metadata, field) || null == metadata[field] || !options.replaceMetadata && "" === metadata[field] || record[field] === metadata[field]) return;
                record[field] = metadata[field], fields.push(field);
            }));
            STATE_FLAG_NAMES.forEach((flag => Object.prototype.hasOwnProperty.call(patch, flag) && record.stateFlags[flag] !== patch[flag] && (patch[flag] && handled.push(carNum), record.stateFlags[flag] = patch[flag], fields.push(`stateFlags.${flag}`))));
            if (!fields.length && existing) return;
            record.updateDate = now, syncLegacyStatus(record), map.set(carNum, record), changes.push({ carNum, operation: existing ? "patch" : "create", fields, before, after: cloneStateValue(record), undoState: "pending" });
        }));
        if (!changes.length) return { changed: [], transactionId: null };
        if (handled.length) Object.assign(domains, await this._readDomains([ "favoriteActresses", "newVideoDecisions" ]));
        changes.forEach((change => handled.includes(change.carNum) && (change.newVideoEffect = captureNewVideoEffect(domains.favoriteActresses, domains.newVideoDecisions, change.carNum))));
        const effects = handled.length ? this._removeHandledNewVideos(domains.favoriteActresses, domains.newVideoDecisions, handled) : { actresses: [], decisions: {} }, activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: options.type || "state-patch", commitState: "pending", changes, createdAt: new Date().toISOString(), undoAttemptedAt: null }, touched = [ "carList", "activity", ...(handled.length ? [ "favoriteActresses", "newVideoDecisions" ] : []) ];
        await this._commit(domains, { carList: [ ...map.values() ], ...(handled.length ? { favoriteActresses: effects.actresses, newVideoDecisions: effects.decisions } : {}) }, activity, touched), await this.eventBus.emit("car-state-changed", { carNums: changes.map((change => change.carNum)), transactionId: activity.id }), handled.length && await this.eventBus.emit("new-video-changed", { carNums: [ ...new Set(handled) ], reason: "state-handled" }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
        return { changed: changes.map((change => change.carNum)), transactionId: activity.id };
    }
    /** @param {string} carNum @param {StateFlag} flag @param {StateRecord} [options] */
    async toggle(carNum, flag, options = {}) {
        if (!STATE_FLAG_NAMES.includes(flag)) throw new TypeError(`无效状态字段: ${flag}`);
        const key = normalizeCarNum(carNum);
        if (!key) throw new Error("番号为空");
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const record = await this.storage.getCar(key), flags = normalizeStateFlags(record?.stateFlags);
            return this._patchWithoutLock([ key ], { [flag]: !flags[flag] }, options);
        });
    }
    /** @param {string | string[]} carNums */
    async remove(carNums) {
        const keys = new Set(uniqueStateKeys((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum)));
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains([ "carList", "activity" ]), changes = domains.carList.filter((/** @type {StateRecord} */ record) => keys.has(/** @type {string} */ (normalizeCarNum(record.carNum)))).map((/** @type {StateRecord} */ record) => ({ carNum: normalizeCarNum(record.carNum), operation: "delete", fields: [ "record" ], before: cloneStateValue(record), after: null, undoState: "pending" }));
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "record-delete", commitState: "pending", changes, createdAt: new Date().toISOString(), undoAttemptedAt: null };
            await this._commit(domains, { carList: domains.carList.filter((/** @type {StateRecord} */ record) => !keys.has(/** @type {string} */ (normalizeCarNum(record.carNum)))) }, activity, [ "carList", "activity" ]), await this.eventBus.emit("car-records-removed", { carNums: changes.map((/** @type {StateRecord} */ change) => change.carNum), transactionId: activity.id }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
            return { changed: changes.map((/** @type {StateRecord} */ change) => change.carNum), transactionId: activity.id };
        });
    }
    /** @param {string | string[]} carNums @param {"ignored" | "snoozed" | null} action @param {string | null} [until] */
    async setNewVideoDecision(carNums, action, until = null) {
        if (![ "ignored", "snoozed", null ].includes(action)) throw new TypeError("无效新作决策");
        const keys = uniqueStateKeys((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum));
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains([ "newVideoDecisions", "activity" ]), decisions = { ...domains.newVideoDecisions }, now = new Date().toISOString();
            /** @type {StateRecord[]} */
            const changes = [];
            keys.forEach((carNum => {
                const before = cloneStateValue(decisions[carNum] || null), after = action ? { action, until: "snoozed" === action ? until : null, createdAt: before?.createdAt || now, updatedAt: now } : null;
                stableStateValue(before) === stableStateValue(after) || (after ? decisions[carNum] = after : delete decisions[carNum], changes.push({ carNum, operation: "new-video-decision", fields: [ "decision" ], before, after, undoState: "pending" }));
            }));
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-decision", commitState: "pending", changes, createdAt: now, undoAttemptedAt: null };
            const changed = changes.map((change => change.carNum));
            await this._commit(domains, { newVideoDecisions: decisions }, activity, [ "newVideoDecisions", "activity" ]), await this.eventBus.emit("new-video-changed", { carNums: changed, reason: action || "decision-restored" }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
            return { changed, transactionId: activity.id };
        });
    }
    /** @param {string | string[]} carNums @param {string} [reason] */
    async removeFromNewVideoList(carNums, reason = "manual") {
        const keys = uniqueStateKeys((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum));
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains([ "carList", "favoriteActresses", "newVideoDecisions", "activity" ]), changed = keys.filter((carNum => {
                const effect = captureNewVideoEffect(domains.favoriteActresses, domains.newVideoDecisions, carNum);
                return effect.actressItems.length > 0 || !!effect.decision;
            }));
            if (!changed.length) return { changed: [], transactionId: null };
            // 墓碑：被移除的新片若没有任何状态记录，落一条空状态 carList 记录。
            // 否则下一轮检测（!carMap.has）会把它当 fresh 重新加回，“浏览后移除”形同虚设
            const existingCarNums = new Set(domains.carList.map((/** @param {StateRecord} record */ record => record.carNum))), now = utils.getNowStr();
            const tombstones = changed.filter((carNum => !existingCarNums.has(carNum))).map((carNum => {
                /** @type {StateRecord} */
                const record = { carNum, url: "", names: "", createDate: now, stateFlags: createEmptyStateFlags() };
                return record.updateDate = now, syncLegacyStatus(record), record;
            }));
            const effects = this._removeHandledNewVideos(domains.favoriteActresses, domains.newVideoDecisions, changed), activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-remove", commitState: "pending", changes: changed.map((carNum => ({ carNum, operation: "new-video-remove", fields: [ "newVideoList", "decision" ], before: null, after: { removed: !0, reason }, newVideoEffect: captureNewVideoEffect(domains.favoriteActresses, domains.newVideoDecisions, carNum), undoState: "pending" }))), createdAt: new Date().toISOString(), undoAttemptedAt: null }, touched = [ "favoriteActresses", "newVideoDecisions", "activity", ...(tombstones.length ? [ "carList" ] : []) ];
            await this._commit(domains, { ...(tombstones.length ? { carList: [ ...domains.carList, ...tombstones ] } : {}), favoriteActresses: effects.actresses, newVideoDecisions: effects.decisions }, activity, touched), await this.eventBus.emit("new-video-changed", { carNums: changed, reason }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
            return { changed, transactionId: activity.id };
        });
    }
    /** @param {string} transactionId */
    async undoTransaction(transactionId) {
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), transaction = domains.activity.entries.find((/** @param {StateRecord} entry */ entry => entry.id === transactionId && "committed" === entry.commitState));
            if (!transaction) throw new Error("操作记录不存在或尚未提交");
            const carMap = new Map(domains.carList.map((/** @param {StateRecord} record */ record => [ normalizeCarNum(record.carNum), cloneStateValue(record) ]))), decisions = { ...domains.newVideoDecisions }, actresses = cloneStateValue(domains.favoriteActresses);
            /** @type {string[]} */
            const reverted = [];
            /** @type {string[]} */
            const conflicts = [];
            for (const change of transaction.changes) {
                if ("reverted" === change.undoState) continue;
                const current = carMap.get(change.carNum);
                if (change.newVideoEffect && !canRestoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect)) {
                    change.undoState = "conflict", conflicts.push(change.carNum); continue;
                }
                if ("delete" === change.operation) {
                    current ? (change.undoState = "conflict", conflicts.push(change.carNum)) : (carMap.set(change.carNum, cloneStateValue(change.before)), change.undoState = "reverted", reverted.push(change.carNum));
                    continue;
                }
                if ("new-video-decision" === change.operation) {
                    const currentDecision = decisions[change.carNum] || null;
                    stableStateValue(currentDecision) !== stableStateValue(change.after) ? (change.undoState = "conflict", conflicts.push(change.carNum)) : (change.before ? decisions[change.carNum] = cloneStateValue(change.before) : delete decisions[change.carNum], change.undoState = "reverted", reverted.push(change.carNum));
                    continue;
                }
                if ("new-video-remove" === change.operation) {
                    restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect), change.undoState = "reverted", reverted.push(change.carNum);
                    continue;
                }
                if (![ "patch", "create" ].includes(change.operation) || !current || change.fields.some((/** @param {string} field */ field => stableStateValue(getStatePath(current, field)) !== stableStateValue(getStatePath(change.after, field))))) {
                    change.undoState = "conflict", conflicts.push(change.carNum); continue;
                }
                if ("create" === change.operation && !change.before) carMap.delete(change.carNum); else change.fields.forEach((/** @param {string} field */ field => setStatePath(current, field, getStatePath(change.before, field)))), syncLegacyStatus(current), carMap.set(change.carNum, current);
                change.newVideoEffect && restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect), change.undoState = "reverted", reverted.push(change.carNum);
            }
            transaction.undoAttemptedAt = new Date().toISOString();
            const log = pruneActivityLog(domains.activity), nextCars = [ ...carMap.values() ];
            await this._commitValues(domains, { carList: nextCars, favoriteActresses: actresses, newVideoDecisions: decisions, activity: log }, `undo_${transactionId}`, transaction.undoAttemptedAt, [ "carList", "favoriteActresses", "newVideoDecisions", "activity" ]);
            reverted.length && await this.eventBus.emit("car-state-changed", { carNums: reverted, undoOf: transactionId }), await this.eventBus.emit("activity-log-changed", { transactionId, undo: !0 });
            return { reverted, conflicts };
        });
    }
}

/** 在 Composition Root 中挂载仍由旧 StorageManager 调用的兼容引用。 */
/** @param {StateService} stateService @param {StateRecord} storageManager */
export function attachStateServiceCompatibility(stateService, storageManager) {
    storageManager.stateService = stateService;
}
