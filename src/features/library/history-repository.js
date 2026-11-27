// @ts-check
import { normalizeCarNum } from "../../core/movie-identity.js";

export class HistoryRepository {
    /** @param {{state: import("../../core/state-service.js").StateService}} dependencies */
    constructor(dependencies) { this.state = dependencies.state; }
    async list() {
        const [stored, ratings] = await Promise.all([
            this.state.getCarList(),
            this.state.getPersonalRatings(),
        ]);
        const records = Array.isArray(stored) ? stored : [];
        const rows = records.map(record => ({ ...record, personalRating: ratings[normalizeCarNum(record.carNum) || ""]?.rating ?? null }));
        const known = new Set(records.map(record => normalizeCarNum(record.carNum)));
        for (const [carNum, value] of Object.entries(/** @type {Record<string, any>} */ (ratings))) {
            if (!known.has(carNum)) rows.push({ carNum, url: "", names: "", updateDate: value.updatedAt, stateFlags: {}, personalRating: value.rating, ratingOnly: true });
        }
        return rows;
    }
    async activity() {
        const log = await this.state.getActivityLog(), groups = new Map(), entries = [];
        for (const entry of log.entries) {
            const combined = entry.importBatchId && groups.get(entry.importBatchId);
            if (combined && entry.commitState === "committed") {
                combined.changes.push(...entry.changes);
                if (entry.undoAvailable === false) combined.undoAvailable = false;
                continue;
            }
            const view = { ...entry, changes: [...(entry.changes || [])] };
            if (entry.importBatchId && entry.commitState === "committed") groups.set(entry.importBatchId, view);
            entries.push(view);
        }
        return { ...log, entries };
    }
    offline() { return this.state.getOfflineHistory(); }
    /** @param {string} transactionId */
    undo(transactionId) { return this.state.undoTransaction(transactionId); }
    /** @param {string | string[]} carNums */
    remove(carNums) { return this.state.remove(carNums); }
    /** @param {string} carNum @param {Parameters<import("../../core/state-service.js").StateService["toggle"]>[1]} flag @param {Record<string, any>} options */
    toggle(carNum, flag, options) { return this.state.toggle(carNum, flag, options); }
    /** @param {string | string[]} carNums @param {Record<string, boolean>} flags @param {Record<string, any>} options */
    patch(carNums, flags, options) { return this.state.patch(carNums, flags, options); }
    /** @param {string} id */
    removeOffline(id) { return this.state.removeOfflineHistory(id); }
}
