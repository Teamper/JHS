// @ts-check

import { l, normalizeCarNum, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */
/** @typedef {{ id: string, providerId?: string, noHandle?: boolean, condition?: (sourceCarNum?: string | null) => boolean, searchUrl?: (carNum: string) => string, sourceCarNum?: string | null, baseUrl?: string }} SiteConfig */
/** @typedef {{ root: JQueryHandle, target?: JQueryHandle, configs: SiteConfig[], carNum?: string | null, isActive?: () => boolean, box?: JQueryHandle, settings?: JQueryHandle }} OtherSiteView */
/** @typedef {{ root?: Element | JQueryHandle, target?: Element | JQueryHandle, isActive?: () => boolean, autoDetect?: boolean }} OtherSiteLoadOptions */
/** @typedef {{ preventDefault: () => void, currentTarget: HTMLInputElement, ctrlKey?: boolean, metaKey?: boolean }} JQuerySiteEvent */

export class StorageQueue {
    constructor() {
        /** @type {Promise<unknown>} */ this.queue = Promise.resolve();
    }
    /** @param {() => unknown | Promise<unknown>} e */
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
        super(...arguments);
        /** @type {SiteConfig[]} */
        this.siteConfigs = [
            { id: "javTrailersBtn" }, { id: "123AvBtn", providerId: "av123" }, { id: "jableBtn" }, { id: "avgleBtn" }, { id: "missAvBtn" }, { id: "supJavBtn" },
            { id: "javDbBtn", condition: () => l }, { id: "javBusBtn", condition: e => Boolean(r && e && !e.includes("FC2")) },
            { id: "fanzaBtn", providerId: "dmm", noHandle: !0, condition: e => Boolean(e && !e.includes("FC2")) },
        ];
    }
    getName() {
        return "OtherSitePlugin";
    }
    async getSiteConfigs() {
        const settings = await this.getSettingCache(), definitions = this.getRuntimeService("movie").externalSites(settings);
        return this.siteConfigs.map((config) => ({ ...(definitions.find(((/** @type {SiteConfig} */ item) => item.id === config.id)) || {}), ...config }));
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
        const settings = this.getRuntimeService("settings"), scope = await this.getRuntimeService("scope")();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("enableLoadOtherSite")) return;
            if (settings.snapshot().enableLoadOtherSite === "no") this.unmount();
            else void this.mount().catch((error => clog.error("外部站点重新挂载失败", error)));
        };
        settings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => settings.removeEventListener("settings.changed", onSettingsChanged)));
        await this.mount();
    }
    /** ON：在当前详情页挂载外部站点面板。 */
    async mount() {
        if (!isDetailPage) return;
        if (this.getRuntimeService("settings").snapshot().enableLoadOtherSite === "no") return;
        await this.loadOtherSite(null, null, { autoDetect: !1 });
    }
    /** OFF：删除 JHS 自有面板（宿主原生 UI 不做永久销毁）。 */
    unmount() {
        $("[data-jhs-other-site-box],[data-jhs-other-site-settings]").remove();
    }
    /** @param {string | null} e @param {string | null} t @param {OtherSiteLoadOptions} [n] */
    async loadOtherSite(e, t, n = {}) {
        if (this.getRuntimeService("settings").snapshot().enableLoadOtherSite === "no") return;
        const root = n.root ? $(n.root) : $(document), target = n.target ? $(n.target) : $(this.getRuntimeService("host").locateDetailSlots().summary);
        if (!target.length || n.isActive && !n.isActive()) return;
        root.find("#otherSiteBox,#settingsArea,[data-jhs-other-site-box],[data-jhs-other-site-settings]").remove();
        e = normalizeCarNum(e) || this.getPageInfo().carNum;
        const enabled = this.getEnabledSites(), configs = (await this.getSiteConfigs()).map((config => ({ ...config, sourceCarNum: t }))), view = /** @type {OtherSiteView} */ ({ root, target, configs, carNum: e, isActive: "function" === typeof n.isActive ? n.isActive : () => !0 });
        const box = $('<div class="panel-block" data-jhs-other-site-box><div class="jhs-site-list"></div></div>'), list = box.find(".jhs-site-list"), settings = $('<div class="panel-block jhs-is-hidden" data-jhs-other-site-settings><div data-jhs-role="site-checkboxes"></div></div>');
        configs.forEach((config => {
            if (config.condition && !1 === config.condition(config.sourceCarNum)) return;
            const button = $('<a target="_blank" class="site-btn jhs-btn jhs-btn--secondary"><span></span></a>').attr("data-jhs-site-id", config.id).toggleClass("jhs-is-hidden", !enabled.includes(config.id));
            button.find("span").text(config.id.replace("Btn", "")), list.append(button);
        }));
        list.append('<button type="button" class="site-btn jhs-btn jhs-btn--primary" data-jhs-role="detect-sites"><span>检测外部站点</span></button>', '<button type="button" class="site-btn jhs-btn jhs-btn--secondary" data-jhs-role="site-settings"><span>设置</span></button>'), target.append(box, settings), view.box = box, view.settings = settings;
        if (!e) return box.find(".site-btn").removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), box.find('[data-jhs-role="detect-sites"]').prop("disabled", !0), this.renderSettingsArea(view), this.setupEventListeners(view), void clog.warn("跳过第三方站点解析：番号不可用");
        box.find('[data-jhs-site-id="javTrailersBtn"]').on("click", ((/** @type {JQuerySiteEvent} */ event) => {
            event.preventDefault();
            const original = $(event.currentTarget).attr("href"), destination = event.ctrlKey || event.metaKey ? original : original + "?handle=1";
            utils.openPage(destination, e, !1, event);
        })), await Promise.all(configs.map((async config => {
            config.condition && !1 === config.condition(config.sourceCarNum) || await this.prepareSiteLink(e, config, view);
        }))), this.renderSettingsArea(view), this.setupEventListeners(view), box.find('[data-jhs-role="detect-sites"]').off("click").on("click", ((/** @type {JQuerySiteEvent} */ event) => {
            event.preventDefault(), this.detectOtherSites(e, view);
        })), n.autoDetect && await this.detectOtherSites(e, view);
        return box;
    }
    /** @param {string | null} e @param {SiteConfig} t @param {OtherSiteView} [view] */
    async prepareSiteLink(e, t, view = { root: $(document), configs: [], isActive: () => !0 }) {
        const n = view.root.find(`[data-jhs-site-id="${t.id}"],#${t.id}`).first();
        if (!(e = normalizeCarNum(e))) return n.removeAttr("href").attr({ "aria-disabled": "true", title: "番号不可用" }), void this.setSiteState(n, "idle");
        if (t.providerId) {
            const url = this.getRuntimeService("movie").searchUrl(t.providerId, { carNum: e });
            return void (url ? (n.attr("href", url), n.attr("title", "点击前往外部搜索页"), this.setSiteState(n, "idle")) : (n.attr("title", "外部站点地址不可用"), this.setSiteState(n, "domain-error")));
        }
        try {
            view.isActive?.() !== false && t.searchUrl && (n.attr("href", t.searchUrl(e)), n.attr("title", "点击前往外部搜索页；点击检测按钮后才自动检测"), this.setSiteState(n, "idle"));
        } catch (a) {
            view.isActive?.() !== false && (n.attr("title", "外部站点地址未配置或不可用"), this.setSiteState(n, "domain-error"));
        }
    }
    /** @param {string | null} e @param {OtherSiteView} [view] */
    async detectOtherSites(e, view = { root: $(document), configs: this.siteConfigs, isActive: () => !0 }) {
        const t = view.root.find('[data-jhs-role="detect-sites"],#detectOtherSiteBtn').first(), n = t.text();
        if (!(e = normalizeCarNum(e))) return t.prop("disabled", !0), void clog.warn("跳过第三方站点检测：番号不可用");
        return t.text("检测中").prop("disabled", !0).addClass("is-checking"), await Promise.all(view.configs.map((async t => {
            t.condition && !1 === t.condition(t.sourceCarNum) || await this.handleSite(e, t, view);
        }))), view.isActive?.() !== false && t.text(n).prop("disabled", !1).removeClass("is-checking");
    }
    /** @param {JQueryHandle} e @param {string} t */
    setSiteState(e, t) {
        e.removeClass("is-checking is-available is-unavailable is-domain-error"), "idle" !== t && e.addClass(`is-${t}`);
    }
    /** @param {string} e @param {SiteConfig} t @param {OtherSiteView} [view] */
    async handleSite(e, t, view = { root: $(document), configs: [], isActive: () => !0 }) {
        const n = view.root.find(`[data-jhs-site-id="${t.id}"],#${t.id}`).first();
        n.removeAttr("href").find(".site-tag").remove(), this.setSiteState(n, "checking");
        if (t.noHandle && !0 === t.noHandle) {
            n.attr("href", this.getRuntimeService("movie").searchUrl(t.providerId, { carNum: e }) || "");
            const cacheKey = "jhs_other_site_dmm", raw = this.getRuntimeService("storage").getLocal(cacheKey), a = (raw ? JSON.parse(raw) : {})[e];
            a ? (n.attr("href", a.url), "multiple" === a.type && n.append('<span class="site-tag">多结果</span>'), this.setSiteState(n, "available")) : this.setSiteState(n, "idle");
        } else if (t.providerId) try {
            const scope = await this.getRuntimeService("scope")();
            const result = await this.getRuntimeService("movie").resolve({ carNum: e, providerId: t.providerId }, { scope });
            if (view.isActive?.() === false) return;
            const searchUrl = this.getRuntimeService("movie").searchUrl(t.providerId, { carNum: e });
            n.attr("href", result?.url || searchUrl || "");
            this.setSiteState(n, result?.url ? "available" : "unavailable");
            if (!result?.url) n.attr("title", "未查询到, 点击前往搜索页");
        } catch (error) {
            if (view.isActive?.() !== false) n.attr("title", "请求失败。"), this.setSiteState(n, "unavailable"), clog.warn(`检测第三方资源失败, ${t.id.replace("Btn", "")}`);
        } else try {
            if (n.attr("href")) return void this.setSiteState(n, "idle");
            if (utils.isHidden(n)) return;
            const a = "jhs_other_site", storage = this.getRuntimeService("storage"), raw = storage.getLocal(a), i = raw ? JSON.parse(raw) : {}, s = e + "_" + t.id.replace("Btn", ""), o = i[s], m = Date.now();
            if (o && o.time && m - o.time < 864e5) return void (n.attr("href", o.url), "multiple" === o.type && n.append('<span class="site-tag">多结果</span>'), this.setSiteState(n, "available"));
            const scope = await this.getRuntimeService("scope")(), result = await this.getRuntimeService("movie").searchExternalSite(t.id, e, { settings: await this.getSettingCache(), scope }), l = result.searchUrl;
            n.attr("href", l);
            if (view.isActive?.() === false) return;
            const h = result.matches;
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
                const latestRaw = storage.getLocal(a), e = latestRaw ? JSON.parse(latestRaw) : {};
                e[s] = p, storage.setLocal(a, JSON.stringify(e));
            }
            g && n.append(g);
        } catch (a) {
            const e = String(a), i = t.id.replace("Btn", "");
            const code = /** @type {{ code?: string }} */ (a)?.code;
            "CIRCUIT_OPEN" === code ? (n.attr("title", e), this.setSiteState(n, "domain-error"), clog.warn(`检测第三方资源跳过, ${i} 已熔断`)) :
            "CF_BLOCKED" === code ? (n.attr("title", "请求失败：Cloudflare 安全检查。"), this.setSiteState(n, "domain-error"), clog.warn(`检测第三方资源失败, ${i} 需Cloudflare安全检查`)) :
            "INVALID_URL" === code ? (n.attr("title", "域名失效"), this.setSiteState(n, "domain-error"), clog.warn(`检测第三方资源失败, ${i} 域名或重定向无效`)) :
            "NOT_FOUND" === code ? (n.attr("title", "未查询到, 点击前往搜索页"), this.setSiteState(n, "unavailable")) :
            (clog.error(a), n.attr("title", "请求失败。"), this.setSiteState(n, "unavailable"), clog.warn(`检测第三方资源失败, ${i}`));
        }
    }
    /** 设置唯一真相源：SettingsService 快照，不再维护插件私有缓存。 */
    async getSettingCache() {
        return /** @type {Record<string, any>} */ (this.getRuntimeService("settings").snapshot());
    }
    async getMissAvUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "missAvBtn")?.baseUrl || "";
    }
    async getjableUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "jableBtn")?.baseUrl || "";
    }
    async getAvgleUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "avgleBtn")?.baseUrl || "";
    }
    async getJavTrailersUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "javTrailersBtn")?.baseUrl || "";
    }
    async getAv123Url() {
        return this.getRuntimeService("movie").providerOrigin("av123") || "";
    }
    async getJavDbUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "javDbBtn")?.baseUrl || "";
    }
    async getJavBusUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "javBusBtn")?.baseUrl || "";
    }
    async getSupJavUrl() {
        return (await this.getSiteConfigs()).find((site) => site.id === "supJavBtn")?.baseUrl || "";
    }
    getEnabledSites() {
        const fallback = this.siteConfigs.map((site => site.id));
        try {
            const raw = this.getRuntimeService("storage").getLocal("jhs_enabled_sites");
            if (!raw) return fallback;
            const parsed = JSON.parse(raw);
            return Array.isArray(parsed) ? parsed.filter((id => fallback.includes(id))) : fallback;
        } catch (error) {
            return clog.warn("外部站点配置损坏，已回退默认值", error), fallback;
        }
    }
    /** @param {string[]} e */
    saveEnabledSites(e) {
        this.getRuntimeService("storage").setLocal("jhs_enabled_sites", JSON.stringify(e));
    }
    /** @param {OtherSiteView} [view] */
    renderSettingsArea(view = { root: $(document), configs: this.siteConfigs }) {
        const enabled = this.getEnabledSites(), target = view.root.find('[data-jhs-role="site-checkboxes"],#siteCheckboxes').first().empty();
        view.configs.forEach((config => {
            const input = $('<input type="checkbox">').attr("data-site-id", config.id).prop("checked", enabled.includes(config.id));
            target.append($('<label class="jhs-site-option"></label>').append(input, $("<span></span>").text(config.id.replace("Btn", ""))));
        }));
    }
    /** @param {OtherSiteView} [view] */
    setupEventListeners(view = { root: $(document), configs: this.siteConfigs, carNum: null }) {
        const $settingsArea = view.root.find('[data-jhs-other-site-settings],#settingsArea').first();
        view.root.find('[data-jhs-role="site-settings"],#settingSiteBtn').off("click.jhsOtherSite").on("click.jhsOtherSite", (() => {
            $settingsArea.toggleClass("jhs-is-hidden");
        })), $settingsArea.off("change.jhsOtherSite").on("change.jhsOtherSite", 'input[type="checkbox"]', (async (/** @type {JQuerySiteEvent} */ event) => {
            const siteId = $(event.currentTarget).attr("data-site-id");
            try {
                if (event.currentTarget.checked) {
                    view.root.find(`[data-jhs-site-id="${siteId}"],#${siteId}`).removeClass("jhs-is-hidden");
                    const carNum = view.carNum || this.getPageInfo().carNum, site = view.configs.find((item => item.id === siteId));
                    site && await this.prepareSiteLink(carNum, site, view);
                } else view.root.find(`[data-jhs-site-id="${siteId}"],#${siteId}`).addClass("jhs-is-hidden");
                this.saveEnabledSites(/** @type {string[]} */ ($settingsArea.find('input[type="checkbox"]:checked').map(((/** @type {number} */ index, /** @type {HTMLInputElement} */ input) => $(input).attr("data-site-id"))).get()));
            } catch (error) {
                clog.warn(`外部站点 ${siteId || "unknown"} 状态更新失败`, error);
            }
        }));
    }
}
