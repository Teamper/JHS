// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseJavStorePreview, parseJavStoreSearch } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createJavStoreAdapter(http) {
    /** @param {string} url @param {any} scope */
    const request = (url, scope) => http.request({
        providerId: "javstore", method: "GET", url, responseType: "text", cacheScope: "public", ttlMs: 604_800_000,
        urlPolicy: { trustClass: "builtin-public", hosts: ["javstore.net"] },
    }, scope);
    return Object.freeze({
        contracts: ["Screenshot"],
        /** @param {{carNum: string}} movieRef @param {{scope?: any}} [options] */
        async getImages(movieRef, options = {}) {
            const searchUrl = `https://javstore.net/search?q=${encodeURIComponent(movieRef.carNum || "")}`;
            const search = await request(searchUrl, options.scope);
            const candidates = parseJavStoreSearch(search.data, movieRef.carNum, search.finalUrl || searchUrl);
            if (!candidates.length) return [];
            for (const candidate of candidates) {
                try {
                    const detail = await request(candidate, options.scope);
                    const imageUrl = parseJavStorePreview(detail.data, detail.finalUrl || candidate);
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
    createHostAdapter: null, cachePolicy: { "movie.images": CACHE.externalDetail }, quality: "silver",
});
