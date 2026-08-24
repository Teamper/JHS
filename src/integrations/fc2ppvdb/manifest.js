// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseFc2PpvDbDetail, parseFc2PpvDbPeople } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createFc2PpvDbAdapter(http) {
    /** @param {{carNum: string, url?: string}} movieRef */
    const resolveUrl = (movieRef) => {
        const id = String(movieRef.carNum || "").match(/^(?:FC2-)?(?:PPV-)?(\d+)$/i)?.[1];
        if (!id) throw new TypeError("FC2PPVDB movie identifier is invalid");
        return new URL(movieRef.url || `https://fc2ppvdb.com/articles/${id}`);
    };
    /** @param {URL} url @param {any} scope */
    const request = (url, scope) => http.request({
        providerId: "fc2ppvdb", method: "GET", url: url.href, responseType: "text",
        cacheScope: "public", ttlMs: 604_800_000,
        urlPolicy: { trustClass: "builtin-public", hosts: ["fc2ppvdb.com"] },
    }, scope);
    return Object.freeze({
        contracts: ["MovieDetail", "MovieCredits"],
        /** @param {{carNum: string, url?: string}} movieRef */
        detailUrl(movieRef) { return resolveUrl(movieRef).href; },
        /** @param {{carNum: string, url?: string}} movieRef @param {{scope?: any}} [options] */
        async getDetail(movieRef, options = {}) {
            const url = resolveUrl(movieRef), response = await request(url, options.scope);
            return parseFc2PpvDbDetail(response.data, response.finalUrl || url.href);
        },
        /** @param {{carNum: string, url?: string}} movieRef @param {{scope?: any}} [options] */
        async getPeople(movieRef, options = {}) {
            const url = resolveUrl(movieRef), response = await request(url, options.scope);
            return parseFc2PpvDbPeople(response.data, response.finalUrl || url.href);
        },
    });
}

export default defineIntegration({
    id: "fc2ppvdb", trustClass: "builtin-public", hosts: ["fc2ppvdb.com"], capabilities: ["movie.detail", "movie.credits"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createFc2PpvDbAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.detail": CACHE.externalDetail, "movie.credits": CACHE.externalDetail }, quality: "silver",
});
