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
        flush: () => hub.flush(),
        dispose: () => binding.dispose(),
    };
}

class SettingBindingHub {
    /** @param {any} settings */
    constructor(settings) {
        this.settings = settings;
        /** @type {Set<any>} */
        this.bindings = new Set();
        /** @type {Map<string, { token: number, value: unknown, promise: Promise<unknown> }>} */
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
        const promise = this.settings.set(key, value).then(
            () => {
                if (this.pending.get(key)?.token === token) {
                    this.pending.delete(key);
                    this._maybeDispose();
                }
            },
            (/** @type {unknown} */ error) => {
                if (this.pending.get(key)?.token === token) {
                    this.pending.delete(key);
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
        this.pending.set(key, { token, value, promise });
        return promise;
    }

    async flush() {
        await Promise.all([ ...this.pending.values() ].map((item) => item.promise));
        await this.settings.waitForIdle();
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

class RowBinding {
    /**
     * @param {any} root
     * @param {Array<Record<string, any>>} descriptors
     * @param {{ settings: any, hub: SettingBindingHub, onChanged?: ((key: string, value: unknown) => void) | null }} options
     */
    constructor(root, descriptors, { settings, hub, onChanged = null }) {
        this.root = root;
        this.settings = settings;
        this.hub = hub;
        this.onChanged = onChanged;
        /** @type {Record<string, (value: unknown) => void>} */
        this.setters = {};
        /** @type {Map<string, { element: any, setValue: (value: unknown) => void, getValue: () => unknown }>} */
        this.controls = new Map();
        hub.bindings.add(this);
        for (const descriptor of descriptors) {
            this._bindDescriptor(descriptor);
        }
    }

    /** @param {Record<string, any>} descriptor */
    _bindDescriptor(descriptor) {
        const key = descriptor.key;
        const row = this.root.find(`[data-jhs-setting="${key}"]`).first();
        if (!row.length) return;
        const slot = row.find(".jhs-setting-row__control");
        let element = slot.children().first();
        if (!element.length) {
            const rendered = renderControl(descriptor);
            slot.append(rendered.root);
            element = rendered.root;
        }
        const type = descriptor.type || (element.is("select") ? "select" : element.is('input[type="checkbox"]') ? "boolean" : element.is('input[type="number"]') ? "number" : "text");
        const setValue = makeSetValue(type, element);
        const getValue = makeGetValue(type, element);
        const fallback = descriptor.defaultValue;
        element.off(".jhsSettingBinding").on("change.jhsSettingBinding", () => {
            const value = getValue();
            this.onChanged?.(key, value);
            if ((descriptor.effect || "live") === "live") {
                this.hub.userChanged(key, value, fallback, descriptor.label || key);
            }
        });
        this.controls.set(key, { element, setValue, getValue });
        this.setters[key] = setValue;
        this.setValue(key, this.hub.desiredValue(key, this.settings.snapshot()[key] ?? fallback));
    }

    /** @param {string} key @param {unknown} value */
    setValue(key, value) {
        const control = this.controls.get(key);
        if (control) control.setValue(value);
    }

    /** @param {Record<string, unknown>} snapshot */
    sync(snapshot) {
        for (const descriptor of this.controls.keys()) {
            const fallback = this.settings.snapshot()[descriptor] ?? undefined;
            const value = Object.prototype.hasOwnProperty.call(snapshot, descriptor) ? snapshot[descriptor] : fallback;
            this.setValue(descriptor, value);
        }
    }

    dispose() {
        for (const control of this.controls.values()) {
            control.element.off(".jhsSettingBinding");
        }
        this.hub._dropBinding(this);
    }
}

/** @param {Record<string, any>} descriptor */
function renderControl(descriptor) {
    const jq = /** @type {any} */ (globalThis).$;
    const value = descriptor.defaultValue;
    if (descriptor.type === "boolean") {
        const control = jq('<input type="checkbox" class="mini-switch">').prop("checked", normalizeBooleanValue(value));
        return { root: control };
    }
    if (descriptor.type === "select") {
        const control = jq('<select class="jhs-select-source"></select>');
        for (const option of descriptor.options || []) {
            const item = option && typeof option === "object" ? option : { value: option, label: String(option) };
            control.append(jq('<option></option>').attr("value", item.value).text(item.label ?? String(item.value)));
        }
        control.val(String(value ?? ""));
        return { root: control };
    }
    if (descriptor.type === "number") {
        return { root: jq('<input type="number" class="jhs-field">').val(value == null ? "" : String(value)) };
    }
    return { root: jq('<input type="text" class="jhs-field">').val(value == null ? "" : String(value)) };
}

/** @param {string} type @param {any} element @returns {(value: unknown) => void} */
function makeSetValue(type, element) {
    if (type === "boolean") {
        return (next) => element.prop("checked", normalizeBooleanValue(next));
    }
    if (type === "select") {
        return (next) => element.val(String(next ?? ""));
    }
    if (type === "number") {
        return (next) => element.val(next == null ? "" : String(next));
    }
    return (next) => element.val(next == null ? "" : String(next));
}

/** @param {string} type @param {any} element @returns {() => unknown} */
function makeGetValue(type, element) {
    if (type === "boolean") return () => element.is(":checked") ? "yes" : "no";
    if (type === "select") return () => element.val();
    if (type === "number") return () => Number(element.val()) || 0;
    return () => element.val();
}

/** @param {unknown} value */
function normalizeBooleanValue(value) {
    return value === "yes" || value === true;
}
