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
                background: #fff;
                border-top: 1px solid #e0e0e0;
                display: flex;
                justify-content: space-around;
                align-items: center;
                padding: 6px 0 env(safe-area-inset-bottom, 6px);
                box-shadow: 0 -2px 8px rgba(0,0,0,0.08);
                -webkit-user-select: none;
                user-select: none;
            }
            #jhs-mobile-bar .jhs-bar-item {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                flex: 1;
                min-height: 48px;
                padding: 4px 0;
                cursor: pointer;
                color: #555;
                font-size: 11px;
                gap: 2px;
                transition: color 0.2s;
                -webkit-tap-highlight-color: transparent;
            }
            #jhs-mobile-bar .jhs-bar-item:active {
                color: #1a73e8;
                background: #f0f0f0;
            }
            #jhs-mobile-bar .jhs-bar-item .jhs-bar-icon {
                font-size: 20px;
                line-height: 1;
            }
            #jhs-mobile-bar .jhs-bar-item .jhs-bar-label {
                font-size: 10px;
                white-space: nowrap;
            }
            #jhs-mobile-bar .jhs-bar-item.jhs-bar-more .jhs-bar-drawer {
                display: none;
                position: fixed;
                bottom: 60px;
                left: 0;
                right: 0;
                background: #fff;
                border-top: 1px solid #e0e0e0;
                border-bottom: 1px solid #e0e0e0;
                padding: 10px;
                box-shadow: 0 -2px 10px rgba(0,0,0,0.1);
                z-index: 10001;
            }
            #jhs-mobile-bar .jhs-bar-item.jhs-bar-more .jhs-bar-drawer.jhs-drawer-open {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                justify-content: center;
            }
            #jhs-mobile-bar .jhs-bar-drawer .jhs-drawer-btn {
                display: inline-flex;
                align-items: center;
                padding: 8px 14px;
                border-radius: 6px;
                color: white;
                font-size: 13px;
                font-weight: 500;
                cursor: pointer;
                border: none;
                min-height: 40px;
                -webkit-tap-highlight-color: transparent;
            }
            @media (min-width: 769px) {
                #jhs-mobile-bar { display: none !important; }
            }
        `;
    }
    async handle() {
        if (!utils.isMobileMode()) return;
        // add padding to body so content isn't hidden behind the bar
        $("body").css("padding-bottom", "64px");
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
                        <a class="jhs-drawer-btn" style="background:#d7a80c;" id="jhs-bar-watch">${k}</a>
                        <a class="jhs-drawer-btn" style="background:#c2bd4c;" id="jhs-bar-magnet-filter">磁力过滤</a>
                        <a class="jhs-drawer-btn" style="background:linear-gradient(to right,#f58c01,#54a11d);" id="jhs-bar-magnet">磁力搜索</a>
                        <a class="jhs-drawer-btn" style="background:linear-gradient(to left,#375f7c,#2196F3);" id="jhs-bar-subtitle">字幕</a>
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
            drawer.toggleClass("jhs-drawer-open");
        });
        // close drawer when clicking outside
        $(document).on("click", (e) => {
            if (!$(e.target).closest("#jhs-bar-more").length) {
                $(".jhs-bar-drawer").removeClass("jhs-drawer-open");
            }
        });
    }
}
