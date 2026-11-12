// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseJavStorePreview, parseJavStoreSearch } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createJavStoreAdapter(http) {
    /** @param {string} url @param {any} options @param {(response: any) => boolean} cacheAccept */
    const request = (url, options, cacheAccept) => http.request({
        providerId: "javstore", capability: "movie.images", method: "GET", url, responseType: "text",
        urlPolicy: { trustClass: "builtin-public", hosts: ["javstore.net"] },
        refreshCache: options.refreshCache === true, cacheAccept,
    }, options.scope);
    return Object.freeze({
        contracts: ["Screenshot"],
        /** @param {{carNum?: string}} movieRef */
        getSearchUrl(movieRef) {
            const carNum = normalizeCarNum(movieRef.carNum);
            const fc2Id = carNum?.match(/^FC2-?(?:PPV-?)?(\d+)$/)?.[1];
            const query = fc2Id ? `FC2-PPV-${fc2Id}` : movieRef.carNum || "";
            return `https://javstore.net/search?q=${encodeURIComponent(query)}`;
        },
        /** @param {{carNum: string}} movieRef @param {{scope?: any, refreshCache?: boolean}} [options] */
        async getImages(movieRef, options = {}) {
            const searchUrl = this.getSearchUrl(movieRef);
            const search = await request(searchUrl, options, response => parseJavStoreSearch(response.data, movieRef.carNum, response.finalUrl || searchUrl).length > 0);
            const candidates = parseJavStoreSearch(search.data, movieRef.carNum, search.finalUrl || searchUrl);
            if (!candidates.length) return [];
            for (const candidate of candidates) {
                try {
                    const detail = await request(candidate, options, response => !!parseJavStorePreview(response.data, response.finalUrl || candidate, movieRef.carNum));
                    const imageUrl = parseJavStorePreview(detail.data, detail.finalUrl || candidate, movieRef.carNum);
                    if (imageUrl) return [Object.freeze({ url: imageUrl, providerId: "javstore" })];
                } catch (error) {
                    if (!(error && typeof error === "object" && "code" in error && error.code === "NOT_FOUND")) throw error;
                }
            }
            return [];
        },
    });
}

export default defineIntegration({
    id: "javstore", trustClass: "builtin-public", hosts: ["javstore.net"],
    capabilities: ["movie.images"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createJavStoreAdapter(client.http),
    createHostAdapter: null, cachePolicy: { "movie.images": "screenshot-7d" }, quality: "silver",
});
