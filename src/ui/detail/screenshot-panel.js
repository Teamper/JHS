// @ts-check

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
 * @param {{target: any, carNum: string, screenshot: import("../../services/screenshot-service.js").ScreenshotService, settings: Record<string, any>, scope?: import("../../core/lifecycle-scope.js").LifecycleScope, isActive?: () => boolean, providerId?: string, isDuplicate?: (url: string) => boolean}} options
 */
export async function renderScreenshotPanel(options) {
    const jq = /** @type {any} */ (globalThis).$;
    const host = jq(options.target), isActive = options.isActive ?? (() => true), providerId = options.providerId ?? "javstore";
    if (!host.length || options.settings.enableLoadScreenShot === "no") return host.empty(), null;
    const load = async (resultHost = host) => {
        resultHost.empty().append(jq("<div></div>").addClass("jhs-panel-state").text("正在加载缩略图…"));
        try {
            const images = await options.screenshot.resolve({ carNum: options.carNum }, { providerId, scope: options.scope });
            if (!isActive()) return null;
            const image = Array.isArray(images) ? images[0] : images;
            if (!image?.url) return resultHost.empty(), null;
            if (options.isDuplicate?.(image.url)) return resultHost.empty(), null;
            return renderImage(resultHost, image.url, "缩略图");
        } catch (error) {
            if (!isActive()) return null;
            const state = jq("<div></div>").addClass("jhs-panel-state").text("缩略图加载失败 ");
            const retry = jq('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", () => void load(resultHost));
            resultHost.empty().append(state.append(retry));
            /** @type {any} */ (globalThis).clog?.error("缩略图加载失败", error);
            return null;
        }
    };
    if (options.settings.screenshotMode !== "manual") return load();
    const tabs = jq('<div class="jhs-screenshot-providers" role="tablist" aria-label="截图来源"></div>');
    const result = jq('<div class="jhs-screenshot-result"></div>').text("请选择截图来源");
    const button = jq('<button type="button" class="jhs-btn jhs-btn--secondary" role="tab" aria-selected="false">JavStore</button>');
    button.on("click", async () => { button.attr("aria-selected", "true"); await load(result); });
    host.empty().append(tabs.append(button), result);
    return host;
}
