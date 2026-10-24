// @ts-check

import { createStateActions } from "../../ui/detail/state-actions.js";
import { C, _, escapeHtml, normalizeCarNum } from "../../core/constants.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";
import { createLatestSettingWriter } from "../../ui/settings/setting-binding-controller.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";

/** @typedef {{ url?: string, extension?: string, [key: string]: any }} SubtitleRecord */

/** Detail-page controls owned by the Detail Feature; the returned adapter keeps old cross-feature calls stable. */
export class DetailPageActionsController {
    /** @param {{hostAdapter: any, route: string, scope: import("../../core/lifecycle-scope.js").LifecycleScope, settings: any, dialog: any, subtitle: any, ui: any, notifications: any, events: any, diagnostics: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.scope = options.scope;
        this.settings = options.settings;
        this.dialog = options.dialog;
        this.subtitle = options.subtitle;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.events = options.events;
        this.diagnostics = options.diagnostics;
        this.document = this.hostAdapter.document;
        this.jquery = this.ui.jquery;
        this.stateActions = null;
        this.featureWorkspace = null;
        this.featureMagnetFilterAdapter = null;
        this.featureMagnetHubAdapter = null;
        this.magnetDialog = null;
        this.stateBinding = null;
        /** @type {WeakMap<LifecycleScope, Map<string, LifecycleScope>>} */
        this.subtitleOperations = new WeakMap();
    }

    getName() { return "DetailPageButtonPlugin"; }

    getFeatureStateActionsAdapter() {
        const ui = this.ui;
        return {
            readPageInfo: () => this.getPageInfo(),
            ui: Object.freeze({
                document: this.document,
                jquery: (/** @type {any} */ value) => ui.jquery(value),
                confirm: (/** @type {MouseEvent | null} */ event, /** @type {string} */ message, /** @type {() => any} */ accept, /** @type {{confirmText?: string, cancelText?: string}} */ options) => ui.confirm(event, message, accept, options),
                closePage: (/** @type {any} */ options) => ui.closePage(options),
                reportError: (/** @type {string} */ message) => this.notifications.error(message),
                /** @param {...unknown} args */
                logError: (...args) => this.diagnostics.recordError({ source: "detail-page-actions", message: args.map(String).join(" ") }),
            }),
            attach: (/** @type {any} */ controller) => { this.stateActions = controller; },
            attachWorkspace: (/** @type {any} */ controller) => { this.featureWorkspace = controller; },
            detachWorkspace: (/** @type {any} */ controller) => { if (this.featureWorkspace === controller) this.featureWorkspace = null; },
        };
    }

    /** @param {any} adapter */
    attachFeatureMagnetFilterAdapter(adapter) { this.featureMagnetFilterAdapter = adapter; }
    /** @param {any} adapter */
    detachFeatureMagnetFilterAdapter(adapter) { if (this.featureMagnetFilterAdapter === adapter) this.featureMagnetFilterAdapter = null; }
    /** @param {any} adapter */
    attachFeatureMagnetHubAdapter(adapter) { this.featureMagnetHubAdapter = adapter; }
    /** @param {any} adapter */
    detachFeatureMagnetHubAdapter(adapter) { if (this.featureMagnetHubAdapter === adapter) { this.featureMagnetHubAdapter = null; this.closeMagnetDialog(); } }

    closeMagnetDialog() {
        const active = this.magnetDialog;
        if (!active) return;
        active.open = false;
        this.magnetDialog = null;
        if (active.index !== null) this.dialog.close(active.index);
    }

    /** Await the source surface inside its own dialog and discard late results after closing. */
    /** @param {string} carNum */
    openMagnetDialog(carNum) {
        const magnetHub = this.featureMagnetHubAdapter;
        if (!magnetHub) return void this.notifications.info("磁力搜索功能已关闭");
        if (this.magnetDialog?.open) return;
        /** @type {{open: boolean, index: number|null, content: any}} */
        const active = { open: true, index: null, content: null };
        this.magnetDialog = active;
        const load = async () => {
            const content = active.content;
            if (!content?.length) return;
            content.attr("aria-busy", "true").empty().text("加载中…");
            try {
                const hub = await magnetHub.createMagnetHub(carNum);
                if (!active.open || this.scope.disposed || this.featureMagnetHubAdapter !== magnetHub || !content[0]?.isConnected) return;
                content.removeAttr("role").empty().append(hub);
            } catch (error) {
                if (!active.open || this.scope.disposed || !content[0]?.isConnected) return;
                this.diagnostics.recordError({ source: "detail-page-actions", message: "磁力来源初始化失败", error });
                content.empty().append(this.jquery('<p class="magnet-error"></p>').text("磁力来源加载失败"), this.jquery('<button type="button" class="jhs-btn jhs-btn--secondary">重试</button>').on("click", () => void load()));
            } finally {
                content.attr("aria-busy", "false");
            }
        };
        try {
            active.index = this.dialog.open({
                type: 1, title: `磁力搜索 ${carNum}`, content: '<div class="jhs-magnet-dialog" role="status" aria-live="polite">加载中…</div>',
                area: this.ui.getResponsiveArea(["60%", "80%"]), scrollbar: false,
                success: (/** @type {any} */ element) => {
                    active.content = this.jquery(element).find(".jhs-magnet-dialog");
                    void load();
                },
                end: () => { active.open = false; active.content?.attr("aria-busy", "false"); if (this.magnetDialog === active) this.magnetDialog = null; },
            });
        } catch (error) {
            active.open = false;
            this.magnetDialog = null;
            this.diagnostics.recordError({ source: "detail-page-actions", message: "磁力搜索打开失败", error });
            this.notifications.error("磁力搜索打开失败");
        }
    }

    getPageInfo() {
        const info = this.hostAdapter.readMovieInfo?.() ?? this.hostAdapter.readMovieRef?.() ?? {};
        return {
            carNum: normalizeCarNum(info.carNum), stateEligibility: info.stateEligibility, url: info.url ?? this.hostAdapter.location?.href ?? "",
            actress: info.actress ?? "", actors: info.actors ?? "", publishTime: info.publishTime ?? "",
        };
    }

    start() {
        this.scope.assertActive();
        if (this.route !== "detail") return false;
        this.hideVideoControls();
        if (!this.createMenuBtn()) return false;
        const release = this.events?.on?.("car-state-changed", (/** @type {{carNums?: string[]}} */ payload) => {
            const carNum = this.getPageInfo().carNum;
            if (carNum && payload.carNums?.includes(carNum)) void this.showStatus(carNum);
        });
        if (typeof release === "function") this.scope.addCleanup(release);
        return true;
    }

    createMenuBtn() {
        const info = this.getPageInfo(), carNum = info.carNum;
        const $ = this.jquery;
        const row = $(`
            <div class="jhs-detail-btn-row jhs-layout-e2965a97" data-jhs-detail-actions>
                <div data-jhs-state-slot></div>
                <div class="jhs-layout-1e90930a">
                    <button type="button" id="enable-magnets-filter" class="jhs-btn jhs-btn--secondary jhs-layout-5f3e3549"><span id="magnets-span">关闭磁力过滤</span></button>
                    <button type="button" id="magnetSearchBtn" class="jhs-btn jhs-btn--accent"><span>磁力搜索</span></button>
                    <button type="button" id="xunLeiSubtitleBtn" class="jhs-btn jhs-btn--secondary"><span>字幕（迅雷）</span></button>
                    <button type="button" id="search-subtitle-btn" class="jhs-btn jhs-btn--secondary jhs-layout-f43f0d6d"><span>字幕（SubtitleCat）</span></button>
                </div>
            </div>
        `);
        row.find("[data-jhs-state-slot]").replaceWith(createStateActions({ jquery: $ }));
        const workspaceSlot = this.featureWorkspace?.getSlot?.("summary-actions");
        let mounted = false;
        if (workspaceSlot?.length) { workspaceSlot.append(row); mounted = true; }
        else mounted = this.hostAdapter.mountDetailActions?.(row[0]) === true;
        this.scope.addCleanup(() => { this.closeMagnetDialog(); row.off(".jhsDetailActions").remove(); });
        if (!mounted) return false;

        row.on("click.jhsDetailActions", "#magnetSearchBtn", () => this.openMagnetDialog(carNum ?? ""));

        const magnetFilter = this.featureMagnetFilterAdapter, current = this.settings.snapshot().enableMagnetsFilter ?? _;
        if (!magnetFilter) row.find("#enable-magnets-filter").remove();
        row.find("#magnets-span").text(current === _ ? "关闭磁力过滤" : "开启磁力过滤");
        magnetFilter?.reconfigure?.();
        const writeMagnetFilter = createLatestSettingWriter({ settings: this.settings, key: "enableMagnetsFilter", fallback: C, apply: (value) => {
            const filtering = value === _;
            if (filtering) magnetFilter?.doFilterMagnet?.(); else magnetFilter?.showAll?.();
            row.find("#magnets-span").text(filtering ? "关闭磁力过滤" : "开启磁力过滤");
        }, onError: (error) => {
            this.diagnostics.recordError({ source: "detail-page-actions", contributionId: "detail.page-state-actions", message: `磁力过滤设置保存失败: ${error instanceof Error ? error.message : String(error)}` });
            this.notifications.error("磁力过滤设置保存失败，已恢复原设置");
        } });
        row.on("click.jhsDetailActions", "#enable-magnets-filter", async () => {
            if (!magnetFilter) return;
            const wasFiltering = row.find("#magnets-span").text() === "关闭磁力过滤";
            await writeMagnetFilter(wasFiltering ? C : _);
        });
        row.on("click.jhsDetailActions", "#xunLeiSubtitleBtn", () => void this.searchXunLeiSubtitle(carNum ?? ""));
        if (!carNum) {
            row.find("#filterBtn,#favoriteBtn,#hasDownBtn,#hasWatchBtn,#magnetSearchBtn,#xunLeiSubtitleBtn,#search-subtitle-btn")
                .prop("disabled", true).attr("title", "番号不可用");
            this.diagnostics.recordError({ source: "detail-page-actions", contributionId: "detail.page-state-actions", message: "详情操作不可用：番号不可用" });
        } else {
            this.stateBinding = this.stateActions?.bind({ root: this.document, carNum }) ?? null;
        }
        return mounted;
    }

    /** @param {unknown} carNum */
    async showStatus(carNum) { return this.stateActions?.showStatus(carNum); }
    getStateRecord() { return this.stateActions?.getStateRecord() ?? this.getPageInfo(); }
    getStateBinding() { return this.stateActions?.getStateBinding(this.document) ?? null; }
    getDetailStateController() { return this.stateActions?.stateController ?? null; }
    /** @param {MouseEvent} event */
    async favoriteOne(event) { return this.stateActions?.favoriteOne(event); }
    /** @param {MouseEvent} event */
    async hasDownOne(event) { return this.stateActions?.hasDownOne(event); }
    /** @param {MouseEvent} event */
    async hasWatchOne(event) { return this.stateActions?.hasWatchOne(event); }
    /** @param {MouseEvent | null} event */
    async filterOne(event) { return this.stateActions?.filterOne(event); }

    hideVideoControls() {
        const root = this.jquery(this.document);
        root.off("mouseenter.jhsDetailVideo").on("mouseenter.jhsDetailVideo", "#preview-video", (/** @type {Event & {currentTarget: Element}} */ event) => {
            this.jquery(event.currentTarget).prop("controls", true);
        });
        this.scope.addCleanup(() => root.off("mouseenter.jhsDetailVideo"));
    }

    /** @param {string} carNum */
    async searchXunLeiSubtitle(carNum) {
        if (this.scope.disposed) return;
        const scope = new LifecycleScope("subtitle-table");
        const releaseParent = this.scope.addCleanup(() => scope.dispose());
        scope.addCleanup(releaseParent);
        /** @type {number | null} */ let index = null;
        /** @type {any} */ let table;
        scope.addCleanup(() => {
            try { table?.destroy(); }
            finally { if (index !== null) { const id = index; index = null; this.dialog.close(id); } }
        });
        let releaseLoading = () => {};
        try {
            const loader = this.ui.loading();
            releaseLoading = scope.addCleanup(() => loader?.close?.());
            const results = await this.subtitle.search("xunlei", { carNum }, { scope });
            if (scope.disposed) return;
            if (!results?.length) return void this.notifications.error("未找到该番号的迅雷字幕");
            index = this.dialog.open({
                type: 1, title: "迅雷字幕", content: '<div class="jhs-layout-8ddc7c91"><div id="xunlei-table-container" class="jhs-layout-583c2485"></div></div>',
                ui: { body: "table" },
                scrollbar: false, area: this.ui.getResponsiveArea(["60%", "70%"]), anim: -1,
                success: (/** @type {any} */ _element, /** @type {number} */ layerIndex) => {
                    index = layerIndex;
                    const root = _element?.nodeType === 1 ? _element : _element[0];
                    if (root.parentNode) scope.observe(root.parentNode, () => { if (!root.isConnected) scope.dispose(); }, { childList: true });
                    table = createJhsTable(/** @type {any} */ (globalThis).Tabulator, root.querySelector("#xunlei-table-container"), {
                        pagination: false, layout: "fitColumns", placeholder: "暂无数据", virtualDom: true, data: results.map((/** @type {SubtitleRecord} */ item) => ({ ...item })),
                        responsiveLayout: "collapse", responsiveLayoutCollapse: true,
                        columnDefaults: { headerHozAlign: "center", hozAlign: "center" },
                        columns: [
                            { title: "文件名", field: "name", headerSort: false, responsive: 0 },
                            { title: "类型", field: "extension", headerSort: false, responsive: 0 },
                            { title: "操作", responsive: 0, headerSort: false, formatter: (/** @type {any} */ cell, /** @type {any} */ _params, /** @type {(callback: () => void) => void} */ onRendered) => {
                                const item = cell.getData();
                                onRendered(() => {
                                    if (scope.disposed) return;
                                    const preview = cell.getElement().querySelector(".subtitle-preview-btn");
                                    const download = cell.getElement().querySelector(".subtitle-download-btn");
                                    if (preview) scope.listen(preview, "click", () => void this.runSubtitle(item, `${carNum}.${item.extension}`, scope, preview, true));
                                    if (download) scope.listen(download, "click", () => void this.runSubtitle(item, `${carNum}.${item.extension}`, scope, download, false));
                                });
                                return '<button type="button" class="jhs-btn jhs-btn--secondary subtitle-preview-btn">预览</button> <button type="button" class="jhs-btn jhs-btn--secondary subtitle-download-btn">下载</button>';
                            } },
                        ],
                    });
                    this.ui.setupEscClose(layerIndex);
                },
                end: () => { index = null; scope.dispose(); },
            });
        } catch (error) {
            if (!scope.disposed) this.subtitleError("搜索", error);
            scope.dispose();
        } finally { releaseLoading(); if (index === null) scope.dispose(); }
    }

    /** @param {string} action @param {unknown} error */
    subtitleError(action, error) {
        this.notifications.error(`字幕${action}失败，请重试`);
        this.diagnostics.recordError({ source: "detail-page-actions", message: `字幕${action}失败: ${error instanceof Error ? error.message : String(error)}` });
    }

    /** @param {SubtitleRecord} subtitle @param {string} filename @param {LifecycleScope} scope */
    async previewSubtitle(subtitle, filename, scope = this.scope) {
        return this.runSubtitle(subtitle, filename, scope, null, true);
    }

    /** @param {SubtitleRecord} subtitle @param {string} filename @param {LifecycleScope} owner @param {HTMLElement | null} button @param {boolean} preview */
    async runSubtitle(subtitle, filename, owner, button, preview) {
        if (owner.disposed) return;
        if (!subtitle?.url) return void this.diagnostics.recordError({ source: "detail-page-actions", message: "字幕预览未提供文件 URL" });
        const extension = String(subtitle.extension || "").toLowerCase();
        if (preview && !["ass", "srt"].includes(extension)) return void this.notifications.error("仅支持 ASS 和 SRT 字幕");
        let operations = this.subtitleOperations.get(owner);
        if (!operations) this.subtitleOperations.set(owner, operations = new Map());
        const key = JSON.stringify([preview, subtitle.url, extension]);
        if (operations.has(key)) return;
        const scope = new LifecycleScope("subtitle-action"), label = button?.textContent;
        operations.set(key, scope);
        const resetButton = () => {
            button?.removeAttribute("aria-busy"); button?.removeAttribute("aria-disabled");
            if (button) button.textContent = label ?? "";
        };
        const releaseParent = owner.addCleanup(() => scope.dispose());
        scope.addCleanup(releaseParent);
        /** @type {number | null} */ let index = null;
        scope.addCleanup(() => {
            resetButton();
            if (operations.get(key) === scope) operations.delete(key);
            if (index !== null) { const id = index; index = null; this.dialog.close(id); }
        });
        button?.setAttribute("aria-busy", "true"); button?.setAttribute("aria-disabled", "true");
        if (button) button.textContent = preview ? "加载中…" : "下载中…";
        try {
            const data = await this.subtitle.download("xunlei", subtitle, { scope });
            if (scope.disposed) return;
            // Keep the trigger focusable before the dialog captures its return target.
            resetButton();
            if (!preview) return void this.ui.download(data, filename);
            const title = `${extension.toUpperCase()} 字幕预览：${filename}`;
            const lines = data.split("\n"), width = String(lines.length).length;
            const escaped = lines.map((/** @type {string} */ line, /** @type {number} */ index) => `<span class="jhs-code-line-number">${String(index + 1).padStart(width, " ")}. </span>${escapeHtml(line)}`).join("\n");
            index = this.dialog.open({
                type: 1, title, area: this.ui.getResponsiveArea(["80%", "80%"]), scrollbar: false,
                ui: { body: "scroll" },
                content: `<div class="jhs-code-viewer">${escaped}</div>`, btn: ["下载", "关闭"],
                success: (/** @type {any} */ element, /** @type {number} */ id) => {
                    index = id; this.ui.setupEscClose(id);
                    const root = element?.nodeType === 1 ? element : element[0];
                    if (root.parentNode) scope.observe(root.parentNode, () => { if (!root.isConnected) scope.dispose(); }, { childList: true });
                },
                end: () => { index = null; scope.dispose(); },
                btn1: () => { if (!scope.disposed) this.ui.download(data, filename); return false; },
            });
        } catch (error) {
            if (!scope.disposed) this.subtitleError(preview ? "预览" : "下载", error);
        } finally { if (index === null) scope.dispose(); }
    }
}
