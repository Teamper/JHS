// @ts-check

import { BUILT_IN_SCREENSHOT_SOURCES } from "./screenshot-sources.js";

/** 未显式指定 provider 时，长缩略图只允许使用的默认来源。 */
const DEFAULT_SCREENSHOT_PROVIDER = "javstore";
/** 长缩略图链路只允许这些来源进入；JavBus cover / FC2 gallery 均不属于长缩略图。 */
const SCREENSHOT_PROVIDER_IDS = new Set([DEFAULT_SCREENSHOT_PROVIDER]);

export class ScreenshotService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers @param {import("../app/integration-registry.js").IntegrationRegistry | null} [integrations] */
    constructor(providers, integrations = null) { this.providers = providers; this.integrations = integrations; }

    /** 详情/FC2 自动加载开关；列表手动按钮可显式绕过此门禁。 @param {Record<string, any>} settings */
    isEnabled(settings) { return settings?.enableLoadScreenShot !== "no"; }

    /** 兼容旧存储：screenshotProviders 可能以 JSON 字符串或数组保存。 @param {unknown} value */
    parseScreenshotProviders(value) {
        if (Array.isArray(value)) return value;
        if (typeof value === "string") {
            try {
                const parsed = JSON.parse(value);
                return Array.isArray(parsed) ? parsed : [];
            } catch { return []; }
        }
        return [];
    }

    /** 返回截图来源设置（mode + 用户覆盖）。 @param {Record<string, any>} settings */
    getScreenshotSettings(settings) {
        return { mode: settings?.screenshotMode === "manual" ? "manual" : "auto", providers: this.parseScreenshotProviders(settings?.screenshotProviders) };
    }

    /** 合并内置目录与用户配置，过滤已禁用来源（implemented=false 仅表示未实现，enabled 由设置 UI 锁定为 false）。 @param {Record<string, any>} settings */
    getEnabledProviders(settings) {
        const configured = this.parseScreenshotProviders(settings?.screenshotProviders);
        return BUILT_IN_SCREENSHOT_SOURCES
            .map((source) => ({ ...source, ...(configured.find((item) => item?.id === source.id) || {}) }))
            .filter((provider) => provider.enabled !== false)
            .sort((left, right) => Number(left.priority ?? 100) - Number(right.priority ?? 100));
    }

    /**
     * 解析影片长缩略图。
     * 指定 providerId 时只使用该来源，无结果返回 null，不 fallback 到其他 movie.images；
     * 未指定时先按 Provider 优先级，再回退到默认长缩略图来源（当前仅 javstore）。
     * 传入 settings 时所有来源（ProviderRegistry / Integration fallback / manual provider）
     * 都必须位于 getEnabledProviders(settings) 白名单内；全部禁用时直接返回 null。
     * @param {Record<string, unknown>} movieRef
     * @param {{ providerId?: string, scope?: unknown, settings?: Record<string, any>, allowWhenDisabled?: boolean }} [context]
     */
    async resolve(movieRef, context = {}) {
        // 总开关门禁：任何调用路径在设置关闭时都不得发请求。
        if (context.settings && !context.allowWhenDisabled && !this.isEnabled(context.settings)) return null;
        const enabledProviders = context.settings ? this.getEnabledProviders(context.settings) : null;
        const enabledIds = enabledProviders ? new Set(enabledProviders.map((provider) => provider.id)) : null;
        if (enabledProviders && !enabledProviders.length) return null;
        if (context.providerId) {
            if (enabledIds && !enabledIds.has(context.providerId)) return null;
            const provider = this.providers.get?.(context.providerId);
            if (provider) {
                if (provider.enabled === false || !provider.capabilities?.includes("screenshot")) return null;
                return this.resolveFromProvider(provider, movieRef, context);
            }
            return this.resolveIntegration(context.providerId, movieRef, context);
        }
        for (const provider of await this.providers.getAvailable("screenshot", context)) {
            if (enabledIds && !enabledIds.has(provider.id)) continue;
            const result = await this.resolveFromProvider(provider, movieRef, context);
            if (result) return result;
        }
        if (enabledIds && !enabledIds.has(DEFAULT_SCREENSHOT_PROVIDER)) return null;
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
        if (context.settings && !context.allowWhenDisabled && !this.isEnabled(context.settings)) return null;
        const manifest = this.integrations?.list("movie.images")?.find((item) => item.id === providerId);
        if (!manifest) return null;
        const adapter = this.integrations?.getAdapter(manifest.id);
        if (typeof adapter?.getImages !== "function") return null;
        const result = await adapter.getImages(movieRef, context);
        return Array.isArray(result) && result.length ? result : null;
    }
    /** @param {Record<string, unknown>} movieRef @param {Record<string, any> | null} [settings] */
    getSearchUrl(movieRef, settings = null) {
        if (!SCREENSHOT_PROVIDER_IDS.has(DEFAULT_SCREENSHOT_PROVIDER)) return null;
        if (settings && !this.isEnabled(settings)) return null;
        if (settings && !this.getEnabledProviders(settings).some((provider) => provider.id === DEFAULT_SCREENSHOT_PROVIDER)) return null;
        for (const manifest of this.integrations?.list("movie.images") ?? []) {
            if (manifest.id !== DEFAULT_SCREENSHOT_PROVIDER) continue;
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.getSearchUrl === "function") return adapter.getSearchUrl(movieRef);
        }
        return null;
    }
}
