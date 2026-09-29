// @ts-check

import { getDetailResourceAdapter } from "../../ui/detail/detail-resource-adapter.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */

/** 非破坏性详情工作区：仅标记宿主稳定块，并为 JHS 自有内容提供固定插槽。 */
export class DetailWorkspaceController {
    /** @param {{hostAdapter: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, styles: any, eventBus: any, ui: {jquery: (value: any) => any, enhanceSelect: (controller: any) => any, refreshSelect: (select: any) => any}}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.lifecycleScope = options.scope;
        this.styles = options.styles;
        this.eventBus = options.eventBus;
        this.ui = options.ui;
        this.styleRelease = null;
        /** @type {JQueryHandle | null} */ this.hostRoot = null;
        /** @type {any} */ this.resourceObserver = null;
        /** @type {number | null} */ this.scheduledResourceFrame = null;
        /** @type {(() => void) | null} */ this.cancelScheduledResourceFrame = null;
    }
    getCss() {
        return `<style>
            .jhs-detail-workspace { display:grid; width:min(100%,1440px); min-width:0; margin:0 auto; padding:var(--jhs-space-6); gap:var(--jhs-space-5); box-sizing:border-box; background:var(--jhs-bg); color:var(--jhs-text); }
            .jhs-detail-workspace__section { display:none; min-width:0; overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
            .jhs-detail-workspace__section.has-content { display:block; }
            .jhs-detail-workspace__header { padding:var(--jhs-space-4) var(--jhs-space-5); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); }
            .jhs-detail-workspace__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); }
            .jhs-detail-workspace__content { min-width:0; padding:var(--jhs-space-5); }
            .jhs-detail-workspace__content:empty { display:none; }
            .jhs-detail-workspace .jhs-detail-btn-row { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); margin-top:var(--jhs-space-4); }
            .jhs-detail-workspace [data-jhs-section="gallery"] .jhs-detail-workspace__content { overflow-x:auto; }
            .jhs-detail-host-workspace { color:var(--jhs-text); }
            .jhs-detail-owned-slot { min-width:0; box-sizing:border-box; padding:var(--jhs-space-4); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
            .jhs-detail-owned-slot:empty { display:none; }
            .jhs-detail-owned-slot--summary-actions { margin-block:var(--jhs-space-5); }
            .jhs-detail-post-resource { display:grid; min-width:0; gap:var(--jhs-space-5); margin-block:var(--jhs-space-5); }
            .jhs-detail-host-workspace .jhs-detail-btn-row { margin:0!important; }
            .jhs-detail-host-action { display:inline-flex!important; min-height:var(--jhs-control-height)!important; align-items:center!important; justify-content:center!important; padding:0 var(--jhs-space-3)!important; border:1px solid var(--jhs-border)!important; border-radius:var(--jhs-radius-sm)!important; background:var(--jhs-surface)!important; color:var(--jhs-text)!important; box-shadow:none!important; font:inherit!important; font-size:var(--jhs-font-size-sm)!important; font-weight:600!important; line-height:1!important; text-decoration:none!important; }
            .jhs-detail-host-action:hover { border-color:var(--jhs-accent)!important; background:var(--jhs-surface-2)!important; color:var(--jhs-accent)!important; }
            .jhs-offline-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-2); margin-left:var(--jhs-space-2); vertical-align:middle; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnets] { container:jhs-magnets / inline-size; min-width:0; }
            [data-jhs-workspace-site="javdb"] [data-jhs-host-region="resources"] { margin:0; min-width:0; }
            [data-jhs-workspace-site="javdb"] [data-jhs-host-region="resources"] > .column { padding:0; min-width:0; }
            [data-jhs-workspace-site="javdb"] [data-jhs-resource-surface] { margin:0; padding:var(--jhs-space-4); box-sizing:border-box; min-width:0; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); color:var(--jhs-text); }
            [data-jhs-workspace-site="javdb"] [data-jhs-resource-body] { padding:0; border:0; background:transparent; color:inherit; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnets] > .magnet-sort { margin-bottom:var(--jhs-space-3); }
            [data-jhs-workspace-site="javdb"] #magnets-content [data-jhs-magnet-row] { display:grid; grid-template-columns:minmax(0,1fr); grid-template-areas:"info" "date" "actions"; gap:var(--jhs-space-2); align-items:center; margin:0; padding:var(--jhs-space-3); box-sizing:border-box; border-bottom:1px solid var(--jhs-border); background:transparent; }
            [data-jhs-workspace-site="javdb"] #magnets-content [data-jhs-magnet-row]:last-child { border-bottom:0; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="info"] .name { color:var(--jhs-text); font-size:var(--jhs-font-size-md); font-weight:600; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="date"] { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part] { width:auto!important; min-width:0; max-width:100%; margin:0!important; padding:0; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="info"] { grid-area:info; overflow-wrap:anywhere; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="date"] { grid-area:date; white-space:nowrap; }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="actions"] { grid-area:actions; display:flex; flex-wrap:nowrap; align-items:center; gap:var(--jhs-space-2); }
            [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="actions"] > :is(a,button) { display:inline-flex; flex:0 0 auto; align-items:center; justify-content:center; box-sizing:border-box; height:var(--jhs-control-height)!important; min-height:var(--jhs-control-height)!important; margin:0!important; padding:0 var(--jhs-space-3)!important; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm)!important; background:var(--jhs-surface); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); line-height:1!important; }
            @container jhs-magnets (min-width:768px) {
                [data-jhs-workspace-site="javdb"] #magnets-content [data-jhs-magnet-row] { grid-template-columns:minmax(0,1fr) max-content max-content; grid-template-areas:"info date actions"; gap:var(--jhs-space-4); }
            }
            @container jhs-magnets (max-width:767px) {
                [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="actions"] > :is(a,button) { height:44px!important; min-height:44px!important; }
            }
            @media (pointer:coarse) {
                [data-jhs-workspace-site="javdb"] [data-jhs-magnet-part="actions"] > :is(a,button) { height:44px!important; min-height:44px!important; }
            }
        </style>`;
    }
    start() {
        this.lifecycleScope.assertActive();
        const css = this.getCss().replace(/^\s*<style>|<\/style>\s*$/g, "");
        this.styleRelease = this.styles.register("jhs-detail-workspace-feature", css);
        this.lifecycleScope.addCleanup(() => { this.styleRelease?.(); this.styleRelease = null; });
        this.lifecycleScope.addCleanup((() => {
            this.cancelScheduledResourceFrame?.(), this.scheduledResourceFrame = null, this.cancelScheduledResourceFrame = null;
        }));
        if (!this.getHostAdapter()) {
            const documentRoot = this.hostAdapter.document?.documentElement ?? globalThis.document?.documentElement;
            if (documentRoot) {
                /** @type {any} */ let observer = null;
                observer = this.lifecycleScope.observe(documentRoot, () => {
                    if (!this.getHostAdapter()) return;
                    this.ensureWorkspace();
                    observer && this.lifecycleScope.releaseObserver(observer);
                }, { childList: true, subtree: true });
            }
        } else this.ensureWorkspace();
        return this;
    }
    getHostAdapter() {
        const host = this.hostAdapter, root = host?.locateDetailRoot?.();
        if (!root) return null;
        return { site: host.site || "unknown", root: this.ui.jquery(root) };
    }
    ensureWorkspace() {
        const $ = this.ui.jquery;
        const adapter = this.getHostAdapter();
        if (!adapter) return $([]);
        const root = adapter.root;
        if (!root.attr("data-jhs-workspace-ready")) {
            root.attr({ "data-jhs-workspace-ready": "true", "data-jhs-workspace-site": adapter.site }).addClass("jhs-detail-host-workspace jhs-ui");
            if ("javdb" === adapter.site) {
                root.children("h2,.video-meta-panel").attr("data-jhs-host-region", "summary");
                root.children(".columns").filter(((/** @type {number} */ _, /** @type {Element} */ element) => $(element).find(".tile-images,.preview-images").length > 0)).attr("data-jhs-host-region", "gallery");
                root.children(".columns").filter(((/** @type {number} */ _, /** @type {Element} */ element) => $(element).find("#magnets-content").length > 0)).attr("data-jhs-host-region", "resources");
                this.normalizeHostActions(root.find(".video-meta-panel").first());
            } else {
                root.children("h3,.row.movie").attr("data-jhs-host-region", "summary");
                const resource = getDetailResourceAdapter(this.hostAdapter, { jquery: $, isDetailPage: true });
                resource?.resourceRegion?.attr("data-jhs-host-region", "resources");
                root.children().filter(((/** @type {number} */ _, /** @type {Element} */ element) => $(element).is("#sample-waterfall") || $(element).find("#sample-waterfall").length > 0)).attr("data-jhs-host-region", "gallery");
                this.normalizeHostActions(root.find(".info").first());
            }
            this.ensureOwnedSlots(root), this.adoptExistingOwnedPanels(root);
        }
        this.hostRoot = root, this.ensureOwnedSlots(root), this.placeOwnedSlots(), this.bindResourceLifecycle();
        return root;
    }
    /** @param {string} name */
    getSlot(name) {
        return this.ensureWorkspace().find(`[data-jhs-slot="${name}"]`).first();
    }
    ensureOwnedSlots(root = this.hostRoot) {
        const $ = this.ui.jquery;
        if (!root?.length) return;
        root.children('[data-jhs-slot="summary-actions"]').length || root.append('<div class="jhs-detail-owned-slot jhs-detail-owned-slot--summary-actions" data-jhs-slot="summary-actions"></div>');
        let group = root.children('[data-jhs-slot-group="post-resource"]').first();
        group.length || (group = $('<div class="jhs-detail-post-resource" data-jhs-slot-group="post-resource"></div>').appendTo(root));
        group.children('[data-jhs-slot="reviews"]').length || group.append('<section class="jhs-detail-owned-slot jhs-detail-owned-slot--reviews" data-jhs-slot="reviews"></section>');
        group.children('[data-jhs-slot="related"]').length || group.append('<section class="jhs-detail-owned-slot jhs-detail-owned-slot--related" data-jhs-slot="related"></section>');
    }
    /** 只移动 JHS 自有插槽，将其固定在稳定宿主锚点旁。 */
    placeOwnedSlots() {
        const root = this.hostRoot, resource = getDetailResourceAdapter(this.hostAdapter, { jquery: this.ui.jquery, isDetailPage: true });
        if (!root?.length) return;
        this.ensureOwnedSlots(root);
        const summaryActions = root.children('[data-jhs-slot="summary-actions"]').first(), postResource = root.children('[data-jhs-slot-group="post-resource"]').first();
        const summaryRegion = "javdb" === root.attr("data-jhs-workspace-site") ? root.children(".video-meta-panel").first() : root.children(".row.movie").first();
        summaryRegion.length && summaryActions.insertAfter(summaryRegion);
        resource?.resourceRegion?.length && postResource.insertAfter(resource.resourceRegion);
    }
    /** @param {JQueryHandle} root */
    adoptExistingOwnedPanels(root) {
        const $ = this.ui.jquery;
        [ [ ".jhs-detail-btn-row", "summary-actions" ], [ ".jhs-related-panel", "related" ], [ ".jhs-review-panel", "reviews" ] ].forEach((([ selector, slot ]) => {
            const target = root.find(`[data-jhs-slot="${slot}"]`).first();
            root.find(selector).filter(((/** @type {number} */ _, /** @type {Element} */ element) => !$(element).closest("[data-jhs-slot]").length)).each(((/** @type {number} */ _, /** @type {Element} */ element) => target.append(element)));
        }));
    }
    /** @param {JQueryHandle} info */
    normalizeHostActions(info) {
        const $ = this.ui.jquery;
        const labels = new Set([ "想看", "看过", "看過", "存入清单", "存入清單", "下载", "下載", "订正", "訂正" ]);
        info.find("a, button").filter(((/** @type {number} */ _, /** @type {Element} */ element) => !$(element).is(".jhs-btn, [id^='jhs-']") && labels.has($(element).text().replace(/\s+/g, " ").trim()))).addClass("jhs-detail-host-action");
    }
    /** @param {MutationRecord} record */
    isJhsOnlyMutation(record) {
        const $ = this.ui.jquery;
        if ($(record.target).closest(".jhs-offline-actions,.jhs-select-control,.jhs-magnet-score").length) return !0;
        const nodes = [ ...record.addedNodes, ...record.removedNodes ].filter((node => node.nodeType === Node.ELEMENT_NODE));
        return nodes.length > 0 && nodes.every((node => {
            const element = /** @type {Element} */ (node);
            return element.matches?.(".jhs-offline-btn,.jhs-offline-actions,.jhs-magnet-score,.jhs-select-control") || element.closest?.(".jhs-offline-actions,.jhs-select-control");
        }));
    }
    bindResourceLifecycle() {
        const adapter = getDetailResourceAdapter(this.hostAdapter, { jquery: this.ui.jquery, isDetailPage: true });
        if (!adapter) return;
        if (this.resourceObserver && this.resourceObserver.root === adapter.observeRoot[0]) return void this.scheduleResourceUpdate();
        this.resourceObserver && this.lifecycleScope?.releaseObserver(this.resourceObserver);
        if (!this.lifecycleScope) return;
        const observer = /** @type {any} */ (this.lifecycleScope.observe(adapter.observeRoot[0], ((/** @type {MutationRecord[]} */ records) => { records.every((record => this.isJhsOnlyMutation(record))) || this.scheduleResourceUpdate(); }), { childList: !0, subtree: !0 }));
        observer.root = adapter.observeRoot[0], this.resourceObserver = observer,
        adapter.sortSelect.length && adapter.sortSelect.addClass("jhs-select-source") && this.ui.enhanceSelect(adapter.controller), this.scheduleResourceUpdate();
    }
    scheduleResourceUpdate() {
        if (null !== this.scheduledResourceFrame) return;
        const usesAnimationFrame = "function" == typeof window.requestAnimationFrame;
        const schedule = /** @type {(callback: FrameRequestCallback) => number} */ (usesAnimationFrame ? window.requestAnimationFrame.bind(window) : (callback => Number(setTimeout(callback))));
        this.scheduledResourceFrame = schedule((() => {
            this.scheduledResourceFrame = null, this.cancelScheduledResourceFrame = null;
            const adapter = getDetailResourceAdapter(this.hostAdapter, { jquery: this.ui.jquery, isDetailPage: true });
            if (!adapter) return;
            adapter.prepareLayout?.();
            this.placeOwnedSlots();
            adapter.sortSelect.length && (adapter.sortSelect.addClass("jhs-select-source"), this.ui.enhanceSelect(adapter.controller), this.ui.refreshSelect(adapter.sortSelect));
            if (!this.eventBus) return;
            void this.eventBus.emit("magnet-items-updated", { site: adapter.site, resourceRoot: adapter.resourceRoot[0], rows: adapter.rows() }, { broadcast: !1 });
        }));
        this.cancelScheduledResourceFrame = () => {
            null !== this.scheduledResourceFrame && (usesAnimationFrame ? window.cancelAnimationFrame?.(this.scheduledResourceFrame) : clearTimeout(this.scheduledResourceFrame));
        };
    }
    dispose() {
        this.cancelScheduledResourceFrame?.();
        this.cancelScheduledResourceFrame = null;
        this.scheduledResourceFrame = null;
        this.resourceObserver && this.lifecycleScope.releaseObserver(this.resourceObserver);
        this.resourceObserver = null;
        this.styleRelease?.();
        this.styleRelease = null;
        this.hostRoot = null;
    }
}

/** 创建 FC2 自有详情壳，所有异步模块只写入固定插槽。 */
/** @param {{ carNum?: string, source?: string, mode?: string }} [options] */
