// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { normalizeCarNum } from "../../core/movie-identity.js";
import { JhsError } from "../../core/jhs-error.js";
import { SERVICE } from "../../contracts/tokens.js";
import { inspectJavStorePreview, inspectJavStorePreviews, inspectJavStoreSearch, javStoreTitleQuery } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createJavStoreAdapter(http) {
    /** @param {string} url @param {any} options @param {(response: any) => boolean} cacheAccept */
    const request = (url, options, cacheAccept) => http.request({
        providerId: "javstore", capability: "movie.images", method: "GET", url, responseType: "text",
        urlPolicy: { trustClass: "builtin-public", hosts: ["javstore.net"] },
        refreshCache: options.refreshCache === true, cacheAccept,
    }, options.scope);
    const searchFor = (/** @type {string} */ query) => `https://javstore.net/search?q=${encodeURIComponent(query)}`;
    /** @param {{carNum?: string}} movieRef */
    function getSearchUrl(movieRef) {
        const carNum = normalizeCarNum(movieRef.carNum);
        const fc2Id = carNum?.match(/^FC2-?(?:PPV-?)?(\d+)$/)?.[1];
        return searchFor(fc2Id ? `FC2-PPV-${fc2Id}` : movieRef.carNum || "");
    }

    /** @param {{carNum: string, title?: string}} movieRef @param {{scope?: any, refreshCache?: boolean, preview?: {titleQuery?: boolean, visitedArticles: Set<string>}}} [options] */
    async function* getImageBatches(movieRef, options = {}) {
        const title = javStoreTitleQuery(movieRef.title || "", movieRef.carNum);
        if (options.preview?.titleQuery && !title) return;
        const searchUrl = options.preview?.titleQuery ? searchFor(title) : getSearchUrl(movieRef);
        const inspectSearch = (/** @type {any} */ response) => inspectJavStoreSearch(response.data, movieRef.carNum, response.finalUrl || searchUrl, options.preview ? { title } : null);
        const search = await request(searchUrl, options, response => inspectSearch(response).candidates.length > 0);
        const inspected = inspectSearch(search);
        const { candidates } = inspected;
        const visited = options.preview?.visitedArticles;
        const relevant = visited ? candidates.filter(candidate => !visited.has(candidate.articleKey ?? candidate.url)).slice(0, 5) : candidates;
        let identityRejected = candidates.length ? 0 : inspected.identityRejected;
        let unrecognizedCount = candidates.length ? 0 : inspected.unrecognizedCount;
        for (const candidate of relevant) {
            options.scope?.assertActive?.();
            visited?.add(candidate.articleKey ?? candidate.url);
            try {
                const inspect = (/** @type {any} */ response) => {
                    const url = response.finalUrl || candidate.url;
                    if (options.preview) return inspectJavStorePreviews(response.data, url, movieRef.carNum, candidate);
                    const { url: asset, reason } = inspectJavStorePreview(response.data, url, movieRef.carNum, candidate.requiresDetailIdentity);
                    return { previews: asset ? [{ url: asset }] : [], reason };
                };
                const detail = await request(candidate.url, options, response => inspect(response).previews.length > 0);
                const { previews, reason } = inspect(detail);
                if (previews.length) yield previews.map(preview => Object.freeze({ ...preview, providerId: "javstore" }));
                if (reason === "identity") identityRejected++;
                if (reason === "structure") unrecognizedCount++;
            } catch (error) {
                if (options.scope?.disposed || /** @type {any} */ (error)?.code !== "NOT_FOUND") throw error;
            }
        }
        if (identityRejected || unrecognizedCount) {
            throw new JhsError("INVALID_RESPONSE", "JavStore 缩略图候选核验失败", { source: "javstore", details: {
                stage: candidates.length ? "detail" : "search",
                reason: unrecognizedCount ? "structure" : "identity",
                candidateCount: inspected.candidateCount, identityRejected, unrecognizedCount,
            } });
        }
    }

    return Object.freeze({
        contracts: ["Screenshot"],
        getSearchUrl,
        getImageBatches,
        /** @param {{carNum: string}} movieRef @param {{scope?: any, refreshCache?: boolean}} [options] */
        async getImages(movieRef, options = {}) {
            for await (const images of getImageBatches(movieRef, options)) return images;
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
