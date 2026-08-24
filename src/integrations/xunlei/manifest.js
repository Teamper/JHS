// @ts-check

import { defineIntegration } from "../../contracts/manifests.js";
import { SERVICE } from "../../contracts/tokens.js";
import { parseXunleiSubtitles } from "./parser.js";

const XUNLEI_HOSTS = ["xunlei.com"];

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createXunleiAdapter(http) {
    return Object.freeze({
        contracts: ["Subtitle"],
        /** @param {{carNum?: unknown}} movieRef @param {{scope?: any}} [options] */
        async search(movieRef, options = {}) {
            const carNum = String(movieRef.carNum ?? "").trim();
            if (!carNum) return [];
            const url = new URL("https://api-shoulei-ssl.xunlei.com/oracle/subtitle");
            url.searchParams.set("gcid", ""), url.searchParams.set("cid", ""), url.searchParams.set("name", carNum);
            const response = await http.request({
                providerId: "xunlei", method: "GET", url: url.href, responseType: "json", cacheScope: "public", ttlMs: 86_400_000,
                urlPolicy: { trustClass: "builtin-public", hosts: XUNLEI_HOSTS },
            }, options.scope);
            return parseXunleiSubtitles(response.data);
        },
        /** @param {{url?: unknown}} subtitle @param {{scope?: any}} [options] */
        async download(subtitle, options = {}) {
            const url = new URL(String(subtitle.url ?? ""));
            const response = await http.request({
                providerId: "xunlei", method: "GET", url: url.href, responseType: "text", cacheScope: "public", ttlMs: 86_400_000,
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
    cachePolicy: { "subtitle.search": "public-1d", "subtitle.download": "public-1d" }, quality: "silver",
});
