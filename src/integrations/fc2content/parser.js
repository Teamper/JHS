// @ts-check

/** @param {string} html @param {string} baseUrl */
export function parseFc2ContentImages(html, baseUrl) {
    const document = new DOMParser().parseFromString(html, "text/html"), images = new Set();
    for (const image of document.querySelectorAll(".items_article_SampleImagesArea img[src]")) {
        const url = new URL(image.getAttribute("src") || "", baseUrl);
        if (url.protocol === "https:") images.add(url.href);
    }
    return Object.freeze([...images].map((url) => Object.freeze({ url, providerId: "fc2content" })));
}
