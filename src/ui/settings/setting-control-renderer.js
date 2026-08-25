// @ts-check

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

/** Bind a set of rendered setting rows to SettingsService (live effect). @param {any} root @param {Array<Record<string, any>>} descriptors @param {{ settings: any, onChanged?: ((key: string, value: unknown) => void) | null }} options */
export function bindSettingRows(root, descriptors, { settings, onChanged = null }) {
    /** @type {Record<string, (value: unknown) => void>} */
    const setters = {};
    descriptors.forEach((descriptor) => {
        const row = root.find(`[data-jhs-setting="${descriptor.key}"]`).first();
        if (!row.length) return;
        const rendered = renderSettingControl(descriptor, { value: settings.snapshot()[descriptor.key] ?? descriptor.defaultValue });
        row.find(".jhs-setting-row__control").empty().append(rendered.root);
        rendered.root.on("change", () => {
            const value = rendered.getValue();
            onChanged?.(descriptor.key, value);
            if ((descriptor.effect || "live") === "live") {
                void settings.set(descriptor.key, value).catch((/** @type {unknown} */ error) => {
                    /** @type {any} */ (globalThis).clog?.error(`保存设置失败: ${descriptor.key}`, error);
                });
            }
        });
        setters[descriptor.key] = rendered.setValue;
    });
    return setters;
}

/** Sync rendered rows from a settings snapshot without firing change events. @param {any} root @param {Array<Record<string, any>>} descriptors @param {Record<string, unknown>} snapshot */
export function syncSettingRows(root, descriptors, snapshot) {
    descriptors.forEach((descriptor) => {
        const row = root.find(`[data-jhs-setting="${descriptor.key}"]`).first();
        if (!row.length) return;
        const rendered = renderSettingControl(descriptor, { value: snapshot[descriptor.key] ?? descriptor.defaultValue });
        row.find(".jhs-setting-row__control").empty().append(rendered.root);
    });
}
