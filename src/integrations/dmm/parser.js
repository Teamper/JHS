// @ts-check

/** @param {any} page @param {string} baseUrl */
export function parseDmmPreview(page, baseUrl) {
    const value = page.find("[data-video-url]").first().attr("data-video-url") ?? page.find("video source[src]").first().attr("src");
    if (!value) throw new TypeError("DMM preview URL is missing");
    const url = new URL(value, baseUrl);
    if (url.protocol !== "https:") throw new TypeError("DMM preview must use HTTPS");
    return Object.freeze({ url: url.href });
}
