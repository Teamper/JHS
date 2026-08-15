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
                background: var(--jhs-status-fav);
                color: var(--jhs-status-fav-on);
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
                background: var(--jhs-status-filter);
                color: var(--jhs-status-filter-on);
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
            .jhs-commandbar__left { flex: 1 1 auto; }
            .jhs-commandbar__right { flex: 0 0 auto; }
            .jhs-commandbar__filters {
                overflow-x: auto;
            }
            .jhs-commandbar__batch, .jhs-commandbar__more, .jhs-sort-control { position:relative; }
            .jhs-commandbar__menu { min-width:220px; }
            .jhs-commandbar__menu .jhs-btn, .jhs-sort-menu .jhs-btn { width:100%; justify-content:flex-start; }
            .jhs-commandbar__sort-label { color:var(--jhs-text-muted); font-size:14px; }
            @media (max-width: 1023px) {
                .jhs-page-commandbar { overflow-x: auto; }
            }
            @media (max-width: 768px) {
                .jhs-page-commandbar { display: none; }
            }
        `;
    }
    async handle() {
        const detailWorkspace = new DetailWorkspacePlugin;
        detailWorkspace.pluginManager = this.pluginManager, H(await detailWorkspace.initCss()), await detailWorkspace.handle();
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
        const more = $('<div class="jhs-commandbar__more"><button type="button" class="jhs-btn jhs-btn--secondary jhs-commandbar__menu-toggle" aria-haspopup="menu" aria-expanded="false">更多</button><div class="jhs-popover jhs-commandbar__menu" role="menu"></div></div>');
        [ "#statsBtn", "#blacklistBtn" ].forEach((selector => {
            const item = $(selector).first();
            item.length && item.attr({ class: "jhs-btn jhs-btn--ghost", role: "menuitem", tabindex: "-1" }).detach().appendTo(more.find(".jhs-commandbar__menu"));
        }));
        more.find(".jhs-commandbar__menu").children().length && left.append(more);
        const filterButtons = $("#jhs-quick-filter .jhs-segmented__item");
        if (filterButtons.length) {
            const filters = $('<div class="jhs-commandbar__filters jhs-segmented" role="tablist" aria-label="状态筛选"></div>');
            filterButtons.each((function() {
                $(this).attr({ class: `jhs-segmented__item${$(this).hasClass("active") ? " active" : ""}`, role: "tab", "aria-selected": $(this).hasClass("active") ? "true" : "false", tabindex: $(this).hasClass("active") ? "0" : "-1" }).detach().appendTo(filters);
            })), left.append(filters);
        }
        $("#jhs-quick-filter").remove();
        const contextItem = $("#addBlacklistBtn").first();
        contextItem.length && contextItem.attr("class", "jhs-btn jhs-btn--secondary").removeAttr("role tabindex").detach().appendTo($('<div class="jhs-commandbar__context"></div>').appendTo(right));
        const sort = $(".jhs-sort-control").first();
        if (sort.length) {
            const view = $('<label class="jhs-commandbar__view"><span class="jhs-commandbar__sort-label">排序</span></label>');
            sort.detach().appendTo(view), right.append(view);
        }
        const batch = $('<div class="jhs-commandbar__batch"><button type="button" class="jhs-btn jhs-btn--secondary jhs-commandbar__menu-toggle" aria-haspopup="menu" aria-expanded="false">批量操作</button><div class="jhs-popover jhs-commandbar__menu" role="menu"></div></div>');
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
                if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
                event.preventDefault();
                const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
                items.eq(next).trigger("focus");
            })).on("click", "[role='menuitem']", (() => {
                menu.removeClass("is-open"), toggle.attr("aria-expanded", "false");
            }));
        }));
        $(document).off("click.jhsCommandbar").on("click.jhsCommandbar", (event => {
            $(event.target).closest(".jhs-commandbar__more, .jhs-commandbar__batch").length || (commandbar.find(".jhs-commandbar__menu").removeClass("is-open"), commandbar.find(".jhs-commandbar__menu-toggle").attr("aria-expanded", "false"));
        }));
        const listPlugin = this.getBean("ListPagePlugin");
        commandbar.find(".jhs-commandbar__filters").on("click", "[role='tab']", (function() {
            $(this).siblings().removeClass("active").attr({ "aria-selected": "false", tabindex: "-1" }), $(this).addClass("active").attr({ "aria-selected": "true", tabindex: "0" });
            const filter = $(this).data("jhs-filter");
            listPlugin.activeQuickFilter = filter, listPlugin.applyQuickFilter(filter);
        })).on("keydown", "[role='tab']", (e => {
            if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(e.key)) return;
            e.preventDefault();
            const tabs = commandbar.find("[role='tab']"), index = tabs.index(e.currentTarget), next = "Home" === e.key ? 0 : "End" === e.key ? tabs.length - 1 : "ArrowRight" === e.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
            tabs.eq(next).trigger("click").trigger("focus");
        }));
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
            const sortMethod = localStorage.getItem("jhs_sortMethod") || "default", sortLabel = { default: "默认", rateCount: "评价人数", date: "时间" }[sortMethod];
            items = group(item("check", "待鉴定") + item("newVideo", "新作品") + item("blacklist", "黑名单") + item("sort", `排序: ${sortLabel}`)) + divider + group(item("setting", "设置"));
        } else if (window.isDetailPage) {
            const statusDefs = [ { action: "filter", icon: m, label: "屏蔽", key: "filter" }, { action: "fav", icon: v, label: "收藏", key: "fav" }, { action: "down", icon: y, label: "已下载", key: "down" }, { action: "watch", icon: k, label: "已观看", key: "watch" } ];
            items = group(statusDefs.map((definition => item(definition.action, `<span class="jhs-fab-status-dot" data-status-key="${definition.key}"></span>${definition.icon}`, `aria-label="${definition.label}" aria-pressed="false" data-label="${definition.label}"`))).join("")) + divider + group(item("magnetFilter", "磁力过滤") + item("magnet", "磁力搜索") + item("subtitle", "字幕")) + divider + group(item("setting", "设置"));
        } else items = group(item("setting", "设置"));
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
            const activeKey = { [d]: "filter", [h]: "fav", [g]: "down", [p]: "watch" };
            let activeStatus = null;
            if (car?.status && activeKey[car.status]) activeStatus = activeKey[car.status];
            menu.find(".jhs-fab-status-dot").each(function () {
                const key = $(this).data("status-key");
                const item = $(this).closest(".jhs-fab-menu-item");
                if (key === activeStatus) {
                    $(this).css({ background: colors[key] || "var(--jhs-border-strong)" }), item.attr("aria-pressed", "true");
                } else {
                    $(this).css({ background: "var(--jhs-border-strong)" }), item.attr("aria-pressed", "false");
                }
            });
        } catch (e) { clog.warn("移动端详情状态刷新失败", e); }
    }
    bindEvents(fab, backdrop) {
        const menu = $(".jhs-fab-menu");
        const closeMenu = (returnFocus = !1) => {
            this._fabGeneration++;
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
        // 菜单项点击
        menu.on("click", ".jhs-fab-menu-item", (e) => {
            const action = $(e.currentTarget).data("action");
            closeMenu(!0);
            void this.handleAction(action).catch((error => clog.error(`移动端操作 ${action || "unknown"} 失败`, error)));
        });
    }
    async handleAction(action) {
        switch (action) {
            // 列表页操作
            case "check":
                $("#waitCheckBtn").length && $("#waitCheckBtn").click();
                break;
            case "newVideo":
                this.getBean("NewVideoPlugin")?.openDialog();
                break;
            case "blacklist":
                this.getBean("BlacklistPlugin")?.openBlacklistDialog();
                break;
            case "sort": {
                const cur = localStorage.getItem("jhs_sortMethod") || "default";
                const next = cur === "default" ? "rateCount" : cur === "rateCount" ? "date" : "default";
                localStorage.setItem("jhs_sortMethod", next);
                const btnPlugin = this.getBean("ListPageButtonPlugin");
                await btnPlugin?.sortItems?.();
                const label = { default: "默认", rateCount: "评价人数", date: "时间" }[next];
                show.info(`排序: ${label}`);
                break;
            }
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
        }
    }
}
