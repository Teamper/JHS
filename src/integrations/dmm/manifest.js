// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseDmmItemCandidates, parseDmmPlayerSources, parseDmmPreview } from "./parser.js";

const DMM_HOSTS = ["dmm.co.jp", "dmm.com"];

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createDmmAdapter(http) {
    return Object.freeze({
        contracts: ["MoviePreview"],
        /** @param {{carNum?: unknown}} movieRef */
        searchUrl(movieRef) { return `https://www.dmm.co.jp/search/=/searchstr=${encodeURIComponent(String(movieRef.carNum ?? ""))}`; },
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
        /** @param {{carNum: string}} movieRef @param {{scope?: any}} [options] */
        async getPreviewForMovie(movieRef, options = {}) {
            const carNum = String(movieRef.carNum), compact = carNum.replace(/-/g, ""), keywords = [carNum.replace("-", "00"), carNum, compact];
            const searchUrl = this.searchUrl(movieRef);
            let candidates = [], lastError = null, hadSuccessfulRequest = false;
            for (const keyword of keywords) {
                const url = `https://api.dmm.com/affiliate/v3/ItemList?${new URLSearchParams({
                    api_id: "UrwskPfkqQ0DuVry2gYL", affiliate_id: "10278-996", output: "json", site: "FANZA", sort: "match", keyword,
                })}`;
                try {
                    const response = await http.request({
                        providerId: "dmm", method: "GET", url, responseType: "json", cacheScope: "public", ttlMs: 604_800_000,
                        urlPolicy: { trustClass: "builtin-public", hosts: DMM_HOSTS },
                    }, options.scope);
                    candidates = parseDmmItemCandidates(response.data, carNum, keyword);
                    hadSuccessfulRequest = true;
                    if (candidates.length) break;
                } catch (error) { lastError = error; }
            }
            if (!candidates.length) {
                if (!hadSuccessfulRequest && lastError) throw lastError;
                return Object.freeze({ sources: null, pageUrl: searchUrl, searchUrl, matchType: "none" });
            }
            const tasks = candidates.map(async (/** @type {any} */ candidate) => {
                const url = `https://www.dmm.co.jp/service/digitalapi/-/html5_player/=/cid=${encodeURIComponent(candidate.contentId)}/mtype=AhRVShI_/service=${encodeURIComponent(candidate.serviceCode)}/floor=${encodeURIComponent(candidate.floorCode)}/mode=/`;
                const response = await http.request({
                    providerId: "dmm", method: "GET", url, responseType: "text", cacheScope: "public", ttlMs: 604_800_000,
                    headers: { "accept-language": "ja-JP,ja;q=0.9", Cookie: "age_check_done=1" },
                    urlPolicy: { trustClass: "builtin-public", hosts: DMM_HOSTS },
                }, options.scope);
                return parseDmmPlayerSources(response.data, response.finalUrl || url);
            });
            let sources;
            try { sources = await Promise.any(tasks); }
            catch (error) {
                const errors = error instanceof AggregateError ? error.errors : [error];
                throw errors.find((item) => item?.code === "REGION_BLOCKED") ?? errors[0] ?? error;
            }
            return Object.freeze({
                sources, pageUrl: candidates.length > 1 ? searchUrl : candidates[0].pageUrl,
                searchUrl, matchType: candidates.length > 1 ? "multiple" : "single",
            });
        },
    });
}

export default defineIntegration({
    id: "dmm", trustClass: "builtin-public", hosts: DMM_HOSTS, capabilities: ["movie.preview"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createDmmAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.preview": CACHE.externalDetail }, quality: "silver",
});
