// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { parseJavFreeImages, parseJavFreeSearch } from "./parser.js";

/** @param {any} http */
export function createJavFreeAdapter(http) {
    /** @param {string} url @param {any} options @param {(response: any) => boolean} cacheAccept */
    const request = (url, options, cacheAccept) => http.request({ providerId: "javfree", capability: "movie.images", method: "GET", url, responseType: "text", cacheAccept, refreshCache: options.refreshCache === true, urlPolicy: { trustClass: "builtin-public", hosts: ["javfree.me"] } }, options.scope);
    /** @param {{carNum?: string}} movie */
    const getSearchUrl = (movie) => `https://javfree.me/search/${encodeURIComponent(movie.carNum || "")}`;
    /** @param {{carNum: string}} movie @param {any} [options] */
    async function* getImageBatches(movie, options = {}) {
        const searchUrl = getSearchUrl(movie), response = await request(searchUrl, options, response => parseJavFreeSearch(response.data, movie.carNum, response.finalUrl || searchUrl).length > 0);
        for (const candidate of parseJavFreeSearch(response.data, movie.carNum, response.finalUrl || searchUrl).slice(0, 5)) {
            options.scope?.assertActive();
            try {
                const detail = await request(candidate, options, response => parseJavFreeImages(response.data, movie.carNum, response.finalUrl || candidate).length > 0);
                const images = parseJavFreeImages(detail.data, movie.carNum, detail.finalUrl || candidate);
                if (images.length) yield images;
            } catch (error) {
                if (options.scope?.disposed || /** @type {any} */ (error)?.code !== "NOT_FOUND") throw error;
            }
        }
    }
    return Object.freeze({
        contracts: ["Screenshot"],
        getSearchUrl,
        getImageBatches,
        /** @param {{carNum: string}} movie @param {any} [options] */
        async getImages(movie, options = {}) {
            for await (const images of getImageBatches(movie, options)) return images;
            return [];
        },
    });
}

export default defineIntegration({
    id: "javfree", trustClass: "builtin-public", hosts: ["javfree.me"], capabilities: ["movie.images"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ deps) => ({ http: deps[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createJavFreeAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.images": "screenshot-7d" }, quality: "silver",
});
