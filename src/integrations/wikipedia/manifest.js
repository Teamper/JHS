// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseWikipediaActressInfo } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createWikipediaAdapter(http) {
    return Object.freeze({
        contracts: ["ActressInfo"],
        /** @param {string} name */
        profileUrl(name) { return new URL(`/wiki/${encodeURIComponent(String(name))}`, "https://ja.wikipedia.org").href; },
        /** @param {string} name @param {{scope?: any}} [options] */
        async lookup(name, options = {}) {
            const url = this.profileUrl(name);
            const response = await http.request({
                providerId: "wikipedia", method: "GET", url, responseType: "text", cacheScope: "public", ttlMs: 604_800_000,
                urlPolicy: { trustClass: "builtin-public", hosts: ["ja.wikipedia.org"] },
            }, options.scope);
            try {
                return parseWikipediaActressInfo(response.data, response.finalUrl || url);
            } catch (error) {
                if (error instanceof TypeError && /actress information is missing/.test(error.message)) return null;
                throw error;
            }
        },
    });
}

export default defineIntegration({
    id: "wikipedia", trustClass: "builtin-public", hosts: ["ja.wikipedia.org"], capabilities: ["person.actress-info"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createWikipediaAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "person.actress-info": CACHE.externalDetail }, quality: "silver",
});
