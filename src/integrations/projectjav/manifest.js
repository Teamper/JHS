// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { parseProjectJavImages, parseProjectJavSearch } from "./parser.js";

/** @param {any} http */
export function createProjectJavAdapter(http) {
    /** @param {string} url @param {any} options @param {(response: any) => boolean} cacheAccept */
    const request = (url, options, cacheAccept) => http.request({ providerId: "projectjav", capability: "movie.images", method: "GET", url, responseType: "text", cacheAccept, refreshCache: options.refreshCache === true, urlPolicy: { trustClass: "builtin-public", hosts: ["projectjav.com"] } }, options.scope);
    return Object.freeze({
        contracts: ["Screenshot"],
        /** @param {{carNum?: string}} movie */
        getSearchUrl(movie) { return `https://projectjav.com/?searchTerm=${encodeURIComponent(movie.carNum || "")}`; },
        /** @param {{carNum: string}} movie @param {any} [options] */
        async getImages(movie, options = {}) {
            const searchUrl = this.getSearchUrl(movie), response = await request(searchUrl, options, response => parseProjectJavSearch(response.data, movie.carNum, response.finalUrl || searchUrl).length > 0);
            for (const candidate of parseProjectJavSearch(response.data, movie.carNum, response.finalUrl || searchUrl).slice(0, 5)) {
                options.scope?.assertActive();
                const detail = await request(candidate, options, response => parseProjectJavImages(response.data, movie.carNum, response.finalUrl || candidate).length > 0);
                const images = parseProjectJavImages(detail.data, movie.carNum, detail.finalUrl || candidate);
                if (images.length) return images;
            }
            return [];
        },
    });
}

export default defineIntegration({
    id: "projectjav", trustClass: "builtin-public", hosts: ["projectjav.com"], capabilities: ["movie.images"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ deps) => ({ http: deps[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createProjectJavAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.images": "screenshot-7d" }, quality: "silver",
});
