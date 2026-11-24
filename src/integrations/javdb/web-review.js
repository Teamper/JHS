// @ts-check
import { JhsError } from "../../core/jhs-error.js";
import { matchesMovieCodeEvidence, movieCodeKey } from "../../core/movie-code-evidence.js";
import { detectSite } from "../../core/site-context.js";

const INVALID = "无法核对 JavDB 原站的观影状态";
const MOVIE_ID = /^[A-Za-z0-9_-]{1,128}$/;
const SCORE = "video_review[score]";
const STATUS = "video_review[status]";
const CONTENT = "video_review[content]";

/** @typedef {{movieId: string, carNum: string}} ReviewMovie */
/** @typedef {"want" | "watch" | "unwatch"} ReviewAction */
/** @typedef {"unmarked" | "want_watch" | "watched"} ReviewStatus */
/** @typedef {{url: URL, token: string, method: "POST" | "DELETE", fields: URLSearchParams}} ReviewRequest */
/** @typedef {{status: ReviewStatus, reviewId: string | null, score: number | null, comment: string, scoreRequired: boolean, actions: Partial<Record<ReviewAction, ReviewRequest>>}} WebReview */

/** @param {Element | null} element @param {"action" | "href"} attribute @param {URL} base */
function advertisedUrl(element, attribute, base) {
    const value = element?.getAttribute(attribute);
    if (!value || !URL.canParse(value, base)) return null;
    const url = new URL(value, base);
    return url.origin === base.origin && !url.username && !url.password && !url.search && !url.hash ? url : null;
}

/** @param {string} token */
function validToken(token) { return !!token && token.length <= 4096 && !/[\r\n]/.test(token); }

/** @param {Element | null} form @param {URL} base @param {string} path @param {URLSearchParams} fields
 * @returns {ReviewRequest | undefined} */
function post(form, base, path, fields) {
    const url = advertisedUrl(form, "action", base);
    const token = form?.querySelector('input[type="hidden"][name="authenticity_token"]')?.getAttribute("value") || "";
    if (url?.pathname !== path || form?.getAttribute("method")?.toLowerCase() !== "post" || !validToken(token)) return;
    fields.set("authenticity_token", token);
    return { url, token, method: "POST", fields };
}

/** @param {Document} doc @param {string} carNum */
function verifyMovieCode(doc, carNum) {
    const evidence = [...doc.querySelectorAll('.movie-panel-info .first-block .value, .video-title strong, a[title="複製番號"][data-clipboard-text]')]
        .filter(node => !node.closest(".movie-list,.masonry,.item"))
        .map(node => node.getAttribute("data-clipboard-text") || node.textContent?.trim() || "");
    for (const block of doc.querySelectorAll(".movie-panel-info .panel-block")) {
        const label = block.querySelector(":scope > strong, :scope > .label")?.textContent?.trim() || "";
        if (/^(?:番號|番号|ID)\s*[:：]?$/i.test(label)) {
            evidence.push(block.querySelector("[data-clipboard-text]")?.getAttribute("data-clipboard-text") || block.querySelector(".value")?.textContent?.trim() || "");
        }
    }
    if (!matchesMovieCodeEvidence(evidence, carNum)) throw new JhsError("INVALID_RESPONSE", "原站 FC2 番号与当前作品不一致");
}

/** @param {Document} doc @param {URL} base @param {string} carNum @returns {WebReview} */
export function parseJavDbWebReview(doc, base, carNum) {
    if (doc.querySelector('form[action="/login"], #navbar-menu-user a[href="/login"], .navbar-menu-user a[href="/login"]')) {
        throw new JhsError("AUTH_REQUIRED", "请登录 JavDB 网页账号");
    }
    verifyMovieCode(doc, carNum);
    const reviewPath = base.pathname + "/reviews";
    const groups = doc.querySelectorAll(".movie-panel-info > .review-buttons");
    if (groups.length !== 1) throw new JhsError("INVALID_RESPONSE", INVALID);
    const group = groups[0];
    const titles = [...group.querySelectorAll(".review-title a[href]")];
    const titlePath = titles.length === 1 ? advertisedUrl(titles[0], "href", base)?.pathname : null;
    /** @type {Partial<Record<ReviewAction, ReviewRequest>>} */
    const actions = {};
    if (!titles.length) {
        const form = doc.querySelector("#modal-review-watched #new_review");
        const want = [...group.querySelectorAll("form[action]")].filter(node => advertisedUrl(node, "action", base)?.pathname === reviewPath + "/want_to_watch");
        const watchedButton = group.querySelector('#review-watched[data-target="modal-review-watched"]');
        const status = form?.querySelector('input[type="hidden"][name="' + STATUS + '"]');
        const value = status?.getAttribute("value") || "";
        if (want.length !== 1 || !watchedButton || !form || !status || !["", "watched"].includes(value) || form.querySelector('[name="_method"]') || want[0].querySelector('[name="_method"]')) {
            throw new JhsError("INVALID_RESPONSE", INVALID);
        }
        actions.want = post(want[0], base, reviewPath + "/want_to_watch", new URLSearchParams());
        actions.watch = post(form, base, reviewPath, new URLSearchParams({ [STATUS]: value, [CONTENT]: "" }));
        if (!actions.want || !actions.watch) throw new JhsError("INVALID_RESPONSE", INVALID);
        return { status: "unmarked", reviewId: null, score: null, comment: "", actions, scoreRequired: !!form.querySelector('[name="' + SCORE + '"][required]') };
    }

    const status = titlePath === "/users/watched_videos" ? "watched" : titlePath === "/users/want_watch_videos" ? "want_watch" : null;
    const form = doc.querySelector("#modal-review-edit #edit_review");
    const editUrl = advertisedUrl(form, "action", base);
    const id = editUrl?.pathname.startsWith(reviewPath + "/") ? editUrl.pathname.slice(reviewPath.length + 1) : "";
    const selected = form?.querySelector('[name="' + STATUS + '"][checked]')?.getAttribute("value");
    if (!status || !id || !MOVIE_ID.test(id) || selected !== status || !form?.querySelector('input[type="hidden"][name="_method"][value="put"]')) {
        throw new JhsError("INVALID_RESPONSE", INVALID);
    }
    const scoreValue = Number(form.querySelector('[name="' + SCORE + '"][checked]')?.getAttribute("value"));
    const score = Number.isInteger(scoreValue) && scoreValue >= 1 && scoreValue <= 5 ? scoreValue : null;
    const commentField = form.querySelector('textarea[name="' + CONTENT + '"]');
    if (!commentField) throw new JhsError("INVALID_RESPONSE", INVALID);
    const comment = commentField.textContent || "";
    const fields = new URLSearchParams({ _method: "put", [CONTENT]: comment });
    if (score) fields.set(SCORE, String(score));
    const targetStatus = status === "watched" ? "want_watch" : "watched";
    if (form.querySelector('input[name="' + STATUS + '"][value="' + targetStatus + '"]')) {
        fields.set(STATUS, targetStatus);
        const edit = post(form, base, reviewPath + "/" + id, fields);
        if (edit) actions[status === "watched" ? "want" : "watch"] = edit;
    }
    if (status === "watched") {
        const links = [...group.querySelectorAll('a[data-method="delete"][href]')].filter(link => advertisedUrl(link, "href", base)?.href === editUrl?.href);
        const token = doc.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
        if (links.length === 1 && editUrl && validToken(token)) actions.unwatch = { url: editUrl, token, method: "DELETE", fields: new URLSearchParams() };
    }
    return { status, reviewId: id, score, comment, actions, scoreRequired: !!form.querySelector('[name="' + SCORE + '"][required]') };
}

/** @param {Pick<import("../../services/http-service.js").HttpService, "request">} http */
export function createJavDbWebReview(http) {
    /** @param {URL} url @param {Record<string, any>} options @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    const request = (url, options, scope) => http.request({
        providerId: "javdb", capability: "account.web-review", url: url.href, responseType: "text",
        transport: "native-fetch", nativeFallback: false, cacheScope: "none", retryCount: 0,
        timeout: 15000, nativeTimeout: 15000, circuitGroup: "account-read",
        requestOptions: { cache: "no-store", redirect: "error" },
        urlPolicy: { trustClass: "custom-public", expectedOrigin: url.origin },
        ...options,
    }, scope);
    return {
        /** @param {string} origin @param {ReviewMovie} movie @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
        async readWebReview(origin, movie, scope) {
            const url = new URL(origin);
            if (url.protocol !== "https:" || !detectSite(url).isJavDB || url.origin !== origin || !MOVIE_ID.test(movie.movieId) || !/^FC2-\d+$/.test(movieCodeKey(movie.carNum))) {
                throw new JhsError("INVALID_URL", "JavDB FC2 作品身份无效");
            }
            url.pathname = "/v/" + movie.movieId;
            const response = await request(url, { requestOptions: { cache: "no-store", redirect: "follow" }, headers: { Accept: "text/html" } }, scope);
            const final = new URL(response.finalUrl || url.href);
            if (final.origin === origin && /^\/(?:login|users\/sign_in)\/?$/.test(final.pathname)) throw new JhsError("AUTH_REQUIRED", "请登录 JavDB 网页账号");
            if (final.origin !== origin || final.pathname.replace(/\/$/, "") !== url.pathname || final.search || final.hash || typeof response.data !== "string") throw new JhsError("INVALID_RESPONSE", INVALID);
            return parseJavDbWebReview(new DOMParser().parseFromString(response.data, "text/html"), url, movie.carNum);
        },
        /** @param {ReviewRequest} action @param {number | undefined} score @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
        async sendWebReview(action, score, scope) {
            const fields = new URLSearchParams(action.fields);
            if (score !== undefined) fields.set(SCORE, String(score));
            return request(action.url, {
                method: action.method, circuitGroup: "account-mutation",
                headers: { "X-CSRF-Token": action.token, "X-Requested-With": "XMLHttpRequest", Accept: "text/javascript, application/javascript", ...(action.method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8" } : {}) },
                ...(action.method === "POST" ? { body: fields.toString() } : {}),
            }, scope);
        },
    };
}
