// @ts-check

export class SettingsService extends EventTarget {
    /** @param {{get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<void>}} storage @param {{validators?: Record<string, (value: unknown) => boolean>, afterPersist?: (snapshot: Readonly<Record<string, unknown>>, changedNames: readonly string[]) => Promise<void> | void}} [options] */
    constructor(storage, options = {}) {
        super();
        this.storage = storage;
        this.validators = options.validators ?? {};
        this.afterPersist = options.afterPersist ?? null;
        this.snapshotValue = Object.freeze({});
        this.writeChain = Promise.resolve();
    }

    /** @param {string} key */
    async load(key = "setting") {
        const stored = await this.storage.get(key);
        this.snapshotValue = Object.freeze(stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {});
        return this.snapshotValue;
    }

    /** Refreshes the in-memory snapshot after a transitional legacy write. */
    async refresh(key = "setting") { return this.load(key); }

    snapshot() { return this.snapshotValue; }

    /** @param {string} name @param {unknown} value @param {string} [storageKey] */
    async set(name, value, storageKey = "setting") {
        return this.patch({ [name]: value }, storageKey);
    }

    /** @param {Record<string, unknown>} values @param {string} [storageKey] */
    async patch(values, storageKey = "setting") {
        if (!values || typeof values !== "object" || Array.isArray(values)) throw new TypeError("Settings patch must be an object");
        return this._enqueue({ ...values }, Object.keys(values), storageKey, true);
    }

    /** @param {Record<string, unknown>} values @param {string} [storageKey] */
    async replace(values, storageKey = "setting") {
        if (!values || typeof values !== "object" || Array.isArray(values)) throw new TypeError("Settings replacement must be an object");
        return this._enqueue({ ...values }, Object.keys(values), storageKey, false);
    }

    /** @param {Record<string, unknown>} values @param {string[]} changedNames @param {string} storageKey @param {boolean} merge */
    _enqueue(values, changedNames, storageKey, merge) {
        for (const name of changedNames) {
            const validator = this.validators[name];
            if (validator && !validator(values[name])) throw new TypeError(`Invalid setting: ${name}`);
        }
        const operation = this.writeChain.then(async () => {
            const next = Object.freeze(merge ? { ...this.snapshotValue, ...values } : { ...values });
            await this.storage.set(storageKey, next);
            this.snapshotValue = next;
            await this.afterPersist?.(next, Object.freeze([ ...changedNames ]));
            const name = changedNames.length === 1 ? changedNames[0] : null;
            this.dispatchEvent(new CustomEvent("settings.changed", { detail: Object.freeze({ name, value: name ? next[name] : undefined, names: Object.freeze([ ...changedNames ]), snapshot: next }) }));
            return next;
        });
        this.writeChain = operation.then(() => undefined, () => undefined);
        return operation;
    }
}
