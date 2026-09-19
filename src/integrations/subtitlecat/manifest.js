// @ts-check
import { defineIntegration } from "../../contracts/manifests.js";
export function createSubtitleCatAdapter() {
    return Object.freeze({
        contracts: ["Subtitle"],
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
export default defineIntegration({ id: "subtitlecat", trustClass: "builtin-public", hosts: ["subtitlecat.com"], capabilities: ["subtitle.search"], requires: [], createClient: () => Object.freeze({ id: "subtitlecat" }), createAdapter: () => createSubtitleCatAdapter(), createHostAdapter: null, cachePolicy: "none", quality: "bronze" });
