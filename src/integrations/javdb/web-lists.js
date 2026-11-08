// @ts-check
import { detectSite } from "../../core/site-context.js";

const ID = /^[A-Za-z0-9_-]{1,128}$/;
/** @param {string} origin */
function webOrigin(origin) {
    const url = new URL(origin);
    if (url.protocol !== "https:" || url.username || url.password || !detectSite(url).isJavDB) throw new Error("清单请求需要当前 JavDB HTTPS 来源");
    return url.origin;
}

/** @param {string} html @param {string} origin */
export function parseJavDbWebAccount(html, origin) {
    const base = webOrigin(origin), doc = new DOMParser().parseFromString(html, "text/html");
    if (doc.querySelector('#navbar-menu-user a[href="/login"],.navbar-menu-user a[href="/login"],form[action="/login"]')) return null;
    const ids = new Set([...doc.querySelectorAll('meta[name="current-user-id"],[data-current-user-id],#navbar-menu-user [data-user-id]')]
        .map(node => node.getAttribute("content") || node.getAttribute("data-current-user-id") || node.getAttribute("data-user-id") || "")
        .filter(value => ID.test(value)));
    const csrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute("content") || "";
    if (!csrf || /[\r\n]/.test(csrf) || csrf.length > 4096 || ids.size > 1) return null;
    if (ids.size === 1) {
        const value = [...ids][0];
        const label = doc.querySelector('#navbar-menu-user [data-user-id],[data-current-user-name]')?.textContent?.trim() || `网页账号 ${value}`;
        return { identity: `id:${value}`, label, csrf };
    }
    const identities = [];
    for (const form of doc.querySelectorAll("form[action]")) {
        let action;
        try { action = new URL(form.getAttribute("action") || "", base); } catch { continue; }
        const method = form.querySelector('input[name="_method"]')?.getAttribute("value")?.toLowerCase();
        if (action.origin !== base || !/^\/users(?:\/(?:update|account))?\/?$/.test(action.pathname) || !["patch", "put"].includes(method || "")) continue;
        const id = form.querySelector('input[name="user[id]"]')?.getAttribute("value");
        const email = form.querySelector('input[name="user[email]"]')?.getAttribute("value")?.trim();
        if (id && ID.test(id)) identities.push({ identity: `id:${id}`, label: `网页账号 ${id}`, csrf });
        else if (email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) identities.push({ identity: `email:${email}`, label: `${email.slice(0, 1)}***@${email.split("@")[1]}`, csrf });
    }
    return identities.length === 1 ? identities[0] : null;
}

/** @param {any} payload @param {string} currentUrl @param {string | null} videoId */
export function parseJavDbListPage(payload, currentUrl, videoId) {
    const base = new URL(currentUrl);
    webOrigin(base.origin);
    if (!payload || typeof payload.lists !== "string" || payload.page != null && typeof payload.page !== "string") throw new Error("清单目录响应格式无效");
    const doc = new DOMParser().parseFromString(payload.lists, "text/html");
    const inputs = [...doc.querySelectorAll('input[type="checkbox"][data-list-id]')];
    if (payload.lists.trim() && !inputs.length || doc.querySelector('form[action="/login"],form[action="/users/sign_in"]')) throw new Error("未读取到有效清单，请确认网页登录状态");
    const lists = inputs.map(input => {
        const id = input.getAttribute("data-list-id") || "", label = input.closest("label")?.cloneNode(true);
        if (!label || !ID.test(id)) throw new Error("清单条目缺少可靠标识或名称");
        const element = /** @type {Element} */ (label);
        element.querySelectorAll("input").forEach(node => node.remove());
        const countNode = element.querySelector(".jhs-list-item__count,[data-list-count],.count") || [...element.querySelectorAll("span")].find(node => /^\s*[(（]?\s*\d+\s*(?:部(?:影片)?)?\s*[)）]?\s*$/.test(node.textContent || ""));
        const number = countNode?.textContent?.match(/\d+/)?.[0];
        countNode?.remove();
        const name = element.textContent?.replace(/\s+/g, " ").trim() || "";
        if (!name) throw new Error("清单条目缺少名称");
        return { id, name, count: number && Number.isSafeInteger(Number(number)) ? Number(number) : null, checked: input.hasAttribute("checked"), disabled: input.hasAttribute("disabled") };
    });
    const pagination = new DOMParser().parseFromString(payload.page || "", "text/html");
    const links = [...pagination.querySelectorAll('a[rel~="next"][href]')];
    if (links.length > 1) throw new Error("清单分页存在多个下一页");
    let nextUrl = null;
    if (links.length) {
        const next = new URL(links[0].getAttribute("href") || "", base);
        if (next.origin !== base.origin || next.pathname !== "/users/simple_lists" || next.username || next.password || next.hash) throw new Error("清单分页离开当前来源");
        if (videoId) {
            const requested = next.searchParams.get("vid");
            if (requested && requested !== videoId) throw new Error("清单分页的影片身份发生变化");
            next.searchParams.set("vid", videoId);
        }
        nextUrl = next.href;
    }
    return { lists, nextUrl };
}

/** Native webpage session operations share the existing HTTP boundary. @param {any} http */
export function createJavDbWebLists(http) {
    /** @param {string} origin @param {URL} url @param {any} options @param {any} scope */
    const request = (origin, url, options, scope) => {
        const base = webOrigin(origin);
        if (url.origin !== base) throw new Error("网页清单请求离开当前来源");
        return http.request({
            providerId: "javdb", capability: "lists.membership", url: url.href, method: "GET", responseType: "json",
            transport: "native-fetch", nativeFallback: false, retryCount: 0, timeout: 15000, nativeTimeout: 15000,
            circuitGroup: "account-read",
            requestOptions: { redirect: "error", cache: "no-store" },
            urlPolicy: { trustClass: "custom-public", expectedOrigin: base, expectedUrl: url.href },
            ...options,
        }, scope);
    };
    return {
        /** @param {string} origin @param {string} accountUrl @param {{scope?: any}} [options] */
        async readWebAccount(origin, accountUrl, options = {}) {
            const response = await request(origin, new URL(accountUrl), { responseType: "text", headers: { Accept: "text/html" } }, options.scope);
            if (typeof response.data !== "string") throw new Error("网页账号响应无效");
            return parseJavDbWebAccount(response.data, origin);
        },
        /** @param {string} origin @param {string | null} videoId @param {{url?: string, scope?: any}} [options] */
        async readListPage(origin, videoId, options = {}) {
            if (videoId !== null && !ID.test(videoId)) throw new Error("JavDB 影片 ID 无效");
            const url = new URL(options.url || "/users/simple_lists", webOrigin(origin));
            if (url.pathname !== "/users/simple_lists") throw new Error("清单目录地址无效");
            if (videoId) url.searchParams.set("vid", videoId);
            const response = await request(origin, url, { headers: { Accept: "application/json" } }, options.scope);
            return parseJavDbListPage(response.data, url.href, videoId);
        },
        /** @param {string} origin @param {{videoId: string, listId: string, checked: boolean, csrf: string}} input @param {{scope?: any}} [options] */
        async setListMember(origin, input, options = {}) {
            if (!ID.test(input.videoId) || !ID.test(input.listId) || typeof input.checked !== "boolean" || !input.csrf || /[\r\n]/.test(input.csrf)) throw new Error("清单提交参数无效");
            const url = new URL("/users/save_video_to_list", webOrigin(origin));
            const response = await request(origin, url, { method: "POST", circuitGroup: "account-mutation", headers: { Accept: "application/json", "Content-Type": "application/json", "X-CSRF-Token": input.csrf }, body: JSON.stringify({ video_id: input.videoId, checked: input.checked, list_id: input.listId }) }, options.scope);
            return response.data?.success === true ? "accepted" : response.data?.success === false ? "rejected" : "unknown";
        },
    };
}
