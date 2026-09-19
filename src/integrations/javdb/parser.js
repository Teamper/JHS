/** 解析 JavDB 收藏演员列表，并返回分页地址。 */
/** @param {any} $page @param {string} baseUrl */
export function parseJavDbActorList($page, baseUrl) {
    const challengeText = $page.find("title, body").text();
    if (/Just a moment|cf-chl-|Cloudflare/i.test(challengeText)) return { state: "challenge", isEmpty: !1, actors: [], nextUrl: null };
    const container = $page.find("#actors").first();
    if (!container.length) return { state: "invalid", isEmpty: !1, actors: [], nextUrl: null };
    const actors = [], boxes = container.find(".actor-box").toArray();
    const wrap = /** @type {any} */ (globalThis).jQuery ?? /** @type {any} */ (globalThis).$ ?? $page.constructor;
    /** @param {string} name */
    const normalizeName = (name) => name.trim();
    try {
        for (const box of boxes) {
            const $actor = wrap(box).find("a").first(), title = $actor.attr("title"), href = $actor.attr("href");
            if (!title || !href) throw new Error("演员卡缺少身份字段");
            const allName = title.split(",").map(normalizeName).filter(Boolean), actorUrl = new URL(href, baseUrl);
            const starId = actorUrl.pathname.split("/").filter(Boolean).pop() || "";
            if (!starId || !allName.length) throw new Error("演员卡身份字段无效");
            actors.push({
                starId,
                name: allName[0],
                allName,
                avatar: $actor.find("img").attr("src"),
                actressType: $actor.find(".info").text().trim().includes("無碼") ? "uncensored" : "censored",
                lastCheckTime: null,
                lastUpdateTime: null
            });
        }
        const nextHref = $page.find(".pagination-next").attr("href"), nextUrl = nextHref ? new URL(nextHref, baseUrl).href : null;
        return { state: "valid", isEmpty: 0 === boxes.length, actors, nextUrl };
    } catch (error) {
        return { state: "invalid", isEmpty: !1, actors: [], nextUrl: null };
    }
}
// @ts-check
