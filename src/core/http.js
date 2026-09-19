// @ts-check

/** @typedef {Record<string, any>} LegacyHttpRecord */

export class GmHttp {
    /** @param {{utils: any, storageManager: any}} dependencies */
    constructor({ utils, storageManager }) {
        this.utils = utils;
        this.storageManager = storageManager;
        /** @type {Map<string, LegacyHttpRecord>} */
        this._circuitBreakers = new Map();
        /** @type {Map<string, LegacyHttpRecord>} */
        this._domainStats = new Map();
    }
    /** @param {string} e */
    _getDomain(e) {
        try { return new URL(e).hostname; } catch { return "unknown"; }
    }
    /** @param {unknown} e @param {number} [status] */
    _isCloudflareChallenge(e, status = 0) {
        if ("string" != typeof e || !e) return !1;
        const text = e.toLowerCase();
        const hasChallengeTitle = /<title[^>]*>\s*just a moment(?:\.\.\.)?\s*<\/title>/i.test(e);
        const hasChallengeForm = /id=["']challenge-form["']/i.test(e);
        const hasCfChl = text.includes("cf-chl-") || text.includes("cf_chl_opt");
        const hasChallengePlatform = text.includes("/cdn-cgi/challenge-platform/") || text.includes("challenge-platform");
        const blockedStatus = 403 === status || 429 === status || 503 === status;
        return hasChallengeTitle || hasChallengeForm && (hasCfChl || hasChallengePlatform) || blockedStatus && hasCfChl && hasChallengePlatform;
    }
    /** @param {string} e */
    _checkCircuitBreaker(e) {
        const t = this._circuitBreakers.get(e);
        if (!t) return null;
        if ("open" === t.state) {
            const n = Date.now() - t.openTime;
            return n < t.cooldownMs ? { state: "open", remaining: Math.ceil((t.cooldownMs - n) / 1e3) } : (t.state = "half-open", t.failCount = 0, t.probing = !1, null);
        }
        if ("half-open" === t.state && t.probing) return { state: "half-open", remaining: 0 };
        return null;
    }
    /** @param {string} e */
    isDomainCircuitBroken(e) {
        return this._checkCircuitBreaker(this._getDomain(e));
    }
    /* domainStats.count 统计请求数（含重试），非独立请求数 */
    /** @param {string} e */
    _recordSuccess(e) {
        let t = this._circuitBreakers.get(e);
        t && (t.state = "closed", t.failCount = 0, t.probing = !1);
        let n = this._domainStats.get(e);
        n || (n = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e, n)), n.count++, n.lastUsed = Date.now();
    }
    /** @param {string} e @param {{affectsBreaker?: boolean}} [options] */
    _recordFailure(e, { affectsBreaker = true } = {}) {
        let t = this._circuitBreakers.get(e);
        t && affectsBreaker && (t.failCount++, ("half-open" === t.state || t.failCount >= (t.threshold || 3)) && (t.state = "open", t.openTime = Date.now(), t.probing = !1,
        clog.warn(`[熔断] ${e} 连续失败 ${t.failCount} 次，已熔断 ${t.cooldownMs / 1e3} 秒`)));
        let n = this._domainStats.get(e);
        n || (n = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e, n)), n.count++, n.errors++, n.lastUsed = Date.now();
    }
    getCircuitBreakerStatus() {
        /** @type {Record<string, LegacyHttpRecord>} */
        const e = {};
        return this._circuitBreakers.forEach(((t, n) => {
            e[n] = { ...t };
        })), e;
    }
    /** @param {string} e */
    resetCircuitBreaker(e) {
        this._circuitBreakers.delete(e);
    }
    resetAllCircuitBreakers() {
        this._circuitBreakers.clear();
    }
    getDomainStats() {
        /** @type {Record<string, LegacyHttpRecord>} */
        const e = {};
        return this._domainStats.forEach(((t, n) => {
            e[n] = { ...t };
        })), e;
    }
    clearDomainStats() {
        this._domainStats.clear();
    }
    /** @param {string} e @param {LegacyHttpRecord} [t] @param {LegacyHttpRecord} [n] @param {any} [a] @param {LegacyHttpRecord} [i] */
    async get(e, t = {}, n = {}, a, i = {}) {
        return this.gmRequest("GET", e, null, t, n, a, i);
    }
    /** @param {string} e @param {LegacyHttpRecord} [t] @param {LegacyHttpRecord} [n] */
    post(e, t = {}, n = {}) {
        n = {
            "Content-Type": "application/json",
            ...n
        };
        let a = JSON.stringify(t);
        return this.gmRequest("POST", e, a, null, n);
    }
    /** @param {string} e @param {string} t @param {any} [n] @param {LegacyHttpRecord | null} [a] @param {LegacyHttpRecord} [i] @param {boolean} [s] @param {LegacyHttpRecord} [requestOptions] */
    async gmRequest(e, t, n = {}, a = {}, i = {}, s = !1, requestOptions = {}) {
        if (a && Object.keys(a).length) {
            const e = new URLSearchParams(a).toString();
            t += (t.includes("?") ? "&" : "?") + e;
        }
        const o = this._getDomain(t), [m, r, b, k] = await Promise.all([this.storageManager.getSetting("httpTimeout", 5e3), this.storageManager.getSetting("httpRetryCount", 3), this.storageManager.getSetting("circuitBreakerThreshold", 3), this.storageManager.getSetting("circuitBreakerCooldown", 6e4)]);
        let u = this._circuitBreakers.get(o);
        u || (u = { state: "closed", failCount: 0, openTime: 0, cooldownMs: k, threshold: b, probing: !1 }, this._circuitBreakers.set(o, u));
        /* 阈值/冷却时间随设置实时生效，且设置值异常时兜底 */
        u.threshold = Math.max(1, Number(b) || 3), u.cooldownMs = Math.max(1e3, Number(k) || 6e4);
        const w = this._checkCircuitBreaker(o);
        if (w) {
            const e = /** @type {Error & LegacyHttpRecord} */ (new Error(`站点 ${o} 已熔断，${w.remaining}秒后重试`));
            throw e._circuitBroken = !0, e;
        }
        /* 熔断计数按“逻辑请求”计：一次请求的重试链最多累计一次，且 4xx 业务性失败不计入熔断 */
        let E = !1;
        const recordBreakerFailure = (/** @type {boolean} */ affectsBreaker) => {
            affectsBreaker && !E ? (E = !0, this._recordFailure(o, { affectsBreaker: !0 })) : this._recordFailure(o, { affectsBreaker: !1 });
        };
        return n || (n = void 0), await this.utils.retry(() => {
            const c = this._checkCircuitBreaker(o);
            if (c) {
                const t = /** @type {Error & LegacyHttpRecord} */ (new Error(`站点 ${o} 已熔断，${c.remaining}秒后重试`));
                return t._circuitBroken = !0, Promise.reject(t);
            }
            "half-open" === u.state && (u.probing = !0);
            return new Promise((/** @type {(value: any) => void} */ a, /** @type {(reason?: any) => void} */ r) => {
            (/** @type {any} */ (globalThis)).GM_xmlhttpRequest({
                method: e,
                url: t,
                headers: i,
                timeout: m,
                data: n,
                ...(requestOptions.cookiePartitionTopLevelSite ? {
                    cookiePartition: { topLevelSite: requestOptions.cookiePartitionTopLevelSite }
                } : {}),
                onload: (/** @type {LegacyHttpRecord} */ e) => {
                    try {
                        if (404 === e.status && requestOptions.ignoreNotFound) return void a(null);
                        if (this._isCloudflareChallenge(e.responseText, e.status)) {
                            recordBreakerFailure(!0);
                            const n = /** @type {Error & LegacyHttpRecord} */ (new Error(`Cloudflare challenge blocked: ${t}`));
                            return n._cfBlocked = !0, n.status = e.status, n.requestUrl = t, n.finalUrl = e.finalUrl,
                            n.cfDiagnostics = { status: e.status, requestUrl: t, finalUrl: e.finalUrl, contentLength: e.responseText?.length || 0 }, void r(n);
                        }
                        if (s && e.finalUrl !== t && r("请求被重定向了,URL是:" + e.finalUrl), e.status >= 200 && e.status < 300) {
                            this._recordSuccess(o);
                            if (e.responseText) try {
                                a(JSON.parse(e.responseText));
                            } catch (n) {
                                a(e.responseText);
                            } else a(e.responseText || e);
                        } else {
                            clog.error("请求失败,状态码:", e.status, t), recordBreakerFailure(e.status >= 500);
                            if (e.responseText) {
                                try {
                                    const t = JSON.parse(e.responseText);
                                    t.status = e.status, r(t);
                                } catch {
                                    const t = /** @type {Error & LegacyHttpRecord} */ (new Error(e.responseText || `请求发生错误 ${e.status}`));
                                    t.status = e.status, r(t);
                                }
                            } else {
                                const t = /** @type {Error & LegacyHttpRecord} */ (new Error(`请求发生错误 ${e.status}`));
                                t.status = e.status, r(t);
                            }
                        }
                    } catch (n) {
                        recordBreakerFailure(!0), r(n);
                    }
                },
                onerror: (/** @type {LegacyHttpRecord} */ e) => {
                    clog.error("网络错误:", t), recordBreakerFailure(!0), r(new Error(e.error || "网络错误"));
                },
                ontimeout: () => {
                    recordBreakerFailure(!0), r(new Error("请求超时: " + t));
                }
            });
        });
        }, r);
    }
}
