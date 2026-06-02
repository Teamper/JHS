class MobileBottomBarPlugin extends X {
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
                border-radius: 50%;
                background: linear-gradient(135deg, #3b82f6, #1e40af);
                color: white;
                font-size: 26px;
                display: flex;
                align-items: center;
                justify-content: center;
                cursor: pointer;
                z-index: 10002;
                box-shadow: 0 4px 16px rgba(59,130,246,0.4);
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
                background: linear-gradient(135deg, #ef4444, #b91c1c);
                box-shadow: 0 4px 16px rgba(239,68,68,0.4);
            }

            /* FAB 遮罩 */
            .jhs-fab-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.25);
                backdrop-filter: blur(2px);
                -webkit-backdrop-filter: blur(2px);
                z-index: 10000;
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
                z-index: 10001;
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
                background: rgba(0,0,0,0.08);
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
                background: white;
                border-radius: 24px;
                box-shadow: 0 2px 12px rgba(0,0,0,0.1);
                cursor: pointer;
                white-space: nowrap;
                min-height: 44px;
                font-size: 14px;
                font-weight: 500;
                color: #333;
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
                background: #f3f4f6;
            }

            /* FAB 状态色块 */
            .jhs-fab-status-dot {
                width: 8px;
                height: 8px;
                border-radius: 50%;
                flex-shrink: 0;
                background: #e5e7eb;
            }

            @media (min-width: 769px) {
                #jhs-fab, .jhs-fab-menu, .jhs-fab-backdrop { display: none !important; }
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
        const fab = $('<div id="jhs-fab">＋</div>').appendTo("body");
        this.bindEvents(fab, backdrop);
    }
    /** 获取详情页番号 */
    getCarNum() {
        try {
            const basePlugin = this.getBean("DetailPageButtonPlugin");
            if (basePlugin?.parseMovieId) return basePlugin.parseMovieId(location.href);
            const el = document.querySelector(".header, #video_id, .video-id");
            if (el) return el.textContent.trim();
        } catch (e) {}
        return null;
    }
    createMenu() {
        const isList = window.isListPage;
        const isDetail = window.isDetailPage;
        let items = "";

        if (isList) {
            const sortMethod = localStorage.getItem("jhs_sortMethod") || "default";
            const sortLabel = { default: "默认", rateCount: "评价人数", date: "时间" }[sortMethod];
            items = `
                <div class="jhs-fab-group">
                    <div class="jhs-fab-menu-item" data-action="check">待鉴定</div>
                    <div class="jhs-fab-menu-item" data-action="newVideo">新作品</div>
                    <div class="jhs-fab-menu-item" data-action="blacklist">黑名单</div>
                    <div class="jhs-fab-menu-item" data-action="sort">排序: ${sortLabel}</div>
                </div>
                <div class="jhs-fab-divider"></div>
                <div class="jhs-fab-group">
                    <div class="jhs-fab-menu-item" data-action="setting">设置</div>
                </div>
            `;
        } else if (isDetail) {
            const statusDefs = [
                { action: "filter", icon: m, label: "屏蔽", key: "filter" },
                { action: "fav", icon: v, label: "收藏", key: "fav" },
                { action: "down", icon: y, label: "已下载", key: "down" },
                { action: "watch", icon: k, label: "已观看", key: "watch" }
            ];
            items = `
                <div class="jhs-fab-group">
                    ${statusDefs.map(d => `<div class="jhs-fab-menu-item" data-action="${d.action}" data-label="${d.label}"><span class="jhs-fab-status-dot" data-status-key="${d.key}"></span>${d.icon}</div>`).join("")}
                </div>
                <div class="jhs-fab-divider"></div>
                <div class="jhs-fab-group">
                    <div class="jhs-fab-menu-item" data-action="magnetFilter">磁力过滤</div>
                    <div class="jhs-fab-menu-item" data-action="magnet">磁力搜索</div>
                    <div class="jhs-fab-menu-item" data-action="subtitle">字幕</div>
                </div>
                <div class="jhs-fab-divider"></div>
                <div class="jhs-fab-group">
                    <div class="jhs-fab-menu-item" data-action="setting">设置</div>
                </div>
            `;
        } else {
            items = `
                <div class="jhs-fab-group">
                    <div class="jhs-fab-menu-item" data-action="setting">设置</div>
                </div>
            `;
        }
        return $(`<div class="jhs-fab-menu">${items}</div>`);
    }
    /** 刷新详情页菜单的状态指示 */
    async refreshDetailStatus() {
        try {
            const carNum = this.getCarNum();
            if (!carNum) return;
            const car = await storageManager.getCar(carNum);
            const menu = $(".jhs-fab-menu");
            const colors = { filter: "#ef4444", fav: "#3b82f6", down: "#22c55e", watch: "#a855f7" };
            const activeKey = { [d]: "filter", [h]: "fav", [g]: "down", [p]: "watch" };
            let activeStatus = null;
            if (car?.status && activeKey[car.status]) activeStatus = activeKey[car.status];
            menu.find(".jhs-fab-status-dot").each(function () {
                const key = $(this).data("status-key");
                const item = $(this).closest(".jhs-fab-menu-item");
                if (key === activeStatus) {
                    $(this).css({ background: colors[key] || "#ccc" });
                } else {
                    $(this).css({ background: "#e5e7eb" });
                }
            });
        } catch (e) {}
    }
    bindEvents(fab, backdrop) {
        const menu = $(".jhs-fab-menu");
        const closeMenu = () => {
            this._fabGeneration++;
            fab.removeClass("jhs-fab-open");
            menu.removeClass("jhs-fab-menu-open");
            backdrop.removeClass("jhs-fab-backdrop-visible");
            menu.find(".jhs-fab-menu-item").removeClass("jhs-fab-item-visible");
        };
        const toggleMenu = () => {
            const isOpen = fab.hasClass("jhs-fab-open");
            if (isOpen) {
                closeMenu();
            } else {
                fab.addClass("jhs-fab-open");
                menu.addClass("jhs-fab-menu-open");
                backdrop.addClass("jhs-fab-backdrop-visible");
                // 刷新排序标签
                if (window.isListPage) {
                    const sortMethod = localStorage.getItem("jhs_sortMethod") || "default";
                    const sortLabel = { default: "默认", rateCount: "评价人数", date: "时间" }[sortMethod];
                    menu.find('[data-action="sort"]').html(`排序: ${sortLabel}`);
                }
                // 刷新详情页状态
                if (window.isDetailPage) this.refreshDetailStatus();
                // stagger 动画：依次显示菜单项（generation counter 防竞态）
                const gen = ++this._fabGeneration;
                const self = this;
                const items = menu.find(".jhs-fab-menu-item");
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
        backdrop.on("click", closeMenu);
        // 菜单项点击
        menu.on("click", ".jhs-fab-menu-item", (e) => {
            const action = $(e.currentTarget).data("action");
            this.handleAction(action);
            closeMenu();
        });
    }
    handleAction(action) {
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
                btnPlugin?.sortItems?.();
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
                this.getBean("SettingPlugin")?.openSettingDialog();
                break;
        }
    }
}
