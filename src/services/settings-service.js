// @ts-check

export class SettingsService extends EventTarget {
    /** @param {{get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<void>}} storage @param {{validators?: Record<string, (value: unknown) => boolean>, afterPersist?: (snapshot: Readonly<Record<string, unknown>>, changedNames: readonly string[]) => Promise<void> | void}} [options] */
    constructor(storage, options = {}) {
        super();
        this.storage = storage;
        this.validators = options.validators ?? {};
        this.afterPersist = options.afterPersist ?? null;
        /** @type {Readonly<Record<string, unknown>>} */ this.snapshotValue = Object.freeze({});
        this.writeChain = Promise.resolve();
    }

    /** @param {string} key */
    async load(key = "setting") {
        const stored = await this.storage.get(key);
        this.snapshotValue = Object.freeze(stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {});
        return this.snapshotValue;
    }

    /** Refreshes the in-memory snapshot after a transitional legacy or remote write; emits settings.changed only when values actually changed. */
    async refresh(key = "setting") {
        const previous = this.snapshotValue;
        await this.load(key);
        const keys = new Set([ ...Object.keys(previous), ...Object.keys(this.snapshotValue) ]);
        const changedNames = [ ...keys ].filter((name) => previous[name] !== this.snapshotValue[name]);
        if (changedNames.length) {
            this.dispatchEvent(new CustomEvent("settings.changed", { detail: Object.freeze({ name: changedNames.length === 1 ? changedNames[0] : null, value: undefined, names: Object.freeze([ ...changedNames ]), snapshot: this.snapshotValue }) }));
        }
        return this.snapshotValue;
    }

    snapshot() { return this.snapshotValue; }

    /** Returns the current write queue; resolves when all queued writes have settled. */
    waitForIdle() { return this.writeChain; }

    /** @param {string} name @param {unknown} value @param {string} [storageKey] */
    async set(name, value, storageKey = "setting") {
        return this.update((draft) => { draft[name] = value; }, storageKey);
    }

    /** @param {Record<string, unknown>} values @param {string} [storageKey] */
    async patch(values, storageKey = "setting") {
        if (!values || typeof values !== "object" || Array.isArray(values)) throw new TypeError("Settings patch must be an object");
        return this.update((draft) => { Object.assign(draft, values); }, storageKey);
    }

    /** @param {Record<string, unknown>} values @param {string} [storageKey] */
    async replace(values, storageKey = "setting") {
        if (!values || typeof values !== "object" || Array.isArray(values)) throw new TypeError("Settings replacement must be an object");
        return this.update((draft) => {
            for (const key of Object.keys(draft)) delete draft[key];
            Object.assign(draft, values);
        }, storageKey);
    }

    /** @param {string|readonly string[]} names @param {string} [storageKey] */
    async unset(names, storageKey = "setting") {
        const list = Array.isArray(names) ? names : [ names ];
        if (!list.every((name) => typeof name === "string" && name)) throw new TypeError("unset names must be non-empty strings");
        return this.update((draft) => { for (const name of list) delete draft[name]; }, storageKey);
    }

    /**
     * Single write primitive for all settings mutations. Every writer enters the
     * shared write chain and re-reads the freshest persisted value inside the
     * jhs_setting_lock before applying a synchronous mutator.
     *
     * @param {(draft: Record<string, unknown>) => unknown} mutator
     * @param {string} [storageKey]
     */
    async update(mutator, storageKey = "setting") {
        if (typeof mutator !== "function") throw new TypeError("Settings update mutator must be a function");
        const operation = this.writeChain.then(() => this._withSettingLock(async () => {
            const stored = await this.storage.get(storageKey);
            const base = /** @type {Record<string, unknown>} */ (stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {});
            const draft = { ...base };
            const maybePromise = mutator(draft);
            if (maybePromise && typeof maybePromise === "object" && typeof /** @type {PromiseLike<unknown>} */ (maybePromise).then === "function") throw new TypeError("Settings update mutator must be synchronous");
            const next = Object.freeze(draft);
            const changedNames = [ ...new Set([ ...Object.keys(base), ...Object.keys(next) ]) ].filter((name) => base[name] !== next[name]);
            for (const name of changedNames) {
                const validator = this.validators[name];
                if (validator && Object.prototype.hasOwnProperty.call(next, name) && !validator(next[name])) throw new TypeError(`Invalid setting: ${name}`);
            }
            const changed = Object.freeze([ ...changedNames ]);
            if (!changed.length) {
                this.snapshotValue = next;
                return next;
            }
            await this.storage.set(storageKey, next);
            this.snapshotValue = next;
            if (changed.length) {
                const name = changed.length === 1 ? changed[0] : null;
                this.dispatchEvent(new CustomEvent("settings.changed", { detail: Object.freeze({ name, value: name ? next[name] : undefined, names: changed, snapshot: next }) }));
            }
            try {
                await this.afterPersist?.(next, changed);
            } catch (error) {
                // Storage and local snapshot are already committed. Post-commit
                // side effects (legacy cache invalidation / BroadcastChannel) must
                // never turn a successful persistence into a reported failure.
                if (typeof /** @type {any} */ (globalThis).clog?.error === "function") /** @type {any} */ (globalThis).clog.error("[settings] afterPersist failed (ignored)", error);
            }
            return next;
        }));
        this.writeChain = operation.then(() => undefined, () => undefined);
        return operation;
    }

    /** Runs the read-modify-write inside the shared jhs_setting_lock so it serializes with legacy writers and other tabs. @param {() => Promise<Record<string, unknown>>} fn */
    async _withSettingLock(fn) {
        const locks = globalThis.navigator?.locks;
        if (!locks?.request) return fn();
        return locks.request("jhs_setting_lock", () => fn());
    }
}
