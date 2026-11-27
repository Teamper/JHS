// @ts-check

import { inspectDataHealth, repairDataHealth } from "../core/data-health.js";
import { prepareAtomicImport } from "../core/atomic-import.js";
import { assertSupportedDataVersion, normalizePortableData, readPortableData } from "../core/migration.js";
import { SNAPSHOTS_KEY, createPortableSnapshot, getStoredSnapshots } from "../core/portable-snapshots.js";

/** @typedef {Record<string, any>} BackupData */
/** @typedef {{signal?: AbortSignal, assertActive?: () => unknown, prepareData?: () => BackupData | Promise<BackupData>, resetActressProfileBackfill?: boolean, snapshotSource?: string}} ImportOptions */
/** @typedef {Pick<Console, "log"|"warn">} BackupLogger */

/** Owns portable exports, guarded restores and local recovery snapshots. */
export class PortableBackupService {
    /** @param {{storage: import("./storage-service.js").StorageService, coordinator: Pick<import("../core/storage-mutation-coordinator.js").StorageMutationCoordinator, "runExclusive">, state?: Pick<import("../core/state-service.js").StateService, "recoverPendingTransactionWithoutLock">, sync?: import("../core/webdav-sync-store.js").WebDavSyncStore, settings?: Pick<import("./settings-service.js").SettingsService,"refresh">, logger?: BackupLogger}} dependencies */
    constructor({ storage, coordinator, state, sync, settings, logger }) {
        this.storage = storage;
        this.coordinator = coordinator;
        this.state = state;
        this.sync = sync;
        this.settings = settings;
        this.logger = logger;
    }

    /** @param {unknown} data @param {ImportOptions} [options] */
    importData(data, options) { return this.importDataWithGuard(data, options); }

    /** @param {unknown} input @param {ImportOptions} [options] */
    async importDataWithGuard(input, options = {}) {
        let { data, warnings } = normalizePortableData(input);
        let committed = false, refreshSettings = false;
        try {
            await this.coordinator.runExclusive(async () => {
                await options.assertActive?.();
                const version = await this.supportedVersion();
                await this.state?.recoverPendingTransactionWithoutLock();
                if (options.prepareData) ({ data, warnings } = normalizePortableData(await options.prepareData()));
                const batch = await prepareAtomicImport(this.storage, data, warnings, version, options.resetActressProfileBackfill !== false, options.snapshotSource);
                await options.assertActive?.();
                await this.storage.commitAtomicBatch({ ...batch, signal: options.signal });
                committed = true;
                refreshSettings = version < 1 || Object.hasOwn(data, "setting");
                if (this.sync) {
                    this.sync.releaseSnapshots();
                    this.sync.hasDeferred ||= batch.domains.length > 0;
                    try { await this.sync.read(); }
                    catch (error) { warnCommitted(this.logger, "[import] synchronization refresh failed", error); }
                }
            });
        } catch (error) {
            if (!committed) throw error;
            warnCommitted(this.logger, "[import] data committed; local refresh pending", error);
        }
        // Settings refresh acquires the same write lock and runs after release.
        if (refreshSettings) try { await this.settings?.refresh(); }
        catch (error) { warnCommitted(this.logger, "[settings] import refresh failed", error); }
    }

    async supportedVersion() { return assertSupportedDataVersion(this.storage); }

    exportPortableData() {
        return this.coordinator.runExclusive(async () => {
            const version = await this.supportedVersion();
            await this.state?.recoverPendingTransactionWithoutLock();
            return readPortableData(this.storage, version);
        });
    }

    async exportData() {
        const data = await this.exportPortableData();
        if (Object.keys(data).length <= 1) throw new Error("没有可导出的数据");
        return data;
    }

    createSnapshot(name = "", source = "manual") {
        return this.coordinator.runExclusive(async () => {
            await this.supportedVersion();
            await this.state?.recoverPendingTransactionWithoutLock();
            const snapshot = await createPortableSnapshot(this.storage, name, source);
            this.logger?.log(`创建快照: ${snapshot.name} (${source})`);
            return snapshot;
        });
    }

    async getSnapshotList() {
        return (await getStoredSnapshots(this.storage)).map(({ id, name, source, time, createdAt, itemCount, kind, targetDataVersion, appVersion }) =>
            ({ id, name, source, time, createdAt, itemCount, kind: kind || "snapshot", targetDataVersion, appVersion }));
    }

    /** @param {string} id */
    async getSnapshot(id) { return (await getStoredSnapshots(this.storage)).find(item => item.id === id) ?? null; }

    /** @param {string} id */
    deleteSnapshot(id) {
        return this.coordinator.runExclusive(async () => {
            const snapshots = await getStoredSnapshots(this.storage), retained = snapshots.filter(item => item.id !== id);
            if (retained.length === snapshots.length) return void this.logger?.warn("删除快照失败, ID不存在: " + id);
            await this.storage.set(SNAPSHOTS_KEY, retained);
            this.logger?.log("删除快照: " + id);
        });
    }

    /** @param {string} id */
    async restoreSnapshot(id) {
        const snapshot = await this.getSnapshot(id);
        if (!snapshot) throw new Error("快照不存在: " + id);
        if (!snapshot.data || typeof snapshot.data !== "object") throw new Error("快照数据损坏");
        const { [SNAPSHOTS_KEY]: _snapshots, ...data } = snapshot.data;
        await this.importData(data, { snapshotSource: "auto-restore" });
        this.logger?.log("已恢复快照: " + snapshot.name);
        return snapshot;
    }

    inspectDataHealth() { return inspectDataHealth(this.storage); }

    repairDataHealth({ snapshot = false } = {}) {
        return this.coordinator.runExclusive(async () => {
            await this.supportedVersion();
            await this.state?.recoverPendingTransactionWithoutLock();
            const report = await inspectDataHealth(this.storage);
            if (!report.fixable.length) return { fixedGroups: 0, report };
            if (snapshot) await createPortableSnapshot(this.storage, "修复前自动恢复点", "auto-repair");
            return repairDataHealth(this.storage);
        });
    }

    /** @param {BackupData} current @param {BackupData} incoming */
    diffData(current, incoming) { return diffPortableData(current, incoming); }
}

/** @param {BackupLogger|undefined} logger @param {string} message @param {unknown} error */
function warnCommitted(logger, message, error) {
    try { logger?.warn(message, error); }
    catch { /* A diagnostic error cannot turn a committed restore into a retry. */ }
}

/** @param {any} value @returns {string | undefined} */
function stableStringify(value) {
    if (value === null || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(",")}}`;
}

/** @param {BackupData} first @param {BackupData} second */
function diffFields(first, second) {
    return Object.fromEntries([...new Set([...Object.keys(first), ...Object.keys(second)])]
        .filter(key => stableStringify(first[key]) !== stableStringify(second[key]))
        .map(key => [key, [first[key], second[key]]]));
}

/** @param {any[]} first @param {any[]} second @param {string} domain */
function diffArrays(first, second, domain) {
    const id = ["car_list", "blacklist_car_list"].includes(domain) ? "carNum" : ["blacklist", "favorite_actresses"].includes(domain) ? "starId" : null;
    if (!id) {
        if (stableStringify(first) === stableStringify(second)) return { status: /** @type {const} */ ("unchanged"), added: [], removed: [], modified: [] };
        const previous = new Set(first.map(stableStringify)), current = new Set(second.map(stableStringify));
        return { status: /** @type {const} */ ("modified"), added: second.filter(item => !previous.has(stableStringify(item))), removed: first.filter(item => !current.has(stableStringify(item))), modified: [] };
    }
    const previous = new Map(first.map(item => [item[id], item])), current = new Map(second.map(item => [item[id], item]));
    const added = [], removed = [], modified = [];
    for (const [key, item] of current) {
        if (!previous.has(key)) added.push(item);
        else {
            const changes = diffFields(previous.get(key), item);
            if (Object.keys(changes).length) modified.push({ key, changes });
        }
    }
    for (const [key, item] of previous) if (!current.has(key)) removed.push(item);
    return { status: added.length + removed.length + modified.length ? /** @type {const} */ ("modified") : /** @type {const} */ ("unchanged"), added, removed, modified };
}

/** @param {BackupData} current @param {BackupData} incoming */
export function diffPortableData(current, incoming) {
    const summary = { added: 0, removed: 0, modified: 0, unchanged: 0 };
    /** @type {BackupData} */ const stores = Object.create(null);
    for (const key of new Set([...Object.keys(current), ...Object.keys(incoming)])) {
        const first = current[key], second = incoming[key];
        if (first === undefined && second === undefined) continue;
        if (first === undefined || second === undefined) {
            const status = first === undefined ? "added" : "removed";
            stores[key] = { status, oldCount: first === undefined ? 0 : Array.isArray(first) ? first.length : 1, newCount: second === undefined ? 0 : Array.isArray(second) ? second.length : 1, added: Array.isArray(second) ? second : [], removed: Array.isArray(first) ? first : [], modified: [] };
        } else if (Array.isArray(first) && Array.isArray(second)) {
            stores[key] = { oldCount: first.length, newCount: second.length, ...diffArrays(first, second, key) };
        } else if (first && second && typeof first === "object" && typeof second === "object" && !Array.isArray(first) && !Array.isArray(second)) {
            const changes = diffFields(first, second);
            stores[key] = { status: Object.keys(changes).length ? "modified" : "unchanged", oldCount: Object.keys(first).length, newCount: Object.keys(second).length, added: [], removed: [], modified: changes };
        } else {
            stores[key] = { status: first === second ? "unchanged" : "modified", oldCount: 1, newCount: 1, added: [], removed: [], modified: first === second ? [] : [{ key, changes: { _value: [first, second] } }] };
        }
        summary[/** @type {keyof typeof summary} */ (stores[key].status)]++;
    }
    return { summary, stores };
}
