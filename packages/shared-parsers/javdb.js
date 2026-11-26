// @ts-check
import { JavDbHostAdapter } from "../../src/platform/hosts/javdb-host-adapter.js";
import { getMovieStateEligibility, normalizeMovieCarNum } from "../../src/core/movie-identity.js";
import { httpsLink, publicMagnet } from "./links.js";

export const JAVDB_ORIGIN = "https://javdb.com";
export const SITE_ID = /^[\w-]{1,64}$/;
const categories = ["all", "censored", "uncensored", "western", "fc2", "anime"];
const rankings = ["movies", "playback", "top", "actors", "fanza_award"];

/** @param {string} code @param {string} message */
export function catalogError(code, message) {
    return Object.assign(new Error(message), { code });
}

function invalid() { return catalogError("INVALID_QUERY", "目录地址或筛选条件无效"); }

/** @param {string} path @param {string | URLSearchParams} input */
export function catalogRoute(path, input) {
    const params = new URLSearchParams(input);
    const page = params.get("page") ?? "1";
    if (!/^[1-9]\d{0,3}$/.test(page)) throw invalid();
    if (page === "1") params.delete("page");
    const movie = /^\/v1\/movies\/([\w-]{1,64})$/.exec(path);
    if (movie && !params.size) return { path: `/v/${movie[1]}`, type: "movie", id: movie[1] };
    const actor = /^\/v1\/actors\/([\w-]{1,64})\/movies$/.exec(path);
    if (actor && [...params.keys()].every(key => key === "page")) {
        return { path: `/actors/${actor[1]}${params.size ? "?" + params : ""}`, type: "list" };
    }
    const rank = /^\/v1\/rankings\/([\w-]+)$/.exec(path)?.[1];
    if (rank && rankings.includes(rank) && [...params.keys()].every(key => ["page", "p", "t"].includes(key))
        && /^(?:daily|weekly|monthly)?$/.test(params.get("p") ?? "") && /^[\w-]{0,32}$/.test(params.get("t") ?? "")) {
        return { path: `/rankings/${rank}?${params}`, type: rank === "actors" ? "actors" : rank === "fanza_award" ? "awards" : "list" };
    }
    if (path === "/v1/browse") {
        const category = params.get("category") ?? "all";
        const facets = params.get("facets");
        const tagged = facets === "1" || [...params.keys()].some(key => /^c\d{1,2}$/.test(key));
        if (!categories.includes(category) || (facets !== null && facets !== "1") || [...params].some(([key, value]) => !["category", "page", "facets"].includes(key) && !(/^c\d{1,2}$/.test(key) && /^\d{1,7}$/.test(value)))) throw invalid();
        params.delete("category");
        params.delete("facets");
        const suffix = category === "all" || tagged && category === "censored" ? "" : `/${category}`;
        return { path: `${tagged ? "/tags" + suffix : suffix || "/"}?${params}`, type: "list" };
    }
    if (path === "/v1/search") {
        const mode = params.get("mode") ?? "movie";
        const advanced = mode === "advanced";
        if (!["actor", "movie", "advanced"].includes(mode) || (params.get("q") ?? "").length > 120) throw invalid();
        if (!advanced && !params.get("q")?.trim()) throw invalid();
        if ([...params].some(([key, value]) => !["mode", "q", "page"].includes(key) && (!advanced || !/^(?:type|sort|date|score|c\d{1,2}|[a-z]+_\w+)(?:\[\])?$/.test(key) || value.length > 120))) throw invalid();
        params.delete("mode");
        if (!advanced) params.set("f", mode === "actor" ? "actor" : "all");
        return { path: `${advanced ? "/search_advanced" : "/search"}?${params}`, type: mode === "actor" ? "actors" : "list" };
    }
    throw invalid();
}

/** @param {Element | null | undefined} node */
function heading(node) { return node?.textContent?.trim() ?? ""; }

/** @param {string} score */
function readScore(score) {
    const value = /([0-9]+(?:\.[0-9]+)?)\s*分/.exec(score)?.[1];
    const votes = /([0-9,]+)\s*人/.exec(score)?.[1];
    return { score, ratingValue: value ? Number(value) : null, voteCount: votes ? Number(votes.replaceAll(",", "")) : null };
}

/** @param {string} text */
export function isCatalogLoginResponse(text) {
    return /^\s*(?:window\.openAuthModal\s*\?|(?:window\.)?location\.href\s*=\s*["']\/login)/.test(text);
}

/** Classify the transport response before either client attempts to parse a catalog document.
 * @param {number} status @param {string} text @param {URL} location */
export function catalogAccessError(status, text, location) {
    if (status === 401 || /^\/(?:login|auth\/signin)\/?$/.test(location.pathname) || isCatalogLoginResponse(text)) {
        return catalogError("AUTH_REQUIRED", "此页面需要 JavDB 登录");
    }
    return status === 403 ? catalogError("SOURCE_DENIED", "JavDB 拒绝了这次读取") : null;
}

/** @param {Element} item @param {URL} url */
function readMovieCard(item, url) {
    const anchor = item.matches("a[href]") ? item : item.querySelector('a[href]');
    const href = httpsLink(anchor?.getAttribute("href"), url, url.origin);
    const id = href && /^\/v\/([\w-]{1,64})\/?$/.exec(new URL(href).pathname)?.[1];
    if (!id) return null;
    const titleNode = item.querySelector(".video-title");
    const codes = [...item.querySelectorAll(".video-title strong, .video-number")].map(node => normalizeMovieCarNum(heading(node))).filter(Boolean);
    const carNum = codes[0] || null;
    const stateEligibility = getMovieStateEligibility(new Set(codes).size > 1 ? { stateEligibility: { eligible: false, reason: "conflicting" }, carNum } : carNum);
    const cover = item.querySelector(".cover img, img");
    const score = heading(item.querySelector(".score .value"));
    const movieTitle = titleNode?.cloneNode(true);
    if (movieTitle instanceof Object && "querySelectorAll" in movieTitle) {
        for (const code of /** @type {Element} */ (movieTitle).querySelectorAll("strong,.video-number")) code.remove();
    }
    return { id, carNum, stateEligibility, url: href, title: anchor?.getAttribute("title") || heading(titleNode),
        displayTitle: heading(/** @type {Element | null} */ (movieTitle ?? null)) || heading(titleNode) || carNum || id,
        coverUrl: httpsLink(cover?.getAttribute("data-src") ?? cover?.getAttribute("src"), url), releaseDate: heading(item.querySelector(".meta")),
        ...readScore(score),
        subtitle: /字幕/.test(heading(item.querySelector(".tags"))) };
}

/** @param {URL} url @param {JavDbHostAdapter} host @param {string | undefined} id */
function detail(url, host, id) {
    const panel = host.document.querySelector(".movie-panel-info");
    const root = host.locateDetailRoot() ?? (panel ? host.document : null);
    const title = heading(root?.querySelector("h2.title .current-title, h2.title .origin-title"))
        || heading(root?.querySelector(".column-video-info h1, .video-title, h2.title"));
    if (!root || !title) throw catalogError("PARSE_ERROR", "无法确认作品详情");
    const { actors } = host.readMovieActors(root, url.href);
    const magnets = [...(host.locateNativeMagnets()?.querySelectorAll('a[href^="magnet:"]') ?? [])].flatMap(anchor => {
        const uri = publicMagnet(anchor.getAttribute("href"));
        return uri ? [{ uri, name: heading(anchor.querySelector(".name")) || heading(anchor), meta: heading(anchor.querySelector(".meta")),
            subtitle: /字幕/.test(heading(anchor.closest(".item")?.querySelector(".tags"))) }] : [];
    });
    const ref = host.readMovieRef();
    const number = ref?.carNum ?? normalizeMovieCarNum(heading(panel?.querySelector(".first-block .value")));
    const stills = host.getDetailImageSequence().flatMap(entry => {
        const original = httpsLink(entry.url, url);
        if (!original) return [];
        const thumbnail = httpsLink(entry.image.getAttribute("data-src") || entry.image.getAttribute("src"), url);
        return [{ url: original, thumbnail }];
    });
    const nativePreview = host.readDetailPreview();
    const cover = root.querySelector(".video-cover img, img.video-cover, .column-video-cover img");
    const preview = nativePreview && {
        poster: httpsLink(nativePreview.poster, url),
        video: nativePreview.requiresLogin ? null : httpsLink(nativePreview.video, url),
        requiresLogin: nativePreview.requiresLogin,
        deferred: !nativePreview.requiresLogin && Boolean(nativePreview.endpoint),
    };
    const fields = [...root.querySelectorAll(".movie-panel-info .panel-block, .column-video-info .panel-block")].flatMap(node => {
            const label = heading(node.querySelector("strong, .label"));
            const value = heading(node.querySelector(".value"));
            return label && value ? [{ label, value }] : [];
    });
    const recommendations = host.getDetailRecommendationBoundaries().flatMap(({ root }) =>
        [...root.querySelectorAll('.item, a.tile-item, a[href^="/v/"]')].map(item => readMovieCard(item, url)).filter(item => item && item.id !== id));
    return { id, url: url.href, title, carNum: number, stateEligibility: ref?.stateEligibility ?? getMovieStateEligibility(number),
        releaseDate: fields.find(field => /日期|發行|发行/.test(field.label))?.value ?? host.readMovieInfo()?.publishTime ?? "",
        coverUrl: httpsLink(cover?.getAttribute("data-src") || cover?.getAttribute("src"), url),
        fields, ...readScore(fields.find(field => /評分|评分/.test(field.label))?.value || heading(root.querySelector(".score .value"))),
        subtitle: /字幕/.test(heading(root.querySelector(".movie-panel-info .tags"))) || magnets.some(item => item.subtitle),
        actors: actors.map(({ name, starId, role, url: href }) => ({ name, id: starId, role, url: httpsLink(href, url, url.origin) })),
        images: stills.map(entry => entry.url), stills, preview, magnets, related: [...new Map(recommendations.map(item => [item?.id, item])).values()].filter(Boolean),
    };
}

/** @param {Document} doc @param {{type: string, id?: string}} route @param {string} [location] */
export function parseCatalogDocument(doc, route, location = doc.URL) {
    const url = new URL(location);
    if (/^\/(?:login|auth\/signin)\/?$/.test(url.pathname)
        || (!doc.querySelector("main,.section,.movie-list,.actor-box") && isCatalogLoginResponse(doc.body?.textContent ?? ""))) {
        throw catalogError("AUTH_REQUIRED", "此页面需要 JavDB 登录");
    }
    const host = new JavDbHostAdapter(doc, url);
    if (route.type === "movie") return detail(url, host, route.id);
    const boundary = host.resolveListBoundary();
    const root = route.type === "awards" || route.type === "actors" ? doc.querySelector("main,section.section") : boundary?.root;
    const empty = doc.querySelector(".empty-message");
    if (!root && !empty) throw catalogError("PARSE_ERROR", "无法识别源站结果区域");
    const items = route.type === "actors"
        ? [...(root?.querySelectorAll('.actor-box a[href^="/actors/"], .actor-list a[href^="/actors/"]') ?? [])].flatMap(anchor => {
            const id = /^\/actors\/([\w-]{1,64})\/?$/.exec(anchor.getAttribute("href") ?? "")?.[1];
            const name = heading(anchor.querySelector(".actor-name, strong")) || anchor.getAttribute("title") || heading(anchor);
            return id && name ? [{ id, name, coverUrl: httpsLink(anchor.querySelector("img")?.getAttribute("src"), url) }] : [];
        })
        : [...new Map([...(root?.querySelectorAll('.item, a[href^="/v/"], a[href*="/v/"]') ?? [])]
            .flatMap(item => { const movie = readMovieCard(item, url); return movie ? [[movie.id, movie]] : []; })).values()];
    if (!items.length && !empty) throw catalogError("PARSE_ERROR", "结果区域缺少可识别的条目");
    const nextLink = boundary?.nextLink || doc.querySelector(".pagination-next");
    const next = nextLink?.getAttribute("href");
    const nextHref = httpsLink(next, url, url.origin);
    const nextUrl = nextHref && new URL(nextHref);
    const nextPage = nextUrl && nextUrl.pathname === url.pathname ? Number(nextUrl.searchParams.get("page")) : 0;
    const facets = new Map();
    if (/^\/tags(?:\/|$)/.test(url.pathname)) {
        for (const anchor of doc.querySelectorAll("main a[href], section.section a[href], .section-container a[href]")) {
            const href = httpsLink(anchor.getAttribute("href"), url);
            if (!href) continue;
            const target = new URL(href);
            const label = heading(anchor);
            if (target.origin !== url.origin || target.pathname !== url.pathname || !label || label.length > 60) continue;
            for (const [key, value] of target.searchParams) {
                if (!/^c\d{1,2}$/.test(key) || !/^\d{1,7}$/.test(value) || value === url.searchParams.get(key)) continue;
                const changed = [...target.searchParams].filter(([name, argument]) => /^c\d{1,2}$/.test(name) && argument !== url.searchParams.get(name));
                if (changed.length === 1) facets.set(key + "=" + value, { key, value, label });
            }
        }
    }
    return { items, nextPage: Number.isInteger(nextPage) && nextPage > Number(url.searchParams.get("page") || 1) && nextPage < 10000 ? nextPage : null,
        ...(facets.size ? { facets: [...facets.values()] } : {}) };
}

/** @param {Document} doc @param {URL} url */
export function readJavDbActorProfile(doc, url) {
    const profile = new JavDbHostAdapter(doc, url).readActorProfile();
    if (!profile?.starId || !SITE_ID.test(profile.starId)) return null;
    const { starId: id, name, names, actressType } = profile;
    return { id, name, names, actressType, url: new URL("/actors/" + id, url).href,
        coverUrl: httpsLink(doc.querySelector(".actor-avatar img, img.actor-avatar")?.getAttribute("src"), url) };
}
