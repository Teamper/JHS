// @ts-check

import { ProviderError } from "../core/cache-policy.js";
import { L, normalizeCarNum } from "../core/constants.js";

/**
 * 预览视频唯一策略源：JavDB / JavBus / 列表卡片共用同一 DMM 解析与开关语义。
 *
 * - enablePreviewVideo: 预览视频总开关（OFF 时任何入口、播放器、DMM 请求都不存在）
 * - enableLoadPreviewVideo: DMM 高画质增强子开关（OFF 时仍允许宿主原生预览，但不发起 DMM 请求）
 */

/** @param {string[]} e @param {string | undefined} t @returns {string | null} */
export const Z = (e, t) => {
    if (!e || 0 === e.length) return null;
    const n = new Set(e);
    if (t && n.has(t)) return t;
    const a = L.map((e => e.quality)).reverse();
    for (const i of a) if (n.has(i)) return i;
    return e[0] || null;
}, ee = "jhs_dmm_video";

const DMM_CACHE_TTL = 30 * 864e5, DMM_CACHE_LIMIT = 500;

/** @param {string | null} raw 坏 JSON 返回空对象而不是让整个预览链路瘫痪 */
function parseJsonMap(raw) {
    if (!raw) return {};
    try {
        const value = JSON.parse(raw);
        return value && "object" == typeof value && !Array.isArray(value) ? value : {};
    } catch { return {}; }
}

/** @param {Record<string, any>} cache 裁掉过期与超量条目 */
function pruneDmmCache(cache) {
    const now = Date.now();
    for (const key of Object.keys(cache)) {
        const entry = cache[key];
        // 无时间戳的历史条目视为仍然有效，避免升级后缓存整体失效
        (!entry || (entry.time && now - entry.time > DMM_CACHE_TTL)) && delete cache[key];
    }
    const keys = Object.keys(cache);
    if (keys.length > DMM_CACHE_LIMIT) {
        keys.sort(((a, b) => (cache[a].time || 0) - (cache[b].time || 0)));
        for (const key of keys.slice(0, keys.length - DMM_CACHE_LIMIT)) delete cache[key];
    }
    return cache;
}

/** @param {Record<string, any>} settings */
export function isPreviewEnabled(settings) {
    return settings?.enablePreviewVideo !== "no";
}

/** @param {Record<string, any>} settings */
export function isDmmEnabled(settings) {
    return settings?.enableLoadPreviewVideo !== "no";
}

/** 预览总开关：任一预览入口可见的前提。 @param {Record<string, any>} settings */
export function canUsePreview(settings) {
    return isPreviewEnabled(settings);
}

/** 宿主原生预览：总开关 ON 即可（不依赖 DMM）。 @param {Record<string, any>} settings */
export function canUseNativePreview(settings) {
    return isPreviewEnabled(settings);
}

/** DMM 高画质能力：总开关与 DMM 子开关都开。 @param {Record<string, any>} settings */
export function canUseDmmPreview(settings) {
    return isPreviewEnabled(settings) && isDmmEnabled(settings);
}

/** 列表卡片 Preview 按钮：当前实现只有 DMM source，因此等价于 canUseDmmPreview。 @param {Record<string, any>} settings */
export function canUseCardPreview(settings) {
    return canUseDmmPreview(settings);
}

class DmmPreviewParser {
    /** @param {string | null} e @param {any} storage @param {any} movie @param {any} scope */
    constructor(e, storage, movie, scope) {
        /** @type {string} */
        this.carNum = e || "", this.storage = storage, this.movie = movie, this.scope = scope, this.lastError = null;
    }
    _checkCache() {
        const cached = pruneDmmCache(parseJsonMap(this.storage.getLocal(ee)));
        return cached[this.carNum] ? (clog.debug("缓存中存在预览视频信息", cached[this.carNum]), cached[this.carNum]) : null;
    }
    /** @param {Record<string, string>} e */
    _updateCache(e) {
        const cached = pruneDmmCache(parseJsonMap(this.storage.getLocal(ee)));
        cached[this.carNum] = { ...e, time: Date.now() }, clog.debug("成功解析出预览视频并已缓存:", e), this.storage.setLocal(ee, JSON.stringify(cached));
    }
    async _fetchRemote() {
        const result = await this.movie.preview("dmm", { carNum: this.carNum }, { scope: this.scope });
        const button = $("#fanzaBtn");
        if (!result.sources) {
            clog.warn("所有关键词尝试均未找到匹配的Content ID, 解析Dmm视频失败");
            button.attr("href", result.searchUrl).attr("title", "未查询到, 点击前往搜索页").css("backgroundColor", "var(--jhs-status-filter)");
            return null;
        }
        button.attr("href", result.pageUrl).css("backgroundColor", "var(--jhs-status-down)");
        if (result.matchType === "multiple") button.append('<span class="site-tag jhs-layout-294497f1">多结果</span>');
        const cacheKey = "jhs_other_site_dmm", cache = pruneDmmCache(parseJsonMap(this.storage.getLocal(cacheKey)));
        cache[this.carNum] = { type: result.matchType, url: result.pageUrl, time: Date.now() };
        this.storage.setLocal(cacheKey, JSON.stringify(cache));
        return result.sources;
    }
    async fetchVideo() {
        const carNum = normalizeCarNum(this.carNum);
        if (!carNum) return clog.warn("跳过 DMM 解析：番号不可用"), null;
        this.carNum = carNum;
        const e = this._checkCache();
        if (e) return e;
        try {
            const e = this.carNum.toLowerCase();
            if (e.startsWith("heyzo") || /^(n\d+|\d+(-\d+)*)$/.test(e) || /^n\d+$/.test(e)) return clog.debug("无码番号类型，取消 DMM 解析"), null;
            if (this.carNum.includes("VR-")) return clog.debug("VR 类型，取消 DMM 解析"), null;
            const sources = await this._fetchRemote();
            if (!sources) return null;
            return this._updateCache(sources), sources;
        } catch (n) {
            const error = /** @type {PreviewFailure} */ (n);
            this.lastError = n instanceof ProviderError ? n : new ProviderError("dmm", error?.code || "PARSE_ERROR", error?.message || String(n), {
                cause: n,
                retryable: error?.retryable === true
            }), clog.error("DMM API 搜索失败:", this.lastError);
            const e = $("#fanzaBtn");
            return e.attr("href", this.movie.searchUrl("dmm", { carNum: this.carNum })),
            e.attr("title", "未查询到, 点击前往搜索页"), e.css("backgroundColor", "var(--jhs-status-filter)"), null;
        }
    }
}

/** @typedef {{ code?: string, message?: string, retryable?: boolean }} PreviewFailure */
/** @typedef {{ sources: Record<string, string> | null, error: PreviewFailure | null }} PreviewResult */

/** 获取 DMM 预览源及可供界面判断的失败原因。 */
/** @param {string | null} carNum @param {any} storage @param {any} movie @param {any} scope @returns {Promise<PreviewResult>} */
export async function fetchDmmPreview(carNum, storage, movie, scope) {
    const parser = new DmmPreviewParser(carNum, storage, movie, scope), sources = await parser.fetchVideo();
    return {
        sources,
        error: parser.lastError
    };
}

/** DMM 子开关门禁：关闭时直接返回无源结果，不发起任何 DMM 请求。 */
/** @param {string | null} carNum @param {any} storage @param {any} movie @param {any} scope @param {Record<string, any>} settings @returns {Promise<PreviewResult>} */
export async function fetchDmmPreviewIfEnabled(carNum, storage, movie, scope, settings) {
    if (!isDmmEnabled(settings)) return { sources: null, error: null };
    return fetchDmmPreview(carNum, storage, movie, scope);
}
