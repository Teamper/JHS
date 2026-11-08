// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { parseXunleiSubtitles } from "./parser.js";
import { SUBTITLE_MAX_BYTES } from "../../core/subtitle-asset.js";

const XUNLEI_HOSTS = ["xunlei.com"];

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createXunleiAdapter(http) {
    return Object.freeze({
        contracts: ["Subtitle"],
        /** @param {{url?: unknown}} subtitle @param {{scope?: any}} [options] */
        async downloadAsset(subtitle, options = {}) {
            const url = new URL(String(subtitle.url || ""));
            if (url.username || url.password) throw new TypeError("字幕地址包含身份信息");
            return http.request({ providerId: "xunlei", capability: "subtitle.download", method: "GET", url: url.href, responseType: "arraybuffer", maxResponseBytes: SUBTITLE_MAX_BYTES, urlPolicy: { trustClass: "custom-public" } }, options.scope);
        },
        /** @param {{carNum?: unknown}} movieRef @param {{scope?: any, refreshCache?: boolean}} [options] */
        async search(movieRef, options = {}) {
            const carNum = String(movieRef.carNum ?? "").trim();
            if (!carNum) return [];
            const url = new URL("https://api-shoulei-ssl.xunlei.com/oracle/subtitle");
            url.searchParams.set("gcid", ""), url.searchParams.set("cid", ""), url.searchParams.set("name", carNum);
            const response = await http.request({
                providerId: "xunlei", capability: "subtitle.search", method: "GET", url: url.href, responseType: "json",
                refreshCache: options.refreshCache === true,
                cacheAccept: (/** @type {any} */ response) => { try { parseXunleiSubtitles(response.data); return true; } catch { return false; } },
                urlPolicy: { trustClass: "builtin-public", hosts: XUNLEI_HOSTS },
            }, options.scope);
            return parseXunleiSubtitles(response.data);
        },
        /** @param {{url?: unknown}} subtitle @param {{scope?: any}} [options] */
        async download(subtitle, options = {}) {
            const url = new URL(String(subtitle.url ?? ""));
            const response = await http.request({
                providerId: "xunlei", capability: "subtitle.download", method: "GET", url: url.href, responseType: "text",
                urlPolicy: { trustClass: "custom-public" },
            }, options.scope);
            if (typeof response.data !== "string") throw new TypeError("迅雷字幕正文不是文本");
            return response.data;
        },
    });
}

export default defineIntegration({
    id: "xunlei", trustClass: "builtin-public", hosts: XUNLEI_HOSTS, capabilities: ["subtitle.search", "subtitle.download"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createXunleiAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "subtitle.search": "public-1d", "subtitle.download": "none" }, quality: "silver",
});
