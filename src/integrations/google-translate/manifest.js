// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseGoogleTranslation } from "./parser.js";

const ENDPOINT = "https://translate-pa.googleapis.com/v1/translate";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createGoogleTranslateAdapter(http) {
    return Object.freeze({
        contracts: ["Translation"],
        /** @param {string} text @param {{sourceLanguage?: string, targetLanguage?: string, scope?: any}} [options] */
        async translate(text, options = {}) {
            if (!String(text || "").trim()) throw new TypeError("Translation text cannot be empty");
            const url = new URL(ENDPOINT);
            url.search = new URLSearchParams({
                "params.client": "gtx",
                dataTypes: "TRANSLATION",
                key: "AIzaSyDLEeFI5OtFBwYBIoK_jj5m32rZK5CkCXA",
                "query.sourceLanguage": options.sourceLanguage ?? "ja",
                "query.targetLanguage": options.targetLanguage ?? "zh-CN",
                "query.text": text,
            }).toString();
            const response = await http.request({
                providerId: "google-translate", capability: "text.translate", method: "GET", url: url.href, responseType: "json",
                transport: "native-fetch", nativeTimeout: 1_500, timeout: 5_000,
                urlPolicy: { trustClass: "builtin-public", hosts: ["translate-pa.googleapis.com"] },
            }, options.scope);
            return parseGoogleTranslation(response.data);
        },
    });
}

export default defineIntegration({
    id: "google-translate", trustClass: "builtin-public", hosts: ["translate-pa.googleapis.com"],
    capabilities: ["text.translate"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createGoogleTranslateAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "text.translate": "none" }, quality: "silver",
});
