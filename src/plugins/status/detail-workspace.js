// @ts-check

import { normalizeCarNum } from "../../core/constants.js";
import { jhsEventBus } from "../../core/event-bus.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { JhsSelect } from "../../core/ui-primitives.js";

/** @typedef {any} JQueryHandle Legacy jQuery runtime handle. */

/** 返回当前详情页的宿主资源边界；调用者不得重挂载这些节点。 */
/** @param {any} hostAdapter */
export function getDetailResourceAdapter(hostAdapter) {
    if (!window.isDetailPage || typeof hostAdapter?.getDetailResourceBoundary !== "function") return null;
    const boundary = hostAdapter.getDetailResourceBoundary();
    if (!boundary) return null;
    return {
        ...boundary, hostRoot: $(boundary.hostRoot), controller: $(boundary.controller), observeRoot: $(boundary.observeRoot), resourceRoot: $(boundary.resourceRoot), resourceRegion: $(boundary.resourceRegion),
        sortSelect: $(boundary.sortSelect), getActionTarget(/** @type {Element} */ row) {
            const target = $(boundary.getActionTarget(row));
            if (!target.length || !boundary.actionTargetRequiresWrapper?.(row)) return target;
            let actions = target.children(".jhs-offline-actions").first();
            return actions.length || (actions = $('<span class="jhs-offline-actions"></span>').appendTo(target)), actions;
        },
    };
}

/** 非破坏性详情工作区：仅标记宿主稳定块，并为 JHS 自有内容提供固定插槽。 */
export class DetailWorkspacePlugin extends BasePlugin {
    constructor() {
        super();
        /** @type {JQueryHandle | null} */ this.hostRoot = null;
        /** @type {any} */ this.resourceObserver = null;
        /** @type {number | null} */ this.scheduledResourceFrame = null;
        /** @type {(() => void) | null} */ this.cancelScheduledResourceFrame = null;
        /** @type {any} */ this.lifecycleScope = null;
    }
    getName() { return "DetailWorkspacePlugin"; }
    async initCss() {
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
            .jhs-detail-owned-slot { min-width:0; padding:var(--jhs-space-5) 0; border-top:1px solid var(--jhs-border); }
            .jhs-detail-owned-slot:empty { display:none; }
            .jhs-detail-owned-slot--summary-actions { padding:var(--jhs-space-3) 0 var(--jhs-space-5); border-top:0; }
            .jhs-detail-post-resource { min-width:0; }
            .jhs-detail-host-workspace .jhs-detail-btn-row { margin:0!important; }
            .jhs-detail-host-action { display:inline-flex!important; min-height:var(--jhs-control-height)!important; align-items:center!important; justify-content:center!important; padding:0 var(--jhs-space-3)!important; border:1px solid var(--jhs-border)!important; border-radius:var(--jhs-radius-sm)!important; background:var(--jhs-surface)!important; color:var(--jhs-text)!important; box-shadow:none!important; font:inherit!important; font-size:var(--jhs-font-size-sm)!important; font-weight:600!important; line-height:1!important; text-decoration:none!important; }
            .jhs-detail-host-action:hover { border-color:var(--jhs-accent)!important; background:var(--jhs-surface-2)!important; color:var(--jhs-accent)!important; }
            .jhs-offline-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-2); margin-left:var(--jhs-space-2); vertical-align:middle; }
            @media (max-width:767px) { .jhs-detail-owned-slot { padding:var(--jhs-space-4) 0; } }
        </style>`;
    }
    async handle() {
        if (!window.isDetailPage) return;
        this.lifecycleScope = await this.getRuntimeService("scope")();
        const cancel = utils.loopDetector((() => !!this.getHostAdapter()), (() => this.ensureWorkspace()), 40, 2500, !0, this.lifecycleScope);
        this.lifecycleScope.addCleanup(cancel);
        this.lifecycleScope.addCleanup((() => {
            this.cancelScheduledResourceFrame?.(), this.scheduledResourceFrame = null, this.cancelScheduledResourceFrame = null;
        }));
    }
    getHostAdapter() {
        const host = this.getRuntimeService("host"), root = host?.locateDetailRoot?.();
        if (!root) return null;
        return { site: host.site || "unknown", root: $(root) };
    }
    ensureWorkspace() {
        const adapter = this.getHostAdapter();
        if (!adapter) return $();
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
                const resource = getDetailResourceAdapter(this.getRuntimeService("host"));
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
        if (!root?.length) return;
        root.children('[data-jhs-slot="summary-actions"]').length || root.append('<div class="jhs-detail-owned-slot jhs-detail-owned-slot--summary-actions" data-jhs-slot="summary-actions"></div>');
        let group = root.children('[data-jhs-slot-group="post-resource"]').first();
        group.length || (group = $('<div class="jhs-detail-post-resource" data-jhs-slot-group="post-resource"></div>').appendTo(root));
        group.children('[data-jhs-slot="reviews"]').length || group.append('<section class="jhs-detail-owned-slot jhs-detail-owned-slot--reviews" data-jhs-slot="reviews"></section>');
        group.children('[data-jhs-slot="related"]').length || group.append('<section class="jhs-detail-owned-slot jhs-detail-owned-slot--related" data-jhs-slot="related"></section>');
    }
    /** 只移动 JHS 自有插槽，将其固定在稳定宿主锚点旁。 */
    placeOwnedSlots() {
        const root = this.hostRoot, resource = getDetailResourceAdapter(this.getRuntimeService("host"));
        if (!root?.length) return;
        this.ensureOwnedSlots(root);
        const summaryActions = root.children('[data-jhs-slot="summary-actions"]').first(), postResource = root.children('[data-jhs-slot-group="post-resource"]').first();
        const summaryRegion = "javdb" === root.attr("data-jhs-workspace-site") ? root.children(".video-meta-panel").first() : root.children(".row.movie").first();
        summaryRegion.length && summaryActions.insertAfter(summaryRegion);
        resource?.resourceRegion?.length && postResource.insertAfter(resource.resourceRegion);
    }
    /** @param {JQueryHandle} root */
    adoptExistingOwnedPanels(root) {
        [ [ ".jhs-detail-btn-row", "summary-actions" ], [ ".jhs-related-panel", "related" ], [ ".jhs-review-panel", "reviews" ] ].forEach((([ selector, slot ]) => {
            const target = root.find(`[data-jhs-slot="${slot}"]`).first();
            root.find(selector).filter(((/** @type {number} */ _, /** @type {Element} */ element) => !$(element).closest("[data-jhs-slot]").length)).each(((/** @type {number} */ _, /** @type {Element} */ element) => target.append(element)));
        }));
    }
    /** @param {JQueryHandle} info */
    normalizeHostActions(info) {
        const labels = new Set([ "想看", "看过", "看過", "存入清单", "存入清單", "下载", "下載", "订正", "訂正" ]);
        info.find("a, button").filter(((/** @type {number} */ _, /** @type {Element} */ element) => !$(element).is(".jhs-btn, [id^='jhs-']") && labels.has($(element).text().replace(/\s+/g, " ").trim()))).addClass("jhs-detail-host-action");
    }
    /** @param {MutationRecord} record */
    isJhsOnlyMutation(record) {
        if ($(record.target).closest(".jhs-offline-actions,.jhs-select-control,.jhs-magnet-score").length) return !0;
        const nodes = [ ...record.addedNodes, ...record.removedNodes ].filter((node => node.nodeType === Node.ELEMENT_NODE));
        return nodes.length > 0 && nodes.every((node => {
            const element = /** @type {Element} */ (node);
            return element.matches?.(".jhs-offline-btn,.jhs-offline-actions,.jhs-magnet-score,.jhs-select-control") || element.closest?.(".jhs-offline-actions,.jhs-select-control");
        }));
    }
    bindResourceLifecycle() {
        const adapter = getDetailResourceAdapter(this.getRuntimeService("host"));
        if (!adapter) return;
        if (this.resourceObserver && this.resourceObserver.root === adapter.observeRoot[0]) return void this.scheduleResourceUpdate();
        this.resourceObserver && this.lifecycleScope?.releaseObserver(this.resourceObserver);
        if (!this.lifecycleScope) return;
        const observer = this.lifecycleScope.observe(adapter.observeRoot[0], ((/** @type {MutationRecord[]} */ records) => { records.every((record => this.isJhsOnlyMutation(record))) || this.scheduleResourceUpdate(); }), { childList: !0, subtree: !0 });
        observer.root = adapter.observeRoot[0], this.resourceObserver = observer,
        adapter.sortSelect.length && adapter.sortSelect.addClass("jhs-select-source") && JhsSelect.enhance(adapter.controller), this.scheduleResourceUpdate();
    }
    scheduleResourceUpdate() {
        if (null !== this.scheduledResourceFrame) return;
        const usesAnimationFrame = "function" == typeof window.requestAnimationFrame;
        const schedule = /** @type {(callback: FrameRequestCallback) => number} */ (usesAnimationFrame ? window.requestAnimationFrame.bind(window) : (callback => Number(setTimeout(callback))));
        this.scheduledResourceFrame = schedule((() => {
            this.scheduledResourceFrame = null, this.cancelScheduledResourceFrame = null;
            const adapter = getDetailResourceAdapter(this.getRuntimeService("host"));
            if (!adapter) return;
            this.placeOwnedSlots();
            adapter.sortSelect.length && (adapter.sortSelect.addClass("jhs-select-source"), JhsSelect.enhance(adapter.controller), JhsSelect.refresh(adapter.sortSelect));
            if (!jhsEventBus) return;
            void jhsEventBus.emit("magnet-items-updated", { site: adapter.site, resourceRoot: adapter.resourceRoot[0], rows: adapter.rows() }, { broadcast: !1 });
        }));
        this.cancelScheduledResourceFrame = () => {
            null !== this.scheduledResourceFrame && (usesAnimationFrame ? window.cancelAnimationFrame?.(this.scheduledResourceFrame) : clearTimeout(this.scheduledResourceFrame));
        };
    }
}

/** 创建 FC2 自有详情壳，所有异步模块只写入固定插槽。 */
/** @param {{ carNum?: string, source?: string, mode?: string }} [options] */
export function createFc2DetailShell({ carNum = "", source = "fc2", mode = "dialog" } = {}) {
    const workspace = $('<div class="jhs-fc2-workspace jhs-ui"></div>').attr({
        "data-jhs-fc2-source": source,
        "data-jhs-fc2-mode": mode,
        "data-jhs-car-num": normalizeCarNum(carNum) || ""
    });
    const definitions = [ [ "summary", "影片概览" ], [ "gallery", "预览与剧照" ], [ "resources", "资源" ], [ "reviews", "评论" ], [ "related", "相关清单" ] ];
    definitions.forEach((([ name, title ]) => {
        const section = $('<section class="jhs-fc2-section"></section>').attr("data-jhs-section", name);
        const header = $('<header class="jhs-fc2-section__header"></header>'), heading = $("<h2></h2>").text(title), actions = $('<div class="jhs-fc2-section__actions"></div>').attr("data-jhs-section-actions", name);
        section.append(header.append(heading, actions), $('<div class="jhs-fc2-section__content"></div>').attr("data-jhs-slot", name)), workspace.append(section);
    }));
    return workspace;
}

/** 创建只属于单个 FC2 详情实例的生命周期和插槽上下文。 */
/** @param {JQueryHandle | Element} root @param {Record<string, unknown>} [options] */
export function createFc2DetailContext(root, options = {}) {
    const workspace = $(root).is(".jhs-fc2-workspace") ? $(root) : $(root).find(".jhs-fc2-workspace").first();
    let destroyed = !1;
    const namespace = `.jhsFc2Detail${Date.now()}${Math.random().toString(36).slice(2)}`, observers = new Set();
    const context = {
        ...options,
        root: workspace,
        workspace,
        namespace,
        observers,
        getSlot: (/** @type {string} */ name) => workspace.find(`[data-jhs-slot="${name}"]`).first(),
        getSection: (/** @type {string} */ name) => workspace.find(`[data-jhs-section="${name}"]`).first(),
        isAlive: () => !destroyed && workspace[0]?.isConnected !== !1,
        addObserver(/** @type {{ disconnect?: () => void }} */ observer) { observer && observers.add(observer); return observer; },
        destroy() {
            if (destroyed) return;
            destroyed = !0, workspace.off(namespace).find("*").off(namespace), observers.forEach((observer => observer.disconnect?.())), observers.clear(), workspace.removeData("jhsFc2Context");
        }
    };
    workspace.data("jhsFc2Context", context);
    return context;
}
