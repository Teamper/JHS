// @ts-check
import { catalogAccessError, JAVDB_ORIGIN, SITE_ID } from "./javdb.js";

const PENDING = "提交状态待确认，请核对 JavDB 状态后再操作";

/** @param {Element} form @param {string} base */
function reviewAction(form, base) {
    const value = form.getAttribute("action");
    if (!value || form.getAttribute("method")?.toLowerCase() !== "post") return null;
    try {
        const action = new URL(value, base);
        return action.origin === JAVDB_ORIGIN && !action.username && !action.password && !action.search && !action.hash ? action : null;
    } catch { return null; }
}

/** @param {Document} page @param {string} reviewPath @param {"want_watch"|"watched"} status */
function hasExistingReview(page, reviewPath, status) {
    const list = status === "watched" ? "/users/watched_videos" : "/users/want_watch_videos";
    if (!page.querySelector('.review-buttons .review-title a[href="' + list + '"]')) return false;
    const form = page.querySelector('form[id^="edit_review"]');
    const path = form && reviewAction(form, JAVDB_ORIGIN)?.pathname;
    return Boolean(path?.startsWith(reviewPath + "/") && SITE_ID.test(path.slice(reviewPath.length + 1))
        && form?.querySelector('input[name="video_review[status]"][checked]')?.getAttribute("value") === status);
}

/** @param {Document} page @param {string} reviewPath */
function isWanted(page, reviewPath) {
    if (hasExistingReview(page, reviewPath, "want_watch")) return true;
    return [...page.querySelectorAll(".review-buttons form[action]")].some(form => {
        const path = reviewAction(form, JAVDB_ORIGIN)?.pathname;
        const selected = form.querySelector('button[aria-pressed="true"]');
        const remove = Boolean(form.querySelector('input[name="_method"][value="delete"]'));
        if (path === `${reviewPath}/want_to_watch`) return remove || Boolean(selected);
        return Boolean(path?.startsWith(`${reviewPath}/`) && SITE_ID.test(path.slice(reviewPath.length + 1))
            && /^(?:[刪删]除(?:想看)?|取消想看)$/u.test(selected?.textContent?.trim() || ""));
    });
}

/** @param {Document} page @param {string} reviewPath @param {URLSearchParams} [submitted] */
function isWatched(page, reviewPath, submitted) {
    if (page.querySelector('#review-watched[aria-pressed="true"]') || hasExistingReview(page, reviewPath, "watched")) return true;
    if (!submitted) return false;
    return [...page.querySelectorAll('form[id^="edit_review"]')].some(form => {
        const path = reviewAction(form, JAVDB_ORIGIN)?.pathname;
        return Boolean(path?.startsWith(`${reviewPath}/`) && SITE_ID.test(path.slice(reviewPath.length + 1))
            && ["status", "score"].every(field => form.querySelector(`input[name="video_review[${field}]"]`)
                ?.getAttribute("value") === submitted.get(`video_review[${field}]`)));
    });
}

/** @param {string} movieId @param {"want"|"watched"} kind @param {number} score @param {any} app @param {import("../../src/core/lifecycle-scope.js").LifecycleScope} scope @param {(html: string, url: string) => Document} [documentFrom] */
export async function saveWebReview(movieId, kind, score, app, scope, documentFrom = html => new DOMParser().parseFromString(html, "text/html")) {
    if (typeof movieId !== "string" || !SITE_ID.test(movieId)) throw new Error("源站作品 ID 无效");
    const account = await app.services.javdbLists.access(scope);
    if (!account.account) throw new Error("请先在「我的」登录 JavDB");
    const policy = { trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: JAVDB_ORIGIN };
    const movieUrl = new URL(`/v/${movieId}`, JAVDB_ORIGIN);
    const reviewPath = movieUrl.pathname + "/reviews";
    const read = async () => {
        const result = await app.services.http.request({ url: movieUrl.href, providerId: "javdb", urlPolicy: policy,
            circuitGroup: "account-read", responseType: "text", retryCount: 0, acceptableStatuses: [401, 403],
            requestOptions: { cache: "no-store" } }, scope);
        const location = new URL(result.finalUrl || movieUrl);
        const denied = catalogAccessError(result.status, result.data, location);
        if (denied) throw denied;
        if (location.origin !== movieUrl.origin || location.pathname.replace(/\/$/, "") !== movieUrl.pathname) throw new Error("无法核对原站作品");
        return documentFrom(result.data, location.href);
    };
    const checkAccount = async () => {
        const current = await app.services.javdbLists.access(scope);
        scope.assertActive();
        if (current.account?.fingerprint !== account.account.fingerprint) throw new Error("JavDB 账号已变化，请重新打开详情");
    };
    const page = await read();
    await checkAccount();
    if (kind === "want" && isWanted(page, reviewPath)) return "已在 JavDB 想看清单";
    if (kind === "watched" && isWatched(page, reviewPath)) return "已在 JavDB 标记看过";

    const form = kind === "want" ? page.querySelector('.review-buttons form[action$="/want_to_watch"]') : page.querySelector("form#new_review");
    const action = form && reviewAction(form, movieUrl.href);
    const expected = reviewPath + (kind === "want" ? "/want_to_watch" : "");
    const csrf = form?.querySelector('input[name="authenticity_token"]')?.getAttribute("value") || page.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
    if (!form || action?.pathname !== expected || !csrf || /[\r\n]/.test(csrf) || csrf.length > 4096
        || form.querySelector('input[name="_method"]')) throw new Error("JavDB 当前没有提供可确认的提交表单");
    const data = new URLSearchParams({ authenticity_token: csrf });
    if (kind === "watched") {
        const state = form.querySelector('input[name="video_review[status]"]')?.getAttribute("value");
        if (!state || !Number.isInteger(score) || score < 1 || score > 5) throw new Error("看过表单或评分无效");
        data.set("video_review[status]", state);
        data.set("video_review[score]", String(score));
        data.set("video_review[content]", "");
    }
    let sent = false;
    try {
        await app.services.http.request({ providerId: "javdb", url: action.href, urlPolicy: policy,
            method: "POST", circuitGroup: "account-mutation", retryCount: 0, responseType: "text", requestOptions: { redirect: "manual" },
            headers: { "Content-Type": "application/x-www-form-urlencoded", "X-CSRF-Token": csrf, "X-Requested-With": "XMLHttpRequest", Accept: "application/json, text/javascript, text/html" },
            body: data.toString(), onDispatch: () => { sent = true; } }, scope);
    } catch (error) {
        scope.assertActive();
        const code = /** @type {{code?:string}|null} */ (error)?.code || "";
        if (!sent || !["NETWORK_ERROR", "TIMEOUT"].includes(code)) throw error;
    }
    let after;
    try { after = await read(); }
    catch {
        scope.assertActive();
        return PENDING;
    }
    await checkAccount();
    if (kind === "want" && isWanted(after, reviewPath)) return "JavDB 想看已更新";
    if (kind === "watched" && isWatched(after, reviewPath, data)) return "JavDB 看过已更新";
    return PENDING;
}
