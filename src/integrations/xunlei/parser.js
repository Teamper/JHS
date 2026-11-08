// @ts-check

import { JhsError } from "../../core/jhs-error.js";

/** @param {any} payload */
export function parseXunleiSubtitles(payload) {
    if (!payload || typeof payload !== "object" || !Array.isArray(payload.data)) throw new JhsError("INVALID_RESPONSE", "迅雷字幕响应结构无效", { source: "xunlei" });
    return Object.freeze(payload.data.flatMap((/** @type {any} */ item) => {
        try {
            const url = new URL(String(item?.url ?? ""));
            if (url.protocol !== "https:" || url.username || url.password) return [];
            const extension = String(item?.ext ?? "").toLowerCase().replace(/^\./, "");
            if (!extension) return [];
            const explicit = String(item.language || item.language_name || item.lan || "").trim();
            const name = String(item.name || "");
            const language = explicit || (/中文|中字|简体|繁体|\b(?:chs|cht|zh|chi|chinese)\b/i.test(name) ? "zh" : /英文|\b(?:eng|en|english)\b/i.test(name) ? "en" : /日文|\b(?:jpn|ja|japanese)\b/i.test(name) ? "ja" : "");
            return [Object.freeze({ name: String(item?.name ?? ""), extension, url: url.href, providerId: "xunlei", ...(language ? { language } : {}) })];
        } catch { return []; }
    }));
}
