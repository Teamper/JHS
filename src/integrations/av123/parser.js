// @ts-check

/** @param {any} page */
function resolveDocument(page) {
    if (typeof page === "string") return new DOMParser().parseFromString(page, "text/html");
    if (typeof page?.querySelectorAll === "function") return page;
    const candidate = page?.[0] ?? page?.get?.(0);
    if (typeof candidate?.querySelectorAll === "function") return candidate;
    throw new TypeError("123AV document is invalid");
}

/** 解析 123AV 中文列表或搜索页中的作品卡片。 */
/** @param {any} $page @param {string} [baseUrl] */
export function parse123AvCards($page, baseUrl = "https://123av.com") {
    const items = new Map();
    if (typeof $page?.find !== "function") {
        for (const card of resolveDocument($page).querySelectorAll(".card")) {
            const link = card.querySelector('a.card__link[href*="/cn/v/fc2-ppv-"]');
            const href = link?.getAttribute("href"), text = link?.textContent?.trim() ?? "";
            const numberMatch = text.match(/FC2-PPV-(\d+)/i);
            if (!href || !numberMatch) continue;
            const carNum = `FC2-${numberMatch[1]}`, detailUrl = new URL(href, baseUrl);
            detailUrl.hash = "";
            items.set(carNum, {
                imgSrc: card.querySelector("img.card__img[src]")?.getAttribute("src") || "", carNum, href: detailUrl.href,
                title: text.replace(/^FC2-PPV-\d+\s*[—–-]\s*/i, "").trim(),
                preview: card.querySelector(".card__poster[data-preview]")?.getAttribute("data-preview") || null,
            });
        }
        return [...items.values()];
    }
    const wrap = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$ ?? $page.constructor;
    $page.find(".card").each(((/** @type {number} */ index, /** @type {Element} */ element) => {
        const $card = wrap(element);
        const $link = $card.find('a.card__link[href*="/cn/v/fc2-ppv-"]').first();
        const href = $link.attr("href"), text = $link.text().trim();
        const numberMatch = text.match(/FC2-PPV-(\d+)/i);
        if (!href || !numberMatch) return;
        const carNum = `FC2-${numberMatch[1]}`;
        const detailUrl = new URL(href, baseUrl);
        detailUrl.hash = "";
        items.set(carNum, {
            imgSrc: $card.find("img.card__img[src]").first().attr("src") || "",
            carNum,
            href: detailUrl.href,
            title: text.replace(/^FC2-PPV-\d+\s*[—–-]\s*/i, "").trim(),
            preview: $card.find(".card__poster[data-preview]").first().attr("data-preview") || null
        });
    }));
    return [...items.values()];
}

/** 合并多个 123AV 页面并按番号去重。 */
/** @param {Array<Array<Record<string, any>>>} cardLists */
export function merge123AvCards(cardLists) {
    const items = new Map();
    cardLists.flat().forEach((/** @type {Record<string, any>} */ item => items.set(item.carNum, item)));
    return [...items.values()];
}

/** 从新版 123AV pager 中读取源站最大页数。 */
/** @param {any} $page @param {string} [baseUrl] */
export function parse123AvSourceMaxPage($page, baseUrl = "https://123av.com") {
    if (typeof $page?.find !== "function") {
        const document = resolveDocument($page), lastHref = document.querySelector('a[rel="last"]')?.getAttribute("href");
        if (lastHref) {
            const page = Number.parseInt(new URL(lastHref, baseUrl).searchParams.get("page") ?? "", 10);
            if (Number.isFinite(page)) return page;
        }
        const inputMax = Number.parseInt(document.querySelector("input.pager__input[max]")?.getAttribute("max") ?? "", 10);
        if (Number.isFinite(inputMax)) return inputMax;
        const totalMatch = document.querySelector(".pager__total")?.textContent?.match(/(\d[\d,]*)/);
        return totalMatch ? Number.parseInt(totalMatch[1].replaceAll(",", ""), 10) : null;
    }
    const lastHref = $page.find('a[rel="last"]').first().attr("href");
    if (lastHref) {
        const page = Number.parseInt(new URL(lastHref, baseUrl).searchParams.get("page") ?? "", 10);
        if (Number.isFinite(page)) return page;
    }
    const inputMax = Number.parseInt($page.find("input.pager__input[max]").first().attr("max"), 10);
    if (Number.isFinite(inputMax)) return inputMax;
    const totalMatch = $page.find(".pager__total").first().text().match(/(\d[\d,]*)/);
    return totalMatch ? Number.parseInt(totalMatch[1].replaceAll(",", ""), 10) : null;
}

/** 解析 123AV 中文详情页，不将站点 logo 误作作品封面。 */
/** @param {any} $page @param {string} url */
export function parse123AvVideoInfo($page, url) {
    const idMatch = new URL(url).pathname.match(/fc2-ppv-(\d+)/i);
    const id = idMatch ? idMatch[1] : null;
    const nativeDocument = typeof $page?.find === "function" ? null : resolveDocument($page);
    const rawTitle = nativeDocument ? nativeDocument.querySelector("h1.watch__title")?.textContent?.trim() ?? "" : $page.find("h1.watch__title").first().text().trim();
    const title = id ? rawTitle.replace(new RegExp(`^FC2-PPV-${id}\\s*[—–-]\\s*`, "i"), "").trim() : rawTitle;
    const pageText = nativeDocument ? nativeDocument.body?.textContent ?? "" : $page.find("body").text();
    const publishDate = pageText.match(/发布日期\s*(\d{4}-\d{2}-\d{2})/)?.[1] || "";
    return { id, publishDate, title, moviePoster: null };
}
