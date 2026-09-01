// @ts-check

import { C, _, escapeHtml, k, l, m, normalizeCarNum, r, v, y } from "../../core/constants.js";
import { DetailStateController } from "../../core/detail-state-controller.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";
import { createLatestSettingWriter } from "../../ui/settings/setting-binding-controller.js";

/** @typedef {MouseEvent} ActionEvent */
/** @typedef {{ url?: string, extension?: string, [key: string]: any }} SubtitleRecord */

export class DetailPageStateActionsController {
    /** @param {{hostAdapter?: any, movie?: any, dialog?: any, subtitle?: any, state?: any, settings?: any, ui?: any, scope?: any, document?: Document, window?: Window}} [options] */
    constructor(options = {}) {
        this.hostAdapter = options.hostAdapter ?? null;
        this.movie = options.movie ?? null;
        this.dialog = options.dialog ?? null;
        this.subtitle = options.subtitle ?? null;
        this.state = options.state ?? null;
        this.settings = options.settings ?? null;
        this.ui = options.ui ?? null;
        this.scope = options.scope ?? null;
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window;
        /** @type {Record<string, any>} */ this.runtimeServices = {};
        this.disposed = false;
        this.answerCount = 1;
        /** @type {any} */ this.stateBinding = null;
        /** @type {DetailStateController | null} */ this.detailStateController = null;
        /** @type {any} */ this.lifecycleScope = null;
    }
    /** @param {string} name */
    getRuntimeService(name) {
        return this.runtimeServices[name] ?? ({
            host: this.hostAdapter,
            movie: this.movie,
            dialog: this.dialog,
            subtitle: this.subtitle,
            state: this.state,
            settings: this.settings,
            ui: this.ui,
            scope: this.scope,
        }[name] ?? null);
    }
    getJQuery() { return this.ui?.getJQuery?.() ?? /** @type {any} */ (globalThis).$; }
    getShow() { return this.ui?.show ?? /** @type {any} */ (globalThis).show ?? {}; }
    getClog() { return this.ui?.getClog?.() ?? /** @type {any} */ (globalThis).clog ?? {}; }
    getLoading() { return this.ui?.getLoading?.() ?? /** @type {any} */ (globalThis).loading ?? (() => ({ close() {} })); }
    getUtils() { return this.ui?.getUtils?.() ?? /** @type {any} */ (globalThis).utils ?? {}; }
    getPageInfo() { return this.hostAdapter?.readMovieRef?.() ?? {}; }
    async resolveScope() {
        const scope = this.getRuntimeService("scope");
        return typeof scope === "function" ? scope() : scope;
    }
    getDetailStateController() {
        return this.detailStateController ||= new DetailStateController(this.getRuntimeService("state"), this.getRuntimeService("ui"));
    }
    /** @param {{scope?: any, externalMagnets?: any, nativeMagnets?: any}} [options] */
    async handle(options = {}) {
        this.externalMagnets = options.externalMagnets ?? this.externalMagnets;
        this.nativeMagnets = options.nativeMagnets ?? this.nativeMagnets;
        const scope = this.lifecycleScope = options.scope ?? await this.resolveScope();
        if (!scope) return;
        this.scope = scope;
        this.hideVideoControls(scope), this.window?.isDetailPage && (await this.createMenuBtn(), await this.autoRemoveNewVideoMark());
    }
    async autoRemoveNewVideoMark() {
        try {
            const e = this.getRuntimeService("settings")?.snapshot?.().autoRemoveNewVideoMarkAfterBrowse ?? C;
            if (e !== _) return;
            const t = this.getPageInfo();
            if (!t.carNum) return;
            await this.getRuntimeService("state")?.removeFromNewVideoList?.([ t.carNum ], "browse");
        } catch (e) { this.getClog().error?.("自动移除新作品标记失败:", e); }
    }
    async createMenuBtn() {
        const $ = this.getJQuery(), utils = this.getUtils(), show = this.getShow(), clog = this.getClog();
        const e = this.getPageInfo(), t = e.carNum, n = `\n            <div class="jhs-detail-btn-row jhs-layout-e2965a97">\n                <div class="jhs-layout-1e90930a">\n                    <button type="button" id="filterBtn" class="jhs-btn jhs-btn--filter jhs-layout-44293084">\n                        <span>${m}</span>\n                    </button>\n                    <button type="button" id="favoriteBtn" class="jhs-btn jhs-btn--fav jhs-layout-44293084">\n                        <span>${v}</span>\n                    </button>\n                    <button type="button" id="hasDownBtn" class="jhs-btn jhs-btn--down jhs-layout-44293084">\n                        <span>${y}</span>\n                    </button>\n                    <button type="button" id="hasWatchBtn" class="jhs-btn jhs-btn--watch jhs-layout-44293084">\n                        <span>${k}</span>\n                    </button>\n                </div>\n        \n                <div class="jhs-layout-1e90930a">\n                    <button type="button" id="enable-magnets-filter" class="jhs-btn jhs-btn--watch jhs-layout-5f3e3549">\n                        <span id="magnets-span">关闭磁力过滤</span>\n                    </button>\n                    <button type="button" id="magnetSearchBtn" class="jhs-btn jhs-btn--accent jhs-layout-44293084">\n                        <span>磁力搜索</span>\n                    </button>\n                    <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--accent jhs-layout-44293084">\n                        <span>字幕 (迅雷)</span>\n                    </button>\n                    <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--accent jhs-layout-f43f0d6d">\n                        <span>字幕 (SubTitleCat)</span>\n                    </button>\n                </div>\n            </div>\n        `;
        const workspaceSlot = this.getRuntimeService("host")?.locateDetailSlots?.()?.summary;
        const menu = $(n);
        workspaceSlot ? workspaceSlot.append(menu[0]) : r ? $(".tabs").after(menu) : l && $("#mag-submit-show").before(menu), menu.find("#magnetSearchBtn").on("click.jhsDetailActions", (async () => {
            const magnetHub = this.externalMagnets;
            if (!magnetHub) return void show.info("磁力搜索功能已禁用");
            let t = await magnetHub.createMagnetHub(e.carNum);
            this.getRuntimeService("dialog").open({
                type: 1,
                title: "磁力搜索 " + e.carNum,
                content: '<div id="magnetHubBox"></div>',
                area: utils.getResponsiveArea([ "60%", "80%" ]),
                scrollbar: !1,
                success: () => {
                    $("#magnetHubBox").append(t);
                }
            });
        }));
        const a = this.nativeMagnets, settings = this.getRuntimeService("settings"), i = settings.snapshot().enableMagnetsFilter ?? _;
        a || menu.find("#enable-magnets-filter").remove(), menu.find("#magnets-span").text(i === _ ? "关闭磁力过滤" : "开启磁力过滤"), i === _ && a?.doFilterMagnet?.();
        const writeMagnetFilter = createLatestSettingWriter({ settings, key: "enableMagnetsFilter", fallback: C, apply: (value) => {
            const filtering = value === _;
            const label = menu.find("#magnets-span");
            if (filtering) { a?.doFilterMagnet?.(); label.text("关闭磁力过滤"); }
            else { a?.showAll?.(); label.text("开启磁力过滤"); }
        }, onError: (error) => {
            clog.error("磁力过滤设置保存失败，已恢复", error), show.error("磁力过滤设置保存失败，已恢复原设置");
        } });
        menu.find("#enable-magnets-filter").on("click.jhsDetailActions", (async (/** @type {ActionEvent} */ e) => {
            if (!a) return;
            const wasFiltering = "关闭磁力过滤" === $("#magnets-span").text();
            await writeMagnetFilter(!wasFiltering ? _ : C);
        })), menu.find("#search-subtitle-btn").on("click.jhsDetailActions", ((/** @type {ActionEvent} */ e) => {
            const target = this.getRuntimeService("movie").sourceUrls({ carNum: t }, ["subtitlecat"])[0]?.url;
            if (target) utils.openPage(target, t, !1, e);
        })),
        menu.find("#xunLeiSubtitleBtn").on("click.jhsDetailActions", (() => this.searchXunLeiSubtitle(t)));
        if (!t) {
            $("#filterBtn, #favoriteBtn, #hasDownBtn, #hasWatchBtn, #magnetSearchBtn, #xunLeiSubtitleBtn, #search-subtitle-btn").prop("disabled", !0).attr("title", "番号不可用");
            return void clog.warn("详情操作不可用：番号不可用");
        }
        this.stateBinding = this.getDetailStateController().bind({ root: this.document, carNum: t, activityType: "detail-state", getRecord: () => this.getStateRecord() });
        this.lifecycleScope?.addCleanup(() => {
            menu.off(".jhsDetailActions").remove();
            this.stateBinding = null;
            this.lifecycleScope = null;
        });
    }
    /** @param {string} e */
    async showStatus(e) {
        return this.getDetailStateController().render({ root: this.document, carNum: e });
    }
    getStateRecord() {
        const info = this.getPageInfo();
        return { carNum: info.carNum, url: info.url, names: info.actress, publishTime: info.publishTime };
    }
    getStateBinding() {
        if (this.stateBinding) return this.stateBinding;
        const info = this.getPageInfo();
        return this.stateBinding = { root: this.document, layerIndex: null, carNum: normalizeCarNum(info.carNum), getRecord: () => this.getStateRecord(), activityType: "detail-state", selectors: {} };
    }
    /** @param {ActionEvent} event */
    async favoriteOne(event) {
        return this.getDetailStateController().requestToggle(this.getStateBinding(), "favorite", event);
    }
    /** @param {ActionEvent} event */
    async hasDownOne(event) {
        return this.getDetailStateController().requestToggle(this.getStateBinding(), "downloaded", event);
    }
    /** @param {ActionEvent} event */
    async hasWatchOne(event) {
        return this.getDetailStateController().requestToggle(this.getStateBinding(), "watched", event);
    }
    /** @param {string} e */
    async searchXunLeiSubtitle(e) {
        const dialog = this.getRuntimeService("dialog"), subtitle = this.getRuntimeService("subtitle"), scope = this.lifecycleScope ?? await this.resolveScope();
        const utils = this.getUtils(), show = this.getShow(), clog = this.getClog();
        let t = this.getLoading()();
        try {
            const n = await subtitle.search("xunlei", { carNum: e }, { scope });
            n && 0 !== n.length ? dialog.open({
                type: 1,
                title: "迅雷字幕",
                content: '\n                    <div class="jhs-layout-8ddc7c91"> \n                        <div id="xunlei-table-container" class="jhs-layout-583c2485"></div>\n                    </div>\n                ',
                scrollbar: !1,
                area: utils.getResponsiveArea([ "60%", "70%" ]),
                anim: -1,
                success: (/** @type {unknown} */ t, /** @type {number} */ a) => {
                    createJhsTable((/** @type {any} */ (globalThis)).Tabulator, "#xunlei-table-container", {
                        pagination: !1,
                        layout: "fitColumns",
                        placeholder: "暂无数据",
                        virtualDom: !0,
                        data: n,
                        responsiveLayout: "collapse",
                        responsiveLayoutCollapse: !0,
                        columnDefaults: {
                            headerHozAlign: "center",
                            hozAlign: "center"
                        },
                        columns: [ {
                            title: "文件名",
                            field: "name",
                            headerSort: !1,
                            responsive: 0
                        }, {
                            title: "类型",
                            field: "extension",
                            headerSort: !1,
                            responsive: 0
                        }, {
                            title: "操作",
                            responsive: 0,
                            headerSort: !1,
                            formatter: (/** @type {any} */ t, /** @type {any} */ n, /** @type {(callback: () => void) => void} */ a) => {
                                const i = t.getData();
                                return a((() => {
                                    const n = t.getElement().querySelector(".subtitle-preview-btn"), a = t.getElement().querySelector(".subtitle-download-btn");
                                    n && n.addEventListener("click", (async (/** @type {Event} */ t) => {
                                        const a = e + "." + i.extension;
                                        this.previewSubtitle(i, a);
                                    })), a && a.addEventListener("click", (async (/** @type {Event} */ t) => {
                                        const a = e + "." + i.extension, s = await subtitle.download("xunlei", i, { scope });
                                        utils.download(s, a);
                                    }));
                                })), '\n                                        <button type="button" class="jhs-btn jhs-btn--secondary subtitle-preview-btn">预览</button>\n                                        <button type="button" class="jhs-btn jhs-btn--primary subtitle-download-btn">下载</button>\n                                    ';
                            }
                        } ]
                    }), utils.setupEscClose(a);
                }
            }) : show.error("迅雷中找不到相关字幕!");
        } catch (e) {
            clog.error(e), show.error(e);
        } finally {
            t.close();
        }
    }
    /** Trigger the existing detail action surface from a Feature consumer. */
    toggleMagnetFilter() {
        const button = this.getJQuery()("#enable-magnets-filter");
        if (button.length) return button.trigger("click");
    }
    /** Trigger the existing magnet search surface from a Feature consumer. */
    openMagnetSearch() {
        const button = this.getJQuery()("#magnetSearchBtn");
        if (button.length) return button.trigger("click");
    }
    /** Trigger the existing SubtitleCat search surface from a Feature consumer. */
    /** @param {any} [event] */
    openSubtitleSearch(event) {
        const button = this.getJQuery()("#search-subtitle-btn");
        if (button.length) return button.trigger("click", event);
    }
    /** @param {ActionEvent | null} e @param {unknown} t */
    async filterOne(e, t) {
        e && e.preventDefault();
        return this.getDetailStateController().requestToggle(this.getStateBinding(), "blocked", e);
    }
    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    hideVideoControls(scope) {
        const $ = this.getJQuery(), documentRoot = $(this.document);
        documentRoot.off("mouseenter.jhsDetailVideo").on("mouseenter.jhsDetailVideo", "#preview-video", ((/** @type {Event} */ event) => {
            $(event.currentTarget).prop("controls", !0);
        }));
        scope.addCleanup((() => documentRoot.off("mouseenter.jhsDetailVideo")));
    }
    /** @param {SubtitleRecord} subtitle @param {string} t */
    async previewSubtitle(subtitle, t) {
        const utils = this.getUtils(), show = this.getShow(), clog = this.getClog();
        if (!subtitle?.url) return void clog.error?.("未提供文件URL");
        const n = String(subtitle.extension || "").toLowerCase();
        if ("ass" === n || "srt" === n) try {
            const dialog = this.getRuntimeService("dialog");
            const scope = this.lifecycleScope ?? await this.resolveScope();
            let a = await this.getRuntimeService("subtitle").download("xunlei", subtitle, { scope }), i = "字幕预览";
            "ass" === n ? i = "ASS字幕预览 - " + t : "srt" === n && (i = "SRT字幕预览 - " + t);
            const s = a.split("\n");
            let o = "";
            const r = String(s.length).length;
            s.forEach(((/** @type {string} */ e, /** @type {number} */ t) => {
                const n = String(t + 1).padStart(r, " ");
                o += `<span class="jhs-code-line-number">${n}. </span>${escapeHtml(e)}\n`;
            }));
            const l = o;
            dialog.open({
                type: 1,
                title: i,
                area: utils.getResponsiveArea([ "80%", "80%" ]),
                scrollbar: !1,
                content: `<div class="jhs-code-viewer">${l}</div>`,
                btn: [ "下载", "关闭" ],
                btn1: function(/** @type {number} */ e, /** @type {unknown} */ n, /** @type {unknown} */ i) {
                    return utils.download(a, t), !1;
                }
            });
        } catch (a) {
            show.error(`预览失败: ${a instanceof Error ? a.message : String(a)}`), clog.error("预览字幕文件出错:", a);
        } else show.error("仅支持预览ASS和SRT字幕文件");
    }
}

/** Compatibility export for the retained disabled-plugin ID. */
export const DetailPageButtonPlugin = DetailPageStateActionsController;
