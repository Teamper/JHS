// @ts-check

import { ProviderError } from "../../core/cache-policy.js";

/** @param {any} page */
function resolveDocument(page) {
    if (typeof page === "string") return new DOMParser().parseFromString(page, "text/html");
    if (typeof page?.querySelector === "function") return page;
    const candidate = page?.[0] ?? page?.get?.(0);
    if (typeof candidate?.querySelector === "function") return candidate;
    throw new TypeError("DMM preview document is invalid");
}

/** @param {any} page @param {string} baseUrl */
export function parseDmmPreview(page, baseUrl) {
    const document = resolveDocument(page);
    const value = document.querySelector("[data-video-url]")?.getAttribute("data-video-url")
        ?? document.querySelector("video source[src]")?.getAttribute("src");
    if (!value) throw new TypeError("DMM preview URL is missing");
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:") throw new TypeError("DMM preview must use HTTPS");
    return Object.freeze({ url: url.href });
}

/** @param {any} payload @param {string} carNum @param {string} keyword */
export function parseDmmItemCandidates(payload, carNum, keyword) {
    if (payload?.result?.result_count === 0 && !Array.isArray(payload.result.items)) return Object.freeze([]);
    if (!payload || typeof payload !== "object" || !payload.result || !Array.isArray(payload.result.items)) {
        throw new ProviderError("dmm", "INVALID_RESPONSE", "DMM API 返回结构无效");
    }
    const normalizedCarNum = carNum.toLowerCase(), compactCarNum = normalizedCarNum.replace(/-/g, ""), compactKeyword = keyword.toLowerCase().replace(/-/g, "");
    return Object.freeze(payload.result.items.flatMap((/** @type {any} */ item) => {
        const contentId = String(item?.content_id ?? ""), makerProduct = String(item?.maker_product ?? "");
        if (!contentId.toLowerCase().includes(compactKeyword) && makerProduct.toLowerCase() !== normalizedCarNum && !contentId.toLowerCase().includes(compactCarNum)) return [];
        return [Object.freeze({
            serviceCode: String(item.service_code ?? ""), floorCode: String(item.floor_code ?? ""),
            contentId, pageUrl: new URL(String(item.URL)).href,
        })];
    }).slice(0, 2));
}

/** @param {string} html @param {string} url */
export function parseDmmPlayerSources(html, url) {
    if (typeof html !== "string") throw new ProviderError("dmm", "PARSE_ERROR", "解析播放页内容失败, 非文本内容", { url });
    if (html.includes("このサービスはお住まいの地域からは")) {
        throw new ProviderError("dmm", "REGION_BLOCKED", "DMM 预览源不可用，请将 DMM 域名分流到日本 IP", { url });
    }
    const args = html.match(/const\s+args\s+=\s+(.*);/);
    if (!args) throw new ProviderError("dmm", "PARSE_ERROR", "未在脚本中找到 const args = ... 变量", { url });
    let bitrates;
    try { ({ bitrates } = JSON.parse(args[1])); }
    catch (cause) { throw new ProviderError("dmm", "PARSE_ERROR", `解析播放器脚本 JSON 失败: ${cause instanceof Error ? cause.message : String(cause)}`, { cause, url }); }
    if (!Array.isArray(bitrates)) throw new ProviderError("dmm", "PARSE_ERROR", "解析画质链接失败: bitrates 字段不是一个数组或不存在", { url });
    /** @type {Record<string, string>} */
    const sources = {};
    for (const item of bitrates) {
        const source = item?.src;
        if (typeof source !== "string" || !source.endsWith(".mp4")) continue;
        const resolved = new URL(source, url);
        if (resolved.protocol !== "https:") continue;
        const quality = resolved.pathname.match(/\/([^/]+)\.mp4$/)?.[1];
        if (quality && !sources[quality]) sources[quality] = resolved.href;
    }
    if (Object.keys(sources).length === 0) throw new ProviderError("dmm", "PARSE_ERROR", "未找到匹配要求的预览画质视频", { url });
    return Object.freeze(sources);
}
