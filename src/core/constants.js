var e, t, n = Object.defineProperty, a = e => {
    throw TypeError(e);
}, i = (e, t, a) => ((e, t, a) => t in e ? n(e, t, {
    enumerable: !0,
    configurable: !0,
    writable: !0,
    value: a
}) : e[t] = a)(e, "symbol" != typeof t ? t + "" : t, a), s = (e, t, n) => (((e, t, n) => {
    t.has(e) || a("Cannot " + n);
})(e, t, "access private method"), n);

const o = window.location.href, r = o.includes("javdb"), l = o.includes("javbus") || o.includes("seejav") || o.includes("bus") || o.includes("javsee") || $("title").text().trim().startsWith("JavBus - AV"), c = o.includes("/search?q") || o.includes("/search/") || o.includes("/users/"), d = "filter", h = "favorite", g = "hasDown", p = "hasWatch", m = "🚫 屏蔽", u = "🚫 已屏蔽", f = "#de3333", v = "⭐ 收藏", b = "⭐ 已收藏", w = "#25b1dc", y = "📥️ 已下载", x = "#7bc73b", k = "🔍 已观看", S = "#d7a80c", C = "no", _ = "yes", T = "javdb", I = "javbus", B = "actor", P = "actress", D = "censored", A = "uncensored", L = [ {
    id: "video-mhb",
    quality: "dmb_w",
    text: "旧视频源-中画质宽版 (404p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "sm_s",
    text: "旧视频源-低画质 (240p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "dm_s",
    text: "旧视频源-中画质 (360p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "dmb_s",
    text: "旧视频源-中画质 (480p)",
    canSelect: !1
}, {
    id: "video-mhb",
    quality: "mhb_w",
    text: "旧视频源-高画质宽版 (404p)",
    canSelect: !1
}, {
    id: "video-mmb",
    quality: "mmb",
    text: "中画质 (432p)",
    canSelect: !0
}, {
    id: "video-mhb",
    quality: "mhb",
    text: "高画质 (576p)",
    canSelect: !0
}, {
    id: "video-hmb",
    quality: "hmb",
    text: "HD (720p)",
    canSelect: !0
}, {
    id: "video-hhb",
    quality: "hhb",
    text: "FullHD (1080p)",
    canSelect: !0
}, {
    id: "video-hhbs",
    quality: "hhbs",
    text: "FullHD (1080p60fps)",
    canSelect: !0
}, {
    id: "video-4k",
    quality: "4k",
    text: "4K (2160p)",
    canSelect: !0
}, {
    id: "video-4ks",
    quality: "4ks",
    text: "4K (2160p60fps)",
    canSelect: !0
} ];

function escapeHtml(e) { const t = document.createElement("span"); return t.textContent = e, t.innerHTML; }

const CURRENT_DATA_VERSION = 1;

let M = "";

window.location.href.includes("hideNav=1") && (M = "\n         .navbar-default {\n            display: none !important;\n        }\n        body {\n            padding-top:0px!important;\n        }\n    ");

const N = `\n<style>\n    .top-bar {\n        z-index: 12345689 !important;\n    }\n    \n    ${M}\n\n    .masonry {\n        height: 100% !important;\n        width: 100% !important;\n        padding: 0 15px !important;\n    }\n    .masonry {\n        display: grid;\n        column-gap: 10px; /* 列间距*/\n        row-gap: 10px; /* 行间距 */\n        grid-template-columns: repeat(4, minmax(0, 1fr));\n        align-items: start;\n    }\n    .masonry .item {\n        /*position: initial !important;*/\n        top: initial !important;\n        left: initial !important;\n        float: none !important;\n        background-color:#c4b1b1;\n        position: relative !important;\n    }\n    \n    .masonry .item:hover {\n        box-shadow: 0 .5em 1em -.125em rgba(10, 10, 10, .1), 0 0 0 1px #485fc7;\n    }\n    .masonry .movie-box{\n        width: 100% !important;\n        height: 100% !important;\n        margin: 0 !important;\n        overflow: inherit !important;\n    }\n    .masonry .movie-box .photo-frame {\n        /*height: 70% !important;*/\n        height:auto !important;\n        margin: 0 !important;\n        position:relative; /* 方便预览视频定位*/\n    }\n    .masonry .movie-box img {\n        max-height: 500px;\n        height: 100% !important;\n        object-fit: contain;\n        object-position: top;\n    }\n    .masonry .movie-box img:hover {\n      transform: scale(1.04);\n      transition: transform 0.3s;\n    }\n    .masonry .photo-info{\n        /*height: 30% !important;*/\n    }\n    .masonry .photo-info span {\n      display: inline-block; /* 或者 block */\n      max-width: 100%;      /* 根据父容器限制宽度 */\n      white-space: nowrap;  /* 禁止换行 */\n      overflow: hidden;     /* 隐藏溢出内容 */\n      text-overflow: ellipsis; /* 显示省略号 */\n    }\n    \n    /* 无码页面的样式 */\n    .photo-frame .mheyzo,\n    .photo-frame .mcaribbeancom2{\n        margin-left: 0 !important;\n    }\n    .avatar-box{\n        width: 100% !important;\n        display: flex !important;\n        margin:0 !important;\n    }\n    .avatar-box .photo-info{\n        display: flex;\n        justify-content: center;\n        align-items: center;\n        gap: 30px;\n        flex-direction: row;\n        background-color:#fff !important;\n    }\n    \n    footer{\n        display: none!important;\n    }\n    \n        \n    .video-title {\n        white-space: normal !important;\n        height: 75px; /* 固定高度 容器就不会出现高低不一*/\n        \n        display: -webkit-box !important; /* 必须设置，使接下来的属性生效 */\n        -webkit-box-orient: vertical; /* 垂直方向堆叠行 */\n        -webkit-line-clamp: 3; /* 设置文本最多显示的行数*/\n    }\n\n    \n</style>\n`;

let j = "";

window.location.href.includes("hideNav=1") && (j = "\n        .main-nav,#search-bar-container {\n            display: none !important;\n        }\n        \n        html {\n            padding-top:0px!important;\n        }\n    ");

const E = `\n<style>\n    ${j}\n    \n    .navbar {\n        z-index: 12345679 !important;\n        padding: 0 0;\n    }\n    \n    .navbar-link:not(.is-arrowless) {\n        padding-right: 33px;\n    }\n    \n    .sub-header,\n    /*#search-bar-container, !*搜索框*!*/\n    #footer,\n    /*.search-recent-keywords, !*搜索框底部热搜词条*!*/\n    .app-desktop-banner,\n    div[data-controller="movie-tab"] .tabs,\n    h3.main-title,\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(3), /* 相关清单*/\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(2), /* 短评按钮*/\n    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(1), /*磁力面板 按钮*/\n    .top-meta,\n    .float-buttons {\n        display: none !important;\n    }\n    \n    div.tabs.no-bottom,\n    .tabs ul {\n        border-bottom: none !important;\n    }\n    \n    \n    /* 视频列表项 相对相对 方便标签绝对定位*/\n    .movie-list .item {\n        position: relative !important;\n    }\n    \n    .video-title {\n        white-space: normal !important;\n        height: 80px; /* 固定高度 容器就不会出现高低不一*/\n        \n        display: -webkit-box; /* 必须设置，使接下来的属性生效 */\n        -webkit-box-orient: vertical; /* 垂直方向堆叠行 */\n        -webkit-line-clamp: 3; /* 设置文本最多显示的行数*/\n    }\n    \n    /* 列表页顶部分类自适应 */\n    .main-tabs, .tabs {\n        overflow-x:hidden;\n        flex-wrap: wrap;\n        justify-content: flex-start;\n    }\n    \n    .main-tabs ul, .tabs ul {\n        flex-wrap: wrap;\n        flex-grow: 0;\n    }\n    \n    \n    /* 二级工具栏 大小封面,可播放,含磁链...*/\n    .toolbar {\n        display: flex;\n    }\n\n</style>\n`;

const F = `\n<style>\n    /* 全局通用样式 */\n    .fr-btn {\n        float: right;\n        margin-left: 4px !important;\n    }\n    \n    .menu-box {\n        position: fixed;\n        right: 10px;\n        top: 50%;\n        transform: translateY(-50%);\n        display: flex;\n        flex-direction: column;\n        z-index: 1000;\n        gap: 6px;\n    }\n    \n    .menu-btn {\n        display: inline-block;\n        min-width: 80px;\n        padding: 7px 12px;\n        border-radius: 4px;\n        color: white !important;\n        text-decoration: none;\n        font-weight: bold;\n        font-size: 12px;\n        text-align: center;\n        cursor: pointer;\n        transition: all 0.3s ease;\n        box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);\n        text-shadow: 0 1px 1px rgba(0, 0, 0, 0.2);\n        border: none;\n        line-height: 1.3;\n        margin: 0;\n    }\n    \n    .menu-btn:hover {\n        transform: translateY(-1px);\n        box-shadow: 0 3px 6px rgba(0, 0, 0, 0.15);\n        opacity: 0.9;\n    }\n    \n    .menu-btn:active {\n        transform: translateY(0);\n        box-shadow: 0 1px 2px rgba(0, 0, 0, 0.1);\n    }\n    \n    .do-hide {\n        display: none !important;\n    }\n    \n    .main-tab-btn {\n        border-bottom:none !important; \n        border-radius:3px !important; \n        height: 30px; \n        margin-left: 5px !important; \n    }\n\n    .jhs-icon {\n        width: 16px;\n        height: 16px;\n    }\n    \n    .tool-box .jhs-icon {\n        width: 1.5rem;\n        height: 1.5rem; \n    }\n     \n    \n    /*表格内按钮溢出,防止被隐藏*/\n    .tabulator .tabulator-row .action-cell-dropdown {\n        overflow: visible !important;\n    }\n    /* 去除行内鼠标小手*/\n    .tabulator .tabulator-row.tabulator-selectable:hover {\n        cursor: default !important;\n    }\n    \n    /* 排序小箭头颜色 */\n    .tabulator .tabulator-col.tabulator-sortable[aria-sort="ascending"] .tabulator-arrow {\n        border-bottom-color: #337ab7 !important;\n    }\n    .tabulator .tabulator-col.tabulator-sortable[aria-sort="descending"] .tabulator-arrow {\n        border-top-color: #337ab7 !important;\n    }\n    \n    /* 针对折叠行的容器或内容进行样式修改 */\n    .tabulator-responsive-collapse {\n        border-top: none !important;\n    }\n    \n    .tabulator-responsive-collapse table{\n        margin-left: 50px !important;\n    }\n    \n    .tabulator-cell {\n        height:auto !important;\n    }\n    \n    /* 列允许换行,去除省略号 */\n    .tabulator .tabulator-cell {\n        white-space: normal !important; \n        text-overflow: clip !important; \n    }\n    \n    .tabulator-tableholder {\n        overflow-x: hidden !important;\n    }\n\n    ${function() {
    const e = [ ".jhs-scrollbar", ".content-panel", ".tabulator-tableholder", ".has-navbar-fixed-top", ".layui-layer-content" ], t = (e, t) => e.map((e => `${e}${t}`)).join(","), n = "::-webkit-scrollbar-track", a = "::-webkit-scrollbar-thumb", i = "::-webkit-scrollbar-thumb:hover";
    return `\n    ${t(e, "::-webkit-scrollbar")}{width:6px;height:6px;}\n    ${t(e, n)}{background:#f1f1f1;border-radius:10px;}\n    ${t(e, a)}{background:#888;border-radius:10px;}\n    ${t(e, i)}{background:#555;}\n    `.trim().replace(/\n/g, "");
}()}\n</style>\n`;

function H(e) {
    if (e) if (e.includes("<style>")) document.head.insertAdjacentHTML("beforeend", e); else {
        const t = document.createElement("style");
        t.textContent = e, document.head.appendChild(t);
    }
}

l && H(N), r && H(E), H("\n<style>\n    .a-normal, /* 白色 */\n    .a-primary, /* 浅蓝色 */\n    .a-success, /* 浅绿色 */\n    .a-danger, /* 浅粉色 */\n    .a-warning, /* 浅橙色 */\n    .a-info /* 灰色 */\n    {\n        display: inline-flex;\n        align-items: center;\n        justify-content: center;\n        padding: 6px 14px;\n        margin-right: 10px;\n        border-radius: 6px;\n        text-decoration: none;\n        font-size: 13px;\n        font-weight: 500;\n        transition: all 0.2s ease;\n        cursor: pointer;\n        border: 1px solid rgba(0, 0, 0, 0.08);\n        white-space: nowrap;\n    }\n    \n    .a-primary {\n        background: #e0f2fe;\n        color: #0369a1;\n        border-color: #bae6fd;\n    }\n    \n    .a-primary:hover {\n        background: #bae6fd;\n    }\n    \n    .a-success {\n        background: #dcfce7;\n        color: #166534;\n        border-color: #bbf7d0;\n    }\n    \n    .a-success:hover {\n        background: #bbf7d0;\n    }\n    \n    .a-danger {\n        background: #fee2e2;\n        color: #b91c1c;\n        border-color: #fecaca;\n    }\n    \n    .a-danger:hover {\n        background: #fecaca;\n    }\n    \n    .a-warning {\n        background: #ffedd5;\n        color: #9a3412;\n        border-color: #fed7aa;\n    }\n    \n    .a-warning:hover {\n        background: #fed7aa;\n    }\n    \n    .a-info {\n        background: #e2e8f0;\n        color: #334155;\n        border-color: #cbd5e1;\n    }\n    \n    .a-info:hover {\n        background: #cbd5e1;\n    }\n    \n    .a-normal {\n        background: transparent;\n        color: #64748b;\n        border-color: #cbd5e1;\n    }\n    \n    .a-normal:hover {\n        background: #f8fafc;\n    }\n</style>\n"),
H(F);

const MOBILE_CSS = `
<style>
    /* ========== 设计令牌（全局） ========== */
    :root {
        --jhs-space-xs: 4px;
        --jhs-space-sm: 8px;
        --jhs-space-md: 12px;
        --jhs-space-lg: 16px;
        --jhs-space-xl: 24px;
        --jhs-space-2xl: 32px;
        --jhs-bg: #ffffff;
        --jhs-bg-secondary: #f8f9fa;
        --jhs-bg-tertiary: #f0f1f3;
        --jhs-border: #e5e7eb;
        --jhs-border-light: #f0f1f3;
        --jhs-text-primary: #1a1a1a;
        --jhs-text-secondary: #6b7280;
        --jhs-text-tertiary: #9ca3af;
        --jhs-accent: #5d87c2;
        --jhs-accent-light: #eef2f8;
        --jhs-success: #22c55e;
        --jhs-error: #ef4444;
        --jhs-warning: #f59e0b;
        --jhs-shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
        --jhs-shadow-md: 0 4px 12px rgba(0,0,0,0.08);
        --jhs-shadow-lg: 0 8px 24px rgba(0,0,0,0.12);
        --jhs-radius-sm: 8px;
        --jhs-radius-md: 12px;
        --jhs-radius-lg: 16px;
        --jhs-radius-full: 9999px;
        --jhs-font: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        --jhs-text-xs: 11px;
        --jhs-text-sm: 13px;
        --jhs-text-base: 15px;
        --jhs-text-lg: 17px;
        --jhs-text-xl: 20px;
    }

    /* ========== 桌面端按钮增强 ========== */
    .a-normal:active, .a-primary:active, .a-success:active, .a-danger:active, .a-warning:active, .a-info:active {
        transform: scale(0.97);
        opacity: 0.85;
        transition: transform 0.1s, opacity 0.1s;
    }
    .a-normal:focus-visible, .a-primary:focus-visible, .a-success:focus-visible, .a-danger:focus-visible, .a-warning:focus-visible, .a-info:focus-visible {
        outline: 2px solid var(--jhs-accent);
        outline-offset: 2px;
    }
    .a-normal:last-child, .a-primary:last-child, .a-success:last-child, .a-danger:last-child, .a-warning:last-child, .a-info:last-child {
        margin-right: 0;
    }

    @media (max-width: 768px) {

        /* ========== 全局基础 ========== */
        * { touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        html { scroll-behavior: smooth; }
        body { font-family: var(--jhs-font); -webkit-font-smoothing: antialiased; }

        /* 触控反馈 */
        button:active, .menu-btn:active, a[class]:active, .side-menu-item:active,
        .jhs-bar-item:active, .jhs-drawer-btn:active, .cache-item:active {
            transform: scale(0.97);
            opacity: 0.85;
            transition: transform 0.1s, opacity 0.1s;
        }

        /* 触控目标最小 44px */
        button, select, .menu-btn, .side-menu-item,
        .a-normal, .a-primary, .a-success, .a-danger, .a-warning, .a-info,
        .jhs-bar-item, .jhs-drawer-btn, .cache-item, .keyword-label,
        .jhs-backup-btn, .main-tab-btn, .jhs-sub-tab {
            min-height: 44px;
        }
        .menu-btn, .side-menu-item, .a-normal, .a-primary, .a-success, .a-danger, .a-warning, .a-info {
            display: inline-flex;
            align-items: center;
        }

        /* 表单元素统一 */
        input[type="text"], input[type="number"], input[type="password"],
        input[type="url"], select, textarea {
            font-size: 16px !important;
            padding: 10px 12px !important;
            border: 1.5px solid var(--jhs-border) !important;
            border-radius: var(--jhs-radius-sm) !important;
            background: var(--jhs-bg) !important;
            width: 100% !important;
            max-width: none !important;
            min-width: 0 !important;
            box-sizing: border-box !important;
            transition: border-color 0.2s !important;
        }
        input:focus, select:focus, textarea:focus {
            border-color: var(--jhs-accent) !important;
            outline: none !important;
            box-shadow: 0 0 0 3px rgba(93,135,194,0.15) !important;
        }

        /* 滚动条隐藏（内容面板保留细滚动条） */
        * { scrollbar-width: none; }
        *::-webkit-scrollbar { display: none; }
        .content-panel::-webkit-scrollbar { display: block; width: 4px; }

        /* ========== 隐藏桌面端元素 ========== */
        .menu-box { display: none !important; }
        .simple-setting, .mini-simple-setting { display: none !important; }

        /* ========== Tabulator 表格 ========== */
        .tabulator-tableholder { overflow-x: auto !important; -webkit-overflow-scrolling: touch; }
        .tabulator { min-width: 400px; }

        /* ========== 弹窗打磨 ========== */
        .layui-layer {
            border-radius: 12px 12px 0 0 !important;
            box-shadow: 0 -2px 20px rgba(0,0,0,0.08) !important;
        }
        .layui-layer-title {
            border-radius: 12px 12px 0 0 !important;
            padding: 14px 16px !important;
            padding-top: calc(14px + env(safe-area-inset-top, 0px)) !important;
            font-size: var(--jhs-text-lg) !important;
            font-weight: 600 !important;
            background: var(--jhs-bg) !important;
            border-bottom: 1px solid var(--jhs-border) !important;
            color: var(--jhs-text-primary) !important;
        }
        .layui-layer-setwin { top: calc(8px + env(safe-area-inset-top, 0px)) !important; right: 8px !important; }
        .layui-layer-setwin a {
            width: 44px !important;
            height: 44px !important;
            display: flex !important;
            align-items: center !important;
            justify-content: center !important;
            font-size: 20px !important;
            color: var(--jhs-text-secondary) !important;
            border-radius: var(--jhs-radius-sm) !important;
        }
        .layui-layer-content {
            padding: var(--jhs-space-lg) !important;
            font-size: var(--jhs-text-base) !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .layui-layer-btn {
            padding: var(--jhs-space-md) var(--jhs-space-lg) !important;
            padding-bottom: calc(var(--jhs-space-md) + env(safe-area-inset-bottom, 0px)) !important;
        }
        .layui-layer-btn a {
            min-height: 44px !important;
            padding: 10px 20px !important;
            border-radius: var(--jhs-radius-sm) !important;
            font-size: var(--jhs-text-base) !important;
            font-weight: 600 !important;
        }
        .layui-layer-msg { bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important; }

        /* ========== 设置面板：侧栏改顶部标签 ========== */
        .jhs-mobile-sidebar {
            display: flex !important;
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            white-space: nowrap !important;
            padding: 0 !important;
            background: var(--jhs-bg) !important;
            border-bottom: 1px solid var(--jhs-border) !important;
            border-right: none !important;
            width: 100% !important;
            flex-shrink: 0 !important;
            gap: 0 !important;
        }
        .jhs-mobile-sidebar .side-menu-item {
            display: inline-flex !important;
            flex-shrink: 0 !important;
            padding: 10px 14px !important;
            font-size: var(--jhs-text-sm) !important;
            border-left: none !important;
            border-bottom: 2px solid transparent !important;
            color: var(--jhs-text-secondary) !important;
            transition: color 0.2s, border-color 0.2s !important;
        }
        .jhs-mobile-sidebar .side-menu-item.active {
            border-left: none !important;
            border-bottom: 2px solid var(--jhs-accent) !important;
            color: var(--jhs-accent) !important;
            font-weight: 600 !important;
            background: transparent !important;
        }

        /* 设置项纵向堆叠 */
        .setting-item {
            flex-direction: column !important;
            align-items: stretch !important;
            padding: var(--jhs-space-md) 0 !important;
            margin-bottom: 0 !important;
            border-bottom: 1px solid var(--jhs-border-light) !important;
        }
        .setting-label {
            min-width: auto !important;
            font-size: var(--jhs-text-sm) !important;
            font-weight: 500 !important;
            color: var(--jhs-text-primary) !important;
            margin-bottom: var(--jhs-space-xs) !important;
        }
        .form-content {
            max-width: none !important;
            min-width: 0 !important;
        }

        /* 设置面板底部操作栏 */
        .jhs-setting-footer {
            padding: var(--jhs-space-md) var(--jhs-space-lg) !important;
            padding-bottom: calc(var(--jhs-space-md) + env(safe-area-inset-bottom, 0px)) !important;
            display: flex !important;
            gap: var(--jhs-space-sm) !important;
        }
        #saveBtn, #clean-all {
            flex: 1 !important;
            padding: 12px 16px !important;
            border-radius: var(--jhs-radius-sm) !important;
            font-size: var(--jhs-text-base) !important;
            font-weight: 600 !important;
        }

        /* 设置面板内按钮统一 */
        .layui-layer-content .menu-btn {
            padding: 8px 14px !important;
            font-size: var(--jhs-text-sm) !important;
            font-weight: 600 !important;
            border-radius: var(--jhs-radius-sm) !important;
            min-height: 40px !important;
        }
        .layui-layer-content .menu-btn + .menu-btn {
            margin-left: var(--jhs-space-sm) !important;
        }

        /* 缓存面板单列 + 按钮纵向堆叠 */
        .jhs-cache-grid {
            grid-template-columns: 1fr !important;
        }
        .cache-item > div:last-child {
            flex-direction: column !important;
        }
        .cache-item .menu-btn {
            width: 100% !important;
            min-height: 44px !important;
        }

        /* 备份面板按钮并排 */
        #backup-panel > div:first-child {
            display: flex !important;
            gap: var(--jhs-space-sm) !important;
        }
        #backup-panel > div:first-child .menu-btn {
            flex: 1 !important;
        }
        #backup-panel .setting-item > div {
            display: flex !important;
            gap: var(--jhs-space-sm) !important;
        }
        #backup-panel .setting-item > div .menu-btn {
            flex: 1 !important;
        }

        /* ========== 详情页按钮：底部栏已覆盖全部操作，隐藏内联按钮 ========== */
        .jhs-detail-btn-row { display: none !important; }

        /* ========== 列表页按钮：隐藏与底部栏重复的按钮 ========== */
        .jhs-list-btn-row:nth-of-type(2) { display: none !important; }
        .jhs-list-btn-row:first-of-type #waitCheckBtn { display: none !important; }

        /* ========== 列表页按钮：水平滚动胶囊 ========== */
        .jhs-list-btn-row {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
            flex-wrap: nowrap !important;
            gap: var(--jhs-space-sm) !important;
            padding: var(--jhs-space-sm) 0 !important;
            scrollbar-width: none !important;
        }
        .jhs-list-btn-row::-webkit-scrollbar { display: none !important; }
        .jhs-list-btn-row .main-tab-btn {
            flex-shrink: 0 !important;
            white-space: nowrap !important;
            border-radius: var(--jhs-radius-full) !important;
            padding: 6px 14px !important;
            font-size: var(--jhs-text-sm) !important;
            min-height: 40px !important;
            height: auto !important;
            box-shadow: var(--jhs-shadow-sm) !important;
        }

        /* ========== 原生表格横滚 ========== */
        .jhs-mobile-table-wrap {
            overflow-x: auto !important;
            -webkit-overflow-scrolling: touch !important;
        }
        .jhs-mobile-table-wrap table {
            min-width: 500px !important;
        }
        .layui-layer-content table {
            min-width: 500px !important;
        }

        /* ========== 新作品网格适配 ========== */
        .jhs-new-video-grid {
            grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)) !important;
        }

        /* ========== JavBus 浮动设置区 ========== */
        #top-right-box { flex-wrap: wrap !important; }

        /* ========== WebDAV 备份卡片列表 ========== */
        .jhs-backup-card {
            background: var(--jhs-bg);
            border: 1px solid var(--jhs-border);
            border-radius: var(--jhs-radius-md);
            padding: var(--jhs-space-lg);
            margin-bottom: var(--jhs-space-md);
        }
        .jhs-backup-card-name {
            font-size: var(--jhs-text-base);
            font-weight: 600;
            color: var(--jhs-text-primary);
            word-break: break-all;
            margin-bottom: var(--jhs-space-xs);
        }
        .jhs-backup-card-meta {
            font-size: var(--jhs-text-sm);
            color: var(--jhs-text-secondary);
            margin-bottom: var(--jhs-space-md);
        }
        .jhs-backup-card-actions {
            display: flex;
            gap: var(--jhs-space-sm);
        }
        .jhs-backup-btn {
            flex: 1;
            display: flex;
            align-items: center;
            justify-content: center;
            min-height: 44px;
            border-radius: var(--jhs-radius-sm);
            font-size: var(--jhs-text-base);
            font-weight: 600;
            color: white;
            cursor: pointer;
            border: none;
            transition: transform 0.15s, opacity 0.15s;
            -webkit-tap-highlight-color: transparent;
        }
        .jhs-backup-btn:active {
            transform: scale(0.96);
            opacity: 0.9;
        }
        .jhs-backup-btn-danger { background: var(--jhs-error); }
        .jhs-backup-btn-primary { background: var(--jhs-accent); }
        .jhs-backup-btn-success { background: var(--jhs-success); }
        .jhs-backup-empty {
            text-align: center;
            color: var(--jhs-text-tertiary);
            padding: var(--jhs-space-2xl) 0;
            font-size: var(--jhs-text-base);
        }

        /* ========== 设置面板高级工具子标签 ========== */
        .jhs-sub-tabs {
            display: flex;
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
            gap: 0;
            border-bottom: 1px solid var(--jhs-border);
            margin-bottom: var(--jhs-space-md);
            scrollbar-width: none;
        }
        .jhs-sub-tabs::-webkit-scrollbar { display: none; }
        .jhs-sub-tab {
            padding: 8px 12px;
            font-size: var(--jhs-text-sm);
            color: var(--jhs-text-secondary);
            white-space: nowrap;
            border-bottom: 2px solid transparent;
            cursor: pointer;
            transition: color 0.2s, border-color 0.2s;
            -webkit-tap-highlight-color: transparent;
        }
        .jhs-sub-tab.active {
            color: var(--jhs-accent);
            border-bottom-color: var(--jhs-accent);
            font-weight: 600;
        }
        .jhs-sub-panel { display: none; }
        .jhs-sub-panel.active { display: block; }
    }
</style>`;
H(MOBILE_CSS);
