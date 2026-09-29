// @ts-check

export const STORAGE_MUTATION_LOCK = "jhs_storage_mutation_v1";

/** Serialize read-modify-write operations across tabs and within this runtime. */
export class StorageMutationCoordinator {
    /** @param {{lockManager?: {request: (name: string, callback: () => any) => Promise<any>} | null, lockName?: string}} [options] */
    constructor(options = {}) {
        this.lockManager = options.lockManager === undefined ? globalThis.navigator?.locks : options.lockManager;
        this.lockName = options.lockName ?? STORAGE_MUTATION_LOCK;
        this._queue = Promise.resolve();
    }

    /** @template T @param {() => Promise<T> | T} operation @returns {Promise<T>} */
    runExclusive(operation) {
        if (typeof operation !== "function") throw new TypeError("Storage mutation must be a function");
        if (this.lockManager?.request) return this.lockManager.request(this.lockName, operation);
        const next = this._queue.then(operation, operation);
        this._queue = next.then(() => undefined, () => undefined);
        return next;
    }
}
