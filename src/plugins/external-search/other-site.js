class StorageQueue {
    constructor() {
        this.queue = Promise.resolve();
    }
    addTask(e) {
        const task = this.queue.then((() => e()));
        return this.queue = task.catch((e => {
            clog.error("执行异步队列任务失败:", e);
        })), task;
    }
    async waitAllFinished() {
        return this.queue;
    }
}

class OtherSitePlugin extends BasePlugin {
    constructor() {
        super(...arguments), i(this, "siteConfigs", [ {
            id: "javTrailersBtn",
            getBaseUrl: async () => await this.getJavTrailersUrl(),
            itemSelector: ".videos-list .video-link",
            searchPath: (e, t) => `${e}/search/${t}`,
            getDetailPageHref: e => e.attr("href"),
            findCarNumOrTitle: e => e.find("p.card-text").text()
        }, {
            id: "123AvBtn",
            getBaseUrl: async () => `${await this.getAv123Url()}/cn`,
            itemSelector: ".card",
            searchPath: (e, t) => `${e}/search?keyword=${encodeURIComponent(t)}`,
            requestOptions: { cookiePartitionTopLevelSite: "https://123av.com" },
            getDetailPageHref: (e, t) => {
                const href = e.find('a.card__link[href*="/cn/v/"]').first().attr("href");
                return href ? new URL(href, t).href : null;
            },
            findCarNumOrTitle: e => e.find(".card__link").first().text(),
            matches: (text, carNum) => text.replace(/FC2-PPV-/gi, "FC2-").toLowerCase().includes(carNum.toLowerCase())
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
        return `
            <style>
                #otherSiteBox, #settingsArea { margin-top:var(--jhs-space-2); user-select:none; }
                .jhs-site-list, #siteCheckboxes { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .site-btn { position:relative; }
                .site-btn::before { width:7px; height:7px; border-radius:50%; background:var(--jhs-brand-color,var(--jhs-text-faint)); content:""; }
                #javTrailersBtn { --jhs-brand-color:#d4a72c; } #123AvBtn { --jhs-brand-color:#e05d44; }
                #jableBtn { --jhs-brand-color:#c94556; } #avgleBtn { --jhs-brand-color:#4677c8; }
                #missAvBtn { --jhs-brand-color:#8b5cf6; } #supJavBtn { --jhs-brand-color:#ef6c35; }
                #javDbBtn { --jhs-brand-color:#2684ff; } #javBusBtn { --jhs-brand-color:#cc3d3d; } #fanzaBtn { --jhs-brand-color:#ea4c89; }
                .site-btn.is-checking { opacity:.65; pointer-events:none; }
                .site-btn.is-available { border-color:var(--jhs-status-down-text); background:var(--jhs-status-down-tint); }
                .site-btn.is-unavailable { border-color:var(--jhs-status-filter-text); background:var(--jhs-status-filter-tint); }
                .site-btn.is-domain-error { border-color:var(--jhs-status-watch-text); background:var(--jhs-status-watch-tint); }
                .site-tag { margin-left:var(--jhs-space-1); padding:1px var(--jhs-space-1); border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-site-option { display:flex; align-items:center; gap:var(--jhs-space-2); }
            </style>`;
    }
    async handle() {
        isDetailPage && await this.loadOtherSite(null, null, {
            autoDetect: !1
        });
    }
    async loadOtherSite(e, t, n = {}) {
        if ("yes" !== await storageManager.getSetting("enableLoadOtherSite", "yes")) return;
        $("#otherSiteBox,#settingsArea").remove();
        e = normalizeCarNum(e) || this.getPageInfo().carNum;
        const a = this.getEnabledSites(), i = `\n            <div id="otherSiteBox" class="panel-block">\n                <div class="jhs-site-list">\n                    ${this.siteConfigs.map((e => {
            if (e.sourceCarNum = t, e.condition && !1 === e.condition(e.sourceCarNum)) return "";
            return `<a target="_blank" class="site-btn jhs-btn jhs-btn--secondary ${a.includes(e.id) ? "" : "jhs-is-hidden"}" id="${e.id}"><span>${e.id.replace("Btn", "")}</span></a>`;
        })).join("")}\n                    <button type="button" id="detectOtherSiteBtn" class="site-btn jhs-btn jhs-btn--primary"><span>检测外部站点</span></button>\n                    <button type="button" id="settingSiteBtn" class="site-btn jhs-btn jhs-btn--secondary"><span>设置</span></button>\n                </div>\n            </div>\n            <div id="settingsArea" class="panel-block jhs-is-hidden"><div id="siteCheckboxes"></div></div>\n        `;
        $(".movie-panel-info").append(i), $(".container .info").append(i);
        if (!e) return $("#otherSiteBox .site-btn").removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }),
        $("#detectOtherSiteBtn").prop("disabled", !0), this.renderSettingsArea(), this.setupEventListeners(), void clog.warn("跳过第三方站点解析：番号不可用");
        $("#javTrailersBtn").on("click", (async t => {
            t.preventDefault();
            let o = $("#javTrailersBtn").attr("href"), r = o + "?handle=1";
            t && (t.ctrlKey || t.metaKey) && (r = o), utils.openPage(r, e, !1, t);
        })), await Promise.all(this.siteConfigs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.prepareSiteLink(e, t);
        }))), this.renderSettingsArea(), this.setupEventListeners(), $("#detectOtherSiteBtn").off("click").on("click", (t => {
            t.preventDefault(), this.detectOtherSites(e);
        })), n.autoDetect && await this.detectOtherSites(e);
    }
    async prepareSiteLink(e, t) {
        const n = $(`#${t.id}`);
        if (!(e = normalizeCarNum(e))) return n.removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), void this.setSiteState(n, "idle");
        if (t.initUrl) return void (n.attr("href", t.initUrl(e)), this.setSiteState(n, "idle"), n.attr("title", "点击前往外部搜索页"));
        try {
            const a = await t.getBaseUrl(), i = t.searchPath(a, e);
            n.attr("href", i), n.attr("title", "点击前往外部搜索页；点击检测按钮后才自动检测"), this.setSiteState(n, "idle");
        } catch (a) {
            n.attr("title", "外部站点地址未配置或不可用"), this.setSiteState(n, "domain-error");
        }
    }
    async detectOtherSites(e) {
        const t = $("#detectOtherSiteBtn"), n = t.text();
        if (!(e = normalizeCarNum(e))) return t.prop("disabled", !0), void clog.warn("跳过第三方站点检测：番号不可用");
        return t.text("检测中").prop("disabled", !0).addClass("is-checking"), await Promise.all(this.siteConfigs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.handleSite(e, t);
        }))), t.text(n).prop("disabled", !1).removeClass("is-checking");
    }
    setSiteState(e, t) {
        e.removeClass("is-checking is-available is-unavailable is-domain-error"), "idle" !== t && e.addClass(`is-${t}`);
    }
    async handleSite(e, t) {
        const n = $(`#${t.id}`);
        n.removeAttr("href").find(".site-tag").remove(), this.setSiteState(n, "checking");
        if (t.initUrl && n.attr("href", t.initUrl(e)), t.noHandle && !0 === t.noHandle) {
            const t = "jhs_other_site_dmm", a = (localStorage.getItem(t) ? JSON.parse(localStorage.getItem(t)) : {})[e];
            a ? (n.attr("href", a.url), "multiple" === a.type && n.append('<span class="site-tag">多结果</span>'), this.setSiteState(n, "available")) : this.setSiteState(n, "idle");
        } else try {
            if (n.attr("href")) return void this.setSiteState(n, "idle");
            if (utils.isHidden(n)) return;
            const a = "jhs_other_site", i = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {}, s = e + "_" + t.id.replace("Btn", ""), o = i[s], m = Date.now();
            if (o && o.time && m - o.time < 864e5) return void (n.attr("href", o.url), "multiple" === o.type && n.append('<span class="site-tag">多结果</span>'), this.setSiteState(n, "available"));
            const r = await t.getBaseUrl(), l = t.searchPath(r, e);
            n.attr("href", l);
            /* 预检查仅用于 UI 展示，实际拦截依赖 gmRequest 内部熔断检查 */
            const _breaker = gmHttp.isDomainCircuitBroken(l);
            if (_breaker) {
                n.attr("title", `站点已熔断，${_breaker.remaining}秒后重试`), this.setSiteState(n, "domain-error");
                return;
            }
            const c = await storageManager.cachedRequest(`other-site:${t.id}:${e}`, 864e5, (() => gmHttp.get(l, null, t.headers, !0, t.requestOptions || {}))), d = utils.htmlTo$dom(c), h = [];
            d.find(t.itemSelector).each(((n, a) => {
                const i = $(a);
                const itemText = t.findCarNumOrTitle(i);
                if (t.matches ? !t.matches(itemText, e) : !itemText.toLowerCase().includes(e.toLowerCase())) return;
                let s = t.getDetailPageHref(i, r, e);
                if (!s) throw new Error("解析href失败");
                s.includes("http") || (s = r + (s.startsWith("/") ? s : "/" + s)), h.push(s);
            }));
            let g = "", p = null;
            if (1 === h.length) {
                let e = h[0];
                n.attr("href", e), this.setSiteState(n, "available"), p = {
                type: "single",
                url: e,
                time: m
            };
            } else h.length > 1 ? (n.attr("href", l), g += '<span class="site-tag">多结果</span>', this.setSiteState(n, "available"), p = {
                type: "multiple",
                url: l,
                time: m
            }) : (n.attr("href", l), n.attr("title", "未查询到, 点击前往搜索页"), this.setSiteState(n, "unavailable"));
            if (p) {
                const e = localStorage.getItem(a) ? JSON.parse(localStorage.getItem(a)) : {};
                e[s] = p, localStorage.setItem(a, JSON.stringify(e));
            }
            g && n.append(g);
        } catch (a) {
            const e = String(a), i = t.id.replace("Btn", "");
            a._circuitBroken ? (n.attr("title", e), this.setSiteState(n, "domain-error"), clog.warn(`检测第三方资源跳过, ${i} 已熔断`)) :
            a?._cfBlocked ? (n.attr("title", "请求失败：Cloudflare 安全检查。"), this.setSiteState(n, "domain-error"), clog.warn(`检测第三方资源失败, ${i} 需Cloudflare安全检查`)) :
            e.includes("重定向") ? (n.attr("title", "域名失效"), this.setSiteState(n, "domain-error"), clog.warn(`检测第三方资源失败, ${i} 域名被重定向`)) :
            e.includes("404 Page Not Found") ? (n.attr("title", "未查询到, 点击前往搜索页"), this.setSiteState(n, "unavailable")) :
            (console.error(a), n.attr("title", "请求失败。"), this.setSiteState(n, "unavailable"), clog.warn(`检测第三方资源失败, ${i}`));
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
            return `\n                <label class="jhs-site-option" for="checkbox-${t.id}">\n                    <input type="checkbox" id="checkbox-${t.id}" data-site-id="${t.id}" ${n ? "checked" : ""}>\n                    <span>${t.id.replace("Btn", "")}</span>\n                </label>\n            `;
        })).join(""));
    }
    setupEventListeners() {
        const e = document.getElementById("settingsArea");
        document.addEventListener("click", (t => {
            if ("settingSiteBtn" === t.target.id || t.target.closest("#settingSiteBtn")) {
                e.classList.toggle("jhs-is-hidden");
            }
        })), e.addEventListener("change", (t => {
            if ("checkbox" === t.target.type) {
                const n = t.target.getAttribute("data-site-id");
                if (t.target.checked) {
                    $(`#${n}`).removeClass("jhs-is-hidden");
                    const e = this.getPageInfo().carNum, t = this.siteConfigs.find((e => e.id === n));
                    this.prepareSiteLink(e, t).then();
                } else $(`#${n}`).addClass("jhs-is-hidden");
                const a = Array.from(e.querySelectorAll('input[type="checkbox"]:checked')).map((e => e.getAttribute("data-site-id")));
                this.saveEnabledSites(a);
            }
        }));
    }
}
