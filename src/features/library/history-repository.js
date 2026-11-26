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
    activity() { return this.state.getActivityLog(); }
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
