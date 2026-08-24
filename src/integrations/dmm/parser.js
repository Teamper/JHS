// @ts-check

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
