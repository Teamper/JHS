/** 提取 JavStore 搜索页中按原始 DOM 顺序排列的匹配候选。 */
function parseJavStoreSearch($searchPage, carNum, baseUrl = "https://javstore.net") {
    const normalizedCarNum = normalizeCarNum(carNum);
    if (!normalizedCarNum) return [];
    return $searchPage.find('a[href$="-pn.html"]').filter(((index, element) =>
        $(element).text().trim().toUpperCase().includes(normalizedCarNum.toUpperCase())
    )).map(((index, element) => new URL($(element).attr("href"), baseUrl).href)).get();
}
/** 提取 JavStore 详情页 CLICK HERE! 对应的绝对预览图地址。 */
function parseJavStorePreview($detailPage, detailUrl) {
    const previewHref = $detailPage.find("a").filter(((index, element) =>
        "CLICK HERE!" === $(element).text().trim()
    )).first().attr("href");
    return previewHref ? new URL(previewHref, detailUrl).href.replace(".th", "") : null;
}

/** 解析 JavDB 收藏演员列表，并返回分页地址。 */
function parseJavDbActorList($page, baseUrl) {
    const actors = [];
    $page.find("#actors .actor-box a").each(((index, element) => {
        const $actor = $(element), title = $actor.attr("title"), href = $actor.attr("href");
        if (!title || !href) return;
        const allName = title.split(",").map((name => name.trim())).filter(Boolean);
        const actorUrl = new URL(href, baseUrl);
        const starId = actorUrl.pathname.split("/").filter(Boolean).pop() || "";
        actors.push({
            starId,
            name: allName[0] || "",
            allName,
            avatar: $actor.find("img").attr("src"),
            actressType: $actor.find(".info").text().trim().includes("無碼") ? A : D,
            lastCheckTime: null,
            lastUpdateTime: null
        });
    }));
    const nextHref = $page.find(".pagination-next").attr("href");
    return { actors, nextUrl: nextHref ? new URL(nextHref, baseUrl).href : null };
}

/** 区分正常页面、合法空列表和第三方拦截页。 */
function parseDetailPage($page, selectors) {
    const challengeText = $page.find("title, body").text();
    const isChallenge = /Just a moment|cf-chl-|Cloudflare/i.test(challengeText);
    const hasContainer = $page.find(selectors.boxSelector).length > 0;
    return {
        state: isChallenge ? "challenge" : hasContainer ? "valid" : "invalid",
        items: hasContainer ? $page.find(selectors.requestDomItemSelector) : null,
        isEmpty: hasContainer && 0 === $page.find(selectors.requestDomItemSelector).length
    };
}

/** 解析 123AV 中文列表或搜索页中的作品卡片。 */
function parse123AvCards($page, baseUrl = "https://123av.com") {
    const items = new Map();
    $page.find(".card").each(((index, element) => {
        const $card = $(element);
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
function merge123AvCards(cardLists) {
    const items = new Map();
    cardLists.flat().forEach((item => items.set(item.carNum, item)));
    return [...items.values()];
}

/** 从新版 123AV pager 中读取源站最大页数。 */
function parse123AvSourceMaxPage($page, baseUrl = "https://123av.com") {
    const lastHref = $page.find('a[rel="last"]').first().attr("href");
    if (lastHref) {
        const page = Number.parseInt(new URL(lastHref, baseUrl).searchParams.get("page"), 10);
        if (Number.isFinite(page)) return page;
    }
    const inputMax = Number.parseInt($page.find("input.pager__input[max]").first().attr("max"), 10);
    if (Number.isFinite(inputMax)) return inputMax;
    const totalMatch = $page.find(".pager__total").first().text().match(/(\d[\d,]*)/);
    return totalMatch ? Number.parseInt(totalMatch[1].replaceAll(",", ""), 10) : null;
}

/** 解析 123AV 中文详情页，不将站点 logo 误作作品封面。 */
function parse123AvVideoInfo($page, url) {
    const idMatch = new URL(url).pathname.match(/fc2-ppv-(\d+)/i);
    const id = idMatch ? idMatch[1] : null;
    const rawTitle = $page.find("h1.watch__title").first().text().trim();
    const title = id ? rawTitle.replace(new RegExp(`^FC2-PPV-${id}\\s*[—–-]\\s*`, "i"), "").trim() : rawTitle;
    const pageText = $page.find("body").text();
    const publishDate = pageText.match(/发布日期\s*(\d{4}-\d{2}-\d{2})/)?.[1] || "";
    return { id, publishDate, title, moviePoster: null };
}
