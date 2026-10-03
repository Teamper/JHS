// @ts-check

import { createStateActions } from "../../ui/detail/state-actions.js";

import { _, k, m, v, y } from "../../core/constants.js";
import { DetailStateController } from "../../core/detail-state-controller.js";
import { normalizeBtihHash } from "../../core/feature-helpers.js";
import { extractJavDbMovieId } from "../../core/movie-identity.js";
import { getJavDbWantWatchState, markJavDbWantWatch } from "../../core/javdb-api.js";
import { openJavDbLoginDialog } from "./javdb-login-dialog.js";
import { renderTranslatedTitle } from "../../ui/translation/title-translation.js";
import { renderScreenshotPanel } from "../../ui/detail/screenshot-panel.js";
import { createFc2SourceLinks, renderFc2Gallery, renderFc2State } from "../../ui/detail/fc2-workspace-view.js";
import { RelatedPanel } from "../../ui/detail/related-panel.js";
import { ReviewPanel } from "../../ui/detail/review-panel.js";
import { createFc2DetailContext, createFc2DetailShell } from "../../ui/detail/fc2-detail-workspace.js";
import { createLatestSettingWriter } from "../../ui/settings/setting-binding-controller.js";

/** @typedef {any} JQueryHandle */
/**
 * @typedef {object} Fc2DetailContext
 * @property {JQueryHandle} root
 * @property {string} namespace
 * @property {string} carNum
 * @property {string} url
 * @property {string} source
 * @property {string | null | undefined} movieId
 * @property {import("../../core/movie-context.js").MovieContext} movieContext
 * @property {number | null | undefined} layerIndex
 * @property {() => boolean} isAlive
 * @property {(name: string) => JQueryHandle} getSlot
 * @property {(name: string) => JQueryHandle} getSection
 * @property {() => void} destroy
 * @property {(observer: { disconnect?: () => void }) => unknown} addObserver
 * @property {((enabled: boolean) => void) | undefined} [magnetFilterApply]
 * @property {Set<string> | undefined} galleryUrls
 * @property {number | undefined} translationGeneration
 * @property {number | undefined} screenshotGeneration
 * @property {number | undefined} otherSiteGeneration
 * @property {((external?: boolean) => Promise<void>) | undefined} openMagnetHub
 * @property {(() => void) | undefined} syncMagnetHub
 */
/** @typedef {{ id: string, name: string, gender?: number }} MovieActor */
/** @typedef {{ title?: string, originalTitle?: string, coverUrl?: string | null, carNum?: string, releaseDate?: string, score?: number | string, duration?: number | string, actors?: MovieActor[], imageUrls?: string[] }} Fc2Movie */
/** @typedef {{ hash?: string, title?: string, hasHdTag?: boolean, hasSubtitleTag?: boolean, createdAt?: string, seeders?: number, sizeMb?: number, fileCount?: number }} NativeMagnet */
/** @typedef {{ highQuality: boolean, grade: string, score: { total: number } }} MagnetAssessment */
/** @typedef {{ movieId?: string | null, carNum: string, url: string, source: string, mode: string, layerIndex?: number }} Fc2MountOptions */
/** @typedef {{ fc2Source?: string, url?: string }} Fc2SourceRecord */

/** Returns an id only for an explicit JavDB detail route. */
export function parseExplicitJavDbMovieId(/** @type {string} */ value) {
    return extractJavDbMovieId(value, window.location.origin);
}

export class Fc2WorkspaceService {
    /** @param {{runtimeServices?: Record<string, any>, resolveDependency?: (name: string) => any}} [options] */
    constructor(options = {}) {
        this.runtimeServices = Object.freeze({ ...(options.runtimeServices ?? {}) });
        this.logger = this.runtimeServices.logger ?? console;
        this.resolveDependency = options.resolveDependency ?? (() => null);
        this.managedByFeature = true;
        this.runtimeStatus = "managed-feature";
        /** @type {Set<string>} */ this.submittedWantMovieIds = new Set();
        /** @type {Set<string>} */ this.submittingWantMovieIds = new Set();
        /** @type {DetailStateController | null} */
        this.detailStateController = null;
        /** @type {number} */ this.translationGeneration = 0;
        /** @type {any} */ this.featureMagnetHubAdapter = null;
        /** @type {any} */ this.featureExternalSitesAdapter = null;
        /** @type {any} */ this.feature123AvAdapter = null;
    }
    getName() { return "Fc2Plugin"; }
    /** @param {string} name */
    getRuntimeService(name) {
        const service = this.runtimeServices[name];
        if (service === undefined) throw new Error(`FC2 workspace service is unavailable: ${name}`);
        return service;
    }
    /** @param {string} name */
    getOptionalDependency(name) { return this.resolveDependency(name); }
    /** @param {any} adapter */
    attachFeatureMagnetHubAdapter(adapter) {
        this.featureMagnetHubAdapter = adapter;
        this.refreshMagnetHubAvailability();
    }
    /** @param {any} adapter */
    detachFeatureMagnetHubAdapter(adapter) {
        if (this.featureMagnetHubAdapter !== adapter) return;
        this.featureMagnetHubAdapter = null;
        this.refreshMagnetHubAvailability();
    }
    /** Refresh existing empty states when the optional search Feature changes. */
    refreshMagnetHubAvailability() {
        if (typeof $ !== "function") return;
        $(".jhs-fc2-workspace").each((/** @type {number} */ _, /** @type {HTMLElement} */ element) => {
            const context = /** @type {Fc2DetailContext | undefined} */ ($(element).data("jhsFc2Context"));
            if (!context?.isAlive()) return;
            context.syncMagnetHub?.();
            const message = context?.root.find('[data-jhs-role="native-magnets"]').data("jhsNativeEmptyMessage");
            if (context?.isAlive() && message) this.renderNativeMagnetEmpty(context, message);
        });
    }
    /** @param {any} adapter */
    attachFeatureExternalSitesAdapter(adapter) {
        this.featureExternalSitesAdapter = adapter;
        if (!adapter) return;
        $(".jhs-fc2-workspace").each((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => {
            const workspace = $(element), context = /** @type {Fc2DetailContext | undefined} */ (workspace.data("jhsFc2Context"));
            if (!context?.isAlive()) return;
            const resources = context.getSlot("resources");
            let sitesGroup = resources.find('[data-jhs-role="other-sites"]').closest(".jhs-fc2-resource-group");
            if (!sitesGroup.length) {
                sitesGroup = this.createResourceGroup("第三方站点", "other-sites");
                const hubGroup = resources.find('[data-jhs-role="magnet-hub"]').closest(".jhs-fc2-resource-group");
                if (hubGroup.length) sitesGroup.insertBefore(hubGroup);
                else resources.append(sitesGroup);
            }
            this.mountFc2OtherSites(context, sitesGroup, adapter);
        });
    }
    /** @param {any} adapter */
    detachFeatureExternalSitesAdapter(adapter) {
        if (this.featureExternalSitesAdapter !== adapter) return;
        this.featureExternalSitesAdapter = null;
        $(".jhs-fc2-workspace").each((/** @type {number} */ _index, /** @type {HTMLElement} */ element) => {
            const context = /** @type {Fc2DetailContext | undefined} */ ($(element).data("jhsFc2Context"));
            if (!context) return;
            context.otherSiteGeneration = (context.otherSiteGeneration || 0) + 1;
            context.getSlot("resources").find('[data-jhs-role="other-sites"]').closest(".jhs-fc2-resource-group").remove();
        });
    }
    /** @param {any} adapter */
    attachFeature123AvAdapter(adapter) { this.feature123AvAdapter = adapter; }
    /** @param {any} adapter */
    detachFeature123AvAdapter(adapter) { if (this.feature123AvAdapter === adapter) this.feature123AvAdapter = null; }
    /** Exposes the narrow FC2 surface needed by the list-card controller. @returns {{resolveMovieIdForRecord: (carNum: string, url: string) => Promise<any>, resolveFc2Source: (record: Fc2SourceRecord) => Promise<any>, openFc2Page: (movieId: any, carNum: string, url: string, navigation: any, options: any) => Promise<any>, openFc2Dialog: (movieId: any, carNum: string, url: string, options: any) => any, openNativeFallback: (url: string, carNum: string, options: {event: any, newTab: boolean}) => void}} */
    getListNavigationCapability() {
        return Object.freeze({
            resolveMovieIdForRecord: (carNum, url) => this.resolveMovieIdForRecord(carNum, url),
            resolveFc2Source: (record) => this.resolveFc2Source(record),
            openFc2Page: (movieId, carNum, url, navigation, options) => this.openFc2Page(movieId, carNum, url, navigation, options),
            openFc2Dialog: (movieId, carNum, url, options) => this.openFc2Dialog(movieId, carNum, url, options),
            openNativeFallback: (url, carNum, { event, newTab }) => {
                if (newTab) utils.openPage(url, carNum, true, { event, newTab: true });
                else window.location.href = url;
            },
        });
    }
    getDetailStateController() {
        return this.detailStateController ||= new DetailStateController(this.getRuntimeService("state"));
    }
    /** @param {string} carNum */
    async resolveMovieId(carNum) {
        const scope = await this.getRuntimeService("scope")();
        return (await this.getRuntimeService("movie").resolve({ carNum }, { scope }))?.movieId || null;
    }
    /** @param {string} carNum @param {string} [url] */
    async resolveMovieIdForRecord(carNum, url = "") { return parseExplicitJavDbMovieId(url) || this.resolveMovieId(carNum); }
    /** @param {string | null} movieId @param {string} carNum @param {string} url @param {{ source?: string }} [options] */
    openFc2Dialog(movieId, carNum, url, { source = "" } = {}) {
        source = [ "fc2", "123av" ].includes(source) ? source : "";
        /** @type {Fc2DetailContext | null} */
        let context = null;
        return this.getRuntimeService("dialog").open({ type: 1, title: carNum, content: '<div class="jhs-fc2-dialog-host"></div>', ui: { size: "workspace", body: "scroll" }, area: utils.getDialogArea("workspace"), skin: "movie-detail-layer", scrollbar: !1, shadeClose: !0,
            success: (/** @type {HTMLElement} */ layerRoot, /** @type {number} */ layerIndex) => { context = this.mountFc2Detail($(layerRoot).find(".jhs-fc2-dialog-host"), { movieId, carNum, url, source, layerIndex, mode: "dialog" }), utils.setupEscClose(layerIndex); },
            end: () => context?.destroy()
        });
    }
    /** 统一挂载 FC2 与 123AV-FC2 详情。 */
    /** @param {JQueryHandle | HTMLElement} host @param {Fc2MountOptions} options @returns {Fc2DetailContext} */
    mountFc2Detail(host, options) {
        const target = $(host), previous = target.data("jhsFc2Context");
        previous?.destroy?.(), target.empty();
        const shell = createFc2DetailShell(options).appendTo(target), context = /** @type {Fc2DetailContext} */ (/** @type {unknown} */ (createFc2DetailContext(shell, options)));
        target.data("jhsFc2Context", context), context.translationGeneration = 0, context.screenshotGeneration = 0, context.otherSiteGeneration = 0;
        this.initializeWorkspace(context);
        this.bindFc2FeatureLifecycle(context);
        return context;
    }
    /** @param {Fc2DetailContext} context */
    initializeWorkspace(context) {
        const summary = $('<div class="jhs-fc2-summary"><div class="jhs-fc2-preview" data-jhs-role="main-preview"></div><div class="jhs-fc2-summary__body"><div data-jhs-role="summary-content"><div class="jhs-fc2-state">正在加载影片信息…</div></div></div></div>'), toolbar = $('<div class="jhs-fc2-toolbar" role="toolbar" aria-label="影片操作"></div>');
        toolbar.append(createStateActions());
        toolbar.append('<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="javdb-want" aria-pressed="false" disabled>JavDB 想看（关联中）</button>', '<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="subtitlecat">字幕 (SubtitleCat)</button>', '<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="xunlei">字幕 (迅雷)</button>'), summary.find(".jhs-fc2-summary__body").append(toolbar), context.getSlot("summary").append(summary);
        const gallery = $('<div class="jhs-fc2-gallery-grid" data-jhs-role="gallery-grid"></div>'), screenshot = $('<div class="jhs-fc2-screenshot" data-jhs-role="screenshot"></div>');
        gallery.on(`click${context.namespace}`, ".jhs-fc2-gallery-item", ((/** @type {MouseEvent} */ event) => {
            const image = $(event.currentTarget).find("img")[0];
            image && (/** @type {any} */ (globalThis)).showImageViewer(image, "", { galleryRoot: gallery[0] });
        }));
        context.getSlot("gallery").append(gallery, screenshot);
        const resources = $('<div class="jhs-fc2-resource-stack"></div>'), nativeGroup = this.createResourceGroup("站内磁力", "native-magnets"), sitesGroup = this.createResourceGroup("第三方站点", "other-sites"), hubGroup = this.createResourceGroup("更多磁力来源", "magnet-hub"), hubButton = $('<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="magnet-hub" aria-expanded="false">展开磁力搜索</button>');
        let magnetHubPromise = null;
        /** @type {any} */ let mountedMagnetHub = null;
        hubGroup.find('[data-jhs-role="magnet-hub"]').append(hubButton, '<div data-jhs-role="magnet-hub-content"></div>'), resources.append(nativeGroup, sitesGroup, hubGroup), context.getSlot("resources").append(resources);
        toolbar.on(`click${context.namespace}`, '[data-jhs-action="subtitlecat"]', ((/** @type {MouseEvent} */ event) => {
            const target = this.getRuntimeService("movie").sourceUrls({ carNum: context.carNum }, ["subtitlecat"])[0]?.url;
            if (target) utils.openPage(target, context.carNum, !1, event);
        }));
        const detailActions = this.getOptionalDependency("DetailPageButtonPlugin");
        detailActions ? toolbar.on(`click${context.namespace}`, '[data-jhs-action="xunlei"]', (() => detailActions.searchXunLeiSubtitle(context.carNum))) : toolbar.find('[data-jhs-action="xunlei"]').remove();
        context.syncMagnetHub = () => {
            if (this.featureMagnetHubAdapter) {
                if (!hubGroup[0].isConnected) resources.append(hubGroup);
            } else {
                hubGroup.detach().find('[data-jhs-role="magnet-hub-content"]').empty();
                hubButton.attr("aria-expanded", "false").text("展开磁力搜索");
                magnetHubPromise = null;
                mountedMagnetHub = null;
            }
        };
        context.syncMagnetHub();
        context.openMagnetHub = async (external = false) => {
            const magnetHub = this.featureMagnetHubAdapter;
            if (!magnetHub) return;
            if (!context.isAlive()) return;
            if (!hubGroup[0].isConnected) resources.append(hubGroup);
            const box = hubGroup.find('[data-jhs-role="magnet-hub-content"]'), expanded = "true" === hubButton.attr("aria-expanded");
            if (expanded && !external) return hubGroup.addClass("is-collapsed"), void hubButton.attr("aria-expanded", "false").text("展开磁力搜索");
            if (mountedMagnetHub !== magnetHub) {
                mountedMagnetHub = magnetHub;
                magnetHubPromise = null;
                box.empty();
            }
            try {
                magnetHubPromise ||= magnetHub.createMagnetHub({ movieContext: context.movieContext, root: context.root }, {
                    initialEngineId: external ? "all" : undefined,
                    requireExternal: external,
                    isActive: () => context.isAlive() && this.featureMagnetHubAdapter === magnetHub,
                });
                const hub = await magnetHubPromise;
                if (!context.isAlive() || this.featureMagnetHubAdapter !== magnetHub) return;
                if (!box.children().length) box.append(hub);
                if (external) hub.data("jhsOpenExternalMagnets")?.();
                hubGroup.removeClass("is-collapsed"), hubButton.attr("aria-expanded", "true").text("收起磁力搜索"), box[0]?.scrollIntoView?.({ block: "nearest" });
            } catch (error) {
                if (!context.isAlive() || this.featureMagnetHubAdapter !== magnetHub) return;
                magnetHubPromise = null;
                renderFc2State(box, "磁力搜索初始化失败", () => void context.openMagnetHub?.(true));
                hubButton.attr("aria-expanded", "false");
                this.logger.error("FC2 磁力搜索初始化失败", error);
            }
        };
        hubButton.on(`click${context.namespace}`, () => void context.openMagnetHub?.());
        this.getDetailStateController().bind({ root: context.root, layerIndex: context.layerIndex ?? null, carNum: context.carNum, activityType: "fc2-state", getRecord: () => ({ carNum: context.carNum, url: context.url, fc2Source: context.source, names: context.root.find('[data-jhs-role="actress-data"]').text(), publishTime: context.root.find('[data-jhs-role="publish-time"]').text() }) });
        "123av" === context.source ? void this.load123AvDetail(context) : void this.loadNativeDetail(context);
        this.mountFc2OtherSites(context, sitesGroup, this.featureExternalSitesAdapter);
        this.loadFc2Screenshot(context);
    }
    /** FC2 统一 live lifecycle：单一 settings listener，按 key 分发到各功能 mount/unmount/reconfigure。 */
    /** @param {Fc2DetailContext} context */
    bindFc2FeatureLifecycle(context) {
        const settings = this.getRuntimeService("settings"), handler = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.length) return;
            if (names.includes("enableLoadScreenShot")) {
                if (settings.snapshot().enableLoadScreenShot === "no") {
                    context.screenshotGeneration = (context.screenshotGeneration || 0) + 1;
                    this.unmountFc2Screenshot(context);
                } else {
                    void this.loadFc2Screenshot(context);
                }
            }
            if (names.includes("translateTitle")) {
                if ((settings.snapshot().translateTitle ?? _) === _) void this.applyFc2Translation(context);
                else {
                    context.translationGeneration = (context.translationGeneration || 0) + 1;
                    this.revertFc2Translation(context);
                }
            }
            if (names.includes("enableMagnetsFilter")) {
                context.magnetFilterApply?.((settings.snapshot().enableMagnetsFilter ?? _) === _);
            }
            if (names.includes("enableLoadOtherSite")) {
                const sitesGroup = context.getSection("resources").find('[data-jhs-role="other-sites"]').closest(".jhs-fc2-resource-group");
                if (settings.snapshot().enableLoadOtherSite === "no") {
                    context.otherSiteGeneration = (context.otherSiteGeneration || 0) + 1;
                    this.unmountFc2OtherSites(context, sitesGroup);
                } else {
                    void this.mountFc2OtherSites(context, sitesGroup, this.featureExternalSitesAdapter);
                }
            }
        };
        settings.addEventListener("settings.changed", handler);
        context.addObserver({ disconnect: () => settings.removeEventListener("settings.changed", handler) });
    }
    /** ON：渲染 FC2 截图面板；请求返回后再查一次开关，OFF 立即清空（防异步回流）。 */
    /** @param {Fc2DetailContext} context */
    loadFc2Screenshot(context) {
        const screenshotService = this.getRuntimeService("screenshot"), settings = this.getRuntimeService("settings"), screenshot = context.root.find('[data-jhs-role="screenshot"]');
        if (!screenshotService.isEnabled(settings.snapshot())) return void screenshot.empty();
        const generation = (context.screenshotGeneration || 0) + 1;
        context.screenshotGeneration = generation;
        void Promise.resolve().then((() => this.getRuntimeService("scope")())).then((/** @type {any} */ scope) => renderScreenshotPanel({
            target: screenshot, carNum: context.carNum.replace("FC2-", ""), screenshot: screenshotService,
            settings: settings.snapshot(), scope,
            isActive: () => context.isAlive() && settings.snapshot().enableLoadScreenShot !== "no" && generation === context.screenshotGeneration,
            isDuplicate: url => Boolean(context.galleryUrls?.has(url)),
        })).then((/** @type {unknown} */ result) => {
            // 稳定插槽：绝不 remove；渲染函数已写入 empty/error 状态，无需再清空。
            if (!context.isAlive() || generation !== context.screenshotGeneration) return;
            if (settings.snapshot().enableLoadScreenShot === "no") return void screenshot.empty();
            if (!result) return;
        }).catch((error) => {
            if (!context.isAlive() || generation !== context.screenshotGeneration) return;
            screenshot.empty();
            this.logger.error("FC2 剧照初始化失败", error);
        });
    }
    /** OFF：清空 FC2 截图槽（保留节点以便再次开启）。 */
    /** @param {Fc2DetailContext} context */
    unmountFc2Screenshot(context) {
        context.screenshotGeneration = (context.screenshotGeneration || 0) + 1;
        context.root.find('[data-jhs-role="screenshot"]').empty();
    }
    /** ON：按当前 DOM 标题重新翻译（原生/123AV 共用 .current-title）；所有翻译入口唯一实现。 */
    /** @param {Fc2DetailContext} context */
    applyFc2Translation(context) {
        const settings = this.getRuntimeService("settings");
        if (!context.isAlive() || (settings.snapshot().translateTitle ?? _) !== _) return;
        const generation = (context.translationGeneration || 0) + 1;
        context.translationGeneration = generation;
        Promise.resolve().then((() => this.getRuntimeService("scope")())).then((/** @type {any} */ scope) => renderTranslatedTitle({ root: context.root, carNum: context.carNum, translation: this.getRuntimeService("translation"), scope, isActive: () => context.isAlive() && (settings.snapshot().translateTitle ?? _) === _ && generation === context.translationGeneration })).catch((error => this.logger.error("FC2 标题翻译失败", error)));
    }
    /** OFF：移除 FC2 已渲染的翻译节点。 */
    /** @param {Fc2DetailContext} context */
    revertFc2Translation(context) {
        context.root.find(".translated-title").remove();
    }
    /** ON：挂载外部站点面板（方法内部按设置门禁）；只有整个 capability 缺失时才允许移除分组。 */
    /** @param {Fc2DetailContext} context @param {any} sitesGroup @param {any} [otherSite] */
    mountFc2OtherSites(context, sitesGroup, otherSite) {
        if (!otherSite) return void sitesGroup.remove();
        const settings = this.getRuntimeService("settings");
        const generation = (context.otherSiteGeneration || 0) + 1;
        context.otherSiteGeneration = generation;
        sitesGroup.length && sitesGroup.show();
        void Promise.resolve().then((() => otherSite.loadOtherSite(context.carNum.replace("FC2-", ""), context.carNum, { root: context.root, target: sitesGroup.find('[data-jhs-role="other-sites"]'), autoDetect: !1, isActive: () => context.isAlive() && settings.snapshot().enableLoadOtherSite !== "no" && generation === context.otherSiteGeneration }))).then((/** @type {JQueryHandle | null} */ box) => {
            // 稳定插槽：OFF/无结果只隐藏分组，绝不 remove；OFF→ON 仍能重新挂载。
            if (!context.isAlive() || generation !== context.otherSiteGeneration) return;
            box ? sitesGroup.show() : sitesGroup.hide();
        }).catch((/** @type {unknown} */ error) => {
            if (!context.isAlive() || generation !== context.otherSiteGeneration) return;
            sitesGroup.show();
            renderFc2State(context.root.find('[data-jhs-role="other-sites"]'), "外部站点加载失败");
            this.logger.error("FC2 外部站点加载失败", error);
        });
    }
    /** OFF：删除 FC2 内外部站点面板并隐藏分组。 */
    /** @param {Fc2DetailContext} context @param {any} sitesGroup */
    unmountFc2OtherSites(context, sitesGroup) {
        context.otherSiteGeneration = (context.otherSiteGeneration || 0) + 1;
        context.root.find("[data-jhs-other-site-box],[data-jhs-other-site-settings]").remove();
        sitesGroup.length && sitesGroup.hide();
    }
    /** @param {string} title @param {string} role */
    createResourceGroup(title, role) { return $('<section class="jhs-fc2-resource-group"><h3 class="jhs-fc2-resource-title"></h3><div></div></section>').find("h3").text(title).end().find("div").attr("data-jhs-role", role).end(); }
    /** @param {Fc2DetailContext} context */
    async loadNativeDetail(context) {
        const movieIdPromise = Promise.resolve(context.movieId);
        this.configureJavDbWantButton(context, movieIdPromise), await Promise.allSettled([ this.fetchAndRenderNativeDetail(context), this.fetchAndRenderNativeMagnets(context), this.mountPanels(context, movieIdPromise) ]);
        // 初始详情翻译走统一入口（generation/isActive/单飞都在 applyFc2Translation 内）。
        if (context.isAlive()) void this.applyFc2Translation(context);
    }
    /** @param {Fc2DetailContext} context */
    async load123AvDetail(context) {
        let source = this.feature123AvAdapter;
        if (!source && typeof this.runtimeServices.ensureFc2Catalog === "function") {
            try { source = await this.runtimeServices.ensureFc2Catalog(); }
            catch {
                if (context.isAlive()) renderFc2State(context.getSlot("summary"), "123AV 详情初始化失败", () => void this.load123AvDetail(context));
                return;
            }
        }
        if (!context.isAlive()) return;
        if (!source) return void renderFc2State(context.getSlot("summary"), "123AV 详情功能已禁用");
        const movieIdPromise = /** @type {Promise<string | null>} */ (source.resolveMovieId(context.carNum));
        void this.configureJavDbWantButton(context, movieIdPromise), void this.mountPanels(context, movieIdPromise), void movieIdPromise.then((movieId => {
            if (context.isAlive()) return this.fetchAndRenderNativeMagnets(context, movieId);
        })).catch((error => {
            context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="native-magnets"]'), "站内磁力关联失败", (() => void this.load123AvMagnets(context))), this.logger.error("123AV 磁力关联失败", error);
        }));
        await source.loadDetail(context, context.url);
        // 初始 123AV 摘要翻译走统一入口。
        if (context.isAlive()) void this.applyFc2Translation(context);
    }
    /** @param {Fc2DetailContext} context */
    async load123AvMagnets(context) {
        const source = this.feature123AvAdapter;
        if (!source) throw new Error("123AV 详情功能已禁用");
        const movieId = await source.resolveMovieId(context.carNum);
        return this.fetchAndRenderNativeMagnets(context, movieId);
    }
    /** 绑定当前工作区自己的 JavDB“想看”操作。 */
    /** @param {Fc2DetailContext} context @param {Promise<string | null | undefined>} movieIdPromise */
    async configureJavDbWantButton(context, movieIdPromise) {
        const button = context.root.find('[data-jhs-action="javdb-want"]');
        try {
            const movieId = await movieIdPromise;
            if (!context.isAlive()) return;
            if (!movieId) return void button.prop("disabled", !0).text("JavDB 暂无对应作品");
            try {
                const alreadyWanted = await getJavDbWantWatchState(movieId);
                if (!context.isAlive()) return;
                if (alreadyWanted) return void button.prop("disabled", !0).attr("aria-pressed", "true").text("已在 JavDB 想看");
            } catch (error) { try { this.logger.warn("读取 JavDB 想看状态失败，保留手动操作", error); } catch { /* keep manual action available */ } }
            button.prop("disabled", !1).text("JavDB 想看").off(`click${context.namespace}`).on(`click${context.namespace}`, (() => void this.submitJavDbWant(context, movieId, button)));
        } catch (error) {
            context.isAlive() && button.prop("disabled", !1).text("JavDB 关联失败，重试").off(`click${context.namespace}`).on(`click${context.namespace}`, (() => void this.configureJavDbWantButton(context, this.resolveMovieId(context.carNum)))), this.logger.error("FC2 JavDB 想看关联失败", error);
        }
    }
    /** @param {Fc2DetailContext} context @param {string} movieId @param {JQueryHandle} button */
    /** @param {Fc2DetailContext} context @param {string} movieId @param {any} button @returns {Promise<unknown>} */
    async submitJavDbWant(context, movieId, button) {
        if (!context.isAlive() || button.data("jhsBusy") || "true" === button.attr("aria-pressed")) return;
        if (this.submittedWantMovieIds.has(movieId)) {
            button.attr({ "aria-pressed": "true", "aria-disabled": "false" }).text("已加入 JavDB 想看");
            return;
        }
        if (this.submittingWantMovieIds.has(movieId)) return;
        this.submittingWantMovieIds.add(movieId);
        button.data("jhsBusy", !0).attr({ "aria-busy": "true", "aria-disabled": "true" }).text("正在加入想看…");
        try {
            let result;
            try {
                result = await markJavDbWantWatch(movieId);
            } catch (error) {
                if (!context.isAlive()) return;
                const normalizedError = /** @type {{ code?: string, message?: string }} */ (error);
                if ("LOGIN_REQUIRED" === normalizedError?.code) {
                    button.attr("aria-disabled", "false").text("JavDB 想看");
                    return openJavDbLoginDialog({
                        dialog: this.getRuntimeService("dialog"), account: this.getRuntimeService("account"),
                        credential: this.getRuntimeService("credential"), getScope: this.getRuntimeService("scope"),
                        ui: this.getRuntimeService("ui"), notifications: this.getRuntimeService("notifications"), logger: this.logger,
                        onSuccess: () => this.submitJavDbWant(context, movieId, button),
                    });
                }
                button.attr("aria-disabled", "false").text("JavDB 想看"), show.error(normalizedError?.message || "加入 JavDB 想看失败"), this.logger.error("加入 JavDB 想看失败", error);
                return;
            }
            this.submittedWantMovieIds.add(movieId);
            if (!context.isAlive()) return result;
            button.attr({ "aria-pressed": "true", "aria-disabled": "false" }).text("已加入 JavDB 想看");
            try { show.ok("已加入 JavDB 想看"); }
            catch (error) { try { this.logger.warn("JavDB 想看已提交，成功提示失败", error); } catch { /* committed state must win */ } }
            return result;
        } finally {
            this.submittingWantMovieIds.delete(movieId);
            context.isAlive() && button.removeData("jhsBusy").removeAttr("aria-busy");
        }
    }
    /** @param {Fc2DetailContext} context */
    async fetchAndRenderNativeDetail(context) {
        try {
            const scope = await this.getRuntimeService("scope")();
            const movie = await this.getRuntimeService("movie").detail({ movieId: context.movieId, carNum: context.carNum, providerId: "javdb" }, { scope });
            if (!movie) throw new Error("JavDB 影片详情不存在");
            if (!context.isAlive()) return;
            this.renderSummary(context, movie), renderFc2Gallery(context, movie.imageUrls || [], movie.coverUrl || null);
        } catch (error) {
            context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="summary-content"]'), "影片信息加载失败", (() => void this.fetchAndRenderNativeDetail(context))), this.logger.error("FC2 详情加载失败", error);
        }
    }
    /** @param {Fc2DetailContext} context @param {Fc2Movie} movie */
    renderSummary(context, movie) {
        const body = context.root.find('[data-jhs-role="summary-content"]').empty(), title = $('<h1 class="jhs-fc2-title"><strong class="current-title"></strong></h1>');
        title.find("strong").text(movie.title || "无标题"), body.append(title);
        if (movie.originalTitle && movie.originalTitle !== movie.title) body.append($('<div class="jhs-fc2-original-title"></div>').text(movie.originalTitle));
        const meta = $('<div class="jhs-fc2-meta"></div>');
        [ `番号：${movie.carNum || context.carNum}`, `发行：${movie.releaseDate || "未知"}`, `评分：${Number.isFinite(Number(movie.score)) ? movie.score : "无"}`, `时长：${Number.isFinite(Number(movie.duration)) ? movie.duration + " 分钟" : "无"}` ].forEach((value => meta.append($("<span></span>").text(value)))), body.append(meta);
        /** @type {string[]} */
        const actressNames = [];
        const actors = $('<div class="jhs-fc2-actors"><strong>主演：</strong></div>');
        (movie.actors || []).forEach((actor => { actors.append($("<a></a>").addClass("jhs-fc2-actor").attr({ href: `/actors/${encodeURIComponent(actor.id)}`, target: "_blank", rel: "noopener noreferrer" }).text(actor.name || "未知演员")), 0 === actor.gender && actressNames.push(actor.name); }));
        movie.actors?.length || actors.append($("<span></span>").text("暂无演员信息")), body.append(actors, createFc2SourceLinks(context, this.getRuntimeService("movie")), $('<span class="jhs-is-hidden" data-jhs-role="actress-data"></span>').text(actressNames.join(" ")), $('<span class="jhs-is-hidden" data-jhs-role="publish-time"></span>').text(movie.releaseDate || ""));
    }
    /** @param {Fc2DetailContext} context @param {string | null | undefined} [movieId] */
    async fetchAndRenderNativeMagnets(context, movieId = context.movieId) {
        const host = context.root.find('[data-jhs-role="native-magnets"]');
        host.removeData("jhsNativeEmptyMessage");
        renderFc2State(host, "正在加载站内磁力…");
        try {
            if (!movieId) return this.renderNativeMagnetEmpty(context, "JavDB 暂无对应作品");
            const scope = await this.getRuntimeService("scope")();
            const magnets = /** @type {NativeMagnet[]} */ (await this.getRuntimeService("magnet").listNative({ movieId, providerId: "javdb" }, { scope }));
            if (!context.isAlive()) return;
            host.empty();
            if (!magnets.length) return this.renderNativeMagnetEmpty(context, "暂无站内磁力");
            /** @type {MagnetAssessment[]} */
            const assessments = [];
            const magnetService = this.getRuntimeService("magnet");
            magnets.forEach((item => {
                const hash = normalizeBtihHash(item.hash);
                if (!hash) return;
                const magnet = `magnet:?xt=urn:btih:${hash}`, assessment = magnetService.assess({ title: item.title, hasHdTag: item.hasHdTag, hasSubtitleTag: item.hasSubtitleTag, date: item.createdAt, seeders: item.seeders }), row = $('<div class="jhs-fc2-magnet-item"></div>').attr("data-jhs-high-quality", String(assessment.highQuality)), info = $('<div class="jhs-fc2-magnet-name"></div>'), actions = $('<div class="jhs-toolbar"></div>'), tags = $('<div class="jhs-fc2-magnet-tags"></div>');
                assessments.push(assessment), tags.append($("<span></span>").addClass("jhs-badge").attr("title", `磁力质量评分 ${assessment.score.total}`).text(`${assessment.grade} ${assessment.score.total}`)), item.hasHdTag && tags.append('<span class="jhs-badge">高清</span>'), item.hasSubtitleTag && tags.append('<span class="jhs-badge">字幕</span>');
                info.append($("<a></a>").attr("href", magnet).text(item.title || magnet), $("<div></div>").addClass("jhs-fc2-meta").text(`${(Number(item.sizeMb || 0) / 1024).toFixed(2)} GB · ${Number(item.fileCount) || 0} 个文件${item.createdAt ? ` · ${item.createdAt}` : ""}`), tags), actions.append($('<button type="button" class="jhs-btn jhs-btn--secondary copy-to-clipboard">复制</button>').attr("data-clipboard-text", magnet), $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-offline-btn">离线</button>').attr({ "data-resource": magnet, "data-jhs-offline-owner": "fc2" })), host.append(row.append(info, actions));
            }));
            await this.bindNativeMagnetFilter(context, host, assessments.some((item => item.highQuality)));
        } catch (error) { context.isAlive() && renderFc2State(host, "站内磁力加载失败", (() => void this.fetchAndRenderNativeMagnets(context, movieId))), this.logger.error("FC2 磁力加载失败", error); }
    }
    /** Offer external search without making requests while rendering a native empty state. */
    /** @param {Fc2DetailContext} context @param {string} message */
    renderNativeMagnetEmpty(context, message) {
        if (!context.isAlive()) return;
        const host = context.root.find('[data-jhs-role="native-magnets"]');
        host.data("jhsNativeEmptyMessage", message);
        renderFc2State(host, message);
        if (!this.featureMagnetHubAdapter) {
            host.append($("<p></p>").text("外部磁力搜索未启用，请在设置中启用磁力搜索功能"));
            return;
        }
        host.append($("<p></p>").text("站内结果不包含 Sukebei 等外部来源，可继续查询已启用的来源。"),
            $('<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="search-external-magnets">搜索外部磁力</button>').on(`click${context.namespace}`, () => void context.openMagnetHub?.(true)));
    }
    /** @param {Fc2DetailContext} context @param {JQueryHandle} host @param {boolean} hasMatch */
    async bindNativeMagnetFilter(context, host, hasMatch) {
        const section = context.getSection("resources"), actions = section.find(".jhs-fc2-section__actions"), old = actions.find('[data-jhs-action="filter-native-magnets"]');
        old.remove();
        const button = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm" data-jhs-action="filter-native-magnets"></button>'), apply = (/** @type {boolean} */ enabled) => { host.find(".jhs-fc2-magnet-item").show(); enabled && hasMatch && host.find('.jhs-fc2-magnet-item[data-jhs-high-quality="false"]').hide(); button.attr("aria-pressed", String(enabled && hasMatch)).text(hasMatch ? enabled ? "显示全部磁力" : "过滤低质量" : "暂无可过滤项").prop("disabled", !hasMatch); };
        const settings = this.getRuntimeService("settings");
        const writeFilter = createLatestSettingWriter({ settings, key: "enableMagnetsFilter", fallback: "no", apply: (value) => apply(value === _), onError: (error) => {
            this.logger.error("磁力过滤设置保存失败，已恢复", error), show.error("磁力过滤设置保存失败，已恢复原设置");
        } });
        context.magnetFilterApply = apply, actions.append(button), apply((settings.snapshot().enableMagnetsFilter ?? _) === _), button.on(`click${context.namespace}`, (async () => {
            const enabled = button.attr("aria-pressed") !== "true";
            await writeFilter(enabled ? _ : "no");
        }));
    }
    /** @param {Fc2DetailContext} context @param {Promise<string | null | undefined>} movieIdPromise */
    async mountPanels(context, movieIdPromise) {
        try {
            const movieId = await movieIdPromise;
            if (!context.isAlive()) return;
            if (!movieId) return this.clearOwnedPanel(context, "reviews"), this.clearOwnedPanel(context, "related"), renderFc2State(context.getSlot("reviews"), "JavDB 暂无对应作品"), renderFc2State(context.getSlot("related"), "JavDB 暂无对应作品");
            this.clearOwnedPanel(context, "reviews"), this.clearOwnedPanel(context, "related");
            const scope = () => this.getRuntimeService("scope")(), relatedPanel = new RelatedPanel({ related: this.getRuntimeService("related"), settings: this.getRuntimeService("settings"), scope }), reviewPanel = new ReviewPanel({ review: this.getRuntimeService("review"), settings: this.getRuntimeService("settings"), storage: this.getRuntimeService("storage"), scope });
            await Promise.allSettled([ reviewPanel.show(movieId, context.getSlot("reviews"), { ownedSection: context.getSection("reviews"), isActive: context.isAlive, ownCleanup: cleanup => context.addObserver({ disconnect: cleanup }) }), relatedPanel.show(context.getSlot("related"), movieId, { ownedSection: context.getSection("related"), isActive: context.isAlive, ownCleanup: cleanup => context.addObserver({ disconnect: cleanup }) }) ]);
        } catch (error) {
            if (!context.isAlive()) return;
            this.clearOwnedPanel(context, "reviews"), this.clearOwnedPanel(context, "related");
            const retry = () => void this.mountPanels(context, this.resolveMovieId(context.carNum));
            renderFc2State(context.getSlot("reviews"), "评论关联失败", retry), renderFc2State(context.getSlot("related"), "相关清单关联失败", retry), this.logger.error("FC2 JavDB 关联失败", error);
        }
    }
    /** @param {Fc2DetailContext} context @param {string} name */
    clearOwnedPanel(context, name) { context.getSlot(name).empty(), context.getSection(name).find(".jhs-fc2-section__actions").empty(); }
    /** @param {Fc2SourceRecord} [record] */
    async resolveFc2Source(record = {}) {
        if (record.fc2Source && [ "fc2", "123av" ].includes(record.fc2Source)) return record.fc2Source;
        try {
            const url = new URL(/** @type {string} */ (record.url || ""), window.location.origin);
            if (this.getRuntimeService("movie").matchesProviderUrl("av123", url.href)) return "123av";
            return url.origin === window.location.origin ? "fc2" : "";
        } catch { return ""; }
    }
    /** Build an owned FC2 detail URL only after a movie identity has been resolved. @param {string} movieId @param {string} carNum @param {string} url @param {{source?: string}} [options] */
    createFc2PageUrl(movieId, carNum, url, { source = "" } = {}) {
        if (!String(movieId || "").trim()) throw new TypeError("FC2 owned detail requires movieId");
        const target = new URL("/users/collection_codes", window.location.origin);
        target.searchParams.set("movieId", String(movieId).trim()), target.searchParams.set("carNum", carNum), target.searchParams.set("url", url), target.searchParams.set("source", source);
        return target.href;
    }
    /** @param {string | null} movieId @param {string} carNum @param {string} url @param {{ newTab?: boolean }} [navigation] @param {{ source?: string }} [options] */
    async openFc2Page(movieId, carNum, url, navigation = { newTab: !0 }, { source = "" } = {}) {
        source = [ "fc2", "123av" ].includes(source) ? source : "";
        const resolvedMovieId = String(movieId || "").trim();
        if (!resolvedMovieId) return void utils.openPage(url, carNum, !0, navigation);
        utils.openPage(this.createFc2PageUrl(resolvedMovieId, carNum, url, { source }), carNum, !0, navigation);
    }
}
