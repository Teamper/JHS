// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { normalizeMovieCarNum } from "../../core/movie-identity.js";
import { PRODUCT_NAMES } from "../../core/product-names.js";

/** @type {Record<string, string>} */
const SITE_NAMES = {
    javTrailersBtn: PRODUCT_NAMES.javtrailers, "123AvBtn": PRODUCT_NAMES.av123,
    jableBtn: PRODUCT_NAMES.jable, avgleBtn: PRODUCT_NAMES.avgle, missAvBtn: PRODUCT_NAMES.missav,
    supJavBtn: PRODUCT_NAMES.supjav, javDbBtn: PRODUCT_NAMES.javdb, javBusBtn: PRODUCT_NAMES.javbus,
    fanzaBtn: PRODUCT_NAMES.dmm,
};

/** @typedef {{ id: string, providerId?: string, noHandle?: boolean, condition?: (carNum: string | null) => boolean, searchUrl?: (carNum: string) => string, baseUrl?: string }} SiteConfig */
/** @typedef {{ root?: Element | any, target?: Element | any, scope?: LifecycleScope, isActive?: () => boolean, autoDetect?: boolean }} OtherSiteLoadOptions */
/** @typedef {{ carNum: string | null, configs: SiteConfig[], box: any, settings: any, scope: LifecycleScope, options: OtherSiteLoadOptions }} OtherSiteView */

export class OtherSitesController {
    /** @param {{document: Document, jquery: (value: any) => any, hostAdapter: any, movie: any, storage: any, settings: any, events: any, scope: LifecycleScope, styles: import("../../contracts/ports.js").StylePort, ui: any, notifications: any, diagnostics: any, site: string, route: string}} options */
    constructor({ document, jquery, hostAdapter, movie, storage, settings, events, scope, styles, ui, notifications, diagnostics, site, route }) {
        this.document = document;
        this.managedByFeature = true;
        this.$ = jquery;
        this.hostAdapter = hostAdapter;
        this.movie = movie;
        this.storage = storage;
        this.settings = settings;
        this.events = events;
        this.scope = scope;
        this.ui = ui;
        this.notifications = notifications;
        this.diagnostics = diagnostics;
        this.route = route;
        this.styles = styles;
        /** @type {Map<Node, OtherSiteView>} */ this.views = new Map();
        this.styleRegistered = false;
        /** @type {SiteConfig[]} */ this.siteConfigs = [
            { id: "javTrailersBtn" }, { id: "123AvBtn", providerId: "av123" }, { id: "jableBtn" },
            { id: "avgleBtn" }, { id: "missAvBtn" }, { id: "supJavBtn" },
            { id: "javDbBtn", condition: () => site === "javbus" },
            { id: "javBusBtn", condition: carNum => site === "javdb" && Boolean(carNum && !carNum.includes("FC2")) },
            { id: "fanzaBtn", providerId: "dmm", noHandle: true, condition: carNum => Boolean(carNum && !carNum.includes("FC2")) },
        ];
    }
    getName() { return "OtherSitePlugin"; }

    getSiteConfigs() {
        const definitions = this.movie.externalSites(this.settings.snapshot());
        return this.siteConfigs.map(config => ({ ...definitions.find((/** @type {SiteConfig} */ item) => item.id === config.id), ...config }));
    }
    initCss() {
        return `
                [data-jhs-other-site-box], [data-jhs-other-site-settings], #otherSiteBox, #settingsArea { margin-top:var(--jhs-space-2); user-select:none; }
                .jhs-site-list, [data-jhs-role="site-checkboxes"], #siteCheckboxes { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .site-btn { position:relative; }
                .site-btn::before { width:7px; height:7px; border-radius:50%; background:var(--jhs-brand-color,var(--jhs-text-faint)); content:""; }
                [data-jhs-site-id="javTrailersBtn"],#javTrailersBtn { --jhs-brand-color:var(--jhs-site-javtrailers); } [data-jhs-site-id="123AvBtn"],#123AvBtn { --jhs-brand-color:var(--jhs-site-av123); }
                [data-jhs-site-id="jableBtn"],#jableBtn { --jhs-brand-color:var(--jhs-site-jable); } [data-jhs-site-id="avgleBtn"],#avgleBtn { --jhs-brand-color:var(--jhs-site-avgle); }
                [data-jhs-site-id="missAvBtn"],#missAvBtn { --jhs-brand-color:var(--jhs-site-missav); } [data-jhs-site-id="supJavBtn"],#supJavBtn { --jhs-brand-color:var(--jhs-site-supjav); }
                [data-jhs-site-id="javDbBtn"],#javDbBtn { --jhs-brand-color:var(--jhs-site-javdb); } [data-jhs-site-id="javBusBtn"],#javBusBtn { --jhs-brand-color:var(--jhs-site-javbus); } [data-jhs-site-id="fanzaBtn"],#fanzaBtn { --jhs-brand-color:var(--jhs-site-dmm); }
                .site-btn.is-checking { cursor:progress; }
                .site-btn.is-available { border-color:var(--jhs-success-text); background:var(--jhs-success-tint); color:var(--jhs-success-text); }
                .site-btn.is-unavailable { border-color:var(--jhs-danger-text); background:var(--jhs-danger-tint); color:var(--jhs-danger-text); }
                .site-btn.is-domain-error { border-color:var(--jhs-warning-text); background:var(--jhs-warning-tint); color:var(--jhs-warning-text); }
                .site-tag { margin-left:var(--jhs-space-1); padding:var(--jhs-space-half) var(--jhs-space-1); border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-site-option { display:flex; align-items:center; gap:var(--jhs-space-2); }
`;
    }
    start() {
        const safeMount = (/** @type {string | null} */ carNum, /** @type {OtherSiteLoadOptions} */ options = {}) => {
            void this.loadOtherSite(carNum, null, options).catch(error => this.report(error));
        };
        let ready = false;
        this.scope.addCleanup(this.events.on("jhs-features-ready", () => {
            ready = true;
            if (this.route === "detail") safeMount(null);
        }));
        this.scope.listen(this.settings, "settings.changed", event => {
            const names = /** @type {CustomEvent} */ (event).detail.names;
            if (names.includes("enableLoadOtherSite")) {
                if (this.settings.snapshot().enableLoadOtherSite === "no") this.unmount();
                else if (ready && this.route === "detail" && !this.views.has(this.document)) safeMount(null);
            }
            if (names.some((/** @type {string} */ name) => name.endsWith("Url"))) {
                for (const view of [...this.views.values()]) {
                    if (this.isActive(view)) safeMount(view.carNum, view.options);
                }
            } else if (names.includes("enabledExternalSites")) {
                for (const view of this.views.values()) this.applySelection(view);
            }
        });
        return true;
    }
    unmount() { for (const view of this.views.values()) view.scope.dispose(); }
    stop() { this.unmount(); }
    dispose() { this.unmount(); }
    /** @param {unknown} error */
    report(error) {
        this.diagnostics.recordError({ source:"external-sites-feature", featureId:"external-sites", message:error instanceof Error ? error.message : String(error) });
    }
    /** @param {OtherSiteView} view */
    isActive(view) { return !view.scope.disposed && view.options.isActive?.() !== false; }

    /** @param {string | null} requested @param {string | null} sourceCarNum @param {OtherSiteLoadOptions} [options] */
    async loadOtherSite(requested, sourceCarNum, options = {}) {
        if (this.scope.disposed || options.scope?.disposed || options.isActive?.() === false || this.settings.snapshot().enableLoadOtherSite === "no") return;
        const $ = this.$;
        const target = options.target ? $(options.target) : $(this.hostAdapter.locateDetailSlots().summary);
        if (!target.length) return;
        const key = options.root ? $(options.root)[0] : this.document;
        const carNum = normalizeMovieCarNum(sourceCarNum ?? requested ?? this.hostAdapter.readMovieRef()?.carNum);
        const configs = this.getSiteConfigs().filter(config => !config.condition || config.condition(carNum));
        this.views.get(key)?.scope.dispose();
        if (!this.styleRegistered) {
            this.scope.addCleanup(this.styles.register("jhs-detail-external-sites-feature", this.initCss()));
            this.styleRegistered = true;
        }
        const box = $('<div class="panel-block" data-jhs-other-site-box><div class="jhs-site-list"></div></div>');
        const settings = $('<div class="panel-block jhs-is-hidden" data-jhs-other-site-settings><div data-jhs-role="site-checkboxes"></div></div>');
        const scope = new LifecycleScope("other-sites"), view = { box, settings, scope, carNum, configs, options };
        const release = (options.scope ?? this.scope).addCleanup(() => scope.dispose());
        scope.addCleanup(() => { release(); this.views.delete(key); box.remove(); settings.remove(); });
        this.views.set(key, view);

        const list = box.find(".jhs-site-list"), choices = settings.find('[data-jhs-role="site-checkboxes"]');
        for (const config of configs) {
            const name = SITE_NAMES[config.id] ?? "第三方站点";
            const link = $('<a target="_blank" rel="noopener noreferrer" class="site-btn jhs-btn jhs-btn--secondary"></a>').attr("data-jhs-site-id", config.id).text(name);
            const url = carNum && this.searchUrl(config, carNum);
            if (url) link.attr({ href: url, title: "前往第三方搜索页" });
            else link.attr({ "aria-disabled": "true", title: carNum ? "第三方站点地址不可用" : "番号不可用" });
            list.append(link);
            const input = $('<input type="checkbox" class="jhs-checkbox">').attr("data-site-id", config.id);
            choices.append($('<label class="jhs-site-option"></label>').append(input, $("<span>").text(name)));
        }
        this.applySelection(view);
        list.append('<button type="button" class="site-btn jhs-btn jhs-btn--secondary" data-jhs-role="detect-sites">检测第三方站点</button>',
            '<button type="button" class="site-btn jhs-btn jhs-btn--secondary" data-jhs-role="site-settings">设置</button>');
        const detect = box.find('[data-jhs-role="detect-sites"]').prop("disabled", !carNum);
        box.find('[data-jhs-role="site-settings"]').on("click", () => settings.toggleClass("jhs-is-hidden"));
        box.find('[data-jhs-site-id="javTrailersBtn"]').on("click", (/** @type {MouseEvent} */ event) => {
            const href = $(event.currentTarget).attr("href");
            if (!href) return;
            event.preventDefault();
            const destination = new URL(href);
            if (!event.ctrlKey && !event.metaKey) destination.searchParams.set("handle", "1");
            this.ui.openPage(destination.href, carNum, false, event);
        });
        settings.on("change", "input[data-site-id]", async (/** @type {Event} */ event) => {
            const input = /** @type {HTMLInputElement} */ (event.currentTarget), id = input.dataset.siteId;
            if (!id) return;
            try {
                await this.settings.update((/** @type {Record<string, any>} */ draft) => {
                    const selected = new Set(draft.enabledExternalSites ?? this.siteConfigs.map(site => site.id));
                    if (input.checked) selected.add(id); else selected.delete(id);
                    draft.enabledExternalSites = [...selected];
                });
            } catch (error) {
                if (!this.isActive(view)) return;
                this.applySelection(view);
                this.notifications.error(error instanceof Error ? error.message : String(error));
            }
        });
        const runDetection = async () => {
            if (!carNum || detect.prop("disabled")) return;
            detect.text("检测中").prop("disabled", true).attr("aria-busy", "true");
            try {
                const enabled = this.getEnabledSites();
                await mapLimit(configs.filter(site => enabled.includes(site.id)), 4, config => this.handleSite(view, config, carNum));
            } finally {
                if (this.isActive(view)) detect.text("检测第三方站点").prop("disabled", false).removeAttr("aria-busy");
            }
        };
        detect.on("click", () => { void runDetection().catch(error => this.report(error)); });
        target.append(box, settings);
        if (options.autoDetect) await runDetection();
        return this.isActive(view) ? box : undefined;
    }

    /** @param {SiteConfig} config @param {string} carNum */
    searchUrl(config, carNum) {
        return config.providerId ? this.movie.searchUrl(config.providerId, { carNum }) : config.searchUrl?.(carNum.replace(/^FC2-/, ""));
    }
    getEnabledSites() { return this.settings.snapshot().enabledExternalSites ?? this.siteConfigs.map(site => site.id); }
    /** @param {OtherSiteView} view */
    applySelection(view) {
        const enabled = this.getEnabledSites();
        for (const { id } of view.configs) {
            view.box.find('a[data-jhs-site-id="' + id + '"]').toggleClass("jhs-is-hidden", !enabled.includes(id));
            view.settings.find('input[data-site-id="' + id + '"]').prop("checked", enabled.includes(id));
        }
    }

    /** @param {OtherSiteView} view @param {SiteConfig} config @param {string} carNum */
    async handleSite(view, config, carNum) {
        if (!this.isActive(view)) return;
        const fallback = this.searchUrl(config, carNum);
        if (!fallback) return;
        const link = view.box.find('a[data-jhs-site-id="' + config.id + '"]');
        link.attr({ href: fallback, "aria-busy": "true" }).removeClass("is-available is-unavailable is-domain-error").addClass("is-checking");
        link.find(".site-tag").remove();
        try {
            let matches;
            if (config.noHandle) {
                const cached = this.storage.getLocal("jhs_other_site_dmm");
                const result = cached ? JSON.parse(cached)[carNum] : null;
                if (result?.url) {
                    link.attr("href", result.url).addClass("is-available");
                    if (result.type === "multiple") link.append('<span class="site-tag">多结果</span>');
                }
                return;
            }
            if (config.providerId) {
                const resolved = await this.movie.resolve({ carNum, providerId: config.providerId }, { scope: view.scope });
                matches = resolved?.url ? [resolved.url] : [];
            } else {
                const result = await this.movie.searchExternalSite(config.id, carNum.replace(/^FC2-/, ""), { settings: this.settings.snapshot(), scope: view.scope });
                matches = result.matches;
            }
            if (!this.isActive(view)) return;
            if (!matches.length) link.addClass("is-unavailable").attr("title", "未找到影片，点击前往搜索页");
            else {
                link.addClass("is-available").attr("title", matches.length === 1 ? "前往影片详情" : "前往第三方搜索页");
                if (matches.length === 1) link.attr("href", matches[0]);
                else link.append('<span class="site-tag">多结果</span>');
            }
        } catch (error) {
            if (!this.isActive(view)) return;
            const code = /** @type {{code?: string}} */ (error)?.code;
            const messages = { CIRCUIT_OPEN: "此来源暂不可用，请稍后重试", CF_BLOCKED: "站点安全验证未通过，请稍后重试",
                INVALID_URL: "站点地址不可用，请在设置中检查", NOT_FOUND: "未找到影片，点击前往搜索页" };
            const domainError = code === "CF_BLOCKED" || code === "CIRCUIT_OPEN" || code === "INVALID_URL";
            link.addClass(domainError ? "is-domain-error" : "is-unavailable").attr("title", messages[/** @type {keyof typeof messages} */ (code)] ?? "检测失败，点击前往搜索页");
            this.notifications.debug("检测第三方站点失败", error);
            if (!domainError && code !== "NOT_FOUND") this.report(error);
        } finally {
            if (this.isActive(view)) link.removeAttr("aria-busy").removeClass("is-checking");
        }
    }
}
