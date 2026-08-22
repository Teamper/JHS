class OneTwoThreeOfflinePlugin extends BasePlugin {
    constructor() {
        super(...arguments), this.tokenKey = "jhs_123pan_author_token", this.tokenMetaKey = "jhs_123pan_author_token_meta",
        this.syncTimer = null, this.syncFallbackMs = 3e5;
    }
    getName() {
        return "OneTwoThreeOfflinePlugin";
    }
    async handle() {
        "yun.123pan.com" === window.location.hostname && this.startTokenSync();
    }
    startTokenSync() {
        this.syncTokenOnce(), this.syncTimer && clearInterval(this.syncTimer), this.syncTimer = setInterval((() => this.syncTokenOnce()), this.syncFallbackMs);
        const e = () => this.syncTokenOnce();
        window.addEventListener("storage", e), window.addEventListener("focus", e), document.addEventListener("visibilitychange", (() => {
            document.hidden || this.syncTokenOnce();
        }));
    }
    getTokenFrom123Pan() {
        let e = (localStorage.getItem("authorToken") || "").trim();
        if (e) return {
            token: e,
            source: "authorToken"
        };
        try {
            const t = JSON.parse(localStorage.getItem("userInfo") || "{}");
            if (t.authorToken || t.token) return {
                token: (t.authorToken || t.token || "").trim(),
                source: t.authorToken ? "userInfo.authorToken" : "userInfo.token"
            };
        } catch (t) { clog.debug("123 云盘历史用户信息解析失败，继续尝试其他凭证来源", t); }
        const t = document.cookie.split(";");
        for (const n of t) {
            const e = n.indexOf("=");
            if (e < 0) continue;
            const t = n.substring(0, e).trim(), a = n.substring(e + 1);
            if (t && /token/i.test(t) && a) return {
                token: decodeURIComponent(a).trim(),
                source: `cookie.${t}`
            };
        }
        return {
            token: "",
            source: ""
        };
    }
    syncTokenOnce() {
        const e = this.getTokenFrom123Pan();
        if (!e.token) return;
        const t = GM_getValue(this.tokenKey, ""), n = GM_getValue(this.tokenMetaKey, null);
        if (t === e.token && n && n.source === e.source) return;
        GM_setValue(this.tokenKey, e.token), GM_setValue(this.tokenMetaKey, {
            source: e.source,
            updatedAt: (new Date).toISOString()
        }), t !== e.token && show.info(`123 云盘授权已更新：${e.source}`);
    }
    getStoredToken() {
        return GM_getValue(this.tokenKey, "");
    }
    clearStoredToken(e) {
        GM_setValue(this.tokenKey, ""), GM_setValue(this.tokenMetaKey, {
            source: "cleared",
            reason: e,
            updatedAt: (new Date).toISOString()
        });
    }
    isTokenExpiredError(e) {
        const msg = e instanceof Error ? e.message : "object" == typeof e && e ? e.message || "" : String(e || "");
        return "TOKEN_EXPIRED" === e || "TOKEN_EXPIRED" === msg || msg.toLowerCase().includes("token is expired");
    }
    assertApiResult(e, t) {
        if (0 === e.code) return;
        const n = e.message || e.msg || t || "请求失败";
        throw /token is expired/i.test(n) ? "TOKEN_EXPIRED" : n;
    }
    /* 依赖 gmRequest 在非 2xx 时 reject 对象上附加 status 属性 */
    async resolveMagnet(e, t) {
        try {
            const n = await gmHttp.post(this._signUrl("https://yun.123pan.com/b/api/v2/offline_download/task/resolve"), { urls: e }, {
                Authorization: "Bearer " + t,
                "App-Version": "3",
                platform: "web",
                Origin: "https://yun.123pan.com",
                Referer: "https://yun.123pan.com/"
            });
            return this.assertApiResult(n, "解析失败"), n.data && n.data.list && n.data.list.length > 0 ? n.data.list[0] : Promise.reject(n.message || `解析失败 (${n.code})`);
        } catch (a) {
            if (a && 401 === a.status) throw "TOKEN_EXPIRED";
            throw this.isTokenExpiredError(a) ? "TOKEN_EXPIRED" : a.message ? "响应解析失败: " + a.message : String(a);
        }
    }
    async submitTask(e, t) {
        if (!e.files || 0 === e.files.length) throw "没有可建立离线的文件";
        const n = e.files.map((e => e.id)), a = e.files.reduce(((e, t) => e + (t.size || 0)), 0);
        try {
            const i = await gmHttp.post(this._signUrl("https://yun.123pan.com/b/api/v2/offline_download/task/submit"), {
                resource_list: [{ resource_id: e.id, select_file_id: n }]
            }, {
                Authorization: "Bearer " + t,
                "App-Version": "3",
                platform: "web"
            });
            return this.assertApiResult(i, "提交失败"), { fileCount: n.length, totalSize: a };
        } catch (i) {
            if (i && 401 === i.status) throw "TOKEN_EXPIRED";
            throw this.isTokenExpiredError(i) ? "TOKEN_EXPIRED" : i.message ? "响应解析失败: " + i.message : String(i);
        }
    }
    /** CRC32-IEEE (poly 0xEDB88320) — 与 Go crc32.ChecksumIEEE 一致 */
    _crc32(e) {
        const t = new Array(256);
        for (let n = 0; n < 256; n++) {
            let a = n;
            for (let i = 0; i < 8; i++) a = 1 & a ? 3988292384 ^ a >>> 1 : a >>> 1;
            t[n] = a;
        }
        let n = 4294967295;
        for (let a = 0; a < e.length; a++) n = t[(n ^ e.charCodeAt(a)) & 255] ^ n >>> 8;
        return (n ^ 4294967295) >>> 0;
    }
    /** 为 123 云盘 API URL 附加签名查询参数（与 Go signPath 算法一致） */
    _signUrl(e) {
        const t = [ "a", "d", "e", "f", "g", "h", "l", "m", "y", "i", "j", "n", "o", "p", "k", "q", "r", "s", "t", "u", "b", "c", "v", "w", "s", "z" ];
        const n = Math.round(1e7 * Math.random());
        const a = new Date;
        const i = new Date(a.getTime() + 6e4 * a.getTimezoneOffset() + 288e5);
        const s = `${i.getFullYear()}${String(i.getMonth() + 1).padStart(2, "0")}${String(i.getDate()).padStart(2, "0")}${String(i.getHours()).padStart(2, "0")}${String(i.getMinutes()).padStart(2, "0")}`;
        let o = "";
        for (let r = 0; r < s.length; r++) o += t[parseInt(s[r])];
        const r = this._crc32(o), l = Math.floor(i.getTime() / 1e3);
        const c = `${l}|${n}|${new URL(e).pathname}|web|3|${r}`;
        const u = this._crc32(c), d = new URL(e);
        return d.searchParams.set(String(r), `${l}-${n}-${u}`), d.toString();
    }
}
