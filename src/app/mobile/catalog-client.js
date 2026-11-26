// @ts-check
import { catalogAccessError, catalogError, catalogRoute, JAVDB_ORIGIN, parseCatalogDocument } from "../javdb/public-catalog.js";
import { JavDbHostAdapter } from "../../platform/hosts/javdb-host-adapter.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { validHttps } from "./components.js";

const sitePolicy = { trustClass: "builtin-public", hosts: ["javdb.com"], expectedOrigin: JAVDB_ORIGIN };

/** @param {Document} doc @param {URL} location @param {string} [currentId] */
function readRecommendations(doc, location, currentId) {
    const host = new JavDbHostAdapter(doc, location);
    const works = new Map();
    for (const { root } of host.getDetailRecommendationBoundaries()) {
        for (const link of root.querySelectorAll("a.tile-item[href], .item a[href], a.item[href]")) {
            const target = validHttps(link.getAttribute("href"), location);
            if (!target) continue;
            const url = new URL(target);
            const id = /^\/v\/([\w-]{1,64})\/?$/.exec(url.pathname)?.[1];
            if (url.origin !== JAVDB_ORIGIN || !id || id === currentId || works.has(id)) continue;
            const numbers = new Set([...link.querySelectorAll(".video-number, .video-title strong")]
                .map(node => normalizeMovieCarNum(node.textContent)).filter(Boolean));
            const carNum = numbers.size === 1 ? [...numbers][0] : null;
            const title = link.getAttribute("title")?.trim() || link.querySelector(".video-title")?.textContent?.trim() || carNum;
            const cover = link.querySelector("img");
            const coverUrl = validHttps(cover?.getAttribute("data-src") || cover?.getAttribute("src"), location);
            works.set(id, { id, url: JAVDB_ORIGIN + "/v/" + id, carNum, title, coverUrl });
        }
    }
    return [...works.values()];
}

export class CatalogClient {
    /** @param {any} http */
    constructor(http) { this.http = http; }

    /** @param {string} url @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {boolean} anonymous */
    async readDocument(url, scope, anonymous) {
        const result = await this.http.request({
            url, providerId: "javdb", responseType: "text", timeout: 12000, maxResponseBytes: 3 * 1024 * 1024,
            headers: { Accept: "text/html" }, acceptableStatuses: [401, 403],
            requestOptions: { anonymous }, urlPolicy: sitePolicy,
        }, scope);
        scope.assertActive();
        const location = new URL(result.finalUrl || url);
        const denied = catalogAccessError(result.status, result.data, location);
        if (denied) throw denied;
        if (!/^content-type:\s*text\/html\b/im.test(result.responseHeaders)) throw catalogError("PARSE_ERROR", "源站没有返回网页");
        return { doc: new DOMParser().parseFromString(result.data, "text/html"), location };
    }

    /** @param {string} path @param {Record<string,string>} params @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope @param {{session?:boolean}} [options] */
    async read(path, params, scope, options = {}) {
        const route = catalogRoute(path, new URLSearchParams(params));
        const url = JAVDB_ORIGIN + route.path;
        const load = async (/** @type {boolean} */ anonymous) => {
            const { doc, location } = await this.readDocument(url, scope, anonymous);
            const result = parseCatalogDocument(doc, route, location.href);
            return route.type === "movie" ? { ...result, recommendations: readRecommendations(doc, location, route.id) }
                : { ...result, usedSession: !anonymous };
        };
        if (options.session) return load(false);
        try { return await load(true); }
        catch (error) {
            if (/** @type {{code?: string}} */ (error).code !== "AUTH_REQUIRED") throw error;
            scope.assertActive();
            return load(false);
        }
    }

    /** @param {string} id @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    async readPreview(id, scope) {
        const route = catalogRoute("/v1/movies/" + id, "");
        const { doc, location } = await this.readDocument(JAVDB_ORIGIN + route.path, scope, false);
        const source = new JavDbHostAdapter(doc, location).readDetailPreview();
        if (!source || location.pathname !== route.path) return null;
        const poster = source.poster ? validHttps(new URL(source.poster, location).href) : null;
        const preview = { poster, requiresLogin: source.requiresLogin, video: /** @type {string|null} */ (null), hls: false };
        if (source.requiresLogin) return preview;
        if (source.video) return { ...preview, video: validHttps(new URL(source.video, location).href) };
        if (!source.endpoint) return preview;
        const endpoint = new URL(source.endpoint, location);
        const csrf = doc.querySelector('meta[name="csrf-token"]')?.getAttribute("content");
        if (endpoint.origin !== JAVDB_ORIGIN || endpoint.username || endpoint.password || !csrf) {
            throw catalogError("PARSE_ERROR", "无法核对原站预告接口");
        }
        const result = await this.http.request({
            url: endpoint.href, providerId: "javdb", responseType: "json", timeout: 12000, maxResponseBytes: 64 * 1024,
            headers: { Accept: "application/json", "X-CSRF-Token": csrf },
            requestOptions: { redirect: "error" }, urlPolicy: sitePolicy,
        }, scope);
        scope.assertActive();
        const video = validHttps(result.data?.url);
        if (!video) throw catalogError("PARSE_ERROR", "原站没有返回可用的预告地址");
        return { ...preview, video, hls: true };
    }
}
