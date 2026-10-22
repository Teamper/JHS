// @ts-check

import { DETAIL_SHORTCUT_ACTIONS, readDetailShortcuts } from "../core/detail-shortcuts.js";
import { MAGNET_SOURCE_IDS, validateCustomMagnetSource, validateHttpsBaseUrl } from "../services/magnet-source-registry.js";
import { validateRule } from "../services/resource-settings-service.js";

/** Decode for validation only. The versioned original value is never rewritten. @param {any} value */
export function settingJson(value) { return typeof value === "string" ? JSON.parse(value) : value; }
/** @param {any} value */
const object = value => !!value && typeof value === "object" && !Array.isArray(value);
/** @param {any} value */
const number = value => (typeof value === "number" || typeof value === "string" && value.trim() !== "") && Number.isFinite(Number(value));
/** @param {any} value */
export function stringList(value) { return Array.isArray(value) && value.every(item => typeof item === "string"); }
/** @param {any} value */
export function booleanMap(value) { return object(value) && Object.values(value).every(item => typeof item === "boolean"); }
/** @param {any} value */
export function shortcuts(value) {
    const map = value;
    if (!object(map)) return false;
    const parsed = readDetailShortcuts(map);
    return Object.keys(map).every(key => Object.hasOwn(DETAIL_SHORTCUT_ACTIONS, key) && (map[key] == null || Object.hasOwn(parsed, key)));
}
/** @param {(item: any) => any} validate */
export const configurationList = validate => (/** @type {any} */ value) => {
    const list = settingJson(value);
    if (!Array.isArray(list)) return false;
    for (const item of list) { if (!object(item)) return false; validate(item); }
    return true;
};
export const resourceValidators = Object.freeze({
    customMagnetSources: configurationList(validateCustomMagnetSource),
    magnetTagRules: configurationList(validateRule),
    magnetFilterRules: configurationList(validateRule),
    magnetBuiltInSources: configurationList(item => {
        if (!MAGNET_SOURCE_IDS.includes(item.id)) throw new Error("未知的内置磁力源");
        if (item.baseUrl) validateHttpsBaseUrl(item.baseUrl);
        if (item.priority != null && (!number(item.priority) || Number(item.priority) < 1)) throw new Error("来源优先级无效");
    }),
    detailShortcuts: shortcuts,
});

/** Descriptor-owned validation, including supported legacy representations. @param {Record<string, any>} descriptor @param {any} value */
export function validateDescriptorSync(descriptor, value) {
    if (descriptor.validateSync) return descriptor.validateSync(value) === true;
    if (descriptor.validate && descriptor.validate(value) !== true) return false;
    if (descriptor.type === "boolean") return [true, false, "yes", "no", "true", "false", 1, 0, "1", "0"].includes(value);
    if (descriptor.type === "select") return (descriptor.options || []).some((/** @type {any} */ option) => option.value === value);
    if (descriptor.type === "number") {
        if (!number(value)) return false;
        const parsed = Number(value);
        return (descriptor.min == null || parsed >= descriptor.min) && (descriptor.max == null || parsed <= descriptor.max) && (descriptor.step !== 1 || Number.isSafeInteger(parsed));
    }
    if (["text", "password"].includes(descriptor.type)) return typeof value === "string";
    if (descriptor.type === "json") { const parsed = settingJson(value); return Array.isArray(descriptor.defaultValue) ? Array.isArray(parsed) : object(parsed); }
    return true;
}
