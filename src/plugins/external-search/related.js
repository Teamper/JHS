class RelatedPlugin extends BasePlugin {
    getName() {
        return "RelatedPlugin";
    }
    async initCss() {
        return `
            <style>
                .jhs-related-panel { min-width:0; }
                .jhs-related-list { display:grid; }
                .jhs-related-item { display:grid; gap:var(--jhs-space-2); padding:var(--jhs-space-3) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
                .jhs-related-item:last-child { border-bottom:0; }
                .jhs-related-heading { display:flex; min-width:0; align-items:baseline; gap:var(--jhs-space-2); }
                .jhs-related-index { flex:none; color:var(--jhs-text-faint); font-size:14px; }
                .jhs-related-title { min-width:0; overflow:hidden; color:var(--jhs-accent); font-size:16px; font-weight:600; text-overflow:ellipsis; text-decoration:none; white-space:nowrap; }
                .jhs-related-meta { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2) var(--jhs-space-4); color:var(--jhs-text-muted); font-size:14px; }
                .jhs-related-time { color:var(--jhs-text-faint); font-size:14px; white-space:nowrap; }
            </style>`;
    }
    async showRelated(target, movieId) {
        const enabled = await storageManager.getSetting("enableLoadRelated", C), host = target?.length ? target : this.getBean("DetailWorkspacePlugin")?.getSlot("related");
        if (!movieId) return void show.error("未传入movieId");
        const existing = host.children('[data-jhs-panel="related"]').filter(((_, element) => $(element).attr("data-jhs-movie-id") === String(movieId))).first();
        if (existing.length) return existing;
        const panel = $('<section class="jhs-related-panel" data-jhs-panel="related"></section>').attr("data-jhs-movie-id", String(movieId)), header = $('<header class="jhs-panel-header"><h3>相关清单</h3></header>'), toggle = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-panel-toggle jhs-related-toggle"><span class="toggle-text"></span><span class="toggle-icon" aria-hidden="true"></span></button>'), state = { movieId, panel, floorIndex: 1, loaded: !1, loading: !1, page: 1 };
        header.append(toggle), panel.append(header, '<div class="jhs-related-list jhs-related-container"></div>', '<div class="jhs-panel-footer jhs-related-footer"></div>'), host.append(panel);
        this.updateToggle(toggle, enabled === _);
        toggle.on("click", (event => {
            event.preventDefault(), event.stopPropagation();
            const expanded = "展开" === toggle.find(".toggle-text").text();
            this.updateToggle(toggle, expanded), panel.find(".jhs-related-container, .jhs-related-footer").toggle(expanded), expanded && !state.loaded && !state.loading && void this.fetchAndDisplayRelateds(state), storageManager.saveSettingItem("enableLoadRelated", expanded ? _ : C);
        }));
        enabled === _ ? await this.fetchAndDisplayRelateds(state) : panel.find(".jhs-related-container, .jhs-related-footer").hide();
        return panel;
    }
    updateToggle(toggle, expanded) {
        toggle.attr("aria-expanded", String(expanded)), toggle.find(".toggle-text").text(expanded ? "折叠" : "展开"),
        toggle.find(".toggle-icon").text(expanded ? "▲" : "▼");
    }
    async fetchAndDisplayRelateds(state) {
        if (state.loading) return;
        state.loading = !0;
        const { movieId, panel } = state, container = panel.find(".jhs-related-container"), footer = panel.find(".jhs-related-footer");
        container.empty().append($('<div class="jhs-panel-state"></div>').text("获取清单中...")), footer.empty();
        let related;
        try {
            related = await K(movieId, 1, 20);
        } catch (error) {
            clog.error("获取清单失败:", error);
            state.loading = !1;
            return void this.renderRetry(container, (() => this.fetchAndDisplayRelateds(state)));
        }
        state.loading = !1, state.loaded = !0;
        container.empty();
        if (!related.length) return void container.append($('<div class="jhs-panel-state"></div>').text("无清单"));
        this.displayRelateds(state, related, container), 20 === related.length ? this.bindLoadMore(state, container, footer) : footer.append($('<div class="jhs-panel-end"></div>').text("已加载全部清单"));
    }
    renderRetry(container, retry) {
        container.empty();
        const state = $('<div class="jhs-panel-state"></div>').append(document.createTextNode("获取清单失败 "));
        state.append($('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm">重试</button>').on("click", retry)), container.append(state);
    }
    bindLoadMore(state, container, footer) {
        const button = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-related-load-more">加载更多清单</button>'), end = $('<div class="jhs-panel-end jhs-related-end">已加载全部清单</div>').hide();
        footer.empty().append(button, end);
        button.on("click", (async () => {
            button.text("加载中...").prop("disabled", !0), state.page++;
            try {
                const related = await K(state.movieId, state.page, 20);
                this.displayRelateds(state, related, container), related.length < 20 ? (button.remove(), end.show()) : button.text("加载更多清单").prop("disabled", !1);
            } catch (error) {
                clog.error("加载更多清单失败:", error), button.text("加载失败，请重试").prop("disabled", !1);
            }
        }));
    }
    displayRelateds(state, related, container) {
        related.forEach((item => {
            const row = $('<article class="jhs-related-item"></article>'), title = $("<a></a>").addClass("jhs-related-title").attr({
                href: `/lists/${encodeURIComponent(item.relatedId)}`,
                target: "_blank",
                rel: "noopener noreferrer"
            }).text(item.name || "未命名清单"), heading = $('<div class="jhs-related-heading"></div>').append($("<span></span>").addClass("jhs-related-index").text(`#${state.floorIndex++}`), title), meta = $('<div class="jhs-related-meta"></div>'), time = $('<time class="jhs-related-time"></time>').text(`创建时间：${item.createTime || "未知"}`);
            meta.append($("<span></span>").text(`视频：${Number(item.movieCount) || 0}`), $("<span></span>").text(`收藏：${Number(item.collectionCount) || 0}`),
            $("<span></span>").text(`查看：${Number(item.viewCount) || 0}`), time), row.append(heading, meta), container.append(row);
        }));
    }
}
