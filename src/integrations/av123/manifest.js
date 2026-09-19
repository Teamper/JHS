// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { defineMovieDetail, defineMovieRef } from "../../contracts/models.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { merge123AvCards, parse123AvCards, parse123AvSourceMaxPage, parse123AvVideoInfo } from "./parser.js";

const DEFAULT_ORIGIN = "https://123av.com";

/** @param {unknown} configured */
function normalizeBaseOrigin(configured) {
    try {
        const url = new URL(String(configured || DEFAULT_ORIGIN));
        if (url.protocol !== "https:") return DEFAULT_ORIGIN;
        return url.origin;
    } catch { return DEFAULT_ORIGIN; }
}

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http @param {{snapshot: () => Record<string, any>} | null} [settings] */
export function create123AvAdapter(http, settings = null) {
    const baseOrigin = () => normalizeBaseOrigin(settings?.snapshot().av123Url);
    /** @param {string} url @param {any} scope @param {string} capability */
    const request = (url, scope, capability = "movie.detail") => {
        const origin = new URL(url).origin, isBuiltin = origin === DEFAULT_ORIGIN;
        return http.request({
            providerId: "av123", capability, method: "GET", url, responseType: "text",
            requestOptions: { cookiePartition: { topLevelSite: origin } },
            urlPolicy: isBuiltin ? { trustClass: "builtin-public", hosts: ["123av.com"], expectedOrigin: origin } : { trustClass: "custom-public", expectedOrigin: origin },
        }, scope);
    };
    return Object.freeze({
        contracts: ["MovieRef", "MovieDetail"],
        origin: baseOrigin,
        /** @param {{carNum?: unknown}} movieRef */
        searchUrl(movieRef) {
            const carNum = normalizeMovieCarNum(movieRef?.carNum);
            return carNum ? `${baseOrigin()}/cn/search?keyword=${encodeURIComponent(carNum)}` : null;
        },
        /** @param {{carNum: string, url?: string}} movieRef */
        detailUrl(movieRef) {
            const id = normalizeMovieCarNum(movieRef.carNum)?.match(/^FC2-(\d+)$/)?.[1];
            return movieRef.url ? new URL(movieRef.url).href : id ? `${baseOrigin()}/cn/v/fc2-ppv-${id}` : null;
        },
        /** @param {string} value */
        matchesUrl(value) { try { const url = new URL(value); return url.origin === baseOrigin() || /^\/cn\/v\/fc2-ppv-\d+\/?$/i.test(url.pathname); } catch { return false; } },
        /** @param {{page?: number, keyword?: string}} query @param {{scope?: any}} [options] */
        async listCatalog(query = {}, options = {}) {
            const page = Math.max(1, Number(query.page) || 1), keyword = String(query.keyword || "").trim();
            const sourcePages = keyword ? [page] : [page * 2 - 1, page * 2];
            const urls = sourcePages.map((sourcePage) => keyword
                ? `${baseOrigin()}/cn/search?keyword=${encodeURIComponent(keyword)}&page=${sourcePage}`
                : `${baseOrigin()}/cn/makers/fc2?page=${sourcePage}`);
            const responses = await Promise.all(urls.map((url) => request(url, options.scope, keyword ? "movie.search" : "movie.catalog")));
            const lists = responses.map((response, index) => parse123AvCards(response.data, response.finalUrl || urls[index]));
            const items = merge123AvCards(lists).map((item) => Object.freeze({
                carNum: item.carNum, title: item.title, url: item.href,
                imageUrl: item.imgSrc ? new URL(item.imgSrc, baseOrigin()).href : null,
                previewUrl: item.preview ? new URL(item.preview, baseOrigin()).href : null,
                providerId: "av123",
            }));
            const sourceMaxPage = !responses.length ? null : parse123AvSourceMaxPage(responses[0].data, responses[0].finalUrl || urls[0]);
            return Object.freeze({ items, maxPage: sourceMaxPage ? keyword ? sourceMaxPage : Math.ceil(sourceMaxPage / 2) : null });
        },
        /** @param {{carNum: string}} movieRef @param {{scope?: any}} [options] */
        async resolveMovie(movieRef, options = {}) {
            const carNum = normalizeMovieCarNum(movieRef.carNum);
            if (!carNum) return null;
            const url = this.searchUrl({ carNum });
            if (!url) return null;
            const response = await request(url, options.scope, "movie.search");
            const match = parse123AvCards(response.data, response.finalUrl || url).find((item) => normalizeMovieCarNum(item.carNum) === carNum);
            return match ? defineMovieRef({ carNum, url: match.href, providerId: "av123" }) : null;
        },
        /** @param {{carNum: string, url?: string}} movieRef @param {{scope?: any}} [options] */
        async getDetail(movieRef, options = {}) {
            const carNum = normalizeMovieCarNum(movieRef.carNum), id = carNum?.match(/^FC2-(\d+)$/)?.[1];
            if (!carNum || (!movieRef.url && !id)) throw new TypeError("123AV movie reference is invalid");
            const url = new URL(movieRef.url || `${baseOrigin()}/cn/v/fc2-ppv-${id}`).href;
            const response = await request(url, options.scope), info = parse123AvVideoInfo(response.data, response.finalUrl || url);
            if (!info.title) throw new TypeError("123AV detail is malformed");
            return defineMovieDetail({ carNum, title: info.title, releaseDate: info.publishDate || null, url: response.finalUrl || url, providerId: "av123" });
        },
    });
}

export default defineIntegration({
    id: "av123", trustClass: "builtin-public", hosts: ["123av.com"],
    capabilities: ["movie.search", "movie.detail", "movie.catalog"], requires: [SERVICE.http, SERVICE.settings],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http], settings: dependencies[SERVICE.settings] }),
    createAdapter: (/** @type {any} */ client) => create123AvAdapter(client.http, client.settings), createHostAdapter: null,
    cachePolicy: { "movie.search": "public-7d", "movie.detail": CACHE.externalDetail, "movie.catalog": "public-7d" }, quality: "silver",
});
