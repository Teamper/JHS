// @ts-check

export const STORAGE_MUTATION_LOCK = "jhs_storage_mutation_v1";

/** Serialize read-modify-write operations across tabs and within this runtime. */
export class StorageMutationCoordinator {
    /** @param {{lockManager?: {request: (name: string, callback: () => any) => Promise<any>} | null, lockName?: string}} [options] */
    constructor(options = {}) {
        this.lockManager = options.lockManager === undefined ? globalThis.navigator?.locks : options.lockManager;
        this.lockName = options.lockName ?? STORAGE_MUTATION_LOCK;
        this._queue = Promise.resolve();
        /** @type {any} Optional observer of the completed business mutation. */
        this.observer = null;
    }

    /** @template T @param {() => Promise<T> | T} operation @returns {Promise<T>} */
    runExclusive(operation) {
        if (typeof operation !== "function") throw new TypeError("Storage mutation must be a function");
        const execute = async () => {
            this.observer?.begin();
            let succeeded = false;
            try { const value = await operation(); succeeded = true; return value; }
            finally { await this.observer?.finish(succeeded); }
        };
        if (this.lockManager?.request) return this.lockManager.request(this.lockName, execute);
        const next = this._queue.then(execute, execute);
        this._queue = next.then(() => undefined, () => undefined);
        return next;
    }
}
