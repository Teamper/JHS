/** 返回当前详情页的宿主资源边界；调用者不得重挂载这些节点。 */
function getDetailResourceAdapter() {
    if (!window.isDetailPage) return null;
    if (r) {
        const hostRoot = $(".video-detail").first(), controller = hostRoot.find('[data-controller="magnet-sort"]').first(), resourceRoot = controller.find("#magnets-content").first();
        if (!hostRoot.length || !controller.length || !resourceRoot.length) return null;
        const resourceRegion = controller.closest(hostRoot.children()).first();
        return {
            site: "javdb", hostRoot, controller, observeRoot: controller, resourceRoot, resourceRegion,
            rows: () => resourceRoot.children(".item").toArray(),
            sortSelect: controller.find('select[data-action*="magnet-sort#sort"]').first(),
            getResource(row) {
                const item = $(row);
                return item.find('.copy-to-clipboard[data-clipboard-text^="magnet:"]').first().attr("data-clipboard-text") || item.find('.magnet-name a[href^="magnet:"]').first().attr("href") || "";
            },
            getActionTarget: row => $(row).children(".buttons").first()
        };
    }
    if (l) {
        const hostRoot = $(".container").filter(((_, element) => $(element).find("#magnet-table").length > 0)).first(), resourceRoot = hostRoot.find("#magnet-table").first();
        if (!hostRoot.length || !resourceRoot.length) return null;
        const resourceRegion = resourceRoot.closest(hostRoot.children()).first(), observeRoot = resourceRoot.parent();
        return {
            site: "javbus", hostRoot, controller: resourceRoot, observeRoot, resourceRoot, resourceRegion,
            rows: () => resourceRoot.find("tr").filter(((_, row) => $(row).find('td a[href^="magnet:"],td a[href^="ed2k:"]').length > 0)).toArray(),
            sortSelect: $(),
            getResource: row => $(row).find('td a[href^="magnet:"],td a[href^="ed2k:"]').first().attr("href") || "",
            getActionTarget(row) {
                const item = $(row), stableActions = item.find(".buttons,.actions,.btn-group").filter(((_, element) => $(element).closest("td").length > 0)).last();
                if (stableActions.length) return stableActions;
                const resourceCell = item.find('td:has(a[href^="magnet:"]),td:has(a[href^="ed2k:"])').first();
                let actions = resourceCell.children(".jhs-offline-actions").first();
                return actions.length || (actions = $('<span class="jhs-offline-actions"></span>').appendTo(resourceCell)), actions;
            }
        };
    }
    return null;
}

/** 非破坏性详情工作区：仅标记宿主稳定块，并为 JHS 自有内容提供固定插槽。 */
class DetailWorkspacePlugin extends BasePlugin {
    constructor() {
        super(), this.hostRoot = null, this.resourceObserver = null, this.scheduledResourceFrame = null;
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
        utils.loopDetector((() => !!this.getHostAdapter()), (() => this.ensureWorkspace()), 40, 2500, !0);
    }
    getHostAdapter() {
        if (r) {
            const root = $(".video-detail").first();
            return root.length ? { site: "javdb", root } : null;
        }
        if (l) {
            const root = $(".container").filter(((_, element) => $(element).find("#magnet-table,.screencap,.info").length > 0)).first();
            return root.length ? { site: "javbus", root } : null;
        }
        return null;
    }
    ensureWorkspace() {
        const adapter = this.getHostAdapter();
        if (!adapter) return $();
        const root = adapter.root;
        if (!root.attr("data-jhs-workspace-ready")) {
            root.attr({ "data-jhs-workspace-ready": "true", "data-jhs-workspace-site": adapter.site }).addClass("jhs-detail-host-workspace jhs-ui");
            if ("javdb" === adapter.site) {
                root.children("h2,.video-meta-panel").attr("data-jhs-host-region", "summary");
                root.children(".columns").filter(((_, element) => $(element).find(".tile-images,.preview-images").length > 0)).attr("data-jhs-host-region", "gallery");
                root.children(".columns").filter(((_, element) => $(element).find("#magnets-content").length > 0)).attr("data-jhs-host-region", "resources");
                this.normalizeHostActions(root.find(".video-meta-panel").first());
            } else {
                root.children("h3,.row.movie").attr("data-jhs-host-region", "summary");
                root.children().filter(((_, element) => $(element).is("#mag-submit-show,#mag-submit") || $(element).find("#magnet-table").length > 0)).attr("data-jhs-host-region", "resources");
                root.children().filter(((_, element) => $(element).is("#sample-waterfall") || $(element).find("#sample-waterfall").length > 0)).attr("data-jhs-host-region", "gallery");
                this.normalizeHostActions(root.find(".info").first());
            }
            this.ensureOwnedSlots(root), this.adoptExistingOwnedPanels(root);
        }
        this.hostRoot = root, this.ensureOwnedSlots(root), this.placeOwnedSlots(), this.bindResourceLifecycle();
        return root;
    }
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
        const root = this.hostRoot, resource = getDetailResourceAdapter();
        if (!root?.length) return;
        this.ensureOwnedSlots(root);
        const summaryActions = root.children('[data-jhs-slot="summary-actions"]').first(), postResource = root.children('[data-jhs-slot-group="post-resource"]').first();
        const summaryRegion = "javdb" === root.attr("data-jhs-workspace-site") ? root.children(".video-meta-panel").first() : root.children(".row.movie").first();
        summaryRegion.length && summaryActions.insertAfter(summaryRegion);
        resource?.resourceRegion?.length && postResource.insertAfter(resource.resourceRegion);
    }
    adoptExistingOwnedPanels(root) {
        [ [ ".jhs-detail-btn-row", "summary-actions" ], [ ".jhs-related-panel", "related" ], [ ".jhs-review-panel", "reviews" ] ].forEach((([ selector, slot ]) => {
            const target = root.find(`[data-jhs-slot="${slot}"]`).first();
            root.find(selector).filter(((_, element) => !$(element).closest("[data-jhs-slot]").length)).each(((_, element) => target.append(element)));
        }));
    }
    normalizeHostActions(info) {
        const labels = new Set([ "想看", "看过", "看過", "存入清单", "存入清單", "下载", "下載", "订正", "訂正" ]);
        info.find("a, button").filter((function() { return !$(this).is(".jhs-btn, [id^='jhs-']") && labels.has($(this).text().replace(/\s+/g, " ").trim()); })).addClass("jhs-detail-host-action");
    }
    isJhsOnlyMutation(record) {
        if ($(record.target).closest(".jhs-offline-actions,.jhs-select-control,.jhs-magnet-score").length) return !0;
        const nodes = [ ...record.addedNodes, ...record.removedNodes ].filter((node => node.nodeType === Node.ELEMENT_NODE));
        return nodes.length > 0 && nodes.every((node => node.matches?.(".jhs-offline-btn,.jhs-offline-actions,.jhs-magnet-score,.jhs-select-control") || node.closest?.(".jhs-offline-actions,.jhs-select-control")));
    }
    bindResourceLifecycle() {
        const adapter = getDetailResourceAdapter();
        if (!adapter) return;
        if (this.resourceObserver && this.resourceObserver.root === adapter.observeRoot[0]) return void this.scheduleResourceUpdate();
        this.resourceObserver?.disconnect?.();
        const observer = new MutationObserver((records => { records.every((record => this.isJhsOnlyMutation(record))) || this.scheduleResourceUpdate(); }));
        observer.root = adapter.observeRoot[0], observer.observe(adapter.observeRoot[0], { childList: !0, subtree: !0 }), this.resourceObserver = observer,
        adapter.sortSelect.length && adapter.sortSelect.addClass("jhs-select-source") && JhsSelect.enhance(adapter.controller), this.scheduleResourceUpdate();
    }
    scheduleResourceUpdate() {
        if (this.scheduledResourceFrame) return;
        const schedule = window.requestAnimationFrame || (callback => setTimeout(callback));
        this.scheduledResourceFrame = schedule((() => {
            this.scheduledResourceFrame = null;
            const adapter = getDetailResourceAdapter();
            if (!adapter) return;
            this.placeOwnedSlots();
            adapter.sortSelect.length && (adapter.sortSelect.addClass("jhs-select-source"), JhsSelect.enhance(adapter.controller), JhsSelect.refresh(adapter.sortSelect));
            void jhsEventBus.emit("magnet-items-updated", { site: adapter.site, resourceRoot: adapter.resourceRoot[0], rows: adapter.rows() }, { broadcast: !1 });
        }));
    }
}

/** 将完全由 JHS 创建的详情弹层原位组织为固定插槽。 */
function organizeJhsOwnedDetailWorkspace(container) {
    if (!container?.length || container.attr("data-jhs-organized")) return;
    const children = container.children().detach();
    container.attr("data-jhs-organized", "true").addClass("jhs-detail-workspace jhs-ui").attr("data-site", "fc2").empty();
    const section = (name, title, hasContent = !1) => $(`<section class="jhs-detail-workspace__section ${hasContent ? "has-content" : ""}" data-jhs-section="${name}"><header class="jhs-detail-workspace__header"><h2>${title}</h2></header><div class="jhs-detail-workspace__content" data-jhs-slot="${name}"></div></section>`);
    const summary = section("summary", "影片概览", !0), gallery = section("gallery", "预览与剧照"), resources = section("resources", "资源", !0), reviews = section("reviews", "评论", !0), related = section("related", "相关清单", !0);
    container.append(summary, gallery, resources, reviews, related);
    const summaryContent = summary.find('[data-jhs-slot="summary"]'), resourceContent = resources.find('[data-jhs-slot="resources"]'), info = children.filter(".movie-info-container"), actionSelector = "#filterBtn, #favoriteBtn, #hasDownBtn, #hasWatchBtn, #enable-magnets-filter, #search-subtitle-btn, #xunLeiSubtitleBtn, #magnetSearchBtn", actionButtons = children.find(actionSelector).addBack(actionSelector);
    summaryContent.append(info), info.find(".origin-title, .current-title, .movie-title, h3").first().addClass("jhs-detail-title");
    if (actionButtons.length) {
        const toolbar = $('<div class="jhs-detail-btn-row" role="toolbar" aria-label="影片状态操作"></div>');
        actionButtons.each((function() { toolbar.append($(this).removeAttr("style").addClass("jhs-btn")); })), summaryContent.append(toolbar);
    }
    resourceContent.append(children.filter(".movie-panel-info, .video-panel")), resourceContent.find("#magnets-content").length || resourceContent.append(children.filter("#magnets-content"));
    related.find('[data-jhs-slot="related"]').append(children.filter("#related-content")), reviews.find('[data-jhs-slot="reviews"]').append(children.filter("#reviews-content")), container.append(children.filter("#data-actress").removeAttr("style").addClass("jhs-is-hidden"));
    const movieGallery = info.find(".movie-gallery").first();
    movieGallery.length && (gallery.find('[data-jhs-slot="gallery"]').append(movieGallery), gallery.addClass("has-content"));
}
