// @ts-check

import { _, k, m, o, v, y } from "../../core/constants.js";
import { detailStateController } from "../../core/detail-state-controller.js";
import { normalizeBtihHash } from "../../core/feature-helpers.js";
import { markJavDbWantWatch } from "../../core/javdb-api.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { renderTranslatedTitle } from "../../ui/translation/title-translation.js";
import { renderScreenshotPanel } from "../../ui/detail/screenshot-panel.js";
import { createFc2SourceLinks, renderFc2Gallery, renderFc2State } from "../../ui/detail/fc2-workspace-view.js";
import { RelatedPanel } from "../../ui/detail/related-panel.js";
import { ReviewPanel } from "../../ui/detail/review-panel.js";
import { createFc2DetailContext, createFc2DetailShell } from "../status/detail-workspace.js";

/** @typedef {any} JQueryHandle */
/**
 * @typedef {object} Fc2DetailContext
 * @property {JQueryHandle} root
 * @property {string} namespace
 * @property {string} carNum
 * @property {string} url
 * @property {string} source
 * @property {string | null | undefined} movieId
 * @property {number | null | undefined} layerIndex
 * @property {() => boolean} isAlive
 * @property {(name: string) => JQueryHandle} getSlot
 * @property {(name: string) => JQueryHandle} getSection
 * @property {() => void} destroy
 */
/** @typedef {{ id: string, name: string, gender?: number }} MovieActor */
/** @typedef {{ title?: string, carNum?: string, releaseDate?: string, score?: number | string, duration?: number | string, actors?: MovieActor[], imageUrls?: string[] }} Fc2Movie */
/** @typedef {{ hash?: string, title?: string, hasHdTag?: boolean, hasSubtitleTag?: boolean, createdAt?: string, seeders?: number, sizeMb?: number, fileCount?: number }} NativeMagnet */
/** @typedef {{ highQuality: boolean, grade: string, score: { total: number } }} MagnetAssessment */
/** @typedef {{ movieId?: string | null, carNum: string, url: string, source: string, mode: string, layerIndex?: number }} Fc2MountOptions */
/** @typedef {{ fc2Source?: string, url?: string }} Fc2SourceRecord */

export class Fc2Plugin extends BasePlugin {
    getName() { return "Fc2Plugin"; }
    /** @param {string} carNum */
    async resolveMovieId(carNum) {
        const scope = await this.getRuntimeService("scope")();
        return (await this.getRuntimeService("movie").resolve({ carNum }, { scope }))?.movieId || null;
    }
    async initCss() {
        return `<style>
            .movie-detail-layer .layui-layer-content { min-height:0; overflow:hidden; background:var(--jhs-bg); }
            .movie-detail-layer .jhs-fc2-dialog-host { height:100%; min-height:0; }
            .jhs-fc2-workspace { display:grid; grid-auto-rows:max-content; align-content:start; width:min(100%,1440px); min-width:0; margin:0 auto; padding:var(--jhs-space-5); gap:var(--jhs-space-4); box-sizing:border-box; background:var(--jhs-bg); color:var(--jhs-text); }
            .jhs-fc2-workspace[data-jhs-fc2-mode="dialog"] { height:100%; min-height:0; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
            .jhs-fc2-section { min-width:0; overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
            .jhs-fc2-section__header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); padding:var(--jhs-space-3) var(--jhs-space-5); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); }
            .jhs-fc2-section__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); }
            .jhs-fc2-section__actions { display:flex; align-items:center; gap:var(--jhs-space-2); }
            .jhs-fc2-section__content { min-width:0; padding:var(--jhs-space-5); }
            .jhs-fc2-summary { display:grid; grid-template-columns:minmax(220px,34%) minmax(0,1fr); gap:var(--jhs-space-5); }
            .jhs-fc2-preview { display:grid; min-height:240px; place-items:center; overflow:hidden; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
            .jhs-fc2-preview:empty::after { color:var(--jhs-text-faint); content:"暂无预览"; }
            .jhs-fc2-preview img { display:block; width:100%; height:100%; max-height:520px; object-fit:contain; }
            .jhs-fc2-title { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:clamp(20px,2.4vw,28px); line-height:1.35; }
            .jhs-fc2-meta { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2) var(--jhs-space-4); margin-bottom:var(--jhs-space-3); color:var(--jhs-text-muted); }
            .jhs-fc2-actors { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-2); }
            .jhs-fc2-actor { display:inline-flex; padding:var(--jhs-space-1) var(--jhs-space-2); border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
            .jhs-fc2-toolbar { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); margin-top:var(--jhs-space-4); }
            .jhs-fc2-gallery-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(112px,144px)); justify-content:start; gap:var(--jhs-space-3); }
            .jhs-fc2-gallery-item { display:block; width:100%; min-width:0; padding:0; overflow:hidden; border:1px solid transparent; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); aspect-ratio:3/2; cursor:zoom-in; }
            .jhs-fc2-gallery-item:focus-visible { border-color:var(--jhs-accent); outline:2px solid var(--jhs-accent); outline-offset:2px; }
            .jhs-fc2-gallery__image { display:block; width:100%; height:100%; object-fit:cover; }
            .jhs-fc2-screenshot { margin-top:var(--jhs-space-4); overflow:hidden; border-radius:var(--jhs-radius-sm); }
            .jhs-fc2-screenshot:empty { display:none; margin:0; }
            .jhs-fc2-screenshot-thumbnail { width:112px; max-width:100%; }
            .jhs-fc2-resource-stack { display:grid; gap:var(--jhs-space-4); }
            .jhs-fc2-resource-group { min-width:0; }
            .jhs-fc2-resource-group + .jhs-fc2-resource-group { padding-top:var(--jhs-space-4); border-top:1px solid var(--jhs-border); }
            .jhs-fc2-resource-title { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
            .jhs-fc2-magnet-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--jhs-space-3); padding:var(--jhs-space-3) 0; border-bottom:1px solid var(--jhs-border); }
            .jhs-fc2-magnet-item:last-child { border-bottom:0; }
            .jhs-fc2-magnet-name { min-width:0; overflow-wrap:anywhere; }
            .jhs-fc2-magnet-tags { display:flex; flex-wrap:wrap; gap:var(--jhs-space-1); margin-top:var(--jhs-space-2); }
            .jhs-fc2-source-links { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); margin-top:var(--jhs-space-3); }
            .jhs-fc2-resource-group.is-collapsed > [data-jhs-role="magnet-hub"] > [data-jhs-role="magnet-hub-content"] { display:none; }
            .jhs-fc2-state { padding:var(--jhs-space-5); color:var(--jhs-text-muted); text-align:center; }
            .jhs-fc2-state.is-error { color:var(--jhs-danger); }
            @media (max-width:767px) {
                .jhs-fc2-workspace { padding:var(--jhs-space-3); gap:var(--jhs-space-3); }
                .jhs-fc2-section__header,.jhs-fc2-section__content { padding:var(--jhs-space-3); }
                .jhs-fc2-summary { grid-template-columns:1fr; }
                .jhs-fc2-preview { min-height:200px; }
                .jhs-fc2-gallery-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-2); }
                .jhs-fc2-toolbar .jhs-btn,.jhs-fc2-section__actions .jhs-btn { min-height:44px; }
                .jhs-fc2-magnet-item { grid-template-columns:1fr; }
            }
            @media (max-width:420px) { .jhs-fc2-toolbar { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); } .jhs-fc2-toolbar .jhs-btn { width:100%; } }
            @media (max-width:339px) { .jhs-fc2-toolbar { grid-template-columns:1fr; } }
            @media (prefers-reduced-motion:reduce) { .jhs-fc2-workspace * { scroll-behavior:auto!important; transition-duration:0.01ms!important; } }
        </style>`;
    }
    async handle() {
        const fc2Href = "/advanced_search?type=3&score_min=0&d=1";
        $('.navbar-item:contains("FC2")').attr("href", fc2Href), $('.tabs a:contains("FC2")').attr("href", fc2Href);
        if (o.includes("advanced_search?type=3")) $("h2.section-title").contents().first().replaceWith("Fc2PPV"), $(".section .container > .box").remove();
        if (!o.includes("collection_codes?movieId")) return;
        const params = new URLSearchParams(window.location.search), movieId = params.get("movieId"), carNum = params.get("carNum"), url = params.get("url"), explicitSource = params.get("source"), host = $("section").first().empty();
        if (!carNum || !url) return void host.append($('<div class="jhs-fc2-state is-error"></div>').text("FC2 详情参数不完整"));
        const source = [ "fc2", "123av" ].includes(explicitSource || "") ? /** @type {string} */ (explicitSource) : await this.resolveFc2Source({ url });
        const context = this.mountFc2Detail(host, { movieId, carNum, url, source, mode: "page" });
        $(window).off("pagehide.jhsFc2Detail").one("pagehide.jhsFc2Detail", (() => context.destroy()));
    }
    /** @param {string | null} movieId @param {string} carNum @param {string} url @param {{ source?: string }} [options] */
    openFc2Dialog(movieId, carNum, url, { source = "fc2" } = {}) {
        /** @type {Fc2DetailContext | null} */
        let context = null;
        return this.getRuntimeService("dialog").open({ type: 1, title: carNum, content: '<div class="jhs-fc2-dialog-host"></div>', area: utils.getDialogArea("workspace"), skin: "movie-detail-layer", scrollbar: !1, shadeClose: !0,
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
        target.data("jhsFc2Context", context), this.initializeWorkspace(context);
        return context;
    }
    /** @param {Fc2DetailContext} context */
    initializeWorkspace(context) {
        const summary = $('<div class="jhs-fc2-summary"><div class="jhs-fc2-preview" data-jhs-role="main-preview"></div><div class="jhs-fc2-summary__body"><div data-jhs-role="summary-content"><div class="jhs-fc2-state">正在加载影片信息…</div></div></div></div>'), toolbar = $('<div class="jhs-fc2-toolbar" role="toolbar" aria-label="影片操作"></div>');
        [ [ "filterBtn", "jhs-btn--filter", m ], [ "favoriteBtn", "jhs-btn--fav", v ], [ "hasDownBtn", "jhs-btn--down", y ], [ "hasWatchBtn", "jhs-btn--watch", k ] ].forEach((([ id, className, label ]) => toolbar.append($('<button type="button" class="jhs-btn"><span></span></button>').attr("id", id).addClass(className).find("span").text(label).end())));
        toolbar.append('<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="javdb-want" aria-pressed="false" disabled>JavDB 想看（关联中）</button>', '<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="subtitlecat">字幕 (SubtitleCat)</button>', '<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="xunlei">字幕 (迅雷)</button>'), summary.find(".jhs-fc2-summary__body").append(toolbar), context.getSlot("summary").append(summary);
        const gallery = $('<div class="jhs-fc2-gallery-grid" data-jhs-role="gallery-grid"></div>'), screenshot = $('<div class="jhs-fc2-screenshot" data-jhs-role="screenshot"></div>');
        gallery.on(`click${context.namespace}`, ".jhs-fc2-gallery-item", ((/** @type {MouseEvent} */ event) => {
            const image = $(event.currentTarget).find("img")[0];
            image && (/** @type {any} */ (globalThis)).showImageViewer(image, "", { galleryRoot: gallery[0] });
        }));
        context.getSlot("gallery").append(gallery, screenshot);
        const resources = $('<div class="jhs-fc2-resource-stack"></div>'), nativeGroup = this.createResourceGroup("站内磁力", "native-magnets"), sitesGroup = this.createResourceGroup("第三方站点", "other-sites"), hubGroup = this.createResourceGroup("更多磁力来源", "magnet-hub"), hubButton = $('<button type="button" class="jhs-btn jhs-btn--secondary" data-jhs-action="magnet-hub" aria-expanded="false">展开磁力搜索</button>');
        let magnetHubPromise = null;
        hubGroup.find('[data-jhs-role="magnet-hub"]').append(hubButton, '<div data-jhs-role="magnet-hub-content"></div>'), resources.append(nativeGroup, sitesGroup, hubGroup), context.getSlot("resources").append(resources);
        toolbar.on(`click${context.namespace}`, '[data-jhs-action="subtitlecat"]', ((/** @type {MouseEvent} */ event) => {
            const target = this.getRuntimeService("movie").sourceUrls({ carNum: context.carNum }, ["subtitlecat"])[0]?.url;
            if (target) utils.openPage(target, context.carNum, !1, event);
        })), toolbar.on(`click${context.namespace}`, '[data-jhs-action="xunlei"]', (() => this.getDependency("DetailPageButtonPlugin").searchXunLeiSubtitle(context.carNum)));
        hubButton.on(`click${context.namespace}`, (async () => {
            if (!context.isAlive()) return;
            const box = hubGroup.find('[data-jhs-role="magnet-hub-content"]'), expanded = "true" === hubButton.attr("aria-expanded");
            if (expanded) return hubGroup.addClass("is-collapsed"), void hubButton.attr("aria-expanded", "false").text("展开磁力搜索");
            magnetHubPromise ||= this.getDependency("MagnetHubPlugin").createMagnetHub(context.carNum, { root: context.root });
            const hub = await magnetHubPromise;
            if (context.isAlive() && !box.children().length) box.append(hub);
            if (context.isAlive()) hubGroup.removeClass("is-collapsed"), hubButton.attr("aria-expanded", "true").text("收起磁力搜索"), box[0]?.scrollIntoView?.({ block: "nearest" });
        }));
        detailStateController.bind({ root: context.root, layerIndex: context.layerIndex ?? null, carNum: context.carNum, activityType: "fc2-state", getRecord: () => ({ carNum: context.carNum, url: context.url, fc2Source: context.source, names: context.root.find('[data-jhs-role="actress-data"]').text(), publishTime: context.root.find('[data-jhs-role="publish-time"]').text() }) });
        void this.getDependency("FilterTitleKeywordPlugin").bindDetailRoot(context.root, { layerIndex: context.layerIndex ?? null });
        void (/** @type {any} */ (this.getDependency("OtherSitePlugin"))).loadOtherSite(context.carNum.replace("FC2-", ""), context.carNum, { root: context.root, target: sitesGroup.find('[data-jhs-role="other-sites"]'), autoDetect: !1, isActive: context.isAlive }).then((/** @type {JQueryHandle | null} */ box) => { if (context.isAlive() && !box) sitesGroup.remove(); }).catch((/** @type {unknown} */ error) => {
            context.isAlive() && sitesGroup.remove(), clog.error("FC2 外部站点加载失败", error);
        });
        const scopePromise = this.getRuntimeService("scope")();
        void scopePromise.then((/** @type {any} */ scope) => renderScreenshotPanel({
            target: screenshot, carNum: context.carNum.replace("FC2-", ""), screenshot: this.getRuntimeService("screenshot"),
            settings: this.getRuntimeService("settings").snapshot(), scope, isActive: context.isAlive,
        })).then((/** @type {unknown} */ result) => { if (context.isAlive() && !result && !screenshot.children().length) screenshot.remove(); });
        "123av" === context.source ? void this.load123AvDetail(context) : void this.loadNativeDetail(context);
    }
    /** @param {string} title @param {string} role */
    createResourceGroup(title, role) { return $('<section class="jhs-fc2-resource-group"><h3 class="jhs-fc2-resource-title"></h3><div></div></section>').find("h3").text(title).end().find("div").attr("data-jhs-role", role).end(); }
    /** @param {Fc2DetailContext} context */
    async loadNativeDetail(context) {
        const movieIdPromise = Promise.resolve(context.movieId);
        this.configureJavDbWantButton(context, movieIdPromise), await Promise.allSettled([ this.fetchAndRenderNativeDetail(context), this.fetchAndRenderNativeMagnets(context), this.mountPanels(context, movieIdPromise) ]);
    }
    /** @param {Fc2DetailContext} context */
    async load123AvDetail(context) {
        const source = /** @type {any} */ (this.getDependency("Fc2By123AvPlugin")), movieIdPromise = /** @type {Promise<string | null>} */ (source.resolveMovieId(context.carNum));
        void this.configureJavDbWantButton(context, movieIdPromise), void this.mountPanels(context, movieIdPromise), void movieIdPromise.then((movieId => {
            if (context.isAlive()) return this.fetchAndRenderNativeMagnets(context, movieId);
        })).catch((error => {
            context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="native-magnets"]'), "站内磁力关联失败", (() => void this.load123AvMagnets(context))), clog.error("123AV 磁力关联失败", error);
        }));
        await source.loadDetail(context, context.url);
    }
    /** @param {Fc2DetailContext} context */
    async load123AvMagnets(context) {
        const movieId = await (/** @type {any} */ (this.getDependency("Fc2By123AvPlugin"))).resolveMovieId(context.carNum);
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
            button.prop("disabled", !1).text("JavDB 想看").off(`click${context.namespace}`).on(`click${context.namespace}`, (() => void this.submitJavDbWant(context, movieId, button)));
        } catch (error) {
            context.isAlive() && button.prop("disabled", !1).text("JavDB 关联失败，重试").off(`click${context.namespace}`).on(`click${context.namespace}`, (() => void this.configureJavDbWantButton(context, this.resolveMovieId(context.carNum)))), clog.error("FC2 JavDB 想看关联失败", error);
        }
    }
    /** @param {Fc2DetailContext} context @param {string} movieId @param {JQueryHandle} button */
    async submitJavDbWant(context, movieId, button) {
        if (!context.isAlive() || button.data("jhsBusy") || "true" === button.attr("aria-pressed")) return;
        button.data("jhsBusy", !0).attr({ "aria-busy": "true", "aria-disabled": "true" }).text("正在加入想看…");
        try {
            await markJavDbWantWatch(movieId);
            if (!context.isAlive()) return;
            button.attr({ "aria-pressed": "true", "aria-disabled": "false" }).text("已加入 JavDB 想看"), show.ok("已加入 JavDB 想看");
        } catch (error) {
            if (!context.isAlive()) return;
            const normalizedError = /** @type {{ code?: string, message?: string }} */ (error);
            if ("LOGIN_REQUIRED" === normalizedError?.code) {
                button.attr("aria-disabled", "false").text("JavDB 想看");
                const loginPlugin = this.getDependency("TOP250Plugin");
                return loginPlugin?.openLoginDialog({ onSuccess: () => this.submitJavDbWant(context, movieId, button) });
            }
            button.attr("aria-disabled", "false").text("JavDB 想看"), show.error(normalizedError?.message || "加入 JavDB 想看失败"), clog.error("加入 JavDB 想看失败", error);
        } finally {
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
            this.renderSummary(context, movie), renderFc2Gallery(context, movie.imageUrls || []);
            if ((this.getRuntimeService("settings").snapshot().translateTitle ?? _) === _) await renderTranslatedTitle({ root: context.root, carNum: movie.carNum || context.carNum, translation: this.getRuntimeService("translation"), scope });
        } catch (error) {
            context.isAlive() && renderFc2State(context.root.find('[data-jhs-role="summary-content"]'), "影片信息加载失败", (() => void this.fetchAndRenderNativeDetail(context))), clog.error("FC2 详情加载失败", error);
        }
    }
    /** @param {Fc2DetailContext} context @param {Fc2Movie} movie */
    renderSummary(context, movie) {
        const body = context.root.find('[data-jhs-role="summary-content"]').empty(), title = $('<h1 class="jhs-fc2-title"><strong class="current-title"></strong></h1>');
        title.find("strong").text(movie.title || "无标题"), body.append(title);
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
        renderFc2State(host, "正在加载站内磁力…");
        try {
            if (!movieId) return renderFc2State(host, "JavDB 暂无对应作品");
            const scope = await this.getRuntimeService("scope")();
            const magnets = /** @type {NativeMagnet[]} */ (await this.getRuntimeService("magnet").listNative({ movieId, providerId: "javdb" }, { scope }));
            if (!context.isAlive()) return;
            host.empty();
            if (!magnets.length) return renderFc2State(host, "暂无站内磁力");
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
        } catch (error) { context.isAlive() && renderFc2State(host, "站内磁力加载失败", (() => void this.fetchAndRenderNativeMagnets(context, movieId))), clog.error("FC2 磁力加载失败", error); }
    }
    /** @param {Fc2DetailContext} context @param {JQueryHandle} host @param {boolean} hasMatch */
    async bindNativeMagnetFilter(context, host, hasMatch) {
        const section = context.getSection("resources"), actions = section.find(".jhs-fc2-section__actions"), old = actions.find('[data-jhs-action="filter-native-magnets"]');
        old.remove();
        const button = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm" data-jhs-action="filter-native-magnets"></button>'), apply = (/** @type {boolean} */ enabled) => { host.find(".jhs-fc2-magnet-item").show(); enabled && hasMatch && host.find('.jhs-fc2-magnet-item[data-jhs-high-quality="false"]').hide(); button.attr("aria-pressed", String(enabled && hasMatch)).text(hasMatch ? enabled ? "显示全部磁力" : "过滤低质量" : "暂无可过滤项").prop("disabled", !hasMatch); };
        const settings = this.getRuntimeService("settings");
        actions.append(button), apply((settings.snapshot().enableMagnetsFilter ?? _) === _), button.on(`click${context.namespace}`, (async () => { const enabled = "true" !== button.attr("aria-pressed"); apply(enabled), await settings.set("enableMagnetsFilter", enabled ? _ : "no"); }));
    }
    /** @param {Fc2DetailContext} context @param {Promise<string | null | undefined>} movieIdPromise */
    async mountPanels(context, movieIdPromise) {
        try {
            const movieId = await movieIdPromise;
            if (!context.isAlive()) return;
            if (!movieId) return this.clearOwnedPanel(context, "reviews"), this.clearOwnedPanel(context, "related"), renderFc2State(context.getSlot("reviews"), "JavDB 暂无对应作品"), renderFc2State(context.getSlot("related"), "JavDB 暂无对应作品");
            this.clearOwnedPanel(context, "reviews"), this.clearOwnedPanel(context, "related");
            const scope = () => this.getRuntimeService("scope")(), relatedPanel = new RelatedPanel({ related: this.getRuntimeService("related"), settings: this.getRuntimeService("settings"), scope }), reviewPanel = new ReviewPanel({ review: this.getRuntimeService("review"), settings: this.getRuntimeService("settings"), storage: this.getRuntimeService("storage"), scope });
            await Promise.allSettled([ reviewPanel.show(movieId, context.getSlot("reviews"), { ownedSection: context.getSection("reviews"), isActive: context.isAlive }), relatedPanel.show(context.getSlot("related"), movieId, { ownedSection: context.getSection("related"), isActive: context.isAlive }) ]);
        } catch (error) {
            if (!context.isAlive()) return;
            this.clearOwnedPanel(context, "reviews"), this.clearOwnedPanel(context, "related");
            const retry = () => void this.mountPanels(context, this.resolveMovieId(context.carNum));
            renderFc2State(context.getSlot("reviews"), "评论关联失败", retry), renderFc2State(context.getSlot("related"), "相关清单关联失败", retry), clog.error("FC2 JavDB 关联失败", error);
        }
    }
    /** @param {Fc2DetailContext} context @param {string} name */
    clearOwnedPanel(context, name) { context.getSlot(name).empty(), context.getSection(name).find(".jhs-fc2-section__actions").empty(); }
    /** @param {Fc2SourceRecord} [record] */
    async resolveFc2Source(record = {}) {
        if (record.fc2Source && [ "fc2", "123av" ].includes(record.fc2Source)) return record.fc2Source;
        try { return this.getRuntimeService("movie").matchesProviderUrl("av123", new URL(/** @type {string} */ (record.url), window.location.origin).href) ? "123av" : "fc2"; } catch { return "fc2"; }
    }
    /** @param {string | null} movieId @param {string} carNum @param {string} url @param {{ newTab?: boolean }} [navigation] @param {{ source?: string }} [options] */
    async openFc2Page(movieId, carNum, url, navigation = { newTab: !0 }, { source = "fc2" } = {}) {
        const target = new URL("/users/collection_codes", window.location.origin);
        target.searchParams.set("movieId", movieId || ""), target.searchParams.set("carNum", carNum), target.searchParams.set("url", url), target.searchParams.set("source", source);
        utils.openPage(target.href, carNum, !0, navigation);
    }
}
