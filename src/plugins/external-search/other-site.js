import { i, l, normalizeCarNum, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";

export class StorageQueue {
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

export class OtherSitePlugin extends BasePlugin {
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
                [data-jhs-other-site-box], [data-jhs-other-site-settings], #otherSiteBox, #settingsArea { margin-top:var(--jhs-space-2); user-select:none; }
                .jhs-site-list, [data-jhs-role="site-checkboxes"], #siteCheckboxes { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .site-btn { position:relative; }
                .site-btn::before { width:7px; height:7px; border-radius:50%; background:var(--jhs-brand-color,var(--jhs-text-faint)); content:""; }
                [data-jhs-site-id="javTrailersBtn"],#javTrailersBtn { --jhs-brand-color:#d4a72c; } [data-jhs-site-id="123AvBtn"],#123AvBtn { --jhs-brand-color:#e05d44; }
                [data-jhs-site-id="jableBtn"],#jableBtn { --jhs-brand-color:#c94556; } [data-jhs-site-id="avgleBtn"],#avgleBtn { --jhs-brand-color:#4677c8; }
                [data-jhs-site-id="missAvBtn"],#missAvBtn { --jhs-brand-color:#8b5cf6; } [data-jhs-site-id="supJavBtn"],#supJavBtn { --jhs-brand-color:#ef6c35; }
                [data-jhs-site-id="javDbBtn"],#javDbBtn { --jhs-brand-color:#2684ff; } [data-jhs-site-id="javBusBtn"],#javBusBtn { --jhs-brand-color:#cc3d3d; } [data-jhs-site-id="fanzaBtn"],#fanzaBtn { --jhs-brand-color:#ea4c89; }
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
        const root = n.root ? $(n.root) : $(document), target = n.target ? $(n.target) : root.find(".movie-panel-info,.container .info").first();
        if (!target.length || n.isActive && !n.isActive()) return;
        root.find("#otherSiteBox,#settingsArea,[data-jhs-other-site-box],[data-jhs-other-site-settings]").remove();
        e = normalizeCarNum(e) || this.getPageInfo().carNum;
        const enabled = this.getEnabledSites(), configs = this.siteConfigs.map((config => ({ ...config, sourceCarNum: t }))), view = { root, target, configs, carNum: e, isActive: "function" === typeof n.isActive ? n.isActive : () => !0 };
        const box = $('<div class="panel-block" data-jhs-other-site-box><div class="jhs-site-list"></div></div>'), list = box.find(".jhs-site-list"), settings = $('<div class="panel-block jhs-is-hidden" data-jhs-other-site-settings><div data-jhs-role="site-checkboxes"></div></div>');
        configs.forEach((config => {
            if (config.condition && !1 === config.condition(config.sourceCarNum)) return;
            const button = $('<a target="_blank" class="site-btn jhs-btn jhs-btn--secondary"><span></span></a>').attr("data-jhs-site-id", config.id).toggleClass("jhs-is-hidden", !enabled.includes(config.id));
            button.find("span").text(config.id.replace("Btn", "")), list.append(button);
        }));
        list.append('<button type="button" class="site-btn jhs-btn jhs-btn--primary" data-jhs-role="detect-sites"><span>检测外部站点</span></button>', '<button type="button" class="site-btn jhs-btn jhs-btn--secondary" data-jhs-role="site-settings"><span>设置</span></button>'), target.append(box, settings), view.box = box, view.settings = settings;
        if (!e) return box.find(".site-btn").removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), box.find('[data-jhs-role="detect-sites"]').prop("disabled", !0), this.renderSettingsArea(view), this.setupEventListeners(view), void clog.warn("跳过第三方站点解析：番号不可用");
        box.find('[data-jhs-site-id="javTrailersBtn"]').on("click", (event => {
            event.preventDefault();
            const original = $(event.currentTarget).attr("href"), destination = event.ctrlKey || event.metaKey ? original : original + "?handle=1";
            utils.openPage(destination, e, !1, event);
        })), await Promise.all(configs.map((async config => {
            config.condition && !1 === config.condition(config.sourceCarNum) || await this.prepareSiteLink(e, config, view);
        }))), this.renderSettingsArea(view), this.setupEventListeners(view), box.find('[data-jhs-role="detect-sites"]').off("click").on("click", (event => {
            event.preventDefault(), this.detectOtherSites(e, view);
        })), n.autoDetect && await this.detectOtherSites(e, view);
        return box;
    }
    async prepareSiteLink(e, t, view = { root: $(document), isActive: () => !0 }) {
        const n = view.root.find(`[data-jhs-site-id="${t.id}"],#${t.id}`).first();
        if (!(e = normalizeCarNum(e))) return n.removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), void this.setSiteState(n, "idle");
        if (t.initUrl) return void (n.attr("href", t.initUrl(e)), this.setSiteState(n, "idle"), n.attr("title", "点击前往外部搜索页"));
        try {
            const a = await t.getBaseUrl(), i = t.searchPath(a, e);
            view.isActive() && (n.attr("href", i), n.attr("title", "点击前往外部搜索页；点击检测按钮后才自动检测"), this.setSiteState(n, "idle"));
        } catch (a) {
            view.isActive() && (n.attr("title", "外部站点地址未配置或不可用"), this.setSiteState(n, "domain-error"));
        }
    }
    async detectOtherSites(e, view = { root: $(document), configs: this.siteConfigs, isActive: () => !0 }) {
        const t = view.root.find('[data-jhs-role="detect-sites"],#detectOtherSiteBtn').first(), n = t.text();
        if (!(e = normalizeCarNum(e))) return t.prop("disabled", !0), void clog.warn("跳过第三方站点检测：番号不可用");
        return t.text("检测中").prop("disabled", !0).addClass("is-checking"), await Promise.all(view.configs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.handleSite(e, t, view);
        }))), view.isActive() && t.text(n).prop("disabled", !1).removeClass("is-checking");
    }
    setSiteState(e, t) {
        e.removeClass("is-checking is-available is-unavailable is-domain-error"), "idle" !== t && e.addClass(`is-${t}`);
    }
    async handleSite(e, t, view = { root: $(document), isActive: () => !0 }) {
        const n = view.root.find(`[data-jhs-site-id="${t.id}"],#${t.id}`).first();
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
            const c = await storageManager.cachedRequest(`other-site:${t.id}:${e}`, 864e5, (() => gmHttp.get(l, null, t.headers, !0, t.requestOptions || {})));
            if (!view.isActive()) return;
            const d = utils.htmlTo$dom(c), h = [];
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
            (clog.error(a), n.attr("title", "请求失败。"), this.setSiteState(n, "unavailable"), clog.warn(`检测第三方资源失败, ${i}`));
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
        const fallback = this.siteConfigs.map((site => site.id));
        try {
            const raw = localStorage.getItem("jhs_enabled_sites");
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((id => fallback.includes(id))) : fallback;
        } catch (error) {
            return clog.warn("外部站点配置损坏，已回退默认值", error), fallback;
        }
    }
    saveEnabledSites(e) {
        localStorage.setItem("jhs_enabled_sites", JSON.stringify(e));
    }
    renderSettingsArea(view = { root: $(document), configs: this.siteConfigs }) {
        const enabled = this.getEnabledSites(), target = view.root.find('[data-jhs-role="site-checkboxes"],#siteCheckboxes').first().empty();
        view.configs.forEach((config => {
            const input = $('<input type="checkbox">').attr("data-site-id", config.id).prop("checked", enabled.includes(config.id));
            target.append($('<label class="jhs-site-option"></label>').append(input, $("<span></span>").text(config.id.replace("Btn", ""))));
        }));
    }
    setupEventListeners(view = { root: $(document), configs: this.siteConfigs, carNum: null }) {
        const $settingsArea = view.root.find('[data-jhs-other-site-settings],#settingsArea').first();
        view.root.find('[data-jhs-role="site-settings"],#settingSiteBtn').off("click.jhsOtherSite").on("click.jhsOtherSite", (() => {
            $settingsArea.toggleClass("jhs-is-hidden");
        })), $settingsArea.off("change.jhsOtherSite").on("change.jhsOtherSite", 'input[type="checkbox"]', (async event => {
            const siteId = $(event.currentTarget).attr("data-site-id");
            try {
                if (event.currentTarget.checked) {
                    view.root.find(`[data-jhs-site-id="${siteId}"],#${siteId}`).removeClass("jhs-is-hidden");
                    const carNum = view.carNum || this.getPageInfo().carNum, site = view.configs.find((item => item.id === siteId));
                    site && await this.prepareSiteLink(carNum, site, view);
                } else view.root.find(`[data-jhs-site-id="${siteId}"],#${siteId}`).addClass("jhs-is-hidden");
                this.saveEnabledSites($settingsArea.find('input[type="checkbox"]:checked').map(((index, input) => $(input).attr("data-site-id"))).get());
            } catch (error) {
                clog.warn(`外部站点 ${siteId || "unknown"} 状态更新失败`, error);
            }
        }));
    }
}
