// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
import { CACHE, SERVICE } from "../../contracts/tokens.js";
import { parseFc2ContentImages } from "./parser.js";

/** @param {{request: (options: Record<string, any>, scope?: any) => Promise<any>}} http */
export function createFc2ContentAdapter(http) {
    return Object.freeze({
        contracts: ["Screenshot"],
        /** @param {{carNum: string}} movieRef */
        detailUrl(movieRef) {
            const id = String(movieRef.carNum || "").match(/^(?:FC2-)?(?:PPV-)?(\d+)$/i)?.[1];
            return id ? `https://adult.contents.fc2.com/article/${id}/` : null;
        },
        /** @param {{carNum: string}} movieRef @param {{scope?: any}} [options] */
        async getImages(movieRef, options = {}) {
            const id = String(movieRef.carNum || "").match(/^(?:FC2-)?(?:PPV-)?(\d+)$/i)?.[1];
            if (!id) return [];
            const url = `https://adult.contents.fc2.com/article/${id}/`;
            const response = await http.request({
                providerId: "fc2content", method: "GET", url, responseType: "text", cacheScope: "public", ttlMs: 604_800_000,
                headers: { referer: url }, urlPolicy: { trustClass: "builtin-public", hosts: ["adult.contents.fc2.com"] },
            }, options.scope);
            return parseFc2ContentImages(response.data, response.finalUrl || url);
        },
    });
}

export default defineIntegration({
    id: "fc2content", trustClass: "builtin-public", hosts: ["adult.contents.fc2.com"], capabilities: ["movie.images"], requires: [SERVICE.http],
    createClient: (/** @type {any} */ dependencies) => Object.freeze({ http: dependencies[SERVICE.http] }),
    createAdapter: (/** @type {any} */ client) => createFc2ContentAdapter(client.http), createHostAdapter: null,
    cachePolicy: { "movie.images": CACHE.externalDetail }, quality: "silver",
});
