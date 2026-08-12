unsafeWindow.utils = window.utils = new Utils, unsafeWindow.gmHttp = window.gmHttp = new class {
    constructor() {
        this._circuitBreakers = new Map();
        this._domainStats = new Map();
    }
    _getDomain(e) {
        try { return new URL(e).hostname; } catch { return "unknown"; }
    }
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
    isDomainCircuitBroken(e) {
        return this._checkCircuitBreaker(this._getDomain(e));
    }
    /* domainStats.count 统计请求数（含重试），非独立请求数 */
    _recordSuccess(e) {
        let t = this._circuitBreakers.get(e);
        t && (t.state = "closed", t.failCount = 0, t.probing = !1);
        let n = this._domainStats.get(e);
        n || (n = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e, n)), n.count++, n.lastUsed = Date.now();
    }
    _recordFailure(e) {
        let t = this._circuitBreakers.get(e);
        t || (t = { state: "closed", failCount: 0, openTime: 0, cooldownMs: 6e4, threshold: 3 }, this._circuitBreakers.set(e, t)),
        t.failCount++, ("half-open" === t.state || t.failCount >= (t.threshold || 3)) && (t.state = "open", t.openTime = Date.now(), t.probing = !1,
        clog.warn(`[熔断] ${e} 连续失败 ${t.failCount} 次，已熔断 ${t.cooldownMs / 1e3} 秒`));
        let n = this._domainStats.get(e);
        n || (n = { count: 0, errors: 0, lastUsed: 0 }, this._domainStats.set(e, n)), n.count++, n.errors++, n.lastUsed = Date.now();
    }
    getCircuitBreakerStatus() {
        const e = {};
        return this._circuitBreakers.forEach(((t, n) => {
            e[n] = { ...t };
        })), e;
    }
    resetCircuitBreaker(e) {
        this._circuitBreakers.delete(e);
    }
    resetAllCircuitBreakers() {
        this._circuitBreakers.clear();
    }
    getDomainStats() {
        const e = {};
        return this._domainStats.forEach(((t, n) => {
            e[n] = { ...t };
        })), e;
    }
    clearDomainStats() {
        this._domainStats.clear();
    }
    async get(e, t = {}, n = {}, a, i = {}) {
        return this.gmRequest("GET", e, null, t, n, a, i);
    }
    post(e, t = {}, n = {}) {
        n = {
            "Content-Type": "application/json",
            ...n
        };
        let a = JSON.stringify(t);
        return this.gmRequest("POST", e, a, null, n);
    }
    async gmRequest(e, t, n = {}, a = {}, i = {}, s = !1, requestOptions = {}) {
        if (a && Object.keys(a).length) {
            const e = new URLSearchParams(a).toString();
            t += (t.includes("?") ? "&" : "?") + e;
        }
        const o = this._getDomain(t), [m, r, b, k] = await Promise.all([storageManager.getSetting("httpTimeout", 5e3), storageManager.getSetting("httpRetryCount", 3), storageManager.getSetting("circuitBreakerThreshold", 3), storageManager.getSetting("circuitBreakerCooldown", 6e4)]);
        let u = this._circuitBreakers.get(o);
        u || (u = { state: "closed", failCount: 0, openTime: 0, cooldownMs: k, threshold: b, probing: !1 }, this._circuitBreakers.set(o, u));
        const w = this._checkCircuitBreaker(o);
        if (w) {
            const e = new Error(`站点 ${o} 已熔断，${w.remaining}秒后重试`);
            throw e._circuitBroken = !0, e;
        }
        return n || (n = void 0), await utils.retry(() => {
            const c = this._checkCircuitBreaker(o);
            if (c) {
                const t = new Error(`站点 ${o} 已熔断，${c.remaining}秒后重试`);
                return t._circuitBroken = !0, Promise.reject(t);
            }
            "half-open" === u.state && (u.probing = !0);
            return new Promise(((a, r) => {
            GM_xmlhttpRequest({
                method: e,
                url: t,
                headers: i,
                timeout: m,
                data: n,
                ...(requestOptions.cookiePartitionTopLevelSite ? {
                    cookiePartition: { topLevelSite: requestOptions.cookiePartitionTopLevelSite }
                } : {}),
                onload: e => {
                    try {
                        if (404 === e.status && requestOptions.ignoreNotFound) return void a(null);
                        if (this._isCloudflareChallenge(e.responseText, e.status)) {
                            this._recordFailure(o);
                            const n = new Error(`Cloudflare challenge blocked: ${t}`);
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
                            clog.error("请求失败,状态码:", e.status, t), this._recordFailure(o);
                            if (e.responseText) {
                                try {
                                    const t = JSON.parse(e.responseText);
                                    t.status = e.status, r(t);
                                } catch {
                                    const t = new Error(e.responseText || `请求发生错误 ${e.status}`);
                                    t.status = e.status, r(t);
                                }
                            } else {
                                const t = new Error(`请求发生错误 ${e.status}`);
                                t.status = e.status, r(t);
                            }
                        }
                    } catch (n) {
                        this._recordFailure(o), r(n);
                    }
                },
                onerror: e => {
                    clog.error("网络错误:", t), this._recordFailure(o), r(new Error(e.error || "网络错误"));
                },
                ontimeout: () => {
                    this._recordFailure(o), r(new Error("请求超时: " + t));
                }
            });
        }));
        }, r);
    }
}, unsafeWindow.storageManager = window.storageManager = new StorageManager;
