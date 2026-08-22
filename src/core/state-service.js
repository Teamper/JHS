const ACTIVITY_SOFT_LIMIT = 1e3, ACTIVITY_HARD_LIMIT = 1e4, ACTIVITY_RETENTION_MS = 30 * 864e5;

function cloneStateValue(value) {
    return null == value ? value : JSON.parse(JSON.stringify(value));
}

function stableStateValue(value) {
    if (null === value || "object" != typeof value) return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStateValue).join(",")}]`;
    return `{${Object.keys(value).sort().map((key => `${JSON.stringify(key)}:${stableStateValue(value[key])}`)).join(",")}}`;
}

function getStatePath(value, path) {
    return path.split(".").reduce(((current, key) => current?.[key]), value);
}

function setStatePath(value, path, next) {
    const keys = path.split("."), last = keys.pop(), target = keys.reduce(((current, key) => current[key] ||= {}), value);
    void 0 === next ? delete target[last] : target[last] = cloneStateValue(next);
}

function captureNewVideoEffect(actresses, decisions, carNum) {
    const key = normalizeCarNum(carNum), actressItems = [];
    actresses.forEach(((actress, actressIndex) => (actress.newVideoList || []).forEach(((item, itemIndex) => {
        normalizeCarNum("string" == typeof item ? item : item.carNum) === key && actressItems.push({ actressIndex, itemIndex, item: cloneStateValue(item) });
    }))));
    return { actressItems, decision: cloneStateValue(decisions[key] || null) };
}

function canRestoreNewVideoEffect(actresses, decisions, carNum, effect) {
    const key = normalizeCarNum(carNum);
    if (stableStateValue(decisions[key] || null) !== stableStateValue(null)) return !1;
    return effect.actressItems.every((entry => !(actresses[entry.actressIndex]?.newVideoList || []).some((item => normalizeCarNum("string" == typeof item ? item : item.carNum) === key))));
}

function restoreNewVideoEffect(actresses, decisions, carNum, effect) {
    effect.actressItems.forEach((entry => {
        const actress = actresses[entry.actressIndex];
        if (!actress) return;
        const list = [ ...(actress.newVideoList || []) ], index = Math.min(entry.itemIndex, list.length);
        list.splice(index, 0, cloneStateValue(entry.item)), actress.newVideoList = list;
    }));
    effect.decision ? decisions[normalizeCarNum(carNum)] = cloneStateValue(effect.decision) : delete decisions[normalizeCarNum(carNum)];
}

function pruneActivityLog(log, now = Date.now()) {
    const result = { entries: Array.isArray(log?.entries) ? log.entries : [], trackingStartedAt: log?.trackingStartedAt || new Date(now).toISOString(), coverageStart: log?.coverageStart || null, truncatedAt: log?.truncatedAt || null };
    const cutoff = now - ACTIVITY_RETENTION_MS, recent = [], older = [];
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

class StateService {
    constructor(storage, eventBus) {
        this.storage = storage, this.eventBus = eventBus, this._queue = Promise.resolve(), this._recovering = !1;
    }
    _withLock(callback) {
        if (globalThis.navigator?.locks?.request) return navigator.locks.request("jhs_state_mutation", callback);
        const run = this._queue.then(callback, callback);
        return this._queue = run.catch((() => {})), run;
    }
    async getActivityLog() {
        return pruneActivityLog(await this.storage.forage.getItem("activity_log"));
    }
    async getOfflineHistory() {
        return await this.storage.forage.getItem("offline_history") || [];
    }
    async appendOfflineHistory(record) {
        const history = await this.getOfflineHistory(), item = { id: record.id || globalThis.crypto?.randomUUID?.() || `offline_${Date.now()}`, createdAt: record.createdAt || new Date().toISOString(), ...record, carNum: normalizeCarNum(record.carNum) };
        history.push(item), history.length > 1e3 && history.splice(0, history.length - 1e3), await this.storage.forage.setItem("offline_history", history), await this.eventBus.emit("offline-history-changed", { ids: [ item.id ] });
        return item;
    }
    async removeOfflineHistory(ids) {
        const keys = new Set(Array.isArray(ids) ? ids : [ ids ]), history = await this.getOfflineHistory(), next = history.filter((item => !keys.has(item.id)));
        if (next.length === history.length) return !1;
        return await this.storage.forage.setItem("offline_history", next), await this.eventBus.emit("offline-history-changed", { ids: [ ...keys ], removed: !0 }), !0;
    }
    async getNewVideoDecisions() {
        return await this.storage.forage.getItem("new_video_decisions") || {};
    }
    async _readDomains() {
        const [carList, actresses, decisions, activity] = await Promise.all([ this.storage.forage.getItem(this.storage.car_list_key), this.storage.forage.getItem(this.storage.favorite_actresses_key), this.storage.forage.getItem("new_video_decisions"), this.storage.forage.getItem("activity_log") ]);
        return { carList: carList || [], actresses: actresses || [], decisions: decisions || {}, activity: pruneActivityLog(activity) };
    }
    _removeHandledNewVideos(actresses, decisions, carNums) {
        const keys = new Set(carNums.map(normalizeCarNum).filter(Boolean)), nextDecisions = { ...decisions };
        keys.forEach((key => delete nextDecisions[key]));
        const nextActresses = actresses.map((actress => {
            if (!Array.isArray(actress.newVideoList)) return actress;
            const newVideoList = actress.newVideoList.filter((item => !keys.has(normalizeCarNum("string" == typeof item ? item : item.carNum))));
            if (newVideoList.length === actress.newVideoList.length) return actress;
            const next = { ...actress, newVideoList };
            return 0 === newVideoList.length && next.lastPublishTime && (next.lastPublishTime = null), next;
        }));
        return { actresses: nextActresses, decisions: nextDecisions };
    }
    async _writeActivity(log) {
        await this.storage.forage.setItem("activity_log", pruneActivityLog(log));
    }
    async _commit(domains, next, activity) {
        // TODO(performance): 后续按事务声明的 domain 读取与写入，避免无关数据域放大 journal。
        const pendingActivity = cloneStateValue(activity), pendingLog = { ...domains.activity, entries: [ ...domains.activity.entries, pendingActivity ] };
        const journal = { id: activity.id, state: "prepared", createdAt: activity.createdAt, before: cloneStateValue(domains), after: cloneStateValue({ ...next, activity: pendingLog }) };
        await this.storage.forage.setItem("mutation_journal", journal);
        try {
            await this.storage._setItemAndInvalidate(this.storage.car_list_key, next.carList), await this._writeActivity(pendingLog),
            await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, next.actresses), await this.storage.forage.setItem("new_video_decisions", next.decisions);
            activity.commitState = "committed", pendingLog.entries = pendingLog.entries.map((entry => entry.id === activity.id ? activity : entry)), await this._writeActivity(pendingLog);
            await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
        } catch (error) {
            await this._recoverJournal(journal);
            throw error;
        }
    }
    async _recoverJournal(journal) {
        const log = await this.getActivityLog(), activity = log.entries.find((entry => entry.id === journal.id));
        if ("committed" === activity?.commitState) {
            await this.storage._setItemAndInvalidate(this.storage.car_list_key, journal.after.carList), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, journal.after.actresses), await this.storage.forage.setItem("new_video_decisions", journal.after.decisions);
        } else {
            const current = await this._readDomains(), keys = [ "carList", "actresses", "decisions" ];
            const conflict = keys.some((key => {
                const value = stableStateValue(current[key]);
                return value !== stableStateValue(journal.before[key]) && value !== stableStateValue(journal.after[key]);
            }));
            if (conflict) throw new Error("检测到未完成状态事务且数据已发生冲突，请先运行数据健康检查");
            await this.storage._setItemAndInvalidate(this.storage.car_list_key, journal.before.carList), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, journal.before.actresses), await this.storage.forage.setItem("new_video_decisions", journal.before.decisions);
            journal.before.activity ? await this._writeActivity(journal.before.activity) : (log.entries = log.entries.filter((entry => entry.id !== journal.id)), await this._writeActivity(log));
        }
        await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
    }
    async _recoverWithoutLock() {
        const journal = await this.storage.forage.getItem("mutation_journal");
        return journal ? (await this._recoverJournal(journal), !0) : !1;
    }
    async recoverPendingTransaction() {
        return this._withLock((() => this._recoverWithoutLock()));
    }
    async patch(carNums, patch, options = {}) {
        const keys = [ ...new Set((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum).filter(Boolean)) ];
        if (!keys.length) throw new Error("番号为空");
        const invalidFlag = Object.keys(patch).find((key => !STATE_FLAG_NAMES.includes(key) || "boolean" != typeof patch[key]));
        if (invalidFlag) throw new TypeError(`无效状态字段: ${invalidFlag}`);
        return this._withLock((() => this._patchWithoutLock(keys, patch, options)));
    }
    async _patchWithoutLock(keys, patch, options) {
        await this._recoverWithoutLock();
        const domains = await this._readDomains(), map = new Map(domains.carList.map((record => [ normalizeCarNum(record.carNum), record ]))), changes = [], handled = [];
        const records = Array.isArray(options.records) ? new Map(options.records.map((record => [ normalizeCarNum(record.carNum), record ]))) : new Map;
        keys.forEach((carNum => {
            const existing = map.get(carNum), metadata = records.get(carNum) || options.record || {}, now = utils.getNowStr(), before = existing ? cloneStateValue(existing) : null;
            const record = existing ? { ...existing, stateFlags: normalizeStateFlags(existing.stateFlags) } : { carNum, url: metadata.url || window.location.href, names: metadata.names || "", createDate: now, stateFlags: createEmptyStateFlags() };
            const fields = [];
            [ "url", "names", "publishTime", "starId", "remark" ].forEach((field => {
                if (!Object.prototype.hasOwnProperty.call(metadata, field) || null == metadata[field] || !options.replaceMetadata && "" === metadata[field] || record[field] === metadata[field]) return;
                record[field] = metadata[field], fields.push(field);
            }));
            STATE_FLAG_NAMES.forEach((flag => Object.prototype.hasOwnProperty.call(patch, flag) && record.stateFlags[flag] !== patch[flag] && (patch[flag] && handled.push(carNum), record.stateFlags[flag] = patch[flag], fields.push(`stateFlags.${flag}`))));
            if (!fields.length && existing) return;
            record.updateDate = now, syncLegacyStatus(record), map.set(carNum, record), changes.push({ carNum, operation: existing ? "patch" : "create", fields, before, after: cloneStateValue(record), undoState: "pending" });
        }));
        if (!changes.length) return { changed: [], transactionId: null };
        changes.forEach((change => handled.includes(change.carNum) && (change.newVideoEffect = captureNewVideoEffect(domains.actresses, domains.decisions, change.carNum))));
        const effects = this._removeHandledNewVideos(domains.actresses, domains.decisions, handled), activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: options.type || "state-patch", commitState: "pending", changes, createdAt: new Date().toISOString(), undoAttemptedAt: null };
        await this._commit(domains, { carList: [ ...map.values() ], ...effects }, activity), await this.eventBus.emit("car-state-changed", { carNums: changes.map((change => change.carNum)), transactionId: activity.id }), handled.length && await this.eventBus.emit("new-video-changed", { carNums: [ ...new Set(handled) ], reason: "state-handled" }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
        return { changed: changes.map((change => change.carNum)), transactionId: activity.id };
    }
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
    async remove(carNums) {
        const keys = new Set((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum).filter(Boolean));
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), changes = domains.carList.filter((record => keys.has(normalizeCarNum(record.carNum)))).map((record => ({ carNum: normalizeCarNum(record.carNum), operation: "delete", fields: [ "record" ], before: cloneStateValue(record), after: null, undoState: "pending" })));
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "record-delete", commitState: "pending", changes, createdAt: new Date().toISOString(), undoAttemptedAt: null };
            await this._commit(domains, { carList: domains.carList.filter((record => !keys.has(normalizeCarNum(record.carNum)))), actresses: domains.actresses, decisions: domains.decisions }, activity), await this.eventBus.emit("car-records-removed", { carNums: changes.map((change => change.carNum)), transactionId: activity.id }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
            return { changed: changes.map((change => change.carNum)), transactionId: activity.id };
        });
    }
    async setNewVideoDecision(carNums, action, until = null) {
        if (![ "ignored", "snoozed", null ].includes(action)) throw new TypeError("无效新作决策");
        const keys = [ ...new Set((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum).filter(Boolean)) ];
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), decisions = { ...domains.decisions }, now = new Date().toISOString(), changes = [];
            keys.forEach((carNum => {
                const before = cloneStateValue(decisions[carNum] || null), after = action ? { action, until: "snoozed" === action ? until : null, createdAt: before?.createdAt || now, updatedAt: now } : null;
                stableStateValue(before) === stableStateValue(after) || (after ? decisions[carNum] = after : delete decisions[carNum], changes.push({ carNum, operation: "new-video-decision", fields: [ "decision" ], before, after, undoState: "pending" }));
            }));
            if (!changes.length) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-decision", commitState: "pending", changes, createdAt: now, undoAttemptedAt: null };
            await this._commit(domains, { carList: domains.carList, actresses: domains.actresses, decisions }, activity), await this.eventBus.emit("new-video-changed", { carNums: keys, reason: action || "decision-restored" }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
            return { changed: keys, transactionId: activity.id };
        });
    }
    async removeFromNewVideoList(carNums, reason = "manual") {
        const keys = [ ...new Set((Array.isArray(carNums) ? carNums : [ carNums ]).map(normalizeCarNum).filter(Boolean)) ];
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), effects = this._removeHandledNewVideos(domains.actresses, domains.decisions, keys), changed = stableStateValue(effects.actresses) !== stableStateValue(domains.actresses) || stableStateValue(effects.decisions) !== stableStateValue(domains.decisions);
            if (!changed) return { changed: [], transactionId: null };
            const activity = { id: globalThis.crypto?.randomUUID?.() || `activity_${Date.now()}`, type: "new-video-remove", commitState: "pending", changes: keys.map((carNum => ({ carNum, operation: "new-video-remove", fields: [ "newVideoList", "decision" ], before: null, after: { removed: !0, reason }, newVideoEffect: captureNewVideoEffect(domains.actresses, domains.decisions, carNum), undoState: "pending" }))), createdAt: new Date().toISOString(), undoAttemptedAt: null };
            await this._commit(domains, { carList: domains.carList, ...effects }, activity), await this.eventBus.emit("new-video-changed", { carNums: keys, reason }), await this.eventBus.emit("activity-log-changed", { transactionId: activity.id });
            return { changed: keys, transactionId: activity.id };
        });
    }
    async undoTransaction(transactionId) {
        return this._withLock(async () => {
            await this._recoverWithoutLock();
            const domains = await this._readDomains(), transaction = domains.activity.entries.find((entry => entry.id === transactionId && "committed" === entry.commitState));
            if (!transaction) throw new Error("操作记录不存在或尚未提交");
            const carMap = new Map(domains.carList.map((record => [ normalizeCarNum(record.carNum), cloneStateValue(record) ]))), decisions = { ...domains.decisions }, actresses = cloneStateValue(domains.actresses), reverted = [], conflicts = [];
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
                if (![ "patch", "create" ].includes(change.operation) || !current || change.fields.some((field => stableStateValue(getStatePath(current, field)) !== stableStateValue(getStatePath(change.after, field))))) {
                    change.undoState = "conflict", conflicts.push(change.carNum); continue;
                }
                if ("create" === change.operation && !change.before) carMap.delete(change.carNum); else change.fields.forEach((field => setStatePath(current, field, getStatePath(change.before, field)))), syncLegacyStatus(current), carMap.set(change.carNum, current);
                change.newVideoEffect && restoreNewVideoEffect(actresses, decisions, change.carNum, change.newVideoEffect), change.undoState = "reverted", reverted.push(change.carNum);
            }
            transaction.undoAttemptedAt = new Date().toISOString();
            const log = pruneActivityLog(domains.activity), nextCars = [ ...carMap.values() ], journal = { id: `undo_${transactionId}`, state: "prepared", createdAt: transaction.undoAttemptedAt, before: cloneStateValue(domains), after: cloneStateValue({ carList: nextCars, actresses, decisions, activity: log }) };
            await this.storage.forage.setItem("mutation_journal", journal), await this.storage._setItemAndInvalidate(this.storage.car_list_key, nextCars), await this.storage._setItemAndInvalidate(this.storage.favorite_actresses_key, actresses), await this.storage.forage.setItem("new_video_decisions", decisions), await this._writeActivity(log), await this.storage.forage.removeItem("mutation_journal"), this.storage._invalidateCache();
            reverted.length && await this.eventBus.emit("car-state-changed", { carNums: reverted, undoOf: transactionId }), await this.eventBus.emit("activity-log-changed", { transactionId, undo: !0 });
            return { reverted, conflicts };
        });
    }
}

const stateService = unsafeWindow.stateService = window.stateService = new StateService(storageManager, jhsEventBus);
