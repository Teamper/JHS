/** 将 JHS 详情 iframe 重组为高密度五区工作区，直接访问宿主详情页时不生效。 */
class DetailWorkspacePlugin extends BasePlugin {
    getName() {
        return "DetailWorkspacePlugin";
    }
    async initCss() {
        return `
            <style>
                .jhs-detail-workspace { display:grid; width:min(100%,1440px); margin:0 auto; padding:var(--jhs-space-4); color:var(--jhs-text); background:var(--jhs-surface); }
                .jhs-detail-workspace.movie-detail-container { height:100%; margin:0; overflow-y:auto; }
                .jhs-detail-workspace__section { min-width:0; padding:var(--jhs-space-5) 0; border-top:1px solid var(--jhs-border); }
                .jhs-detail-workspace__section:first-child { padding-top:0; border-top:0; }
                .jhs-detail-workspace__section:not(.has-content) { display:none; }
                .jhs-detail-workspace__header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-detail-workspace__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-xl); font-weight:700; }
                .jhs-detail-workspace__actions { display:flex; align-items:center; gap:var(--jhs-space-2); }
                .jhs-detail-workspace__content { min-width:0; }
                .jhs-detail-summary { display:grid; grid-template-columns:minmax(220px,280px) minmax(0,1fr); align-items:start; gap:var(--jhs-space-5); }
                .jhs-detail-summary__media, .jhs-detail-summary__info { min-width:0; }
                .jhs-detail-summary__media img { width:100%; height:auto; border-radius:var(--jhs-radius-md); }
                .jhs-detail-title { display:-webkit-box; overflow:hidden; margin:0 0 var(--jhs-space-2); color:var(--jhs-text); font-size:clamp(20px,2vw,24px); line-height:1.3; -webkit-box-orient:vertical; -webkit-line-clamp:2; }
                .jhs-detail-summary__info .translated-title { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:clamp(16px,1.5vw,18px); font-weight:500; line-height:1.5; }
                .jhs-detail-summary__actions { grid-column:1/-1; }
                .jhs-detail-host-action { display:inline-flex!important; min-height:var(--jhs-control-height)!important; align-items:center!important; justify-content:center!important; padding:0 var(--jhs-space-3)!important; border:1px solid var(--jhs-border)!important; border-radius:var(--jhs-radius-sm)!important; background:var(--jhs-surface)!important; color:var(--jhs-text)!important; box-shadow:none!important; font:inherit!important; font-size:var(--jhs-font-size-sm)!important; font-weight:600!important; line-height:1!important; text-decoration:none!important; }
                .jhs-detail-host-action:hover { border-color:var(--jhs-accent)!important; background:var(--jhs-surface-2)!important; color:var(--jhs-accent)!important; }
                .jhs-detail-workspace .jhs-detail-btn-row { margin:0 !important; }
                .jhs-detail-workspace [data-jhs-section-content="gallery"] .tile-images,
                .jhs-detail-workspace [data-jhs-section-content="gallery"] #sample-waterfall,
                .jhs-detail-workspace [data-jhs-section-content="gallery"] .movie-gallery,
                .jhs-detail-workspace [data-jhs-section-content="resources"] #magnets-content,
                .jhs-detail-workspace [data-jhs-section-content="resources"] #magnet-table { margin:0; }
                .jhs-detail-workspace [data-jhs-section-content="resources"] :is(#magnets-content,#magnet-table,.video-panel) { border-radius:var(--jhs-radius-sm); }
                .jhs-detail-source--reflowed { display:none !important; }
                @media (max-width:767px) {
                    .jhs-detail-workspace { padding:var(--jhs-space-3); }
                    .jhs-detail-workspace__section { padding:var(--jhs-space-4) 0; }
                    .jhs-detail-summary { grid-template-columns:1fr; }
                    .jhs-detail-summary__media { width:min(100%,360px); margin:0 auto; }
                    .jhs-detail-summary__actions { grid-column:auto; }
                }
            </style>`;
    }
    async handle() {
        if (!window.isDetailPage || "1" !== new URLSearchParams(window.location.search).get("hideNav")) return;
        utils.loopDetector((() => !!this.getAdapter()), (() => this.buildWorkspace()), 40, 2500, !0);
    }
    getAdapter() {
        if (r) {
            const root = $(".video-detail").first(), cover = root.find(".column-video-cover").first(), info = root.find(".column-video-info").first();
            return root.length && cover.length && info.length ? {
                site: "javdb",
                root,
                cover,
                info,
                title: $()
            } : null;
        }
        if (l) {
            const cover = $(".screencap").first(), info = $(".info").first(), root = cover.closest(".container");
            const title = root.find("h3").first();
            return root.length && cover.length && info.length ? {
                site: "javbus",
                root,
                cover,
                info,
                title
            } : null;
        }
        return null;
    }
    buildWorkspace() {
        if ($("#jhs-detail-workspace").length) return;
        const adapter = this.getAdapter();
        if (!adapter) {
            clog.warn("详情工作区未启用：关键宿主节点缺失，已保留原页面布局");
            return;
        }
        const workspace = $(`
            <main id="jhs-detail-workspace" class="jhs-detail-workspace jhs-ui" data-site="${adapter.site}">
                ${this.section("summary", "影片概览")}
                ${this.section("gallery", "预览与剧照")}
                ${this.section("resources", "资源")}
                ${this.section("related", "相关清单")}
                ${this.section("reviews", "评论")}
            </main>`);
        const summary = workspace.find('[data-jhs-section-content="summary"]');
        const summaryGrid = $('<div class="jhs-detail-summary"><div class="jhs-detail-summary__media"></div><div class="jhs-detail-summary__info"></div><div class="jhs-detail-summary__actions"></div></div>');
        summary.append(summaryGrid);
        adapter.title.length && summaryGrid.find(".jhs-detail-summary__info").append(adapter.title);
        summaryGrid.find(".jhs-detail-summary__media").append(adapter.cover);
        summaryGrid.find(".jhs-detail-summary__info").append(adapter.info);
        this.normalizeHostActions(adapter.info);
        const titleNode = adapter.title.length ? adapter.title : summaryGrid.find(".origin-title, .current-title, h3").first();
        titleNode.addClass("jhs-detail-title");
        workspace.find('[data-jhs-section="summary"]').addClass("has-content");
        adapter.site === "javdb" ? workspace.insertBefore(adapter.root) : adapter.root.prepend(workspace);
        this.routeSections(workspace, adapter.root);
        adapter.site === "javdb" && adapter.root.addClass("jhs-detail-source--reflowed");
        let scheduledFrame = null;
        const observer = new MutationObserver((() => {
            if (scheduledFrame) return;
            scheduledFrame = requestAnimationFrame((() => {
                scheduledFrame = null;
                if (!workspace[0]?.isConnected) return void observer.disconnect();
                this.routeSections(workspace, adapter.root);
            }));
        }));
        adapter.root[0] && observer.observe(adapter.root[0], {
            childList: !0,
            subtree: !0
        });
    }
    /** 仅统一工作区内已知宿主操作的外观，不替换节点或事件。 */
    normalizeHostActions(info) {
        const labels = new Set([ "想看", "看过", "看過", "存入清单", "存入清單", "下载", "下載", "订正", "訂正" ]);
        info.find("a, button").filter((function() {
            return !$(this).is(".jhs-btn, [id^='jhs-']") && labels.has($(this).text().replace(/\s+/g, " ").trim());
        })).addClass("jhs-detail-host-action");
    }
    section(name, title) {
        return `<section class="jhs-detail-workspace__section" data-jhs-section="${name}" aria-labelledby="jhs-detail-${name}-title"><header class="jhs-detail-workspace__header"><h2 id="jhs-detail-${name}-title">${title}</h2><div class="jhs-detail-workspace__actions" data-jhs-section-actions="${name}"></div></header><div class="jhs-detail-workspace__content" data-jhs-section-content="${name}"></div></section>`;
    }
    routeSections(workspace, sourceRoot) {
        this.moveToSection(workspace, "gallery", [ ".tile-images", ".preview-images", "#sample-waterfall", ".movie-gallery" ]);
        this.moveToSection(workspace, "resources", [ ".jhs-detail-btn-row", "#magnets-content", "#magnet-table", "#mag-submit-show", ".movie-panel-info" ]);
        this.movePanelToSection(workspace, "related", ".jhs-related-panel");
        this.movePanelToSection(workspace, "reviews", ".jhs-review-panel");
        this.moveToSection(workspace, "related", [ "#related-content" ]);
        this.moveToSection(workspace, "reviews", [ "#reviews-content" ]);
        const actions = workspace.find(".jhs-detail-summary__actions"), buttonRow = workspace.find('[data-jhs-section-content="resources"] > .jhs-detail-btn-row').first();
        buttonRow.length && actions.append(buttonRow);
        actions.children().length && workspace.find('[data-jhs-section="summary"]').addClass("has-content");
        sourceRoot.find(".jhs-detail-source--reflowed").removeClass("jhs-detail-source--reflowed");
    }
    movePanelToSection(workspace, name, selector) {
        const target = workspace.find(`[data-jhs-section-content="${name}"]`), actionTarget = workspace.find(`[data-jhs-section-actions="${name}"]`), section = workspace.find(`[data-jhs-section="${name}"]`);
        $(selector).each((function() {
            const panel = $(this);
            if (panel.closest(".layui-layer").length || panel.closest(target).length) return;
            const toggle = panel.find(".jhs-panel-toggle").first().detach();
            toggle.length && actionTarget.empty().append(toggle);
            panel.find(".jhs-panel-header").remove();
            target.append(panel);
        }));
        target.children().length && section.addClass("has-content");
    }
    moveToSection(workspace, name, selectors) {
        const target = workspace.find(`[data-jhs-section-content="${name}"]`), section = workspace.find(`[data-jhs-section="${name}"]`);
        selectors.forEach((selector => {
            $(selector).each((function() {
                const node = $(this);
                node.closest(".layui-layer").length || node.closest(workspace).length || target.append(node);
            }));
        }));
        target.children().length && section.addClass("has-content");
    }
}

/** 把评论或相关清单的折叠操作收纳到已有工作区标题。 */
function adoptOwnedDetailPanels(container, sections) {
    let scheduledFrame = null;
    const route = () => {
        for (const [name, selector] of Object.entries(sections)) {
            const section = container.find(`[data-jhs-section="${name}"]`), content = section.find(`[data-jhs-section-content="${name}"]`), actions = section.find(`[data-jhs-section-actions="${name}"]`), panel = content.find(selector).first();
            if (!panel.length) continue;
            const toggle = panel.find(".jhs-panel-toggle").first().detach();
            toggle.length && actions.empty().append(toggle);
            panel.find(".jhs-panel-header").remove();
            section.addClass("has-content");
        }
    };
    route();
    const observer = new MutationObserver((() => {
        if (scheduledFrame) return;
        scheduledFrame = requestAnimationFrame((() => {
            scheduledFrame = null;
            if (!container[0]?.isConnected) return void observer.disconnect();
            route();
        }));
    }));
    container[0] && observer.observe(container[0], {
        childList: !0,
        subtree: !0
    });
}

/** 将现有 FC2 弹层节点原位重组为五区工作区。 */
function organizeJhsOwnedDetailWorkspace(container) {
    if (!container?.length || container.attr("data-jhs-organized")) return;
    const children = container.children().detach();
    container.attr("data-jhs-organized", "true").addClass("jhs-detail-workspace jhs-ui").attr("data-site", "fc2").empty();
    const section = (name, title, hasContent = !1) => $(`<section class="jhs-detail-workspace__section ${hasContent ? "has-content" : ""}" data-jhs-section="${name}"><header class="jhs-detail-workspace__header"><h2>${title}</h2><div class="jhs-detail-workspace__actions" data-jhs-section-actions="${name}"></div></header><div class="jhs-detail-workspace__content" data-jhs-section-content="${name}"></div></section>`);
    const summary = section("summary", "影片概览", !0), gallery = section("gallery", "预览与剧照"), resources = section("resources", "资源", !0), related = section("related", "相关清单", !0), reviews = section("reviews", "评论", !0);
    container.append(summary, gallery, resources, related, reviews);
    const summaryContent = summary.find('[data-jhs-section-content="summary"]'), resourceContent = resources.find('[data-jhs-section-content="resources"]');
    const info = children.filter(".movie-info-container"), actionSelector = "#filterBtn, #favoriteBtn, #hasDownBtn, #hasWatchBtn, #enable-magnets-filter, #search-subtitle-btn, #xunLeiSubtitleBtn, #magnetSearchBtn", actionButtons = children.find(actionSelector).addBack(actionSelector);
    summaryContent.append(info), info.find(".origin-title, .current-title, .movie-title, h3").first().addClass("jhs-detail-title");
    if (actionButtons.length) {
        const toolbar = $('<div class="jhs-detail-btn-row" role="toolbar" aria-label="影片状态操作"></div>');
        actionButtons.each((function() {
            toolbar.append($(this).removeAttr("style").addClass("jhs-btn"));
        }));
        summaryContent.append(toolbar);
    }
    resourceContent.append(children.filter(".movie-panel-info, .video-panel"));
    resourceContent.find("#magnets-content").length || resourceContent.append(children.filter("#magnets-content"));
    related.find('[data-jhs-section-content="related"]').append(children.filter("#related-content"));
    reviews.find('[data-jhs-section-content="reviews"]').append(children.filter("#reviews-content"));
    container.append(children.filter("#data-actress").removeAttr("style").addClass("jhs-is-hidden"));
    const moveGallery = () => {
        const movieGallery = info.find(".movie-gallery").first();
        if (!movieGallery.length) return !1;
        gallery.find('[data-jhs-section-content="gallery"]').append(movieGallery), gallery.addClass("has-content");
        return !0;
    };
    if (!moveGallery() && info[0]) {
        const galleryObserver = new MutationObserver((() => {
            moveGallery() && galleryObserver.disconnect();
        }));
        galleryObserver.observe(info[0], {
            childList: !0,
            subtree: !0
        });
    }
    adoptOwnedDetailPanels(container, {
        related: ".jhs-related-panel",
        reviews: ".jhs-review-panel"
    });
}
