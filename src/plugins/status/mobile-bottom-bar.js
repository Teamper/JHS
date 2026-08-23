class MobileBottomBarPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        this._fabGeneration = 0;
    }
    getName() {
        return "MobileBottomBarPlugin";
    }
    shouldSkipOnMobile() {
        return false; // this plugin only runs on mobile
    }
    async initCss() {
        return `
            /* FAB 浮动操作按钮 */
            #jhs-fab {
                position: fixed;
                bottom: calc(24px + env(safe-area-inset-bottom, 0px));
                right: 20px;
                width: 56px;
                height: 56px;
                border: 0;
                border-radius: 50%;
                background: var(--jhs-accent);
                color: var(--jhs-accent-text-on);
                font-size: 26px;
                font-family: inherit;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: var(--jhs-z-fab);
                box-shadow: var(--jhs-shadow-md);
                transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1), box-shadow 0.3s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                -webkit-user-select: none;
            }
            #jhs-fab:active {
                transform: scale(0.9);
            }
            #jhs-fab.jhs-fab-open {
                transform: rotate(135deg);
                background: var(--jhs-accent-hover);
                color: var(--jhs-accent-text-on);
                box-shadow: var(--jhs-shadow-md);
            }

            /* FAB 遮罩 */
            .jhs-fab-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.25);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                z-index: var(--jhs-z-fab-backdrop);
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }
            .jhs-fab-backdrop.jhs-fab-backdrop-visible {
                opacity: 1;
                pointer-events: auto;
            }

            /* FAB 菜单 */
            .jhs-fab-menu {
                position: fixed;
                bottom: calc(92px + env(safe-area-inset-bottom, 0px));
                right: 16px;
                z-index: var(--jhs-z-fab-menu);
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: flex-end;
                opacity: 0;
                transform: translateY(16px) scale(0.92);
                pointer-events: none;
                transition: opacity 0.25s, transform 0.25s cubic-bezier(0.32, 0.72, 0, 1);
            }
            .jhs-fab-menu.jhs-fab-menu-open {
                opacity: 1;
                transform: translateY(0) scale(1);
                pointer-events: auto;
            }

            /* FAB 菜单分组 */
            .jhs-fab-group {
                display: flex;
                flex-direction: column;
                gap: 10px;
                align-items: flex-end;
            }
            .jhs-fab-divider {
                width: 32px;
                height: 2px;
                background: var(--jhs-border);
                border-radius: 1px;
                align-self: flex-end;
                margin: 2px 0;
            }

            /* FAB 菜单项 */
            .jhs-fab-menu-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 16px;
                background: var(--jhs-surface);
                border: 1px solid var(--jhs-border);
                border-radius: 24px;
                box-shadow: var(--jhs-shadow-md);
                cursor: pointer;
                white-space: nowrap;
                min-height: 44px;
                font-size: 14px;
                font-family: inherit;
                font-weight: 500;
                color: var(--jhs-text);
                opacity: 0;
                transform: translateY(8px) scale(0.92);
                transition: opacity 0.2s, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), background 0.15s;
                -webkit-tap-highlight-color: transparent;
                user-select: none;
                -webkit-user-select: none;
            }
            .jhs-fab-menu-item.jhs-fab-item-visible {
                opacity: 1;
                transform: translateY(0) scale(1);
                transition: opacity 0.2s ease, transform 0.2s cubic-bezier(0.32, 0.72, 0, 1), background 0.15s;
            }
            .jhs-fab-menu-item:active {
                transform: scale(0.95);
                background: var(--jhs-surface-2);
            }

            /* FAB 状态色块 */
            .jhs-fab-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
                background: var(--jhs-border-strong);
            }

            .jhs-page-commandbar {
                display: flex;
                align-items: center;
                justify-content: space-between;
                overflow: visible;
                gap: var(--jhs-space-3);
                width: 100%;
                margin: var(--jhs-space-3) 0;
            }
            .jhs-commandbar__left, .jhs-commandbar__right,
            .jhs-commandbar__primary, .jhs-commandbar__filters,
            .jhs-commandbar__context, .jhs-commandbar__view {
                display: flex;
                align-items: center;
                gap: var(--jhs-space-1);
                min-width: 0;
                white-space: nowrap;
            }
            .jhs-commandbar__left { flex: 1 1 auto; overflow:visible; }
            .jhs-commandbar__right { flex: 0 0 auto; overflow:visible; }
            .jhs-commandbar__filters { overflow:visible; }
            .jhs-commandbar__batch, .jhs-commandbar__more, .jhs-sort-control { position:relative; }
            .jhs-commandbar__menu { min-width:220px; }
            .jhs-commandbar__menu .jhs-btn, .jhs-sort-menu .jhs-btn { width:100%; justify-content:flex-start; }
            .jhs-commandbar__sort-label { color:var(--jhs-text-muted); font-size:14px; }
            .jhs-mobile-filter-menu, .jhs-mobile-sort-menu { display:none; min-width:220px; padding:var(--jhs-space-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
            .jhs-fab-menu:is(.jhs-fab-filter-open,.jhs-fab-sort-open) > .jhs-fab-group, .jhs-fab-menu:is(.jhs-fab-filter-open,.jhs-fab-sort-open) > .jhs-fab-divider { display:none; }
            .jhs-fab-menu.jhs-fab-filter-open > .jhs-mobile-filter-menu, .jhs-fab-menu.jhs-fab-sort-open > .jhs-mobile-sort-menu { display:grid; gap:var(--jhs-space-1); }
            .jhs-mobile-filter-menu .jhs-btn, .jhs-mobile-sort-menu .jhs-btn { width:100%; justify-content:flex-start; }
            @media (max-width: 1023px) {
                .jhs-page-commandbar { flex-wrap:wrap; overflow:visible; }
                .jhs-commandbar__left, .jhs-commandbar__right { flex-wrap:wrap; overflow:visible; }
                .jhs-commandbar__left { flex-basis:100%; }
                .jhs-commandbar__right { margin-left:auto; }
            }
            @media (max-width: 768px) {
                .jhs-page-commandbar { display: none; }
            }
        `;
    }
    async handle() {
        if (!utils.isMobileMode()) return;
        // 添加遮罩
        const backdrop = $('<div class="jhs-fab-backdrop"></div>').appendTo("body");
        // 添加菜单
        const menu = this.createMenu();
        $("body").append(menu);
        // 添加 FAB 按钮
        const fab = $('<button type="button" id="jhs-fab" class="jhs-btn" aria-label="打开 JHS 工具" aria-controls="jhs-fab-menu" aria-haspopup="menu" aria-expanded="false">＋</button>').appendTo("body");
        this.bindEvents(fab, backdrop);
    }
    async afterPluginsReady() {
        this.buildCommandBar();
    }
    /** 将列表页分散的 JHS 控件收敛为单一命令栏。 */
    buildCommandBar() {
        if (!window.isListPage || $("#jhs-page-commandbar").length) return;
        const commandbar = $(`
            <div id="jhs-page-commandbar" class="jhs-page-commandbar jhs-ui" role="toolbar" aria-label="JHS 页面工具">
                <div class="jhs-commandbar__left"></div>
                <div class="jhs-commandbar__right"></div>
            </div>`);
        const listBox = r ? $(this.getSelector().boxSelector).first() : $(".masonry").first();
        if (!listBox.length) return void clog.warn("JHS 页面工具栏未创建：列表容器尚未就绪");
        listBox.before(commandbar);
        const left = commandbar.find(".jhs-commandbar__left"), right = commandbar.find(".jhs-commandbar__right");
        const primary = $('<div class="jhs-commandbar__primary"></div>');
        [ "#waitCheckBtn", "#newVideoBtn", "#historyBtn" ].forEach((selector => {
            const item = $(selector).first();
            item.length && item.attr("class", "jhs-btn jhs-btn--secondary").removeAttr("role tabindex").detach().appendTo(primary);
        }));
        primary.children().length && left.append(primary);
        const more = $('<div class="jhs-commandbar__more"><button type="button" class="jhs-btn jhs-btn--secondary jhs-commandbar__menu-toggle" aria-haspopup="menu" aria-controls="jhs-commandbar-more-menu" aria-expanded="false">更多</button><div id="jhs-commandbar-more-menu" class="jhs-popover jhs-commandbar__menu" role="menu"></div></div>');
        [ "#statsBtn", "#blacklistBtn" ].forEach((selector => {
            const item = $(selector).first();
            item.length && item.attr({ class: "jhs-btn jhs-btn--ghost", role: "menuitem", tabindex: "-1" }).detach().appendTo(more.find(".jhs-commandbar__menu"));
        }));
        more.find(".jhs-commandbar__menu").children().length && left.append(more);
        const quickFilter = $("#jhs-quick-filter").first();
        quickFilter.length && left.append($('<div class="jhs-commandbar__filters"></div>').append(quickFilter.detach()));
        const contextItem = $("#addBlacklistBtn").first();
        contextItem.length && contextItem.attr("class", "jhs-btn jhs-btn--secondary").removeAttr("role tabindex").detach().appendTo($('<div class="jhs-commandbar__context"></div>').appendTo(right));
        const sort = $(".jhs-sort-control").first();
        if (sort.length) {
            const view = $('<label class="jhs-commandbar__view"><span class="jhs-commandbar__sort-label">排序</span></label>');
            sort.detach().appendTo(view), right.append(view);
        }
        const batch = $('<div class="jhs-commandbar__batch"><button type="button" class="jhs-btn jhs-btn--secondary jhs-commandbar__menu-toggle" aria-haspopup="menu" aria-controls="jhs-commandbar-batch-menu" aria-expanded="false">批量操作</button><div id="jhs-commandbar-batch-menu" class="jhs-popover jhs-commandbar__menu" role="menu"></div></div>');
        [ "#filterAllVideo", "#favoriteAllVideo", "#hasDownAllVideo" ].forEach((selector => {
            const item = $(selector).first();
            item.length && item.attr({ class: "jhs-btn jhs-btn--ghost", role: "menuitem", tabindex: "-1" }).detach().appendTo(batch.find(".jhs-commandbar__menu"));
        }));
        batch.find(".jhs-commandbar__menu").children().length && right.append(batch);
        $(".jhs-list-btn-row").filter((function() { return !$(this).children().length; })).remove();
        commandbar.find(".jhs-commandbar__more, .jhs-commandbar__batch").each((function() {
            const container = $(this), toggle = container.find(".jhs-commandbar__menu-toggle"), menu = container.find(".jhs-commandbar__menu");
            toggle.on("click", (event => {
                event.stopPropagation();
                const open = !menu.hasClass("is-open");
                commandbar.find(".jhs-commandbar__menu").removeClass("is-open"), commandbar.find(".jhs-commandbar__menu-toggle").attr("aria-expanded", "false"),
                menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && menu.children().first().trigger("focus");
            })), menu.on("keydown", "[role='menuitem']", (event => {
                const items = menu.find("[role='menuitem']"), index = items.index(event.currentTarget);
                if ("Escape" === event.key) return event.preventDefault(), menu.removeClass("is-open"), toggle.attr("aria-expanded", "false").trigger("focus");
                if ("Tab" === event.key) return menu.removeClass("is-open"), void toggle.attr("aria-expanded", "false");
                if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                items.eq(next).trigger("focus");
            })).on("click", "[role='menuitem']", (() => {
                menu.removeClass("is-open"), toggle.attr("aria-expanded", "false").trigger("focus");
            }));
        }));
        $(document).off("click.jhsCommandbar").on("click.jhsCommandbar", (event => {
            $(event.target).closest(".jhs-commandbar__more, .jhs-commandbar__batch").length || (commandbar.find(".jhs-commandbar__menu").removeClass("is-open"), commandbar.find(".jhs-commandbar__menu-toggle").attr("aria-expanded", "false"));
        }));
        this.getBean("ListPagePlugin")?.syncQuickFilterUi();
    }
    /** 获取详情页番号 */
    getCarNum() {
        try {
            const basePlugin = this.getBean("DetailPageButtonPlugin");
            if (basePlugin?.parseMovieId) return basePlugin.parseMovieId(location.href);
            const el = document.querySelector(".header, #video_id, .video-id");
            if (el) return el.textContent.trim();
        } catch (e) { clog.debug("移动端详情番号解析失败，已回退", e); }
        return null;
    }
    createMenu() {
        const item = (action, label, attributes = "") => `<button type="button" role="menuitem" class="jhs-btn jhs-fab-menu-item" data-action="${action}" ${attributes}>${label}</button>`, group = content => `<div class="jhs-fab-group">${content}</div>`, divider = '<div class="jhs-fab-divider" role="separator"></div>';
        let items;
        if (window.isListPage) {
            const sortMethod = localStorage.getItem("jhs_sortMethod") || "default", sortLabels = { default: "默认", rateCount: "评价人数", date: "时间" }, sortLabel = sortLabels[sortMethod], activeFilter = normalizeQuickFilterKey(this.getBean("ListPagePlugin")?.activeQuickFilter),
                filterOptions = [ ...PRIMARY_QUICK_FILTERS, ...SECONDARY_QUICK_FILTERS ].map(((filter, index) => `${index === PRIMARY_QUICK_FILTERS.length ? '<div class="jhs-filter-menu__separator" role="separator"></div>' : ""}<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-mobile-filter-option" aria-checked="${filter === activeFilter}" tabindex="-1" data-jhs-filter="${filter}">${QUICK_FILTER_LABELS[filter]}</button>`)).join(""),
                sortOptions = Object.entries(sortLabels).map((([value, label]) => `<button type="button" role="menuitemradio" class="jhs-btn jhs-btn--ghost jhs-mobile-sort-option" aria-checked="${value === sortMethod}" tabindex="-1" data-jhs-sort="${value}">${label}</button>`)).join("");
            items = group(item("check", "开始鉴定") + item("newVideo", "新作品") + item("blacklist", "黑名单") + item("sort", `排序: ${sortLabel}`, 'aria-haspopup="menu" aria-expanded="false"') + item("quickFilter", `<span class="jhs-mobile-filter-label">筛选：${QUICK_FILTER_LABELS[activeFilter]}</span>`, 'aria-haspopup="menu" aria-expanded="false"')) + divider + group(item("logger", "运行日志") + item("setting", "设置")) + `<div class="jhs-mobile-filter-menu" role="menu" aria-label="列表筛选">${filterOptions}</div><div class="jhs-mobile-sort-menu" role="menu" aria-label="列表排序">${sortOptions}</div>`;
        } else if (window.isDetailPage) {
            const statusDefs = [ { action: "filter", icon: m, label: "屏蔽", key: "filter" }, { action: "fav", icon: v, label: "收藏", key: "fav" }, { action: "down", icon: y, label: "已下载", key: "down" }, { action: "watch", icon: k, label: "已观看", key: "watch" } ];
            items = group(statusDefs.map((definition => item(definition.action, `<span class="jhs-fab-status-dot" data-status-key="${definition.key}"></span>${definition.icon}`, `aria-label="${definition.label}" aria-pressed="false" data-label="${definition.label}"`))).join("")) + divider + group(item("magnetFilter", "磁力过滤") + item("magnet", "磁力搜索") + item("subtitle", "字幕")) + divider + group(item("logger", "运行日志") + item("setting", "设置"));
        } else items = group(item("logger", "运行日志") + item("setting", "设置"));
        return $(`<div id="jhs-fab-menu" class="jhs-fab-menu" role="menu" aria-hidden="true">${items}</div>`);
    }
    /** 刷新详情页菜单的状态指示 */
    async refreshDetailStatus() {
        try {
            const carNum = this.getCarNum();
            if (!carNum) return;
            const car = await storageManager.getCar(carNum);
            const menu = $(".jhs-fab-menu");
            const colors = { filter: "var(--jhs-status-filter)", fav: "var(--jhs-status-fav)", down: "var(--jhs-status-down)", watch: "var(--jhs-status-watch)" };
            const flags = normalizeStateFlags(car?.stateFlags), activeKeys = new Set([
                flags.blocked && "filter", flags.favorite && "fav", flags.downloaded && "down", flags.watched && "watch"
            ].filter(Boolean));
            menu.find(".jhs-fab-status-dot").each(function () {
                const key = $(this).data("status-key");
                const item = $(this).closest(".jhs-fab-menu-item");
                if (activeKeys.has(key)) {
                    $(this).css({ background: colors[key] || "var(--jhs-border-strong)" }), item.attr("aria-pressed", "true");
                } else {
                    $(this).css({ background: "var(--jhs-border-strong)" }), item.attr("aria-pressed", "false");
                }
            });
        } catch (e) { clog.warn("移动端详情状态刷新失败", e); }
    }
    bindEvents(fab, backdrop) {
        const menu = $(".jhs-fab-menu"), filterMenu = menu.find(".jhs-mobile-filter-menu"), sortMenu = menu.find(".jhs-mobile-sort-menu"), filterTrigger = menu.find('[data-action="quickFilter"]'), sortTrigger = menu.find('[data-action="sort"]'), closeFilterMenu = (returnFocus = !1) => {
            menu.removeClass("jhs-fab-filter-open"), filterTrigger.attr("aria-expanded", "false"), returnFocus && filterTrigger.trigger("focus");
        }, closeSortMenu = (returnFocus = !1) => {
            menu.removeClass("jhs-fab-sort-open"), sortTrigger.attr("aria-expanded", "false"), returnFocus && sortTrigger.trigger("focus");
        };
        const closeMenu = (returnFocus = !1) => {
            this._fabGeneration++;
            closeFilterMenu(), closeSortMenu();
            fab.removeClass("jhs-fab-open").attr("aria-expanded", "false");
            menu.removeClass("jhs-fab-menu-open").attr("aria-hidden", "true");
            backdrop.removeClass("jhs-fab-backdrop-visible");
            menu.find(".jhs-fab-menu-item").removeClass("jhs-fab-item-visible");
            returnFocus && fab.trigger("focus");
        };
        const toggleMenu = () => {
            const isOpen = fab.hasClass("jhs-fab-open");
            if (isOpen) {
                closeMenu();
            } else {
                fab.addClass("jhs-fab-open").attr("aria-expanded", "true");
                menu.addClass("jhs-fab-menu-open").attr("aria-hidden", "false");
                backdrop.addClass("jhs-fab-backdrop-visible");
                // 刷新排序标签
                if (window.isListPage) {
                    const sortMethod = localStorage.getItem("jhs_sortMethod") || "default";
                    const sortLabel = { default: "默认", rateCount: "评价人数", date: "时间" }[sortMethod];
                    menu.find('[data-action="sort"]').text(`排序: ${sortLabel}`);
                    this.getBean("ListPagePlugin")?.syncQuickFilterUi();
                }
                // 刷新详情页状态
                if (window.isDetailPage) void this.refreshDetailStatus().catch((error => clog.warn("移动端详情状态刷新失败", error)));
                // stagger 动画：依次显示菜单项（generation counter 防竞态）
                const gen = ++this._fabGeneration;
                const self = this;
                const items = menu.find(".jhs-fab-menu-item");
                items.first().trigger("focus");
                items.each(function (i) {
                    const el = $(this);
                    setTimeout(() => {
                        if (gen === self._fabGeneration) el.addClass("jhs-fab-item-visible");
                    }, 30 + i * 35);
                });
            }
        };
        // FAB 点击切换
        fab.on("click", toggleMenu);
        // 遮罩点击关闭
        backdrop.on("click", (() => closeMenu(!0)));
        menu.on("keydown", ".jhs-fab-menu-item", (event => {
            const items = menu.find(".jhs-fab-menu-item"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), closeMenu(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        }));
        filterMenu.on("keydown", ".jhs-mobile-filter-option", (event => {
            const items = filterMenu.find(".jhs-mobile-filter-option"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), closeFilterMenu(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        })).on("click", ".jhs-mobile-filter-option", (event => {
            event.stopPropagation(), this.getBean("ListPagePlugin").setQuickFilter($(event.currentTarget).data("jhs-filter")), closeMenu(!0);
        }));
        sortMenu.on("keydown", ".jhs-mobile-sort-option", (event => {
            const items = sortMenu.find(".jhs-mobile-sort-option"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), closeSortMenu(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        })).on("click", ".jhs-mobile-sort-option", (event => {
            event.stopPropagation();
            const value = $(event.currentTarget).data("jhs-sort");
            localStorage.setItem("jhs_sortMethod", value), sortMenu.find(".jhs-mobile-sort-option").attr("aria-checked", "false"), $(event.currentTarget).attr("aria-checked", "true"), void this.getBean("ListPageButtonPlugin")?.sortItems?.(), closeMenu(!0);
        }));
        // 菜单项点击
        menu.on("click", ".jhs-fab-menu-item", (e) => {
            const action = $(e.currentTarget).data("action");
            if ("quickFilter" === action) {
                e.stopPropagation(), menu.addClass("jhs-fab-filter-open"), filterTrigger.attr("aria-expanded", "true");
                const selected = filterMenu.find('[aria-checked="true"]');
                return void (selected.length ? selected.first() : filterMenu.find(".jhs-mobile-filter-option").first()).trigger("focus");
            }
            if ("sort" === action) {
                e.stopPropagation(), menu.addClass("jhs-fab-sort-open"), sortTrigger.attr("aria-expanded", "true");
                const selected = sortMenu.find('[aria-checked="true"]');
                return void (selected.length ? selected.first() : sortMenu.find(".jhs-mobile-sort-option").first()).trigger("focus");
            }
            closeMenu(!0);
            void this.handleAction(action).catch((error => clog.error(`移动端操作 ${action || "unknown"} 失败`, error)));
        });
    }
    async handleAction(action) {
        switch (action) {
            // 列表页操作
            case "check":
                await this.getBean("ListPageButtonPlugin")?.openWaitCheck?.();
                break;
            case "newVideo":
                this.getBean("NewVideoPlugin")?.openDialog();
                break;
            case "blacklist":
                this.getBean("BlacklistPlugin")?.openBlacklistDialog();
                break;
            case "sort":
                break;
            // 详情页操作
            case "filter":
                $("#filterBtn").length && $("#filterBtn").click();
                break;
            case "fav":
                $("#favoriteBtn").length && $("#favoriteBtn").click();
                break;
            case "down":
                $("#hasDownBtn").length && $("#hasDownBtn").click();
                break;
            case "watch":
                $("#hasWatchBtn").length && $("#hasWatchBtn").click();
                break;
            case "magnetFilter":
                $("#enable-magnets-filter").length && $("#enable-magnets-filter").click();
                break;
            case "magnet":
                $("#magnetSearchBtn").length && $("#magnetSearchBtn").click();
                break;
            case "subtitle":
                $("#search-subtitle-btn").length && $("#search-subtitle-btn").click();
                break;
            // 通用
            case "setting":
                await this.getBean("SettingPlugin")?.openQuickSetting();
                break;
            case "logger":
                clog.openDialog?.();
                break;
        }
    }
}
