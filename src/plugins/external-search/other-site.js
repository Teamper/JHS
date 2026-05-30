class ve {
    constructor() {
        this.queue = Promise.resolve();
    }
    addTask(e) {
        this.queue = this.queue.then((() => e())).catch((e => {
            clog.error("执行异步队列任务失败:", e);
        }));
    }
    async waitAllFinished() {
        return this.queue;
    }
}

class be extends X {
    constructor() {
        super(...arguments), i(this, "okBackgroundColor", "#7bc73b"), i(this, "errorBackgroundColor", "#de3333"),
        i(this, "warnBackgroundColor", "#d7a80c"), i(this, "domainErrorBackgroundColor", "#d7780c"),
        i(this, "siteConfigs", [ {
            id: "javTrailersBtn",
            getBaseUrl: async () => await this.getJavTrailersUrl(),
            itemSelector: ".videos-list .video-link",
            searchPath: (e, t) => `${e}/search/${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.find("p.card-text").text()
        }, {
            id: "123AvBtn",
            getBaseUrl: async () => await this.getAv123Url() + "/ja",
            itemSelector: ".box-item",
            searchPath: (e, t) => `${e}/search?keyword=${t}`,
            getDetailPageHref: e => e.find(".detail a").attr("href"),
            findCarNumOrTitle: e => e.find("img").attr("title")
        }, {
            id: "jableBtn",
            getBaseUrl: async () => await this.getjableUrl(),
            itemSelector: "#list_videos_videos_list_search_result .detail .title a",
            searchPath: (e, t) => `${e}/search/${t}/`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.text()
        }, {
            id: "avgleBtn",
            getBaseUrl: async () => await this.getAvgleUrl(),
            itemSelector: ".text-secondary",
            searchPath: (e, t) => `${e}/vod/search.html?wd=${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.text()
        }, {
            id: "missAvBtn",
            getBaseUrl: async () => await this.getMissAvUrl(),
            itemSelector: ".text-secondary",
            searchPath: (e, t) => `${e}/search/${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.text()
        }, {
            id: "supJavBtn",
            getBaseUrl: async () => await this.getSupJavUrl(),
            itemSelector: ".posts post",
            searchPath: (e, t) => `${e}/?s=${t}`,
            getDetailPageHref: (e, t, n) => e.attr("href"),
            findCarNumOrTitle: e => e.attr("title")
        }, {
            id: "javDbBtn",
            getBaseUrl: async () => await this.getJavDbUrl(),
            itemSelector: ".movie-list .item",
            searchPath: (e, t) => `${e}/search?q=${t}`,
            getDetailPageHref: e => e.find("a").attr("href"),
            findCarNumOrTitle: e => e.find(".video-title").text(),
            condition: e => l
        }, {
            id: "javBusBtn",
            getBaseUrl: async () => await this.getJavBusUrl(),
            itemSelector: ".container h3",
            searchPath: (e, t) => `${e}/${t}`,
            getDetailPageHref: (e, t, n) => `${t}/${n}`,
            findCarNumOrTitle: e => e.text(),
            condition: e => r && e && !e.includes("FC2")
        }, {
            id: "fanzaBtn",
            noHandle: !0,
            initUrl: e => `https://www.dmm.co.jp/search/=/searchstr=${e}`,
            condition: e => e && !e.includes("FC2")
        } ]), i(this, "settingCache", null), i(this, "lastFetchTime", 0), i(this, "CACHE_DURATION", 1e4);
    }
    getName() {
        return "OtherSitePlugin";
    }
    async initCss() {
        return "\n            <style>\n                .site-btn {\n                    position: relative !important;\n                    min-width: 80px;\n                    display: inline-block;\n                    padding: 5px 10px;\n                    color: white !important;\n                    background-color:#938585;\n                    text-decoration: none;\n                    border-radius: 4px;\n                    text-align: center;\n                    margin-bottom: 5px;\n                }\n                .site-btn:hover {\n                    color: white;\n                    transform: translateY(-2px);\n                    box-shadow: 0 2px 5px rgba(0,0,0,0.1);\n                }\n                .site-tag {\n                    position: absolute; \n                    top: -15px; \n                    right: 0; \n                    background-color: #ffc107; \n                    color: #333; \n                    font-size: 12px; \n                    padding: 2px 6px; \n                    border-radius: 4px;\n                }\n            </style>\n        ";
    }
    async handle() {
        isDetailPage && this.loadOtherSite(null, null, {
            autoDetect: !1
        }).then();
    }
    async loadOtherSite(e, t, n = {}) {
        if ("yes" !== await storageManager.getSetting("enableLoadOtherSite", "yes")) return;
        $("#otherSiteBox,#settingsArea").remove();
        e || (e = this.getPageInfo().carNum);
        const a = this.getEnabledSites(), i = `\n            <div id="otherSiteBox" class="panel-block" style="${r ? "margin-top:8px;font-size:13px" : "margin-top:10px;font-size:13px"}; user-select: none; ">\n                <div style="display: flex;gap: 5px;flex-wrap: wrap">\n                    ${this.siteConfigs.map((e => {
            if (e.sourceCarNum = t, e.condition && !1 === e.condition(e.sourceCarNum)) return "";
            return `<a target="_blank" class="site-btn" style="${a.includes(e.id) ? "" : "display:none"}" id="${e.id}"><span>${e.id.replace("Btn", "")}</span></a>`;
        })).join("")}\n                    <a id="detectOtherSiteBtn" class="site-btn" style="background-color:#1677ff"><span>检测外部站点</span></a>\n                    <a id="settingSiteBtn" class="site-btn"><span>设置</span></a>\n                </div>\n            </div>\n            \n            <div id="settingsArea" class="panel-block"  style="display: none; margin-top:10px; margin-bottom: 10px; user-select: none; ">\n                <div id="siteCheckboxes" style="display: flex;gap: 5px;flex-wrap: wrap">\n                </div>\n            </div>\n        `;
        $(".movie-panel-info").append(i), $(".container .info").append(i), $("#javTrailersBtn").on("click", (async t => {
            t.preventDefault();
            let n = await storageManager.getSetting();
            const a = n.filterHotKey, i = n.favoriteHotKey, s = n.speedVideoHotKey;
            let o = $("#javTrailersBtn").attr("href"), r = o + `?handle=1&filterHotKey=${a}&favoriteHotKey=${i}&speedVideoHotKey=${s}`;
            t && (t.ctrlKey || t.metaKey) && (r = o), utils.openPage(r, e, !1, t);
        })), await Promise.all(this.siteConfigs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.prepareSiteLink(e, t);
        }))), this.renderSettingsArea(), this.setupEventListeners(), $("#detectOtherSiteBtn").off("click").on("click", (t => {
            t.preventDefault(), this.detectOtherSites(e);
        })), n.autoDetect && await this.detectOtherSites(e);
    }
    async prepareSiteLink(e, t) {
        const n = $(`#${t.id}`);
        if (t.initUrl) return void (n.attr("href", t.initUrl(e)), n.css("backgroundColor", this.warnBackgroundColor),
        n.attr("title", "点击前往外部搜索页"));
        try {
            const a = await t.getBaseUrl(), i = t.searchPath(a, e);
            n.attr("href", i), n.attr("title", "点击前往外部搜索页；点击检测按钮后才自动检测"), n.css("backgroundColor", this.warnBackgroundColor);
        } catch (a) {
            n.attr("title", "外部站点地址未配置或不可用"), n.css("backgroundColor", this.domainErrorBackgroundColor);
        }
    }
    async detectOtherSites(e) {
        const t = $("#detectOtherSiteBtn"), n = t.text();
        return t.text("检测中").css("backgroundColor", "#938585"), await Promise.all(this.siteConfigs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.handleSite(e, t);
        }))), t.text(n).css("backgroundColor", "#1677ff");
    }
    async handleSite(e, t) {
        const n = $(`#${t.id}`);
        n.removeAttr("href").find(".site-tag").remove();
        if (t.initUrl && (n.attr("href", t.initUrl(e)), n.css("backgroundColor", this.warnBackgroundColor)),
        t.noHandle && !0 === t.noHandle) {
            const t = "jhs_other_site_dmm", a = (localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {})[e];
            a && ("single" === a.type ? (n.attr("href", a.url), n.css("backgroundColor", this.okBackgroundColor)) : "multiple" === a.type && (n.attr("href", a.url),
            n.append('<span class="site-tag" style="top:-15px">多结果</span>'), n.css("backgroundColor", this.okBackgroundColor)));
        } else try {
            if (n.attr("href")) return;
            if (utils.isHidden(n)) return;
            const a = "jhs_other_site", i = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {}, s = e + "_" + t.id.replace("Btn", ""), o = i[s], m = Date.now();
            if (o && o.time && m - o.time < 864e5) return void ("single" === o.type ? (n.attr("href", o.url), n.css("backgroundColor", this.okBackgroundColor)) : "multiple" === o.type && (n.attr("href", o.url),
            n.append('<span class="site-tag" style="top:-15px">多结果</span>'), n.css("backgroundColor", this.okBackgroundColor)));
            const r = await t.getBaseUrl(), l = t.searchPath(r, e);
            n.attr("href", l);
            /* 预检查仅用于 UI 展示，实际拦截依赖 gmRequest 内部熔断检查 */
            const _breaker = gmHttp.isDomainCircuitBroken(l);
            if (_breaker) {
                n.attr("title", `站点已熔断，${_breaker.remaining}秒后重试`), n.css("backgroundColor", this.domainErrorBackgroundColor);
                return;
            }
            const c = await storageManager.cachedRequest(`other-site:${t.id}:${e}`, 864e5, (() => gmHttp.get(l, null, t.headers, !0))), d = utils.htmlTo$dom(c), h = [];
            d.find(t.itemSelector).each(((n, a) => {
                const i = $(a);
                if (!t.findCarNumOrTitle(i).toLowerCase().includes(e.toLowerCase())) return;
                let s = t.getDetailPageHref(i, r, e);
                if (!s) throw new Error("解析href失败");
                s.includes("http") || (s = r + (s.startsWith("/") ? s : "/" + s)), h.push(s);
            }));
            let g = "", p = null;
            if (1 === h.length) {
                let e = h[0];
                n.attr("href", e), n.css("backgroundColor", this.okBackgroundColor), p = {
                type: "single",
                url: e,
                time: m
            };
            } else h.length > 1 ? (n.attr("href", l), g += '<span class="site-tag" style="top:-15px">多结果</span>',
            n.css("backgroundColor", this.okBackgroundColor), p = {
                type: "multiple",
                url: l,
                time: m
            }) : (n.attr("href", l), n.attr("title", "未查询到, 点击前往搜索页"), n.css("backgroundColor", this.errorBackgroundColor));
            if (p) {
                const e = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {};
                e[s] = p, localStorage.setItem(a, JSON.stringify(e));
            }
            g && n.append(g);
        } catch (a) {
            const e = String(a), i = t.id.replace("Btn", "");
            a._circuitBroken ? (n.attr("title", e), n.css("backgroundColor", this.domainErrorBackgroundColor),
            clog.warn(`检测第三方资源跳过, ${i} 已熔断`)) : e.includes("Just a moment") ? (n.attr("title", "请求失败：Cloudflare 安全检查。"), n.css("backgroundColor", this.warnBackgroundColor),
            clog.warn(`检测第三方资源失败, ${i} 需Cloudflare安全检查`)) : e.includes("重定向") ? (n.attr("title", "域名失效"),
            n.css("backgroundColor", this.domainErrorBackgroundColor), clog.warn(`检测第三方资源失败, ${i} 域名被重定向`)) : e.includes("404 Page Not Found") ? (n.attr("title", "未查询到, 点击前往搜索页"),
            n.css("backgroundColor", this.errorBackgroundColor)) : (console.error(a), n.attr("title", "请求失败。"),
            n.css("backgroundColor", this.errorBackgroundColor), clog.warn(`检测第三方资源失败, ${i}`));
        }
    }
    async getSettingCache() {
        const e = Date.now();
        return (!this.settingCache || e - this.lastFetchTime > this.CACHE_DURATION) && (this.settingCache = await storageManager.getSetting(),
        this.lastFetchTime = e), this.settingCache;
    }
    async getMissAvUrl() {
        return (await this.getSettingCache()).missAvUrl || "https://missav.live";
    }
    async getjableUrl() {
        return (await this.getSettingCache()).jableUrl || "https://jable.tv";
    }
    async getAvgleUrl() {
        return (await this.getSettingCache()).avgleUrl || "https://jav.rs";
    }
    async getJavTrailersUrl() {
        return (await this.getSettingCache()).javTrailersUrl || "https://javtrailers.com";
    }
    async getAv123Url() {
        return (await this.getSettingCache()).av123Url || "https://123av.com";
    }
    async getJavDbUrl() {
        return (await this.getSettingCache()).javDbUrl || "https://javdb.com";
    }
    async getJavBusUrl() {
        return (await this.getSettingCache()).javBusUrl || "https://www.javbus.com";
    }
    async getSupJavUrl() {
        return (await this.getSettingCache()).supJavUrl || "https://supjav.com";
    }
    getEnabledSites() {
        const e = localStorage.getItem("jhs_enabled_sites");
        return e ? JSON.parse(e) : this.siteConfigs.map((e => e.id));
    }
    saveEnabledSites(e) {
        localStorage.setItem("jhs_enabled_sites", JSON.stringify(e));
    }
    renderSettingsArea() {
        const e = this.getEnabledSites(), t = document.getElementById("siteCheckboxes");
        t && (t.innerHTML = this.siteConfigs.map((t => {
            const n = e.includes(t.id);
            return `\n                <div style="margin-right: 15px; display: flex; align-items: ${r ? "center" : "flex-start"};">\n                    <input type="checkbox" id="checkbox-${t.id}" data-site-id="${t.id}" ${n ? "checked" : ""} style="margin-right: 8px; cursor: pointer;">\n                    <label for="checkbox-${t.id}" style="color: #333; font-weight: 500; cursor: pointer;">${t.id.replace("Btn", "")}</label>\n                </div>\n            `;
        })).join(""));
    }
    setupEventListeners() {
        const e = document.getElementById("settingsArea");
        document.addEventListener("click", (t => {
            if ("settingSiteBtn" === t.target.id || t.target.closest("#settingSiteBtn")) {
                const t = "none" === e.style.display || "" === e.style.display;
                e.style.display = t ? "block" : "none";
            }
        })), e.addEventListener("change", (t => {
            if ("checkbox" === t.target.type) {
                const n = t.target.getAttribute("data-site-id");
                if (t.target.checked) {
                    $(`#${n}`).show();
                    const e = this.getPageInfo().carNum, t = this.siteConfigs.find((e => e.id === n));
                    this.prepareSiteLink(e, t).then();
                } else $(`#${n}`).hide();
                const a = Array.from(e.querySelectorAll('input[type="checkbox"]:checked')).map((e => e.getAttribute("data-site-id")));
                this.saveEnabledSites(a);
            }
        }));
    }
}
