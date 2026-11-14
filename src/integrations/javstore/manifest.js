// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
import { JhsError } from "../../core/jhs-error.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { inspectJavStorePreview, inspectJavStoreSearch } from "./parser.js";

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
            const search = await request(searchUrl, options, response => inspectJavStoreSearch(response.data, movieRef.carNum, response.finalUrl || searchUrl).candidates.length > 0);
            const inspected = inspectJavStoreSearch(search.data, movieRef.carNum, search.finalUrl || searchUrl);
            const { candidates } = inspected;
            let identityRejected = candidates.length ? 0 : inspected.identityRejected;
            let unrecognizedCount = candidates.length ? 0 : inspected.unrecognizedCount;
            for (const candidate of candidates) {
                try {
                    const inspect = (/** @type {any} */ response) => inspectJavStorePreview(response.data, response.finalUrl || candidate.url, movieRef.carNum, candidate.requiresDetailIdentity);
                    const detail = await request(candidate.url, options, response => Boolean(inspect(response).url));
                    const preview = inspect(detail);
                    if (preview.url) return [Object.freeze({ url: preview.url, providerId: "javstore" })];
                    if (preview.reason === "identity") identityRejected++;
                    if (preview.reason === "structure") unrecognizedCount++;
                } catch (error) {
                    if (!(error && typeof error === "object" && "code" in error && error.code === "NOT_FOUND")) throw error;
                }
            }
            if (identityRejected || unrecognizedCount) {
                throw new JhsError("INVALID_RESPONSE", "JavStore 缩略图候选核验失败", { source: "javstore", details: {
                    stage: candidates.length ? "detail" : "search",
                    reason: unrecognizedCount ? "structure" : "identity",
                    candidateCount: inspected.candidateCount, identityRejected, unrecognizedCount,
                } });
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
