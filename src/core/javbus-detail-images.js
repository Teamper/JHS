// @ts-check

/** @param {Document} document */
export function findJavBusDetailRoot(document) {
    return document.querySelector("#magnet-table")?.closest(".container") ?? document.querySelector(".container .row.movie")?.parentElement ?? null;
}

/** @param {Element|null} root @param {string} baseUrl */
export function readJavBusDetailImageSequence(root, baseUrl) {
    return [...(root?.querySelectorAll("#sample-waterfall a.sample-box") ?? [])].flatMap(trigger => {
        if (trigger.closest(".screen-container")) return [];
        const image = trigger.querySelector("img");
        const href = trigger.getAttribute("href") || image?.getAttribute("src");
        if (!image || !href) return [];
        let url;
        try { url = new URL(href, baseUrl); } catch { return []; }
        if (url.origin === "https://www.prestige-av.com" && !url.username && !url.password && url.pathname.startsWith("/images/corner/goods/")) {
            url.hostname = "image.mgstage.com";
            url.pathname = "/images/" + url.pathname.slice("/images/corner/goods/".length);
        }
        return ["https:", "http:"].includes(url.protocol) ? [{ trigger, image, url: url.href }] : [];
    });
}
