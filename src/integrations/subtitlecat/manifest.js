// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { SUBTITLE_MAX_BYTES } from "../../core/subtitle-asset.js";
import { parseSubtitleCatDownloads, parseSubtitleCatSearch } from "./parser.js";
const policy = { trustClass: "builtin-public", hosts: ["subtitlecat.com"] };
/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} [http] */
export function createSubtitleCatAdapter(http) {
    return Object.freeze({
        contracts: ["Subtitle"],
        /** @param {{carNum?: unknown}} movieRef @param {{scope?: any, refreshCache?: boolean}} [options] */
        async search(movieRef, options = {}) {
            if (!http) throw new TypeError("字幕请求服务不可用");
            const carNum = String(movieRef.carNum || "").trim();
            if (!carNum) return [];
            const base = `https://www.subtitlecat.com/index.php?search=${encodeURIComponent(carNum)}`;
            const search = await http.request({ providerId: "subtitlecat", capability: "subtitle.search", url: base, responseType: "text", urlPolicy: policy, refreshCache: options.refreshCache === true,
                cacheAccept: (/** @type {any} */ response) => { try { return parseSubtitleCatSearch(response.data, response.finalUrl || base, carNum).length > 0; } catch { return false; } },
            }, options.scope);
            const candidates = parseSubtitleCatSearch(search.data, search.finalUrl || base, carNum);
            const results = [];
            for (const candidate of candidates) {
                options.scope?.assertActive();
                const detail = await http.request({ providerId: "subtitlecat", capability: "subtitle.search", url: candidate.url, responseType: "text", urlPolicy: policy, refreshCache: options.refreshCache === true,
                    cacheAccept: (/** @type {any} */ response) => { try { return parseSubtitleCatDownloads(response.data, response.finalUrl || candidate.url, carNum, candidate.name).length > 0; } catch { return false; } },
                }, options.scope);
                results.push(...parseSubtitleCatDownloads(detail.data, detail.finalUrl || candidate.url, carNum, candidate.name));
            }
            return results;
        },
        /** @param {{url?: unknown}} subtitle @param {{scope?: any}} [options] */
        async downloadAsset(subtitle, options = {}) {
            if (!http) throw new TypeError("字幕请求服务不可用");
            return http.request({ providerId: "subtitlecat", capability: "subtitle.download", url: String(subtitle.url || ""), responseType: "arraybuffer", maxResponseBytes: SUBTITLE_MAX_BYTES, urlPolicy: policy }, options.scope);
        },
        /** @param {{url?: unknown}} subtitle @param {{scope?: any}} [options] */
        async download(subtitle, options = {}) {
            if (!http) throw new TypeError("字幕请求服务不可用");
            const result = await http.request({ providerId: "subtitlecat", capability: "subtitle.download", url: String(subtitle.url || ""), responseType: "text", urlPolicy: policy }, options.scope);
            return result.data;
        },
        /** @param {{carNum?: unknown}} movieRef */
        detailUrl(movieRef) {
            const carNum = String(movieRef?.carNum || "").trim();
            if (!carNum) return null;
            const url = new URL("/index.php", "https://subtitlecat.com");
            url.searchParams.set("search", carNum);
            return url.href;
        },
    });
}
export default defineIntegration({
    id: "subtitlecat", trustClass: "builtin-public", hosts: ["subtitlecat.com"], capabilities: ["subtitle.search", "subtitle.download"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ deps) => ({ http: deps[SERVICE.http] }), createAdapter: (/** @type {any} */ client) => createSubtitleCatAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "subtitle.search": "public-1d", "subtitle.download": "none" }, quality: "silver",
});
