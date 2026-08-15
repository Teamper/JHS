const BUILT_IN_MAGNET_SOURCES = Object.freeze([
    { id: "native-javdb", name: "JavDB 本站", type: "本站资源", domain: "javdb.com", priority: 10, enabled: true },
    { id: "native-javbus", name: "JavBus 本站", type: "本站资源", domain: "javbus.com", priority: 11, enabled: true },
    { id: "u9a9", name: "U9A9", type: "网页来源", domain: "u9a9.com", baseUrl: "https://u9a9.com", priority: 20, enabled: true },
    { id: "u3c3", name: "U3C3", type: "网页来源", domain: "u3c3.com", baseUrl: "https://u3c3.com", priority: 30, enabled: true },
    { id: "sukebei", name: "Sukebei", type: "网页来源", domain: "sukebei.nyaa.si", baseUrl: "https://sukebei.nyaa.si", priority: 40, enabled: true },
    { id: "btsow", name: "BTSOW", type: "API 来源", domain: "btsow.lol", baseUrl: "https://btsow.lol", priority: 50, enabled: true }
]);
const BUILT_IN_SCREENSHOT_SOURCES = Object.freeze([
    { id: "javstore", name: "JavStore", domain: "javstore.net", priority: 10, enabled: true },
    { id: "projectjav", name: "ProjectJav", domain: "projectjav.com", priority: 20, enabled: false, implemented: false },
    { id: "18av", name: "18AV", domain: "18av.mm-cg.com", priority: 30, enabled: false, implemented: false }
]);

function validateRule(rule) {
    if (!rule.name?.trim() || !rule.pattern?.trim()) throw new TypeError("规则名称和匹配内容不能为空");
    if ("regex" === rule.type) try { new RegExp(rule.pattern); } catch { throw new TypeError("正则表达式无效"); }
    return { ...rule, name: rule.name.trim(), pattern: rule.pattern.trim() };
}

function buildCustomMagnetSource(form, existing = null) {
    const parserType = form.parserType || "magnet-links";
    const config = { id: existing?.id || `source-${Date.now()}`, name: String(form.name || "").trim(), enabled: Boolean(form.enabled), priority: Number(form.priority) || 100, searchUrlTemplate: String(form.searchUrlTemplate || "").trim(), targetUrlTemplate: String(form.targetUrlTemplate || form.searchUrlTemplate || "").trim(), parserType };
    if (!config.name) throw new TypeError("来源名称不能为空");
    if ("torrent-table" === parserType) Object.assign(config, { rowSelector: form.rowSelector, titleSelector: form.titleSelector, magnetSelector: form.magnetSelector, sizeSelector: form.sizeSelector, dateSelector: form.dateSelector, seedersSelector: form.seedersSelector, leechersSelector: form.leechersSelector });
    if ("json" === parserType) Object.assign(config, { resultsPath: form.resultsPath, titlePath: form.titlePath, magnetPath: form.magnetPath, hashPath: form.hashPath, sizePath: form.sizePath, datePath: form.datePath, seedersPath: form.seedersPath });
    return validateCustomMagnetSource(config);
}

class ResourceSettingsService {
    constructor(storage = storageManager) { this.storage = storage; }
    async getArray(key) { const value = await this.storage.getSetting(key, "[]"); if (Array.isArray(value)) return value; try { const parsed = JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } }
    async saveArray(key, value) { if (!Array.isArray(value)) throw new TypeError("配置必须是数组"); await this.storage.saveSettingItem(key, JSON.stringify(value)); return value; }
    getMagnetSources() { return this.getArray("customMagnetSources"); }
    saveMagnetSources(value) { value.forEach(validateCustomMagnetSource); return this.saveArray("customMagnetSources", value); }
    getMagnetTagRules() { return this.getArray("magnetTagRules"); }
    saveMagnetTagRules(value) { value.forEach(validateRule); return this.saveArray("magnetTagRules", value); }
    getMagnetFilterRules() { return this.getArray("magnetFilterRules"); }
    saveMagnetFilterRules(value) { value.forEach(validateRule); return this.saveArray("magnetFilterRules", value); }
    async getBuiltInSources() { return await this.getArray("magnetBuiltInSources"); }
    saveBuiltInSources(value) { value.forEach((source => { if (!MAGNET_SOURCE_IDS.includes(source.id)) throw new TypeError("未知的内置磁力源"); if (source.baseUrl) validateHttpsBaseUrl(source.baseUrl); if (source.priority != null && (!Number.isFinite(Number(source.priority)) || Number(source.priority) < 1)) throw new TypeError("来源优先级无效"); })); return this.saveArray("magnetBuiltInSources", value); }
    async getScreenshotSettings() { return { mode: await this.storage.getSetting("screenshotMode", "auto"), providers: await this.getArray("screenshotProviders") }; }
    async saveScreenshotSettings(value) { await this.storage.saveSettingItem("screenshotMode", value.mode); await this.saveArray("screenshotProviders", value.providers); }
    async getCloudSettings() { return { enable115Offline: Boolean(await this.storage.getSetting("enable115Offline", false)), enable115Match: Boolean(await this.storage.getSetting("enable115Match", false)), concurrency: Number(await this.storage.getSetting("oneOneFiveConcurrency", 4)), cacheMinutes: Number(await this.storage.getSetting("oneOneFiveCacheMinutes", 60)) }; }
    async saveCloudSettings(value) { for (const [key, item] of Object.entries({ enable115Offline: value.enable115Offline, enable115Match: value.enable115Match, oneOneFiveConcurrency: value.concurrency, oneOneFiveCacheMinutes: value.cacheMinutes })) await this.storage.saveSettingItem(key, item); }
    async exportConfig() { return { customMagnetSources: await this.getMagnetSources(), magnetTagRules: await this.getMagnetTagRules(), magnetFilterRules: await this.getMagnetFilterRules(), magnetBuiltInSources: await this.getBuiltInSources(), screenshot: await this.getScreenshotSettings() }; }
    async importConfig(text) {
        let value; try { value = JSON.parse(text); } catch (error) { throw new TypeError(`配置格式错误：${error.message}`); }
        if (!value || "object" !== typeof value || Array.isArray(value)) throw new TypeError("配置格式错误：根节点必须是对象");
        const operations = [];
        if (Object.hasOwn(value, "customMagnetSources")) { if (!Array.isArray(value.customMagnetSources)) throw new TypeError("自定义磁力源必须是数组"); value.customMagnetSources.forEach(validateCustomMagnetSource); operations.push(() => this.saveMagnetSources(value.customMagnetSources)); }
        if (Object.hasOwn(value, "magnetTagRules")) { if (!Array.isArray(value.magnetTagRules)) throw new TypeError("标签规则必须是数组"); value.magnetTagRules.forEach(validateRule); operations.push(() => this.saveMagnetTagRules(value.magnetTagRules)); }
        if (Object.hasOwn(value, "magnetFilterRules")) { if (!Array.isArray(value.magnetFilterRules)) throw new TypeError("过滤规则必须是数组"); value.magnetFilterRules.forEach(validateRule); operations.push(() => this.saveMagnetFilterRules(value.magnetFilterRules)); }
        if (Object.hasOwn(value, "magnetBuiltInSources")) { if (!Array.isArray(value.magnetBuiltInSources)) throw new TypeError("内置磁力源配置必须是数组"); operations.push(() => this.saveBuiltInSources(value.magnetBuiltInSources)); }
        if (Object.hasOwn(value, "screenshot")) { if (!value.screenshot || !["auto", "manual"].includes(value.screenshot.mode) || !Array.isArray(value.screenshot.providers)) throw new TypeError("截图配置无效"); operations.push(() => this.saveScreenshotSettings(value.screenshot)); }
        for (const operation of operations) await operation();
        return value;
    }
}
