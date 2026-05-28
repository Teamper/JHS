class OneTwoThreeOfflinePlugin extends X {
    constructor() {
        super(...arguments), this.tokenKey = "jhs_123pan_author_token", this.tokenMetaKey = "jhs_123pan_author_token_meta",
        this.syncTimer = null, this.syncFallbackMs = 3e5;
    }
    getName() {
        return "OneTwoThreeOfflinePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .one23-offline-btn {\n                    background-color: #1677ff !important;\n                    color: #fff !important;\n                    border-color: #1677ff !important;\n                }\n                .one23-offline-btn.loading {\n                    opacity: 0.65;\n                    cursor: wait;\n                }\n                .one23-native-btn {\n                    margin-left: 6px;\n                    padding: 3px 8px;\n                    border-radius: 3px;\n                    border: 1px solid #1677ff;\n                    background: #1677ff;\n                    color: #fff !important;\n                    cursor: pointer;\n                    font-size: 12px;\n                    line-height: 1.2;\n                }\n            </style>\n        ";
    }
    async handle() {
        "yun.123pan.com" === window.location.hostname ? this.startTokenSync() : (r || l) && (this.bindSubmit(), this.injectNativeButtons());
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
        } catch (t) {}
        const t = document.cookie.split(";");
        for (const n of t) {
            const [t, a] = n.trim().split("=");
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
        return "TOKEN_EXPIRED" === e || String(e || "").toLowerCase().includes("token is expired");
    }
    getTokenMetaText() {
        const e = GM_getValue(this.tokenMetaKey, null);
        return e && e.source && e.updatedAt ? `（来源：${e.source}，更新：${new Date(e.updatedAt).toLocaleString()}）` : "";
    }
    assertApiResult(e, t) {
        if (0 === e.code) return;
        const n = e.message || e.msg || t || "请求失败";
        throw /token is expired/i.test(n) ? "TOKEN_EXPIRED" : n;
    }
    handleTokenExpired() {
        this.clearStoredToken("expired"), show.error("123 云盘授权已过期，请登录或刷新 yun.123pan.com 后再提交");
    }
    bindSubmit() {
        $(document).off("click.one23", ".one23-offline-btn").on("click.one23", ".one23-offline-btn", (e => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget), n = t.attr("data-magnet");
            n && this.submitMagnet(n, t);
        }));
    }
    injectNativeButtons() {
        r && utils.loopDetector((() => $("#magnets-content .item").length > 0), (() => this.injectJavDbButtons()));
        l && utils.loopDetector((() => $("#magnet-table td a[href^='magnet:']").length > 0), (() => this.injectJavBusButtons()));
    }
    injectJavDbButtons() {
        $("#magnets-content .item").each(((e, t) => {
            const n = $(t), a = n.find("a[href^='magnet:']").first().attr("href") || n.find(".copy-to-clipboard").attr("data-clipboard-text");
            a && 0 === n.find(".one23-offline-btn").length && n.find(".buttons").first().append(`<button class="button is-info is-small one23-offline-btn" data-magnet="${escapeHtml(a)}" type="button">&nbsp;123离线&nbsp;</button>`);
        }));
    }
    injectJavBusButtons() {
        $("#magnet-table td a[href^='magnet:']").each(((e, t) => {
            const n = $(t), a = n.attr("href");
            a && 0 === n.siblings(".one23-offline-btn").length && n.after(`<button class="one23-native-btn one23-offline-btn" data-magnet="${escapeHtml(a)}" type="button">123离线</button>`);
        }));
    }
    async submitMagnet(e, t) {
        const n = this.getStoredToken();
        if (!n) return void show.error("请先登录或刷新 yun.123pan.com，等待授权自动同步后再提交离线任务");
        if (t.hasClass("loading")) return;
        const a = t.text();
        try {
            t.addClass("loading").prop("disabled", !0).text("提交中");
            const i = await this.resolveMagnet(e, n), s = await this.submitTask(i, n);
            const o = await this.markCurrentVideoAsHasDown(t);
            show.info(`已提交 123 离线：${s.fileCount} 个文件 / ${this.formatSize(s.totalSize)}${o ? "，已标记为已下载" : ""}`),
            t.text("已提交");
        } catch (i) {
            this.isTokenExpiredError(i) ? this.handleTokenExpired() : show.error("123 离线提交失败：" + i + this.getTokenMetaText()),
            t.text(a);
        } finally {
            setTimeout((() => t.removeClass("loading").prop("disabled", !1).text(a)), 1800);
        }
    }
    /** 离线任务提交成功后，复用 JHS 影片状态存储标记为已下载。 */
    async markCurrentVideoAsHasDown(e) {
        try {
            const t = this.getOfflineVideoInfo(e);
            if (!t || !t.carNum || !t.url) return !1;
            const n = await storageManager.getCar(t.carNum);
            if (n && n.status === g) return !1;
            await storageManager.saveCar({
                carNum: t.carNum,
                url: t.url,
                names: t.actress || t.names,
                actionType: g,
                publishTime: t.publishTime
            });
            const a = this.getBean("DetailPageButtonPlugin");
            a && a.showStatus && a.showStatus(t.carNum).then(), window.refresh();
            return !0;
        } catch (t) {
            console.error("123 离线成功后标记已下载失败:", t);
            show.error("123 离线已提交，但自动标记已下载失败：" + t);
            return !1;
        }
    }
    /** 从详情页或按钮所在列表项提取当前影片信息。 */
    getOfflineVideoInfo(e) {
        if (window.isDetailPage) return this.getPageInfo();
        const t = e && e.closest ? e.closest(".item") : $();
        return t && t.length ? this.getBean("ListPagePlugin").findCarNumAndHref(t) : this.getPageInfo();
    }
    resolveMagnet(e, t) {
        return new Promise(((n, a) => {
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://www.123pan.com/b/api/v2/offline_download/task/resolve",
                headers: {
                    Authorization: "Bearer " + t,
                    "App-Version": "3",
                    platform: "web",
                    "Content-Type": "application/json;charset=UTF-8",
                    Origin: "https://www.123pan.com",
                    Referer: "https://www.123pan.com/"
                },
                data: JSON.stringify({
                    urls: e
                }),
                onload: e => {
                    if (401 === e.status) return void a("TOKEN_EXPIRED");
                    try {
                        const t = JSON.parse(e.responseText);
                        this.assertApiResult(t, "解析失败"), t.data && t.data.list && t.data.list.length > 0 ? n(t.data.list[0]) : a(t.message || `解析失败 (${t.code})`);
                    } catch (t) {
                        a(this.isTokenExpiredError(t) ? "TOKEN_EXPIRED" : t.message ? "响应解析失败: " + t.message : String(t));
                    }
                },
                onerror: () => a("网络请求失败")
            });
        }));
    }
    submitTask(e, t) {
        return new Promise(((n, a) => {
            if (!e.files || 0 === e.files.length) return void a("没有可建立离线的文件");
            const i = e.files.map((e => e.id)), s = e.files.reduce(((e, t) => e + (t.size || 0)), 0);
            GM_xmlhttpRequest({
                method: "POST",
                url: "https://www.123pan.com/b/api/v2/offline_download/task/submit",
                headers: {
                    Authorization: "Bearer " + t,
                    "App-Version": "3",
                    platform: "web",
                    "Content-Type": "application/json;charset=UTF-8"
                },
                data: JSON.stringify({
                    resource_list: [ {
                        resource_id: e.id,
                        select_file_id: i
                    } ]
                }),
                onload: e => {
                    if (401 === e.status) return void a("TOKEN_EXPIRED");
                    try {
                        const t = JSON.parse(e.responseText);
                        this.assertApiResult(t, "提交失败"), n({
                            fileCount: i.length,
                            totalSize: s
                        });
                    } catch (t) {
                        a(this.isTokenExpiredError(t) ? "TOKEN_EXPIRED" : t.message ? "响应解析失败: " + t.message : String(t));
                    }
                },
                onerror: () => a("网络请求失败")
            });
        }));
    }
    formatSize(e) {
        if (!e) return "0B";
        const t = [ "B", "KB", "MB", "GB", "TB" ];
        let n = 0, a = e;
        for (;a >= 1024 && n < t.length - 1; ) a /= 1024, n++;
        return `${a.toFixed(n ? 2 : 0)}${t[n]}`;
    }
}
