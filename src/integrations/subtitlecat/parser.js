// @ts-check
/** @param {any} page @param {string} baseUrl */
export function parseSubtitleCatResults(page, baseUrl) {
    return Object.freeze(page.find("a[href*='/subtitles/']").map((/** @type {number} */ _index, /** @type {Element} */ element) => {
        const anchor = page.constructor(element);
        return Object.freeze({ language: anchor.text().trim(), url: new URL(anchor.attr("href"), baseUrl).href });
    }).get());
}
