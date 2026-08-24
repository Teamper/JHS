// @ts-check

export class SettingsService extends EventTarget {
    /** @param {{get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<void>}} storage @param {{validators?: Record<string, (value: unknown) => boolean>}} [options] */
    constructor(storage, options = {}) {
        super();
        this.storage = storage;
        this.validators = options.validators ?? {};
        this.snapshotValue = Object.freeze({});
        this.writeChain = Promise.resolve();
    }

    /** @param {string} key */
    async load(key = "setting") {
        const stored = await this.storage.get(key);
        this.snapshotValue = Object.freeze(stored && typeof stored === "object" && !Array.isArray(stored) ? { ...stored } : {});
        return this.snapshotValue;
    }

    snapshot() { return this.snapshotValue; }

    /** @param {string} name @param {unknown} value @param {string} [storageKey] */
    async set(name, value, storageKey = "setting") {
        const validator = this.validators[name];
        if (validator && !validator(value)) throw new TypeError(`Invalid setting: ${name}`);
        const operation = this.writeChain.then(async () => {
            const next = Object.freeze({ ...this.snapshotValue, [name]: value });
            await this.storage.set(storageKey, next);
            this.snapshotValue = next;
            this.dispatchEvent(new CustomEvent("settings.changed", { detail: Object.freeze({ name, value, snapshot: next }) }));
            return next;
        });
        this.writeChain = operation.then(() => undefined, () => undefined);
        return operation;
    }
}
