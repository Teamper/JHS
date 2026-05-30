class MobileBottomBarPlugin extends X {
    getName() {
        return "MobileBottomBarPlugin";
    }
    shouldSkipOnMobile() {
        return false; // this plugin only runs on mobile
    }
    async initCss() {
        return `
            #jhs-mobile-bar {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                z-index: 10000;
                background: rgba(255,255,255,0.92);
                backdrop-filter: blur(20px);
                -webkit-backdrop-filter: blur(20px);
                border-top: 0.5px solid rgba(0,0,0,0.1);
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 6px 0 env(safe-area-inset-bottom, 6px);
                box-shadow: 0 -1px 20px rgba(0,0,0,0.06);
                -webkit-user-select: none;
                user-select: none;
            }
            #jhs-mobile-bar .jhs-bar-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                flex: 1;
                min-height: 44px;
                padding: 4px 0;
                cursor: pointer;
                color: #555;
                font-size: 11px;
                gap: 3px;
                transition: all 0.15s ease;
                -webkit-tap-highlight-color: transparent;
                border-radius: 8px;
                margin: 0 2px;
            }
            #jhs-mobile-bar .jhs-bar-item:active {
                color: #1a73e8;
                background: rgba(93,135,194,0.08);
                transform: scale(0.95);
            }
            #jhs-mobile-bar .jhs-bar-item .jhs-bar-icon {
                font-size: 22px;
                line-height: 1.2;
            }
            #jhs-mobile-bar .jhs-bar-item .jhs-bar-label {
                font-size: 11px;
                font-weight: 500;
                color: #6b7280;
                white-space: nowrap;
            }

            /* 抽屉背景遮罩 */
            .jhs-drawer-backdrop {
                position: fixed;
                inset: 0;
                background: rgba(0,0,0,0.3);
                z-index: 10000;
                opacity: 0;
                pointer-events: none;
                transition: opacity 0.3s;
            }
            .jhs-drawer-backdrop.jhs-backdrop-visible {
                opacity: 1;
                pointer-events: auto;
            }

            /* 抽屉面板 */
            #jhs-mobile-bar .jhs-bar-drawer {
                position: fixed;
                bottom: 0;
                left: 0;
                right: 0;
                background: #fff;
                border-radius: 16px 16px 0 0;
                padding: 16px;
                padding-bottom: calc(80px + env(safe-area-inset-bottom, 16px));
                box-shadow: 0 8px 24px rgba(0,0,0,0.12);
                z-index: 10001;
                transform: translateY(100%);
                transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
            }
            #jhs-mobile-bar .jhs-bar-drawer.jhs-drawer-open {
                transform: translateY(0);
            }

            /* 抽屉拖拽手柄 */
            .jhs-drawer-handle {
                width: 36px;
                height: 4px;
                background: #d1d5db;
                border-radius: 2px;
                margin: 0 auto 12px;
            }

            /* 抽屉按钮 */
            #jhs-mobile-bar .jhs-drawer-btn {
                display: inline-flex;
                align-items: center;
                justify-content: center;
                padding: 0 16px;
                border-radius: 8px;
                color: white;
                font-size: 13px;
                font-weight: 600;
                cursor: pointer;
                border: none;
                min-height: 44px;
                flex: 1;
                min-width: 0;
                transition: transform 0.15s, opacity 0.15s;
                -webkit-tap-highlight-color: transparent;
            }
            #jhs-mobile-bar .jhs-drawer-btn:active {
                transform: scale(0.96);
                opacity: 0.9;
            }
            #jhs-mobile-bar .jhs-btn-gold { background: #d7a80c; }
            #jhs-mobile-bar .jhs-btn-olive { background: #c2bd4c; }
            #jhs-mobile-bar .jhs-btn-gradient-orange { background: linear-gradient(135deg, #f59e0b, #22c55e); }
            #jhs-mobile-bar .jhs-btn-gradient-blue { background: linear-gradient(135deg, #3b82f6, #1e40af); }

            @media (min-width: 769px) {
                #jhs-mobile-bar { display: none !important; }
                .jhs-drawer-backdrop { display: none !important; }
            }
        `;
    }
    async handle() {
        if (!utils.isMobileMode()) return;
        // add padding to body so content isn't hidden behind the bar
        $("body").css("padding-bottom", "64px");
        // add backdrop
        $('<div class="jhs-drawer-backdrop"></div>').appendTo("body");
        const bar = this.createBar();
        $("body").append(bar);
        this.bindEvents();
    }
    createBar() {
        const isList = window.isListPage;
        const isDetail = window.isDetailPage;
        let primaryItems = "";
        let drawerBtns = "";

        if (isList) {
            primaryItems = `
                <div class="jhs-bar-item" id="jhs-bar-check"><span class="jhs-bar-icon">📋</span><span class="jhs-bar-label">待鉴定</span></div>
                <div class="jhs-bar-item" id="jhs-bar-new"><span class="jhs-bar-icon">🎬</span><span class="jhs-bar-label">新作品</span></div>
                <div class="jhs-bar-item" id="jhs-bar-blacklist"><span class="jhs-bar-icon">🚫</span><span class="jhs-bar-label">黑名单</span></div>
                <div class="jhs-bar-item" id="jhs-bar-setting"><span class="jhs-bar-icon">⚙️</span><span class="jhs-bar-label">设置</span></div>
            `;
        } else if (isDetail) {
            primaryItems = `
                <div class="jhs-bar-item" id="jhs-bar-filter"><span class="jhs-bar-icon">🚫</span><span class="jhs-bar-label">${m}</span></div>
                <div class="jhs-bar-item" id="jhs-bar-fav"><span class="jhs-bar-icon">⭐</span><span class="jhs-bar-label">${v}</span></div>
                <div class="jhs-bar-item" id="jhs-bar-down"><span class="jhs-bar-icon">📥</span><span class="jhs-bar-label">${y}</span></div>
                <div class="jhs-bar-item jhs-bar-more" id="jhs-bar-more"><span class="jhs-bar-icon">⋯</span><span class="jhs-bar-label">更多</span>
                    <div class="jhs-bar-drawer">
                        <div class="jhs-drawer-handle"></div>
                        <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;">
                            <a class="jhs-drawer-btn jhs-btn-gold" id="jhs-bar-watch">${k}</a>
                            <a class="jhs-drawer-btn jhs-btn-olive" id="jhs-bar-magnet-filter">磁力过滤</a>
                            <a class="jhs-drawer-btn jhs-btn-gradient-orange" id="jhs-bar-magnet">磁力搜索</a>
                            <a class="jhs-drawer-btn jhs-btn-gradient-blue" id="jhs-bar-subtitle">字幕</a>
                        </div>
                    </div>
                </div>
                <div class="jhs-bar-item" id="jhs-bar-setting"><span class="jhs-bar-icon">⚙️</span><span class="jhs-bar-label">设置</span></div>
            `;
        } else {
            primaryItems = `
                <div class="jhs-bar-item" id="jhs-bar-setting"><span class="jhs-bar-icon">⚙️</span><span class="jhs-bar-label">设置</span></div>
            `;
        }
        return `<div id="jhs-mobile-bar">${primaryItems}</div>`;
    }
    bindEvents() {
        const bar = $("#jhs-mobile-bar");
        const backdrop = $(".jhs-drawer-backdrop");
        const closeDrawer = () => {
            $(".jhs-bar-drawer").removeClass("jhs-drawer-open");
            backdrop.removeClass("jhs-backdrop-visible");
        };
        // list page buttons
        bar.on("click", "#jhs-bar-check", () => {
            const btn = $("#waitCheckBtn");
            btn.length && btn.click();
        });
        bar.on("click", "#jhs-bar-new", () => {
            const plugin = this.getBean("NewVideoPlugin");
            plugin && plugin.openDialog();
        });
        bar.on("click", "#jhs-bar-blacklist", () => {
            const plugin = this.getBean("BlacklistPlugin");
            plugin && plugin.openBlacklistDialog();
        });
        bar.on("click", "#jhs-bar-setting", () => {
            const plugin = this.getBean("SettingPlugin");
            plugin && plugin.openSettingDialog();
        });
        // detail page buttons
        bar.on("click", "#jhs-bar-filter", (e) => {
            $("#filterBtn").length && $("#filterBtn").click();
        });
        bar.on("click", "#jhs-bar-fav", () => {
            $("#favoriteBtn").length && $("#favoriteBtn").click();
        });
        bar.on("click", "#jhs-bar-down", () => {
            $("#hasDownBtn").length && $("#hasDownBtn").click();
        });
        bar.on("click", "#jhs-bar-watch", () => {
            $("#hasWatchBtn").length && $("#hasWatchBtn").click();
        });
        bar.on("click", "#jhs-bar-magnet-filter", () => {
            $("#enable-magnets-filter").length && $("#enable-magnets-filter").click();
        });
        bar.on("click", "#jhs-bar-magnet", () => {
            $("#magnetSearchBtn").length && $("#magnetSearchBtn").click();
        });
        bar.on("click", "#jhs-bar-subtitle", (e) => {
            $("#search-subtitle-btn").length && $("#search-subtitle-btn").click();
        });
        // more drawer toggle
        bar.on("click", "#jhs-bar-more", (e) => {
            if ($(e.target).closest(".jhs-drawer-btn").length) return;
            const drawer = $(e.currentTarget).find(".jhs-bar-drawer");
            const isOpen = drawer.hasClass("jhs-drawer-open");
            if (isOpen) {
                closeDrawer();
            } else {
                drawer.addClass("jhs-drawer-open");
                backdrop.addClass("jhs-backdrop-visible");
            }
        });
        // close drawer when clicking outside
        $(document).on("click", (e) => {
            if (!$(e.target).closest("#jhs-bar-more").length) {
                closeDrawer();
            }
        });
        // close drawer when clicking backdrop
        backdrop.on("click", closeDrawer);
    }
}
