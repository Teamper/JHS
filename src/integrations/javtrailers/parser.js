// @ts-check
/** @param {any} page @param {string} baseUrl */
export function parseJavTrailersPreview(page, baseUrl) {
    const source = page.find("video source[src], video[src]").first().attr("src");
    if (!source) return null;
    const url = new URL(source, baseUrl);
    return Object.freeze({ url: url.href });
}
