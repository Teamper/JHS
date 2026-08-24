// @ts-check

/** 解析 123AV 中文列表或搜索页中的作品卡片。 */
/** @param {any} $page @param {string} [baseUrl] */
export function parse123AvCards($page, baseUrl = "https://123av.com") {
    const items = new Map();
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
    const rawTitle = $page.find("h1.watch__title").first().text().trim();
    const title = id ? rawTitle.replace(new RegExp(`^FC2-PPV-${id}\\s*[—–-]\\s*`, "i"), "").trim() : rawTitle;
    const pageText = $page.find("body").text();
    const publishDate = pageText.match(/发布日期\s*(\d{4}-\d{2}-\d{2})/)?.[1] || "";
    return { id, publishDate, title, moviePoster: null };
}
