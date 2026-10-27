// @ts-check

import { createPanelEmpty, createPanelError, createPanelLoading } from "./primitives.js";
import { screenshotErrorMessage } from "./screenshot-error.js";

/** @param {unknown} value */
function normalizeImageUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return url.protocol === "https:" ? url.href : null;
    } catch { return null; }
}

/** Replace a result without losing keyboard focus owned by that result. @param {any} host @param {any} content */
function replaceResult(host, content) {
    const restoreFocus = host[0]?.contains(document.activeElement);
    host.empty().append(content);
    if (restoreFocus) {
        const target = host.find("button")[0] ?? host.children().attr("tabindex", "-1")[0];
        target?.focus({ preventScroll: true });
    }
}

/** @param {any} host @param {string} url @param {string} alt @param {any} scope @param {() => void} onError */
function renderImage(host, url, alt, scope, onError) {
    const jq = /** @type {any} */ (globalThis).$;
    const normalized = normalizeImageUrl(url);
    if (!normalized) return null;
    const image = jq("<img>").attr({ src: normalized, alt, loading: "lazy" }).addClass("jhs-fc2-gallery__image");
    image.one("error", () => { if (host[0]?.contains(image[0])) onError(); });
    const button = jq('<button type="button" class="jhs-btn jhs-fc2-gallery-item jhs-fc2-screenshot-thumbnail"></button>').attr("aria-label", `查看${alt}大图`).append(image);
    replaceResult(host, button);
    host.off("click.jhsScreenshot").on("click.jhsScreenshot", ".jhs-fc2-screenshot-thumbnail", (/** @type {any} */ event) => {
        event.preventDefault(); event.stopPropagation();
        /** @type {any} */ (globalThis).showImageViewer(image[0], "", { imageKind:"contact-sheet", owner: button[0], trigger: button[0], scope });
    });
    return normalized;
}

/**
 * 唯一截图视图：设置解析、provider 过滤、manual/auto 策略全部来自 ScreenshotService。
 * @param {{target: any, carNum: string, screenshot: import("../../services/screenshot-service.js").ScreenshotService, settings: Record<string, any>, scope?: import("../../core/lifecycle-scope.js").LifecycleScope, isActive?: () => boolean, providerId?: string, isDuplicate?: (url: string) => boolean, refreshCache?: boolean, renderImage?: (url: string) => boolean, renderError?: (error: unknown) => void, renderLoading?: (retry: boolean) => void}} options
 */
export async function renderScreenshotPanel(options) {
    const jq = /** @type {any} */ (globalThis).$;
    const host = jq(options.target), isActive = () => !options.scope?.disposed && (options.isActive?.() ?? true), providerId = options.providerId ?? "javstore";
    if (!host.length || !options.screenshot.isEnabled(options.settings)) return host.empty(), null;
    const { mode } = options.screenshot.getScreenshotSettings(options.settings);
    const enabledProviders = options.screenshot.getEnabledProviders(options.settings);
    if (!enabledProviders.length) return host.empty().append(createPanelEmpty("暂无可用截图来源")), host;
    if (mode !== "manual" && !enabledProviders.some((provider) => provider.id === providerId)) return host.empty(), null;
    const load = async (resultHost = host, selectedProviderId = providerId, refreshCache = false) => {
        if (!isActive() || refreshCache && resultHost.attr("aria-busy") === "true") return null;
        const request = {};
        const showError = (error = /** @type {unknown} */ (null)) => {
            if (!isActive()) return;
            if (options.renderError) options.renderError(error);
            else replaceResult(resultHost, createPanelError(screenshotErrorMessage(error), () => void load(resultHost, selectedProviderId, true)));
        };
        const release = options.scope?.addCleanup(() => {
            if (resultHost.data("jhs-screenshot-request") === request) resultHost.attr("aria-busy", "false").removeData("jhs-screenshot-request");
        });
        resultHost.data("jhs-screenshot-request", request).attr("aria-busy", "true");
        if (options.renderLoading) options.renderLoading(refreshCache);
        else if (refreshCache) resultHost.find("button").attr("aria-disabled", "true").text("重试中…");
        else replaceResult(resultHost, createPanelLoading());
        try {
            const images = await options.screenshot.resolve({ carNum: options.carNum }, { providerId: selectedProviderId, scope: options.scope, settings: options.settings, ...(refreshCache ? { refreshCache: true } : {}) });
            if (!isActive() || resultHost.data("jhs-screenshot-request") !== request) return null;
            const image = Array.isArray(images) ? images[0] : images;
            if (!image?.url) { if (options.renderError) options.renderError(null); else replaceResult(resultHost, createPanelEmpty("暂无缩略图")); return null; }
            if (options.isDuplicate?.(image.url)) return resultHost.empty(), null;
            const imageUrl = options.renderImage ? options.renderImage(image.url) ? image.url : null : renderImage(resultHost, image.url, "缩略图", options.scope, showError);
            if (!imageUrl) replaceResult(resultHost, createPanelEmpty("暂无缩略图"));
            return imageUrl;
        } catch (error) {
            if (!isActive() || resultHost.data("jhs-screenshot-request") !== request) return null;
            showError(error);
            try { /** @type {any} */ (globalThis).clog?.error("缩略图加载失败", error); } catch { /* keep the retry available */ }
            return null;
        } finally {
            release?.();
            if (resultHost.data("jhs-screenshot-request") === request) resultHost.attr("aria-busy", "false").removeData("jhs-screenshot-request");
        }
    };
    if (mode !== "manual") return load(host, providerId, options.refreshCache === true);
    const tabs = jq('<div class="jhs-screenshot-providers" role="tablist" aria-label="截图来源"></div>');
    const resultId = `jhs-screenshot-result-${String(options.carNum).replace(/[^a-z0-9_-]/gi, "-")}`;
    const result = jq('<div class="jhs-screenshot-result" role="tabpanel"></div>').attr("id", resultId).text("请选择截图来源");
    enabledProviders.forEach((provider, index) => {
        const button = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-tab" role="tab" aria-selected="false"></button>').attr({ "aria-controls": resultId, tabindex: index === 0 ? "0" : "-1" }).text(provider.name);
        button.on("click", async () => {
            tabs.find("[role='tab']").attr({ "aria-selected": "false", tabindex: "-1" });
            button.attr({ "aria-selected": "true", tabindex: "0" });
            await load(result, provider.id);
        });
        tabs.append(button);
    });
    tabs.on("keydown", "[role='tab']", ((/** @type {KeyboardEvent} */ event) => {
        if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
        event.preventDefault();
        const items = tabs.find("[role='tab']"), index = items.index(event.currentTarget);
        const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowRight" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
        items.eq(next).trigger("focus").trigger("click");
    }));
    host.empty().append(tabs, result);
    return host;
}
