// @ts-check

export class ScreenshotProviderRegistry {
    /** @param {Array<{id: string, name: string, enabled?: boolean, priority?: number, getScreenshot: (carNum: string) => Promise<any>}>} [providers] */
    constructor(providers = []) { this.providers = new Map(); providers.forEach((provider => this.register(provider))); }
    /** @param {{id: string, name: string, enabled?: boolean, priority?: number, getScreenshot: (carNum: string) => Promise<any>}} provider */
    register(provider) {
        if (!provider?.id || !provider.name || "function" !== typeof provider.getScreenshot) throw new TypeError("Invalid screenshot provider");
        this.providers.set(provider.id, { enabled: true, priority: 100, ...provider });
        return this;
    }
    /** @param {string} id */
    get(id) { return this.providers.get(id) || null; }
    getEnabledProviders() { return [...this.providers.values()].filter((provider => provider.enabled)).sort(((a, b) => a.priority - b.priority)); }
    /** @param {string} carNum */
    async first(carNum) {
        for (const provider of this.getEnabledProviders()) {
            try { const result = await provider.getScreenshot(carNum); if (result?.url) return result; } catch (error) { /** @type {any} */ (globalThis).clog?.warn(`截图源 ${provider.name} 请求失败`, error); }
        }
        return null;
    }
}
