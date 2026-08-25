// @ts-check

/** 未显式指定 provider 时，长缩略图只允许使用的默认来源。 */
const DEFAULT_SCREENSHOT_PROVIDER = "javstore";
/** 长缩略图链路只允许这些来源进入；JavBus cover / FC2 gallery 均不属于长缩略图。 */
const SCREENSHOT_PROVIDER_IDS = new Set([DEFAULT_SCREENSHOT_PROVIDER]);

export class ScreenshotService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers @param {import("../app/integration-registry.js").IntegrationRegistry | null} [integrations] */
    constructor(providers, integrations = null) { this.providers = providers; this.integrations = integrations; }
    /**
     * 解析影片长缩略图。
     * 指定 providerId 时只使用该来源，无结果返回 null，不 fallback 到其他 movie.images；
     * 未指定时先按 Provider 优先级，再回退到默认长缩略图来源（当前仅 javstore）。
     * @param {Record<string, unknown>} movieRef
     * @param {{ providerId?: string, scope?: unknown }} [context]
     */
    async resolve(movieRef, context = {}) {
        if (context.providerId) {
            const provider = this.providers.get?.(context.providerId);
            if (provider) {
                if (provider.enabled === false || !provider.capabilities?.includes("screenshot")) return null;
                return this.resolveFromProvider(provider, movieRef, context);
            }
            return this.resolveIntegration(context.providerId, movieRef, context);
        }
        for (const provider of await this.providers.getAvailable("screenshot", context)) {
            const result = await this.resolveFromProvider(provider, movieRef, context);
            if (result) return result;
        }
        return this.resolveIntegration(DEFAULT_SCREENSHOT_PROVIDER, movieRef, context);
    }
    /** @param {Record<string, any>} provider @param {Record<string, unknown>} movieRef @param {Record<string, unknown>} context */
    async resolveFromProvider(provider, movieRef, context) {
        try {
            const result = await provider.resolve(movieRef, context);
            this.providers.updateHealth(provider.id, { ok: true });
            if (result) return result;
        } catch (error) { this.providers.updateHealth(provider.id, { ok: false, error: error instanceof Error ? error.message : String(error) }); }
        return null;
    }
    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {Record<string, unknown>} context */
    async resolveIntegration(providerId, movieRef, context) {
        if (!SCREENSHOT_PROVIDER_IDS.has(providerId)) return null;
        const manifest = this.integrations?.list("movie.images")?.find((item) => item.id === providerId);
        if (!manifest) return null;
        const adapter = this.integrations?.getAdapter(manifest.id);
        if (typeof adapter?.getImages !== "function") return null;
        const result = await adapter.getImages(movieRef, context);
        return Array.isArray(result) && result.length ? result : null;
    }
    /** @param {Record<string, unknown>} movieRef */
    getSearchUrl(movieRef) {
        if (!SCREENSHOT_PROVIDER_IDS.has(DEFAULT_SCREENSHOT_PROVIDER)) return null;
        for (const manifest of this.integrations?.list("movie.images") ?? []) {
            if (manifest.id !== DEFAULT_SCREENSHOT_PROVIDER) continue;
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.getSearchUrl === "function") return adapter.getSearchUrl(movieRef);
        }
        return null;
    }
}
