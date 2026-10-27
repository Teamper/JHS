// @ts-check

export const STORAGE_MUTATION_LOCK = "jhs_storage_mutation_v1";

/** Serialize read-modify-write operations across tabs and within this runtime. */
export class StorageMutationCoordinator {
    /** @param {{lockManager?: {request: (name: string, callback: () => any) => Promise<any>} | null, lockName?: string}} [options] */
    constructor(options = {}) {
        this.lockManager = options.lockManager === undefined ? globalThis.navigator?.locks : options.lockManager;
        this.lockName = options.lockName ?? STORAGE_MUTATION_LOCK;
        this._queue = Promise.resolve();
        /** @type {any} */ this.diagnostics = null;
        /** @type {any} Optional observer of the completed business mutation. */
        this.observer = null;
        /** @type {(() => Promise<unknown>) | null} */ this.beforeMutation = null;
        /** Schedules post-commit work without extending the caller's lock or queue. @type {(() => void) | null} */ this.afterRelease = null;
    }

    /** A CPU continuation crosses this barrier outside its transaction; queued writers keep priority across frames/tabs. */
    async waitForIdle() {
        if (this.lockManager?.request) await this.lockManager.request(this.lockName, () => undefined);
        else await this._queue;
    }

    /** Recovery evidence is valid only inside this invocation's shared lock. @template T @param {(recovery?: any) => Promise<T> | T} operation @returns {Promise<T>} */
    runExclusive(operation) {
        if (typeof operation !== "function") throw new TypeError("Storage mutation must be a function");
        const requestedAt = this.diagnostics?.performanceRecording ? performance.now() : null;
        const execute = async () => {
            const acquiredAt = requestedAt === null ? null : performance.now();
            const recovery = await this.beforeMutation?.();
            this.observer?.begin();
            let succeeded = false;
            try { const value = await operation(recovery); succeeded = true; return value; }
            finally {
                try { await this.observer?.finish(succeeded); }
                finally { if (acquiredAt !== null) this.diagnostics?.recordComputation("storage.lock", { waitMs: acquiredAt - (requestedAt ?? acquiredAt), holdMs: performance.now() - acquiredAt }); }
            }
        };
        const next = this.lockManager?.request ? this.lockManager.request(this.lockName, execute) : this._queue.then(execute, execute);
        if (!this.lockManager?.request) this._queue = next.then(() => undefined, () => undefined);
        // Never await work scheduled here. SettingsService may own a queue that
        // is itself awaiting this operation; awaiting its refresh would deadlock.
        const released = () => { try { this.afterRelease?.(); } catch { /* A committed mutation keeps its original result. */ } };
        void next.then(released, released);
        return next;
    }
}
