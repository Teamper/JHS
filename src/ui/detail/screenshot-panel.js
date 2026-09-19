// @ts-check

import { createPanelError, createPanelLoading } from "./primitives.js";

/** @param {unknown} value */
function normalizeImageUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return url.protocol === "https:" ? url.href : null;
    } catch { return null; }
}

/** @param {any} host @param {string} url @param {string} alt */
function renderImage(host, url, alt) {
    const jq = /** @type {any} */ (globalThis).$;
    const normalized = normalizeImageUrl(url);
    if (!normalized) return null;
    const image = jq("<img>").attr({ src: normalized, alt, loading: "lazy" }).addClass("jhs-fc2-gallery__image");
    const button = jq('<button type="button" class="jhs-btn jhs-fc2-gallery-item jhs-fc2-screenshot-thumbnail"></button>').attr("aria-label", `查看${alt}大图`).append(image);
    host.empty().append(button).off("click.jhsScreenshot").on("click.jhsScreenshot", ".jhs-fc2-screenshot-thumbnail", (/** @type {any} */ event) => {
        event.preventDefault(); event.stopPropagation();
        /** @type {any} */ (globalThis).showImageViewer(image[0]);
    });
    return normalized;
}

/**
 * 唯一截图视图：设置解析、provider 过滤、manual/auto 策略全部来自 ScreenshotService。
 * @param {{target: any, carNum: string, screenshot: import("../../services/screenshot-service.js").ScreenshotService, settings: Record<string, any>, scope?: import("../../core/lifecycle-scope.js").LifecycleScope, isActive?: () => boolean, providerId?: string, isDuplicate?: (url: string) => boolean}} options
 */
export async function renderScreenshotPanel(options) {
    const jq = /** @type {any} */ (globalThis).$;
    const host = jq(options.target), isActive = options.isActive ?? (() => true), providerId = options.providerId ?? "javstore";
    if (!host.length || !options.screenshot.isEnabled(options.settings)) return host.empty(), null;
    const { mode } = options.screenshot.getScreenshotSettings(options.settings);
    const enabledProviders = options.screenshot.getEnabledProviders(options.settings);
    if (mode !== "manual" && !enabledProviders.some((provider) => provider.id === providerId)) return host.empty(), null;
    if (!enabledProviders.length) return host.empty().append(jq('<div class="jhs-panel-state">没有可用截图来源</div>')), host;
    const load = async (resultHost = host, selectedProviderId = providerId) => {
        resultHost.empty().append(createPanelLoading("正在加载缩略图…"));
        try {
            const images = await options.screenshot.resolve({ carNum: options.carNum }, { providerId: selectedProviderId, scope: options.scope, settings: options.settings });
            if (!isActive()) return null;
            const image = Array.isArray(images) ? images[0] : images;
            if (!image?.url) return resultHost.empty(), null;
            if (options.isDuplicate?.(image.url)) return resultHost.empty(), null;
            return renderImage(resultHost, image.url, "缩略图");
        } catch (error) {
            if (!isActive()) return null;
            resultHost.empty().append(createPanelError("缩略图加载失败 ", () => void load(resultHost, selectedProviderId)));
            /** @type {any} */ (globalThis).clog?.error("缩略图加载失败", error);
            return null;
        }
    };
    if (mode !== "manual") return load();
    const tabs = jq('<div class="jhs-screenshot-providers" role="tablist" aria-label="截图来源"></div>');
    const resultId = `jhs-screenshot-result-${String(options.carNum).replace(/[^a-z0-9_-]/gi, "-")}`;
    const result = jq('<div class="jhs-screenshot-result" role="tabpanel"></div>').attr("id", resultId).text("请选择截图来源");
    enabledProviders.forEach((provider, index) => {
        const button = jq('<button type="button" class="jhs-btn jhs-btn--secondary" role="tab" aria-selected="false"></button>').attr({ "aria-controls": resultId, tabindex: index === 0 ? "0" : "-1" }).text(provider.name);
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
