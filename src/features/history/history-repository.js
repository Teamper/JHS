// @ts-check

export class HistoryRepository {
    /** @param {{storage: any, state: any}} dependencies */
    constructor(dependencies) { this.storage = dependencies.storage; this.state = dependencies.state; }
    list() { return this.storage.getCarList(); }
    activity() { return this.state.getActivityLog(); }
    offline() { return this.state.getOfflineHistory(); }
    /** @param {string} transactionId */
    undo(transactionId) { return this.state.undoTransaction(transactionId); }
    /** @param {string | string[]} carNums */
    remove(carNums) { return this.state.remove(carNums); }
    /** @param {string} carNum @param {string} flag @param {Record<string, any>} options */
    toggle(carNum, flag, options) { return this.state.toggle(carNum, flag, options); }
    /** @param {string | string[]} carNums @param {Record<string, boolean>} flags @param {Record<string, any>} options */
    patch(carNums, flags, options) { return this.state.patch(carNums, flags, options); }
    /** @param {string} id */
    removeOffline(id) { return this.state.removeOfflineHistory(id); }
}
