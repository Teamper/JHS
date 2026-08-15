class ScreenshotProviderRegistry {
    constructor(providers = []) { this.providers = new Map(); providers.forEach((provider => this.register(provider))); }
    register(provider) {
        if (!provider?.id || !provider.name || "function" !== typeof provider.getScreenshot) throw new TypeError("Invalid screenshot provider");
        this.providers.set(provider.id, { enabled: true, priority: 100, ...provider });
        return this;
    }
    get(id) { return this.providers.get(id) || null; }
    getEnabledProviders() { return [...this.providers.values()].filter((provider => provider.enabled)).sort(((a, b) => a.priority - b.priority)); }
    async first(carNum) {
        for (const provider of this.getEnabledProviders()) {
            try { const result = await provider.getScreenshot(carNum); if (result?.url) return result; } catch (error) { clog.warn(`截图源 ${provider.name} 请求失败`, error); }
        }
        return null;
    }
}
