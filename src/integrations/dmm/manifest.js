// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseDmmPreview } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createDmmAdapter(http) {
    return Object.freeze({
        contracts: ["MoviePreview"],
        /** @param {{url: string}} movieRef @param {{scope?: any}} [options] */
        async getPreview(movieRef, options = {}) {
            const url = new URL(movieRef.url);
            const response = await http.request({
                providerId: "dmm", method: "GET", url: url.href, responseType: "text",
                cacheScope: "public", ttlMs: 604_800_000,
                urlPolicy: { trustClass: "builtin-public", hosts: ["dmm.co.jp"] },
            }, options.scope);
            return parseDmmPreview(response.data, response.finalUrl || url.href);
        },
    });
}

export default defineIntegration({
    id: "dmm", trustClass: "builtin-public", hosts: ["dmm.co.jp"], capabilities: ["movie.preview"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createDmmAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.preview": CACHE.externalDetail }, quality: "silver",
});
