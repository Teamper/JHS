// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { parseJavBusMovieDetail } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createJavBusAdapter(http) {
    return Object.freeze({
        contracts: ["MovieDetail", "Screenshot"],
        /** @param {{carNum: string, url?: string}} movieRef @param {{scope?: any}} [options] */
        async getDetail(movieRef, options = {}) {
            const carNum = normalizeMovieCarNum(movieRef.carNum);
            if (!carNum) throw new TypeError("JavBus movie reference is invalid");
            const url = new URL(movieRef.url || `https://www.javbus.com/${encodeURIComponent(carNum)}`).href;
            const response = await http.request({
                providerId: "javbus", capability: "movie.detail", method: "GET", url, responseType: "text",
                urlPolicy: { trustClass: "builtin-public", hosts: ["javbus.com"] },
            }, options.scope);
            return parseJavBusMovieDetail(response.data, response.finalUrl || url);
        },
        /** @param {{carNum: string, url?: string}} movieRef @param {{scope?: any}} [options] */
        async getImages(movieRef, options = {}) {
            const detail = await this.getDetail(movieRef, options);
            return detail.coverUrl ? [Object.freeze({ url: detail.coverUrl, providerId: "javbus" })] : [];
        },
    });
}

export default defineIntegration({
    id: "javbus", trustClass: "builtin-public", hosts: ["javbus.com"],
    capabilities: ["movie.detail", "movie.images"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createJavBusAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.detail": CACHE.externalDetail, "movie.images": CACHE.externalDetail }, quality: "silver",
});
