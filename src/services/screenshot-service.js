// @ts-check

import { BUILT_IN_SCREENSHOT_SOURCES } from "./screenshot-sources.js";
import { normalizeHttpUrl } from "../core/feature-helpers.js";
import { normalizeCarNum } from "../core/movie-identity.js";

/** 未显式指定 provider 时，长缩略图只允许使用的默认来源。 */
const DEFAULT_SCREENSHOT_PROVIDER = "javstore";
/** 长缩略图链路只允许这些来源进入；JavBus cover / FC2 gallery 均不属于长缩略图。 */
/** @type {Set<string>} */
const SCREENSHOT_PROVIDER_IDS = new Set(BUILT_IN_SCREENSHOT_SOURCES.filter(source => source.implemented !== false).map(source => source.id));

/** @typedef {{url: string, providerId: string, match: "confirmed" | "candidate"}} ScreenshotMatch */
/** @typedef {ScreenshotMatch & {image: HTMLImageElement}} LoadedScreenshot */
/** @typedef {{select: (images: any, providerId: string) => Promise<LoadedScreenshot | null>, visitedArticles: Set<string>, titleQuery?: boolean}} PreviewSelection */
/** @typedef {{providerId?: string, scope?: unknown, settings?: Record<string, any>, allowWhenDisabled?: boolean, refreshCache?: boolean}} ScreenshotContext */

export class ScreenshotService {
    /** @param {import("../app/provider-registry.js").ProviderRegistry} providers @param {import("../app/integration-registry.js").IntegrationRegistry | null} [integrations] @param {import("./diagnostics-service.js").DiagnosticsService | null} [diagnostics] */
    constructor(providers, integrations = null, diagnostics = null) { this.providers = providers; this.integrations = integrations; this.diagnostics = diagnostics; }

    /** 规范截图资源 URL，并升级 JavStore 自有域名的 HTTP 链接。 @param {unknown} value @param {string} [baseUrl] */
    normalizeAssetUrl(value, baseUrl = "https://javstore.net") {
        const normalized = normalizeHttpUrl(value, baseUrl);
        if (!normalized) return null;
        const url = new URL(normalized);
        if (url.protocol === "http:" && (url.hostname === "javstore.net" || url.hostname.endsWith(".javstore.net"))) url.protocol = "https:";
        return url.href;
    }

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
            .filter((provider) => provider.enabled !== false && provider.implemented !== false)
            .sort((left, right) => Number(left.priority ?? 100) - Number(right.priority ?? 100));
    }

    /** @param {{carNum: string, title?: string}} movieRef
     * @param {ScreenshotContext & {loadImage: (url: string) => Promise<HTMLImageElement | null>}} options
     * @returns {Promise<LoadedScreenshot | null>} */
    async resolvePreview(movieRef, { loadImage, ...context }) {
        if (!normalizeCarNum(movieRef.carNum)) return null;
        const scope = /** @type {import("../core/lifecycle-scope.js").LifecycleScope | undefined} */ (context.scope);
        /** @type {Map<string, ScreenshotMatch & {rank: number}>} */
        const candidates = new Map();
        const attempted = new Set();
        let imageFailed = false;
        let failure = null;
        const load = async (/** @type {ScreenshotMatch} */ asset) => {
            scope?.assertActive();
            attempted.add(asset.url);
            const image = await loadImage(asset.url);
            scope?.assertActive();
            if (image) return { ...asset, image };
            imageFailed = true;
            return null;
        };
        /** @type {PreviewSelection} */
        const preview = {
            visitedArticles: new Set(),
            select: async (images, providerId) => {
                for (const value of Array.isArray(images) ? images : [images]) {
                    const asset = typeof value === "string" ? { url: value } : value;
                    const url = this.normalizeAssetUrl(asset?.url);
                    if (!url || attempted.has(url)) continue;
                    const source = asset.providerId || providerId;
                    if (asset.match === "candidate") {
                        const rank = asset.rank ?? 0;
                        const previous = candidates.get(url);
                        if (!previous || previous.rank < rank) candidates.set(url, { url, providerId: source, match: "candidate", rank });
                        continue;
                    }
                    const selected = await load({ url, providerId: source, match: "confirmed" });
                    if (selected) return selected;
                }
                return null;
            },
        };
        const findConfirmed = async (/** @type {() => Promise<unknown>} */ resolve) => {
            try {
                return /** @type {LoadedScreenshot | null} */ (await resolve());
            } catch (error) {
                scope?.assertActive();
                failure ??= error;
                return null;
            }
        };

        const confirmed = await findConfirmed(() => this.resolve(movieRef, { ...context, preview }));
        if (confirmed) return confirmed;
        if (movieRef.title?.trim() && (!context.providerId || context.providerId === "javstore")
            && (!context.settings || this.getEnabledProviders(context.settings).some(source => source.id === "javstore"))) {
            const byTitle = await findConfirmed(() => this.resolveIntegration("javstore", movieRef, { ...context, preview: { ...preview, titleQuery: true } }));
            if (byTitle) return byTitle;
        }
        for (const { rank, ...asset } of [...candidates.values()].sort((left, right) => right.rank - left.rank)) {
            if (attempted.has(asset.url)) continue;
            const selected = await load(asset);
            if (selected) return selected;
        }
        scope?.assertActive();
        if (imageFailed) throw new Error("缩略图图片加载失败");
        if (failure) throw failure;
        return null;
    }

    /**
     * 解析影片长缩略图。
     * 指定 providerId 时只使用该来源，无结果返回 null，不 fallback 到其他 movie.images；
     * 未指定时先按 Provider 优先级，再按设置顺序查询已启用的长缩略图来源。
     * 传入 settings 时所有来源（ProviderRegistry / Integration fallback / manual provider）
     * 都必须位于 getEnabledProviders(settings) 白名单内；全部禁用时直接返回 null。
     * @param {Record<string, unknown>} movieRef
     * @param {ScreenshotContext & {preview?: PreviewSelection}} [context]
     */
    async resolve(movieRef, context = {}) {
        /** @type {import("../core/lifecycle-scope.js").LifecycleScope | undefined} */ (context.scope)?.assertActive?.();
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
        let failure = null;
        for (const id of enabledProviders?.map(provider => provider.id) ?? [DEFAULT_SCREENSHOT_PROVIDER]) {
            try {
                const images = await this.resolveIntegration(id, movieRef, context);
                if (images) return images;
            } catch (error) {
                if (/** @type {any} */ (context.scope)?.disposed) throw error;
                failure = error;
            }
        }
        if (failure) throw failure;
        return null;
    }
    /** @param {Record<string, any>} provider @param {Record<string, unknown>} movieRef @param {ScreenshotContext & {preview?: PreviewSelection}} context */
    async resolveFromProvider(provider, movieRef, context) {
        try {
            const result = await provider.resolve(movieRef, context);
            this.providers.updateHealth(provider.id, { ok: true });
            if (result) return context.preview ? await context.preview.select(result, provider.id) : result;
        } catch (error) {
            if (/** @type {any} */ (context.scope)?.disposed) throw error;
            this.providers.updateHealth(provider.id, { ok: false, error: error instanceof Error ? error.message : String(error) });
        }
        return null;
    }
    /** @param {string} providerId @param {Record<string, unknown>} movieRef @param {ScreenshotContext & {preview?: PreviewSelection}} context */
    async resolveIntegration(providerId, movieRef, context) {
        /** @type {import("../core/lifecycle-scope.js").LifecycleScope | undefined} */ (context.scope)?.assertActive?.();
        if (!SCREENSHOT_PROVIDER_IDS.has(providerId)) return null;
        if (context.settings && !context.allowWhenDisabled && !this.isEnabled(context.settings)) return null;
        const manifest = this.integrations?.list("movie.images")?.find((item) => item.id === providerId);
        if (!manifest) return null;
        const adapter = this.integrations?.getAdapter(manifest.id);
        if (typeof adapter?.getImages !== "function") return null;
        try {
            if (context.preview?.titleQuery && typeof adapter.getImageBatches !== "function") return null;
            const batches = context.preview && typeof adapter.getImageBatches === "function"
                ? adapter.getImageBatches(movieRef, context)
                : [await adapter.getImages(movieRef, context)];
            let count = 0;
            let selected = null;
            for await (const images of batches) {
                if (!Array.isArray(images) || !images.length) continue;
                count += images.length;
                selected = context.preview ? await context.preview.select(images, providerId) : images;
                if (selected) break;
            }
            this.diagnostics?.updateProvider(providerId, { ok: true, count, updatedAt: Date.now() });
            return selected;
        } catch (error) {
            if (/** @type {any} */ (context.scope)?.disposed) throw error;
            this.diagnostics?.updateProvider(providerId, { ok: false, error: error instanceof Error ? error.message : String(error), ...(/** @type {any} */ (error)?.source === "javstore" ? { details: /** @type {any} */ (error).details } : {}), updatedAt: Date.now() });
            throw error;
        }
    }
    /** @param {Record<string, unknown>} movieRef @param {Record<string, any> | null} [settings] */
    getSearchUrl(movieRef, settings = null) {
        if (settings && !this.isEnabled(settings)) return null;
        const selected = settings ? this.getEnabledProviders(settings)[0]?.id : DEFAULT_SCREENSHOT_PROVIDER;
        if (!selected || !SCREENSHOT_PROVIDER_IDS.has(selected)) return null;
        for (const manifest of this.integrations?.list("movie.images") ?? []) {
            if (manifest.id !== selected) continue;
            const adapter = this.integrations?.getAdapter(manifest.id);
            if (typeof adapter?.getSearchUrl === "function") return adapter.getSearchUrl(movieRef);
        }
        return null;
    }
}
