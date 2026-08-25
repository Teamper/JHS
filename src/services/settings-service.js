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

    /** Runs the read-modify-write inside the shared jhs_setting_lock so it serializes with legacy writers and other tabs. @param {() => Promise<Record<string, unknown>>} fn */
    async _withSettingLock(fn) {
        const locks = globalThis.navigator?.locks;
        if (!locks?.request) return fn();
        return locks.request("jhs_setting_lock", () => fn());
    }

    /** @param {Record<string, unknown>} values @param {string[]} changedNames @param {string} storageKey @param {boolean} merge */
    _enqueue(values, changedNames, storageKey, merge) {
        for (const name of changedNames) {
            const validator = this.validators[name];
            if (validator && !validator(values[name])) throw new TypeError(`Invalid setting: ${name}`);
        }
        const operation = this.writeChain.then(() => this._withSettingLock(async () => {
            const stored = await this.storage.get(storageKey);
            const base = /** @type {Record<string, unknown>} */ (stored && typeof stored === "object" && !Array.isArray(stored) ? stored : {});
            const next = Object.freeze(merge ? { ...base, ...values } : { ...values });
            // 真实 diff：以锁内重读的 base 为准，同值重写不发事件；replace 覆盖整个对象，
            // 因此被删除的 key 也计入 changed。
            const actualChanged = merge
                ? Object.keys(values).filter((name) => base[name] !== values[name])
                : [ ...new Set([ ...Object.keys(base), ...Object.keys(next) ]) ].filter((name) => base[name] !== next[name]);
            await this.storage.set(storageKey, next);
            this.snapshotValue = next;
            const changed = Object.freeze([ ...actualChanged ]);
            await this.afterPersist?.(next, changed);
            if (changed.length) {
                const name = changed.length === 1 ? changed[0] : null;
                this.dispatchEvent(new CustomEvent("settings.changed", { detail: Object.freeze({ name, value: name ? next[name] : undefined, names: changed, snapshot: next }) }));
            }
            return next;
        }));
        this.writeChain = operation.then(() => undefined, () => undefined);
        return operation;
    }
}
