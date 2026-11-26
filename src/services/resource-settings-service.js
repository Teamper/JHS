// @ts-check

import { parseBooleanSetting as parseBooleanSettingValue } from "../core/feature-helpers.js";
import { MAGNET_SOURCE_IDS, validateCustomMagnetSource, validateHttpsBaseUrl } from "./magnet-source-registry.js";

export const BUILT_IN_NATIVE_MAGNET_SOURCES = Object.freeze([
    { id: "native-javdb", name: "JavDB 本站", type: "本站资源", domain: "javdb.com", priority: 10, enabled: true, testMode: "host-page" },
    { id: "native-javbus", name: "JavBus 本站", type: "本站资源", domain: "javbus.com", priority: 11, enabled: true, testMode: "host-page" }
]);
export const BUILT_IN_MAGNET_SOURCES = BUILT_IN_NATIVE_MAGNET_SOURCES;

/** @typedef {Record<string, any>} ResourceRecord */

export function validateRule(/** @type {ResourceRecord} */ rule) {
    if (!rule.name?.trim() || !rule.pattern?.trim()) throw new TypeError("规则名称和匹配内容不能为空");
    if ("regex" === rule.type) try { new RegExp(rule.pattern); } catch { throw new TypeError("正则表达式无效"); }
    return { ...rule, name: rule.name.trim(), pattern: rule.pattern.trim() };
}

export function buildCustomMagnetSource(/** @type {ResourceRecord} */ form, /** @type {ResourceRecord | null} */ existing = null) {
    const parserType = form.parserType || "magnet-links";
    const config = { id: existing?.id || `source-${Date.now()}`, name: String(form.name || "").trim(), enabled: Boolean(form.enabled), priority: Number(form.priority) || 100, searchUrlTemplate: String(form.searchUrlTemplate || "").trim(), targetUrlTemplate: String(form.targetUrlTemplate || form.searchUrlTemplate || "").trim(), parserType };
    if (!config.name) throw new TypeError("来源名称不能为空");
    if ("torrent-table" === parserType) Object.assign(config, { rowSelector: form.rowSelector, titleSelector: form.titleSelector, magnetSelector: form.magnetSelector, sizeSelector: form.sizeSelector, dateSelector: form.dateSelector, seedersSelector: form.seedersSelector, leechersSelector: form.leechersSelector });
    if ("json" === parserType) Object.assign(config, { resultsPath: form.resultsPath, titlePath: form.titlePath, magnetPath: form.magnetPath, hashPath: form.hashPath, sizePath: form.sizePath, datePath: form.datePath, seedersPath: form.seedersPath });
    return validateCustomMagnetSource(config);
}

/** @param {unknown} value @param {boolean} [fallback] */
export function parseBooleanSetting(value, fallback = false) { return parseBooleanSettingValue(value, fallback); }

/** Parse finite numeric setting with optional bounds. */
/** @param {unknown} value @param {number} fallback @param {{min?: number, max?: number}} [bounds] */
export function parseFiniteNumberSetting(value, fallback, bounds = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    const rounded = Math.round(parsed);
    if (bounds.min != null && rounded < bounds.min) return bounds.min;
    if (bounds.max != null && rounded > bounds.max) return bounds.max;
    return rounded;
}

/** Normalize one canonical cloud setting before it reaches storage. */
/** @param {string} key @param {unknown} value */
export function normalizeCloudSetting(key, value) {
    if (["enable123Offline", "enable115Offline", "enable115Match", "enable115LoginRedirect"].includes(key)) return parseBooleanSetting(value, false);
    if (key === "offlineProviderMode") return ["ask", "123", "115"].includes(String(value)) ? String(value) : "ask";
    if (key === "oneOneFiveConcurrency") return parseFiniteNumberSetting(value, 4, { min: 1, max: 10 });
    if (key === "oneOneFiveCacheMinutes") return parseFiniteNumberSetting(value, 60, { min: 1, max: 1440 });
    throw new TypeError(`未知云盘设置: ${key}`);
}

export class ResourceSettingsService {
    /** @param {Pick<import("./settings-service.js").SettingsService, "snapshot" | "set" | "update" | "patch">} settings */
    constructor(settings) { this.settings = settings; }

    getArray(/** @type {string} */ key) { return readResourceArray(this.settings.snapshot()[key]); }

    async saveArray(/** @type {string} */ key, /** @type {any[]} */ value) {
        if (!Array.isArray(value)) throw new TypeError("配置必须是数组");
        await this.settings.set(key, JSON.stringify(value));
        return value;
    }

    async updateArray(/** @type {string} */ key, /** @type {(list: any[]) => any[]} */ updater) {
        /** @type {any[] | undefined} */ let result;
        await this.settings.update(draft => {
            result = updater(readResourceArray(draft[key]));
            if (!Array.isArray(result)) throw new TypeError("配置必须是数组");
            draft[key] = JSON.stringify(result);
        });
        return result;
    }
    getMagnetSources() { return this.getArray("customMagnetSources"); }
    saveMagnetSources(/** @type {ResourceRecord[]} */ value) { value.forEach(validateCustomMagnetSource); return this.saveArray("customMagnetSources", value); }
    getMagnetTagRules() { return this.getArray("magnetTagRules"); }
    saveMagnetTagRules(/** @type {ResourceRecord[]} */ value) { value.forEach(validateRule); return this.saveArray("magnetTagRules", value); }
    getMagnetFilterRules() { return this.getArray("magnetFilterRules"); }
    saveMagnetFilterRules(/** @type {ResourceRecord[]} */ value) { value.forEach(validateRule); return this.saveArray("magnetFilterRules", value); }
    getBuiltInSources() { return this.getArray("magnetBuiltInSources"); }
    saveBuiltInSources(/** @type {ResourceRecord[]} */ value) { value.forEach((source => { if (!MAGNET_SOURCE_IDS.includes(source.id)) throw new TypeError("未知的内置磁力源"); if (source.baseUrl) validateHttpsBaseUrl(source.baseUrl); if (source.priority != null && (!Number.isFinite(Number(source.priority)) || Number(source.priority) < 1)) throw new TypeError("来源优先级无效"); })); return this.saveArray("magnetBuiltInSources", value); }
    getScreenshotSettings() {
        const { screenshotMode = "auto", screenshotProviders } = this.settings.snapshot();
        return { mode: screenshotMode, providers: readResourceArray(screenshotProviders) };
    }
    async saveScreenshotMode(/** @type {string} */ mode) { await this.settings.set("screenshotMode", mode); return mode; }
    async saveScreenshotProviders(/** @type {ResourceRecord[]} */ providers) { return this.saveArray("screenshotProviders", providers); }
    saveScreenshotSettings(/** @type {ResourceRecord} */ value) {
        return this.settings.patch({ screenshotMode: value.mode, screenshotProviders: JSON.stringify(value.providers) });
    }
    getCloudSettings() {
        const settings = this.settings.snapshot();
        return {
            enable123Offline: parseBooleanSetting(settings.enable123Offline, true),
            enable115Offline: parseBooleanSetting(settings.enable115Offline),
            enable115Match: parseBooleanSetting(settings.enable115Match),
            enable115LoginRedirect: parseBooleanSetting(settings.enable115LoginRedirect),
            providerMode: normalizeCloudSetting("offlineProviderMode", settings.offlineProviderMode),
            concurrency: parseFiniteNumberSetting(settings.oneOneFiveConcurrency, 4, { min: 1, max: 10 }),
            cacheMinutes: parseFiniteNumberSetting(settings.oneOneFiveCacheMinutes, 60, { min: 1, max: 1440 })
        };
    }
    async saveCloudSetting(/** @type {string} */ key, /** @type {unknown} */ value) {
        const normalized = normalizeCloudSetting(key, value);
        await this.settings.set(key, normalized);
        return normalized;
    }
    saveCloudSettings(/** @type {ResourceRecord} */ value) {
        const normalized = { enable123Offline: normalizeCloudSetting("enable123Offline", value.enable123Offline), enable115Offline: normalizeCloudSetting("enable115Offline", value.enable115Offline), enable115Match: normalizeCloudSetting("enable115Match", value.enable115Match), enable115LoginRedirect: normalizeCloudSetting("enable115LoginRedirect", value.enable115LoginRedirect), offlineProviderMode: normalizeCloudSetting("offlineProviderMode", value.providerMode || "ask"), oneOneFiveConcurrency: normalizeCloudSetting("oneOneFiveConcurrency", value.concurrency), oneOneFiveCacheMinutes: normalizeCloudSetting("oneOneFiveCacheMinutes", value.cacheMinutes) };
        return this.settings.patch(normalized);
    }
    exportConfig() { return { customMagnetSources: this.getMagnetSources(), magnetTagRules: this.getMagnetTagRules(), magnetFilterRules: this.getMagnetFilterRules(), magnetBuiltInSources: this.getBuiltInSources(), screenshot: this.getScreenshotSettings() }; }
    async importConfig(/** @type {string} */ text) {
        /** @type {ResourceRecord} */ let value; try { value = JSON.parse(text); } catch (error) { throw new TypeError(`配置格式错误：${error instanceof Error ? error.message : String(error)}`); }
        if (!value || "object" !== typeof value || Array.isArray(value)) throw new TypeError("配置格式错误：根节点必须是对象");
        /** @type {Array<() => Promise<unknown>>} */ const operations = [];
        if (Object.hasOwn(value, "customMagnetSources")) { if (!Array.isArray(value.customMagnetSources)) throw new TypeError("自定义磁力源必须是数组"); value.customMagnetSources.forEach(validateCustomMagnetSource); operations.push(() => this.saveMagnetSources(value.customMagnetSources)); }
        if (Object.hasOwn(value, "magnetTagRules")) { if (!Array.isArray(value.magnetTagRules)) throw new TypeError("标签规则必须是数组"); value.magnetTagRules.forEach(validateRule); operations.push(() => this.saveMagnetTagRules(value.magnetTagRules)); }
        if (Object.hasOwn(value, "magnetFilterRules")) { if (!Array.isArray(value.magnetFilterRules)) throw new TypeError("过滤规则必须是数组"); value.magnetFilterRules.forEach(validateRule); operations.push(() => this.saveMagnetFilterRules(value.magnetFilterRules)); }
        if (Object.hasOwn(value, "magnetBuiltInSources")) { if (!Array.isArray(value.magnetBuiltInSources)) throw new TypeError("内置磁力源配置必须是数组"); operations.push(() => this.saveBuiltInSources(value.magnetBuiltInSources)); }
        if (Object.hasOwn(value, "screenshot")) { if (!value.screenshot || !["auto", "manual"].includes(value.screenshot.mode) || !Array.isArray(value.screenshot.providers)) throw new TypeError("截图配置无效"); operations.push(() => this.saveScreenshotSettings(value.screenshot)); }
        for (const operation of operations) await operation();
        return value;
    }
}

/** @param {unknown} value @returns {any[]} */
function readResourceArray(value) {
    if (Array.isArray(value)) return value;
    if (typeof value !== "string") return [];
    try {
        const parsed = JSON.parse(value);
        return Array.isArray(parsed) ? parsed : [];
    } catch { return []; }
}
