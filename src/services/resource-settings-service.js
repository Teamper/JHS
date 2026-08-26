// @ts-check

import { MAGNET_SOURCE_IDS, validateCustomMagnetSource, validateHttpsBaseUrl } from "./magnet-source-registry.js";

export const BUILT_IN_NATIVE_MAGNET_SOURCES = Object.freeze([
    { id: "native-javdb", name: "JavDB 本站", type: "本站资源", domain: "javdb.com", priority: 10, enabled: true },
    { id: "native-javbus", name: "JavBus 本站", type: "本站资源", domain: "javbus.com", priority: 11, enabled: true }
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

/** Parse legacy boolean strings without the classic Boolean("false") trap. */
/** @param {unknown} value @param {boolean} [fallback] */
export function parseBooleanSetting(value, fallback = false) {
    if (value == null) return fallback;
    if (value === true || value === "true" || value === "yes" || value === 1 || value === "1") return true;
    if (value === false || value === "false" || value === "no" || value === 0 || value === "0") return false;
    return fallback;
}

/** Parse finite numeric setting with optional bounds. */
/** @param {unknown} value @param {number} fallback @param {{min?: number, max?: number}} [bounds] */
export function parseFiniteNumberSetting(value, fallback, bounds = {}) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return fallback;
    if (bounds.min != null && parsed < bounds.min) return bounds.min;
    if (bounds.max != null && parsed > bounds.max) return bounds.max;
    return parsed;
}

export class ResourceSettingsService {
    constructor(/** @type {any} */ storage = storageManager) { this.storage = storage; }
    async getArray(/** @type {string} */ key) { const value = await this.storage.getSetting(key, "[]"); if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
    async saveArray(/** @type {string} */ key, /** @type {any[]} */ value) { if (!Array.isArray(value)) throw new TypeError("配置必须是数组"); await this.storage.saveSettingItem(key, JSON.stringify(value)); return value; }
    async updateArray(/** @type {string} */ key, /** @type {(list: any[]) => any[]} */ updater) {
        if (typeof this.storage.updateSetting === "function") {
            /** @type {any[] | undefined} */
            let result;
            await this.storage.updateSetting((/** @type {Record<string, any>} */ draft) => {
                const raw = draft[key];
                let list;
                if (Array.isArray(raw)) list = raw;
                else { try { const parsed = JSON.parse(raw || "[]"); list = Array.isArray(parsed) ? parsed : []; } catch { list = []; } }
                result = updater(list);
                if (!Array.isArray(result)) throw new TypeError("配置必须是数组");
                draft[key] = JSON.stringify(result);
            });
            return result;
        }
        const current = await this.getArray(key);
        const next = updater(current);
        await this.saveArray(key, next);
        return next;
    }
    getMagnetSources() { return this.getArray("customMagnetSources"); }
    saveMagnetSources(/** @type {ResourceRecord[]} */ value) { value.forEach(validateCustomMagnetSource); return this.saveArray("customMagnetSources", value); }
    getMagnetTagRules() { return this.getArray("magnetTagRules"); }
    saveMagnetTagRules(/** @type {ResourceRecord[]} */ value) { value.forEach(validateRule); return this.saveArray("magnetTagRules", value); }
    getMagnetFilterRules() { return this.getArray("magnetFilterRules"); }
    saveMagnetFilterRules(/** @type {ResourceRecord[]} */ value) { value.forEach(validateRule); return this.saveArray("magnetFilterRules", value); }
    async getBuiltInSources() { return await this.getArray("magnetBuiltInSources"); }
    saveBuiltInSources(/** @type {ResourceRecord[]} */ value) { value.forEach((source => { if (!MAGNET_SOURCE_IDS.includes(source.id)) throw new TypeError("未知的内置磁力源"); if (source.baseUrl) validateHttpsBaseUrl(source.baseUrl); if (source.priority != null && (!Number.isFinite(Number(source.priority)) || Number(source.priority) < 1)) throw new TypeError("来源优先级无效"); })); return this.saveArray("magnetBuiltInSources", value); }
    async getScreenshotSettings() { return { mode: await this.storage.getSetting("screenshotMode", "auto"), providers: await this.getArray("screenshotProviders") }; }
    async saveScreenshotMode(/** @type {string} */ mode) { await this.storage.saveSettingItem("screenshotMode", mode); return mode; }
    async saveScreenshotProviders(/** @type {ResourceRecord[]} */ providers) { return this.saveArray("screenshotProviders", providers); }
    async saveScreenshotSettings(/** @type {ResourceRecord} */ value) {
        if (typeof this.storage.patch === "function") return this.storage.patch({ screenshotMode: value.mode, screenshotProviders: JSON.stringify(value.providers) });
        await this.saveScreenshotMode(value.mode);
        await this.saveScreenshotProviders(value.providers);
        return value;
    }
    async getCloudSettings() {
        return {
            enable123Offline: parseBooleanSetting(await this.storage.getSetting("enable123Offline", true), true),
            enable115Offline: parseBooleanSetting(await this.storage.getSetting("enable115Offline", false), false),
            enable115Match: parseBooleanSetting(await this.storage.getSetting("enable115Match", false), false),
            enable115LoginRedirect: parseBooleanSetting(await this.storage.getSetting("enable115LoginRedirect", false), false),
            providerMode: await this.storage.getSetting("offlineProviderMode", "ask"),
            concurrency: parseFiniteNumberSetting(await this.storage.getSetting("oneOneFiveConcurrency", 4), 4, { min: 1, max: 10 }),
            cacheMinutes: parseFiniteNumberSetting(await this.storage.getSetting("oneOneFiveCacheMinutes", 60), 60, { min: 1, max: 1440 })
        };
    }
    async saveCloudSetting(/** @type {string} */ key, /** @type {unknown} */ value) {
        /** @type {Record<string, string>} */
        const keyMap = { enable123Offline: "enable123Offline", enable115Offline: "enable115Offline", enable115Match: "enable115Match", enable115LoginRedirect: "enable115LoginRedirect", offlineProviderMode: "offlineProviderMode", oneOneFiveConcurrency: "oneOneFiveConcurrency", oneOneFiveCacheMinutes: "oneOneFiveCacheMinutes" };
        const storageKey = keyMap[key];
        if (!storageKey) throw new TypeError(`未知云盘设置: ${key}`);
        await this.storage.saveSettingItem(storageKey, value);
        return value;
    }
    async saveCloudSettings(/** @type {ResourceRecord} */ value) {
        if (typeof this.storage.patch === "function") return this.storage.patch({ enable123Offline: value.enable123Offline, enable115Offline: value.enable115Offline, enable115Match: value.enable115Match, enable115LoginRedirect: value.enable115LoginRedirect, offlineProviderMode: value.providerMode || "ask", oneOneFiveConcurrency: value.concurrency, oneOneFiveCacheMinutes: value.cacheMinutes });
        for (const [key, item] of Object.entries({ enable123Offline: value.enable123Offline, enable115Offline: value.enable115Offline, enable115Match: value.enable115Match, enable115LoginRedirect: value.enable115LoginRedirect, offlineProviderMode: value.providerMode || "ask", oneOneFiveConcurrency: value.concurrency, oneOneFiveCacheMinutes: value.cacheMinutes })) await this.storage.saveSettingItem(key, item);
        return value;
    }
    async exportConfig() { return { customMagnetSources: await this.getMagnetSources(), magnetTagRules: await this.getMagnetTagRules(), magnetFilterRules: await this.getMagnetFilterRules(), magnetBuiltInSources: await this.getBuiltInSources(), screenshot: await this.getScreenshotSettings() }; }
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
