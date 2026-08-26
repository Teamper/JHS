// @ts-check

import { getSettingBindingHub } from "./setting-binding-controller.js";

/**
 * Shared setting UI renderer. Both the full settings dialog and the quick
 * settings panel render the same SettingDescriptor through this module and
 * write through the same SettingsService key — no second semantic definition.
 */

/** @param {string} key @param {unknown} value */
function normalizeBooleanValue(key, value) {
    return value === "yes" || value === true;
}

/** @typedef {{ value?: unknown, onChange?: ((value: unknown) => void) | null }} ControlOptions */

/** Build the raw control element for a descriptor. @param {Record<string, any>} descriptor @param {ControlOptions} [options] */
export function renderSettingControl(descriptor, options = {}) {
    const jq = /** @type {any} */ (globalThis).$;
    const value = options.value ?? descriptor.defaultValue;
    const onChange = options.onChange ?? null;
    /** @type {any} */ let control;
    if (descriptor.type === "boolean") {
        control = jq('<input type="checkbox" class="mini-switch">').prop("checked", normalizeBooleanValue(descriptor.key, value));
        control.on("change", () => { onChange?.(control.is(":checked") ? "yes" : "no"); });
        return { root: control, getValue: () => control.is(":checked") ? "yes" : "no", setValue: /** @param {unknown} next */ (next) => control.prop("checked", normalizeBooleanValue(descriptor.key, next)) };
    }
    if (descriptor.type === "select") {
        const optionsList = Array.isArray(descriptor.options) ? descriptor.options : [];
        control = jq('<select class="jhs-select-source"></select>');
        optionsList.forEach((option) => {
            const item = option && typeof option === "object" ? option : { value: option, label: String(option) };
            control.append(jq('<option></option>').attr("value", item.value).text(item.label ?? String(item.value)));
        });
        control.val(String(value ?? ""));
        control.on("change", () => onChange?.(control.val()));
        return { root: control, getValue: () => control.val(), setValue: /** @param {unknown} next */ (next) => control.val(String(next ?? "")) };
    }
    if (descriptor.type === "number") {
        control = jq('<input type="number" class="jhs-field">').val(value == null ? "" : String(value));
        control.on("change", () => onChange?.(Number(control.val()) || 0));
        return { root: control, getValue: () => Number(control.val()) || 0, setValue: /** @param {unknown} next */ (next) => control.val(next == null ? "" : String(next)) };
    }
    control = jq('<input type="text" class="jhs-field">').val(value == null ? "" : String(value));
    control.on("change", () => onChange?.(control.val()));
    return { root: control, getValue: () => control.val(), setValue: /** @param {unknown} next */ (next) => control.val(next == null ? "" : String(next)) };
}

/** Build a canonical jhs-setting-row for a descriptor. @param {Record<string, any>} descriptor @param {ControlOptions & { value?: unknown }} [options] */
export function renderSettingRow(descriptor, options = {}) {
    const jq = /** @type {any} */ (globalThis).$;
    const rendered = renderSettingControl(descriptor, { value: options.value, onChange: options.onChange });
    const copy = jq('<span class="jhs-setting-row__copy"></span>')
        .append(jq('<span class="jhs-setting-row__label"></span>').text(descriptor.label))
        .append(jq('<span class="jhs-setting-row__description"></span>').text(descriptor.description || ""));
    const control = jq('<span class="jhs-setting-row__control"></span>').append(rendered.root);
    const row = jq('<label class="jhs-setting-row"></label>')
        .attr("data-jhs-setting", descriptor.key)
        .attr("data-jhs-setting-effect", descriptor.effect || "live")
        .toggleClass("jhs-setting-row--indent", descriptor.indent === true)
        .append(copy, control);
    return { row, root: rendered.root, getValue: rendered.getValue, setValue: rendered.setValue };
}

/** Render the quick settings list from registry descriptors. @param {import("../../app/settings-registry.js").SettingsRegistry} registry @param {{ disabledContributions?: Set<string> }} [options] */
export function buildQuickSettingsHtml(registry, options = {}) {
    const jq = /** @type {any} */ (globalThis).$;
    const list = jq('<div class="simple-setting__list"></div>');
    for (const descriptor of registry.list({ surfaces: [ "quick" ], disabledContributions: options.disabledContributions })) {
        const { row } = renderSettingRow(descriptor);
        list.append(row);
    }
    return list;
}

/**
 * Bind a set of rendered setting rows to SettingsService (live effect).
 *
 * Returns a disposable binding handle. It keeps the original DOM controls and
 * subscribes to the shared per-SettingsService binding hub so every mounted
 * quick/full surface stays in sync without rebuilding controls.
 *
 * @param {any} root
 * @param {Array<Record<string, any>>} descriptors
 * @param {{ settings: any, onChanged?: ((key: string, value: unknown) => void) | null }} options
 */
export function bindSettingRows(root, descriptors, { settings, onChanged = null }) {
    const hub = getSettingBindingHub(settings);
    const binding = new RowBinding(root, descriptors, { settings, hub, onChanged });
    return {
        sync: (/** @type {Record<string, unknown>} */ snapshot) => binding.sync(snapshot),
        flush: (/** @type {any} */ options) => hub.flush(options),
        dispose: () => binding.dispose(),
        setters: binding.setters,
    };
}

/**
 * Sync rendered rows from a snapshot without firing change events. This is a
 * compatibility helper only; it never rebuilds controls.
 *
 * @param {any} root
 * @param {Array<Record<string, any>>} descriptors
 * @param {Record<string, unknown>} snapshot
 */
export function syncSettingRows(root, descriptors, snapshot) {
    descriptors.forEach((descriptor) => {
        const row = root.find(`[data-jhs-setting="${descriptor.key}"]`).first();
        if (!row.length) return;
        const control = row.find(".jhs-setting-row__control").children().first();
        const value = Object.prototype.hasOwnProperty.call(snapshot, descriptor.key) ? snapshot[descriptor.key] : descriptor.defaultValue;
        if (control.is('input[type="checkbox"]')) control.prop("checked", normalizeBooleanValue(descriptor.key, value));
        else if (control.is("select")) control.val(String(value ?? ""));
        else control.val(value == null ? "" : String(value));
    });
}

class RowBinding {
    /**
     * @param {any} root
     * @param {Array<Record<string, any>>} descriptors
     * @param {{ settings: any, hub: any, onChanged?: ((key: string, value: unknown) => void) | null }} options
     */
    constructor(root, descriptors, { settings, hub, onChanged = null }) {
        this.root = root;
        this.settings = settings;
        this.hub = hub;
        this.onChanged = onChanged;
        /** @type {Record<string, (value: unknown) => void>} */
        this.setters = {};
        /** @type {Map<string, { element: any, setValue: (value: unknown) => void }>} */
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
            const rendered = renderSettingControl(descriptor);
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
        this.controls.set(key, { element, setValue });
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
        for (const key of this.controls.keys()) {
            const value = Object.prototype.hasOwnProperty.call(snapshot, key) ? snapshot[key] : this.settings.snapshot()[key];
            this.setValue(key, value);
        }
    }

    dispose() {
        for (const control of this.controls.values()) {
            control.element.off(".jhsSettingBinding");
        }
        this.hub._dropBinding(this);
    }
}

/** @param {string} type @param {any} element @returns {(value: unknown) => void} */
function makeSetValue(type, element) {
    if (type === "boolean") return (next) => element.prop("checked", normalizeBooleanValue("", next));
    if (type === "select") return (next) => element.val(String(next ?? ""));
    if (type === "number") return (next) => element.val(next == null ? "" : String(next));
    return (next) => element.val(next == null ? "" : String(next));
}

/** @param {string} type @param {any} element @returns {() => unknown} */
function makeGetValue(type, element) {
    if (type === "boolean") return () => element.is(":checked") ? "yes" : "no";
    if (type === "select") return () => element.val();
    if (type === "number") return () => Number(element.val()) || 0;
    return () => element.val();
}
