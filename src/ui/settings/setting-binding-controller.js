// @ts-check

/**
 * Shared Settings UI binding controller.
 *
 * All live setting surfaces (quick + full) are bound to one hub per
 * SettingsService. A change on one surface is immediately reflected on every
 * other mounted surface, then persisted through SettingsService. Write failures
 * roll back every surface to the last committed value, guarded by a per-key
 * revision token so a stale failed promise cannot overwrite a newer intent.
 */

const hubs = new WeakMap();

/** @param {any} settings */
export function getSettingBindingHub(settings) {
    let hub = hubs.get(settings);
    if (!hub) {
        hub = new SettingBindingHub(settings);
        hubs.set(settings, hub);
    }
    return hub;
}


/**
 * Bind a non-descriptor static control (checkbox/select/range) through the same
 * shared BindingHub used by dynamic setting rows. This gives static live
 * controls optimistic sync, cross-surface propagation, rollback and pending
 * intent retention.
 *
 * @param {{
 *   root: any,
 *   selector: string,
 *   key: string,
 *   getValue: () => unknown,
 *   setValue: (value: unknown) => void,
 *   fallback?: unknown,
 *   label?: string,
 *   settings: any,
 *   onChange?: ((key: string, value: unknown) => void) | null
 * }} options
 */
export function bindSettingControl({ root, selector, key, getValue, setValue, fallback = undefined, label = key, settings, onChange = null }) {
    const hub = getSettingBindingHub(settings);
    const element = root.find(selector);
    if (!element.length) return null;
    /** @type {any} */
    const binding = {
        setValue(/** @type {string} */ name, /** @type {unknown} */ value) {
            if (name === key) setValue(value);
        },
        dispose() {
            element.off(".jhsSettingBinding");
            hub._dropBinding(binding);
        },
    };
    hub.bindings.add(binding);
    element.off(".jhsSettingBinding").on("change.jhsSettingBinding", () => {
        const value = getValue();
        onChange?.(key, value);
        hub.userChanged(key, value, fallback, label);
    });
    binding.setValue(key, hub.desiredValue(key, settings.snapshot()[key] ?? fallback));
    return {
        sync(/** @type {Record<string, unknown>} */ snapshot) {
            if (Object.prototype.hasOwnProperty.call(snapshot, key)) setValue(snapshot[key]);
        },
        flush: (/** @type {any} */ options) => hub.flush(options),
        dispose: () => binding.dispose(),
    };
}

/**
 * Creates an optimistic direct-action writer whose rollback is owned only by
 * the latest intent for this control.
 *
 * @param {{settings: any, key: string, fallback?: unknown, apply: (value: unknown) => void, onError?: (error: unknown) => void}} options
 */
export function createLatestSettingWriter({ settings, key, fallback = undefined, apply, onError = () => {} }) {
    let revision = 0;
    return async (/** @type {unknown} */ value) => {
        const token = ++revision;
        apply(value);
        try {
            await settings.set(key, value);
        } catch (error) {
            if (token === revision) {
                apply(settings.snapshot()[key] ?? fallback);
                onError(error);
            }
        }
    };
}

class SettingBindingHub {
    /** @param {any} settings */
    constructor(settings) {
        this.settings = settings;
        /** @type {Set<any>} */
        this.bindings = new Set();
        /** @type {Map<string, { token: number, value: unknown, promise: Promise<unknown>, error?: unknown }>} */
        this.pending = new Map();
        this.revision = 0;
        this._onSettingsChanged = this._onSettingsChanged.bind(this);
        this.settings.addEventListener("settings.changed", this._onSettingsChanged);
    }

    /** @param {any} event */
    _onSettingsChanged(event) {
        const detail = event.detail || {};
        const snapshot = detail.snapshot ?? this.settings.snapshot();
        const names = Array.isArray(detail.names) ? detail.names : Object.keys(snapshot);
        for (const name of names) {
            const pending = this.pending.get(name);
            // A newer local intent must never be covered by an intermediate
            // committed state from an older write (e.g. OFF -> ON -> OFF).
            this.syncAll(name, pending ? pending.value : snapshot[name]);
        }
    }

    /** @param {string} key @param {unknown} value */
    syncAll(key, value) {
        for (const binding of this.bindings) binding.setValue(key, value);
    }

    /** @param {string} key @param {unknown} fallback */
    desiredValue(key, fallback) {
        const pending = this.pending.get(key);
        return pending ? pending.value : fallback;
    }

    /** @param {string} key @param {unknown} value @param {unknown} fallback @param {string} [label] */
    userChanged(key, value, fallback, label) {
        // Optimistically update every mounted surface.
        this.syncAll(key, value);
        const token = ++this.revision;
        /** @type {{ token: number, value: unknown, promise: Promise<unknown>, error?: unknown }} */
        const item = { token, value, promise: Promise.resolve() };
        const promise = this.settings.set(key, value).then(
            () => {
                if (this.pending.get(key) === item) {
                    this.pending.delete(key);
                    this._maybeDispose();
                }
            },
            (/** @type {unknown} */ error) => {
                if (this.pending.get(key) === item) {
                    this.pending.delete(key);
                    item.error = error;
                    const committed = this.settings.snapshot()[key] ?? fallback;
                    this.syncAll(key, committed);
                    this._maybeDispose();
                    if (typeof /** @type {any} */ (globalThis).show?.error === "function") {
                        /** @type {any} */ (globalThis).show.error(`${label || key}保存失败，已恢复原设置`);
                    } else if (typeof /** @type {any} */ (globalThis).clog?.error === "function") {
                        /** @type {any} */ (globalThis).clog.error(`${label || key}保存失败，已恢复原设置`, error);
                    }
                }
            }
        );
        item.promise = promise;
        this.pending.set(key, item);
        return promise;
    }

    async flush({ throwOnFailure = false } = {}) {
        const items = [ ...this.pending.values() ];
        await Promise.all(items.map((item) => item.promise));
        await this.settings.waitForIdle();
        if (throwOnFailure) {
            const failures = items.filter((item) => item.error).map((item) => item.error);
            if (failures.length > 0) {
                const error = /** @type {any} */ (new Error("部分实时设置保存失败"));
                error.cause = failures[0];
                error.liveSettingFailures = failures;
                throw error;
            }
        }
    }

    /** @param {any} binding */
    _dropBinding(binding) {
        this.bindings.delete(binding);
        this._maybeDispose();
    }

    _maybeDispose() {
        if (this.bindings.size === 0 && this.pending.size === 0) {
            this.settings.removeEventListener("settings.changed", this._onSettingsChanged);
            hubs.delete(this.settings);
        }
    }
}
