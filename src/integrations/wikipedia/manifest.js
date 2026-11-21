// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { isNotFoundError } from "../../core/jhs-error.js";
import { parseWikipediaActressPage } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createWikipediaAdapter(http) {
    const requestPage = (/** @type {string} */ url, /** @type {any} */ scope) => http.request({
        providerId: "wikipedia", capability: "person.actress-info", method: "GET", url, responseType: "text", timeout: 15_000,
        urlPolicy: { trustClass: "builtin-public", hosts: ["ja.wikipedia.org"] },
    }, scope);

    return Object.freeze({
        contracts: ["ActressInfo"],
        /** @param {string} name */
        profileUrl(name) { return new URL(`/wiki/${encodeURIComponent(String(name))}`, "https://ja.wikipedia.org").href; },
        /** @param {string} name @param {{scope?: any}} [options] */
        async lookup(name, options = {}) {
            const requestedName = String(name ?? "").trim();
            if (!requestedName) return null;
            const url = this.profileUrl(requestedName);
            const response = await requestPage(url, options.scope);
            const finalUrl = response.finalUrl || url;
            const parsed = parseWikipediaActressPage(response.data, finalUrl, requestedName);
            if (parsed.info) return parsed.info;
            const decodedFinalUrl = (() => {
                try { return decodeURIComponent(finalUrl); } catch { return finalUrl; }
            })();
            if (requestedName.includes("_(AV女優)") || decodedFinalUrl.includes("_(AV女優)")) return null;
            for (const disambigUrl of parsed.disambigUrls) {
                try {
                    const candidate = await requestPage(disambigUrl, options.scope);
                    const candidateParsed = parseWikipediaActressPage(candidate.data, candidate.finalUrl || disambigUrl, requestedName);
                    if (candidateParsed.info) return candidateParsed.info;
                } catch (error) {
                    if (isNotFoundError(error)) continue;
                    throw error;
                }
            }
            return null;
        },
    });
}

export default defineIntegration({
    id: "wikipedia", trustClass: "builtin-public", hosts: ["ja.wikipedia.org"], capabilities: ["person.actress-info"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createWikipediaAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "person.actress-info": "none" }, quality: "silver",
});
