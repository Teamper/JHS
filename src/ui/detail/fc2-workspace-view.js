// @ts-check

/** @param {unknown} value */
function normalizeUrl(value) {
    try {
        const url = new URL(String(value || ""));
        return ["http:", "https:"].includes(url.protocol) ? url.href : null;
    } catch { return null; }
}

import { createPanelState } from "./primitives.js";

/** @param {any} target @param {string} message @param {null|(() => void)} [retry] */
export function renderFc2State(target, message, retry = null) {
    const jq = /** @type {any} */ (globalThis).$, host = jq(target).empty();
    const state = createPanelState(message, { retry, tone: retry ? "error" : "neutral", extraClass: "jhs-fc2-state" });
    host.append(state);
}

/** @param {any} context @param {unknown[]} images @param {unknown} [coverUrl] */
export function renderFc2Gallery(context, images, coverUrl = null) {
    const jq = /** @type {any} */ (globalThis).$;
    const urls = [...new Set((images || []).map(normalizeUrl).filter(Boolean))];
    const grid = context.root.find('[data-jhs-role="gallery-grid"]').empty(), preview = context.root.find('[data-jhs-role="main-preview"]').empty();
    context.galleryUrls = new Set(urls);
    const normalizedCover = normalizeUrl(coverUrl);
    if (normalizedCover) preview.append(jq("<img>").attr({ src: normalizedCover, alt: `${context.carNum} 概览`, loading: "eager" }));
    if (!urls.length) return renderFc2State(grid, "暂无剧照");
    urls.forEach((url, index) => grid.append(jq('<button type="button" class="jhs-btn jhs-fc2-gallery-item"></button>').attr("aria-label", `查看剧照 ${index + 1}`).append(jq("<img>").addClass("jhs-fc2-gallery__image").attr({ src: url, alt: `剧照 ${index + 1}`, loading: "lazy" }))));
    // 去重保险：若额外长缩略图复用了 Gallery 图片，隐藏 screenshot 区域。
    const screenshot = context.root.find('[data-jhs-role="screenshot"]');
    screenshot.find("img").each((/** @type {number} */ _, /** @type {HTMLImageElement} */ img) => {
        const src = img.getAttribute("src");
        if (src && context.galleryUrls.has(src)) screenshot.empty();
    });
}

/** @param {any} context @param {any} movieService */
export function createFc2SourceLinks(context, movieService) {
    const jq = /** @type {any} */ (globalThis).$;
    const links = jq('<div class="jhs-fc2-source-links" aria-label="影片来源"></div>');
    const providerLinks = movieService.sourceUrls({ carNum: context.carNum }, ["fc2ppvdb", "fc2content"]);
    const values = [["123av" === context.source ? "123AV 原页面" : "JavDB 原页面", normalizeUrl(context.url)], ...providerLinks.map((/** @type {any} */ item) => [item.providerId === "fc2ppvdb" ? "FC2PPVDB" : "FC2 市场", item.url])];
    values.forEach(([label, href]) => href && links.append(jq("<a></a>").addClass("jhs-btn jhs-btn--ghost jhs-btn--sm").attr({ href, target: "_blank", rel: "noopener noreferrer" }).text(label)));
    return links;
}
