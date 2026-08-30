// @ts-check

export const STORAGE_MUTATION_LOCK = "jhs_storage_mutation_v1";

/** Serialize destructive storage mutations across tabs and within one runtime. */
export class StorageMutationCoordinator {
    /** @param {{lockManager?: {request: (name: string, callback: () => any) => Promise<any>}, lockName?: string}} [options] */
    constructor(options = {}) {
        this.lockManager = options.lockManager ?? globalThis.navigator?.locks;
        this.lockName = options.lockName ?? STORAGE_MUTATION_LOCK;
        this._queue = Promise.resolve();
        this._active = 0;
    }

    /** @template T @param {() => Promise<T> | T} operation @returns {Promise<T>} */
    runExclusive(operation) {
        if (typeof operation !== "function") throw new TypeError("Storage mutation must be a function");
        const run = async () => {
            this._active++;
            try { return await operation(); }
            finally { this._active--; }
        };
        if (this.lockManager?.request) return this.lockManager.request(this.lockName, run);
        const next = this._queue.then(run, run);
        this._queue = next.then(() => undefined, () => undefined);
        return next;
    }

}
