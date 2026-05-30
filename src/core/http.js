unsafeWindow.utils = window.utils = new J, unsafeWindow.gmHttp = window.gmHttp = new class {
    constructor() {
        this._circuitBreakers = new Map();
        this._domainStats = new Map();
    }
    _getDomain(e) {
        try { return new URL(e).hostname; } catch { return "unknown"; }
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
        t.failCount++, t.failCount >= (t.threshold || 3) && (t.state = "open", t.openTime = Date.now(),
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
    getUsedDomains() {
        return [...this._domainStats.keys()];
    }
    async get(e, t = {}, n = {}, a) {
        return this.gmRequest("GET", e, null, t, n, a);
    }
    post(e, t = {}, n = {}) {
        n = {
            "Content-Type": "application/json",
            ...n
        };
        let a = JSON.stringify(t);
        return this.gmRequest("POST", e, a, null, n);
    }
    postForm(e, t = {}, n = {}) {
        n || (n = {}), n["Content-Type"] || (n["Content-Type"] = "application/x-www-form-urlencoded");
        let a = "";
        return t && Object.keys(t).length > 0 && (a = Object.entries(t).map((([e, t]) => `${e}=${encodeURIComponent(t)}`)).join("&")),
        this.gmRequest("POST", e, a, null, n);
    }
    postFileFormData(e, t = {}, n = {}) {
        n || (n = {});
        const a = `----WebKitFormBoundary${Math.random().toString(36).substring(2)}`;
        n["Content-Type"] = `multipart/form-data; boundary=${a}`;
        let i = "";
        return t && Object.keys(t).length > 0 && (i = Object.entries(t).map((([e, t]) => `--${a}\r\nContent-Disposition: form-data; name="${e}"\r\n\r\n${t}\r\n`)).join("")),
        i += `--${a}--`, this.gmRequest("POST", e, i, null, n);
    }
    /* 注意: 分块下载未使用 AbortController, 某块失败时其他飞行中的请求不会被取消 */
    async downloadFileInChunks(e, t = {}, n, a) {
        if (!n) throw new Error("请提供文件名 (filename) 用于保存。");
        const i = await storageManager.getSetting("httpTimeout", 5e3), s = await storageManager.getSetting("httpRetryCount", 3);
        let o, r;
        clog.log(`[${n}] 正在获取文件大小...`);
        try {
            const a = await utils.retry((() => new Promise(((n, a) => {
                GM_xmlhttpRequest({
                    method: "GET",
                    url: e,
                    headers: {
                        ...t,
                        Range: "bytes=0-0"
                    },
                    timeout: i,
                    onload: n,
                    onerror: e => a(new Error("网络错误：无法获取文件大小")),
                    ontimeout: () => a(new Error("超时：获取文件大小"))
                });
            }))), s);
            if (206 !== a.status && 200 !== a.status) throw new Error(`请求文件大小失败，状态码: ${a.status}`);
            {
                const e = a.responseHeaders.match(/content-range:\s*bytes\s*\d+-\d+\/(\d+)/i), t = a.responseHeaders.match(/content-type:\s*([^\s;]+)/i);
                if (e && e[1]) o = parseInt(e[1], 10); else {
                    if (!a.responseHeaders.match(/content-length:\s*(\d+)/i) || 200 !== a.status) throw new Error("无法从响应头中获取文件总大小，服务器可能不支持 Range 请求。");
                    {
                        const e = a.responseHeaders.match(/content-length:\s*(\d+)/i);
                        o = parseInt(e[1], 10), clog.warn(`[${n}] 服务器返回 200 状态码，可能不支持 Range 请求。将尝试完整下载。`);
                    }
                }
                t && t[1] && (r = t[1]), clog.log(`[${n}] 文件总大小：${(o / 1024 / 1024).toFixed(2)} MB, MIME 类型: ${r || "未知"}`);
            }
        } catch (u) {
            throw clog.error(`[${n}] 获取文件大小失败:`, u.message), u;
        }
        if (!o || o <= 0) throw new Error("获取到的文件大小无效或服务器拒绝提供大小信息。");
        const l = 1048576, c = Math.ceil(o / l), d = [], h = new Array(c);
        clog.log(`[${n}] 文件将被分为 ${c} 块进行下载 (每块约 1.00 MB)`);
        for (let f = 0; f < c; f++) {
            const a = f * l, r = `bytes=${a}-${Math.min(a + l - 1, o - 1)}`, g = await utils.retry((() => new Promise(((a, s) => {
                const o = {
                    ...t,
                    Range: r,
                    Accept: "application/octet-stream"
                };
                GM_xmlhttpRequest({
                    method: "GET",
                    url: e,
                    headers: o,
                    timeout: i,
                    responseType: "arraybuffer",
                    onload: e => {
                        206 === e.status || 200 === e.status ? e.response instanceof ArrayBuffer ? (h[f] = e.response,
                        clog.log(`[${n}] 成功下载第 ${f + 1}/${c} 块 (${r})`), a()) : s(new Error(`第 ${f + 1} 块响应不是 ArrayBuffer。`)) : s(new Error(`第 ${f + 1} 块请求失败，状态码: ${e.status}`));
                    },
                    onerror: e => s(new Error(`第 ${f + 1} 块网络错误: ${e.error}`)),
                    ontimeout: () => s(new Error(`第 ${f + 1} 块超时。`))
                });
            }))), s);
            d.push(g);
        }
        try {
            await Promise.all(d), clog.log(`[${n}] 所有分块下载完成，开始合并...`);
        } catch (u) {
            throw clog.error(`[${n}] 分块下载过程中发生错误:`, u.message), u;
        }
        const g = new Blob(h);
        g.size !== o && clog.warn(`[${n}] 警告：合并后的 Blob 大小 (${g.size}) 与预期文件大小 (${o}) 不匹配！`);
        const p = await g.text();
        let m;
        m = a ? a(p) : p, utils.download(m, n), clog.log(`[${n}] 文件合并完成，已触发浏览器下载。`);
    }
    async gmRequest(e, t, n = {}, a = {}, i = {}, s = !1) {
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
        "half-open" === u.state && (u.probing = !0);
        return n || (n = void 0), await utils.retry((() => new Promise(((a, r) => {
            GM_xmlhttpRequest({
                method: e,
                url: t,
                headers: i,
                timeout: m,
                data: n,
                onload: e => {
                    try {
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
        }))), r);
    }
}, unsafeWindow.storageManager = window.storageManager = new z;
