// @ts-check

import { readPortableData, readStoredDataVersion } from "./migration.js";
import { formatUiDateTime } from "./ui-date-time.js";

export const SNAPSHOTS_KEY = "snapshots";

/** @param {Pick<import("../services/storage-service.js").StorageService, "get">} storage @returns {Promise<Record<string, any>[]>} */
export async function getStoredSnapshots(storage) { return await storage.get(SNAPSHOTS_KEY) || []; }

/** The caller holds the mutation lock or owns the draft.
 * @param {Pick<import("../services/storage-service.js").StorageService, "get"|"set">} storage
 * @param {string} name @param {string} source
 */
export async function createPortableSnapshot(storage, name, source) {
    const snapshots = await getStoredSnapshots(storage);
    const data = await readPortableData(storage, await readStoredDataVersion(storage));
    if (Object.keys(data).length <= 1) throw new Error("没有可导出的数据");
    const itemCount = Object.values(data).reduce((count, value) => count + (Array.isArray(value) ? value.length : value && typeof value === "object" ? 1 : 0), 0);
    const time = formatUiDateTime(new Date());
    const snapshot = { id: `snap_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`, name: name || time, source, time, itemCount, data, kind: "snapshot" };
    await storage.set(SNAPSHOTS_KEY, [...snapshots, snapshot].slice(-10));
    return snapshot;
}
