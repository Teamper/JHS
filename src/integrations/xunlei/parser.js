// @ts-check

import { JhsError } from "../../core/jhs-error.js";

/** @param {any} payload */
export function parseXunleiSubtitles(payload) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) throw new JhsError("INVALID_RESPONSE", "迅雷字幕响应结构无效", { source: "xunlei" });
    return Object.freeze(payload.data.flatMap((/** @type {any} */ item) => {
        try {
            const url = new URL(String(item?.url ?? ""));
            if (url.protocol !== "https:") return [];
            const extension = String(item?.ext ?? "").toLowerCase().replace(/^\./, "");
            if (!extension) return [];
            return [Object.freeze({ name: String(item?.name ?? ""), extension, url: url.href, providerId: "xunlei" })];
        } catch { return []; }
    }));
}
