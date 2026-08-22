/** 设计令牌层 (Design tokens): 全部 --jhs-* 变量, 亮色(:root) + 暗色(:root[data-jhs-theme="dark"])。
 * 在 css-injection.js 最先注入, 供所有后续插件 CSS 通过 var(--jhs-*) 消费。 */

const JHS_Z_INDEX = Object.freeze({
    content: 10,
    elevated: 20,
    localPopover: 30,
    popover: 100,
    dropdown: 1e3,
    fabBackdrop: 1e4,
    fabMenu: 10001,
    fab: 10002,
    debugLow: 12345678,
    hostNav: 12345679,
    hostTopbar: 12345689,
    modal: 12345699,
    sheetBackdrop: 12345789,
    sheet: 12345790,
    loading: 99999999,
    viewer: 999999990,
    layer: 999999991,
    debug: 999999999,
    tooltip: 9999999999
});

function buildThemeCss() {
  return `\n<style>\n    :root {\n        /* 字体 */
        --jhs-font: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;

        /* 中性色 */
        --jhs-bg: #f4f6f9;
        --jhs-surface: #ffffff;
        --jhs-surface-2: #f2f4f8;
        --jhs-border: #e3e7ee;
        --jhs-border-strong: #8a94a6;
        --jhs-text: #1f2733;
        --jhs-text-muted: #5b6b7c;
        --jhs-text-faint: #637183;
        --jhs-input-bg: #f2f4f8;
        --jhs-placeholder: #637183;
        --jhs-disabled-bg: #f2f4f8;
        --jhs-disabled-text: #637183;

        /* 间距 / 排版 / 控件尺寸 */
        --jhs-space-1: 4px;
        --jhs-space-2: 8px;
        --jhs-space-3: 12px;
        --jhs-space-4: 16px;
        --jhs-space-5: 24px;
        --jhs-space-6: 32px;
        --jhs-font-size-xs: 12px;
        --jhs-font-size-sm: 13px;
        --jhs-font-size-md: 14px;
        --jhs-font-size-lg: 16px;
        --jhs-font-size-xl: 18px;
        --jhs-control-height-sm: 32px;
        --jhs-control-height: 36px;
        --jhs-touch-target: 44px;
        --jhs-motion-fast: 120ms;
        --jhs-motion-base: 180ms;
        --jhs-ease: cubic-bezier(.2, 0, 0, 1);

        /* 层级：业务模块只消费语义令牌，不自行发明数值 */
        --jhs-z-content: ${JHS_Z_INDEX.content};
        --jhs-z-elevated: ${JHS_Z_INDEX.elevated};
        --jhs-z-local-popover: ${JHS_Z_INDEX.localPopover};
        --jhs-z-popover: ${JHS_Z_INDEX.popover};
        --jhs-z-dropdown: ${JHS_Z_INDEX.dropdown};
        --jhs-z-fab-backdrop: ${JHS_Z_INDEX.fabBackdrop};
        --jhs-z-fab-menu: ${JHS_Z_INDEX.fabMenu};
        --jhs-z-fab: ${JHS_Z_INDEX.fab};
        --jhs-z-debug-low: ${JHS_Z_INDEX.debugLow};
        --jhs-z-host-nav: ${JHS_Z_INDEX.hostNav};
        --jhs-z-host-topbar: ${JHS_Z_INDEX.hostTopbar};
        --jhs-z-modal: ${JHS_Z_INDEX.modal};
        --jhs-z-sheet-backdrop: ${JHS_Z_INDEX.sheetBackdrop};
        --jhs-z-sheet: ${JHS_Z_INDEX.sheet};
        --jhs-z-loading: ${JHS_Z_INDEX.loading};
        --jhs-z-viewer: ${JHS_Z_INDEX.viewer};
        --jhs-z-layer: ${JHS_Z_INDEX.layer};
        --jhs-z-debug: ${JHS_Z_INDEX.debug};
        --jhs-z-tooltip: ${JHS_Z_INDEX.tooltip};

        /* 主操作色 (中性蓝灰; 状态色仅表达数据语义) */
        --jhs-accent: #3b6ea5;
        --jhs-accent-hover: #2f5b8a;
        --jhs-accent-tint: #e7eef6;
        --jhs-accent-text-on: #ffffff;

        /* 通用反馈语义（不得代替影片状态色） */
        --jhs-danger: #c02b2b;
        --jhs-danger-tint: #fde8e8;
        --jhs-danger-text-on: #ffffff;
        --jhs-warning: #826207;
        --jhs-warning-tint: #faf3df;
        --jhs-warning-text-on: #ffffff;

        /* 状态语义色 (品牌, 保持可辨识): red=屏蔽 cyan=收藏 green=下载 amber=观看
         * -on   实色背景上的文字 (filter 用白字, 其余深字)
         * -text tint 背景上的文字 / 彩色文字落 surface 的正文色 */
        --jhs-status-filter: #de3333;
        --jhs-status-filter-tint: #fde8e8;
        --jhs-status-filter-hover: #c02b2b;
        --jhs-status-filter-text: #c02b2b;
        --jhs-status-filter-on: #ffffff;
        --jhs-status-fav: #25b1dc;
        --jhs-status-fav-tint: #e5f6fc;
        --jhs-status-fav-hover: #1e93b8;
        --jhs-status-fav-text: #15728b;
        --jhs-status-fav-on: #14181d;
        --jhs-status-down: #7bc73b;
        --jhs-status-down-tint: #eff8e6;
        --jhs-status-down-hover: #66ac2d;
        --jhs-status-down-text: #387213;
        --jhs-status-down-on: #14181d;
        --jhs-status-watch: #d7a80c;
        --jhs-status-watch-tint: #faf3df;
        --jhs-status-watch-hover: #b58b09;
        --jhs-status-watch-text: #826207;
        --jhs-status-watch-on: #14181d;

        /* 品牌色 (第三方站点来源标识, 保持可辨识) */
        --jhs-brand-javdb: #c23a85;
        --jhs-brand-javbus: #967004;

        /* 代码查看器 (终端语义, 亮暗一致, 不随主题) */
        --jhs-code-bg: #1e1e1e;
        --jhs-code-text: #ffffff;
        --jhs-code-line: #aaaaaa;

        /* 圆角: 唯一一套 */
        --jhs-radius-xs: 6px;
        --jhs-radius-sm: 8px;
        --jhs-radius-md: 12px;
        --jhs-radius-lg: 14px;
        --jhs-radius-pill: 999px;

        /* 阴影: 与背景同色相 */
        --jhs-shadow-xs: 0 1px 2px rgba(31, 39, 51, .06);
        --jhs-shadow-sm: 0 1px 3px rgba(31, 39, 51, .08), 0 1px 2px rgba(31, 39, 51, .04);
        --jhs-shadow-md: 0 4px 14px rgba(31, 39, 51, .10);
        --jhs-shadow-lg: 0 12px 32px rgba(31, 39, 51, .16);

        /* 图标 */
        --jhs-icon-color: #5b6b7c;
    }

    :root[data-jhs-theme="dark"] {
        --jhs-bg: #14181d;
        --jhs-surface: #1d232b;
        --jhs-surface-2: #262d37;
        --jhs-border: #333c47;
        --jhs-border-strong: #64728a;
        --jhs-text: #e6ebf1;
        --jhs-text-muted: #9aa7b6;
        --jhs-text-faint: #9cacbd;
        --jhs-input-bg: #262d37;
        --jhs-placeholder: #9cacbd;
        --jhs-disabled-bg: #262d37;
        --jhs-disabled-text: #9cacbd;

        --jhs-accent: #7ca6d4;
        --jhs-accent-hover: #8db3de;
        --jhs-accent-tint: #25354a;
        --jhs-accent-text-on: #14181d;

        --jhs-danger: #e87171;
        --jhs-danger-tint: #3a2323;
        --jhs-danger-text-on: #14181d;
        --jhs-warning: #e0b32e;
        --jhs-warning-tint: #362f18;
        --jhs-warning-text-on: #14181d;

        --jhs-status-filter: #e05a5a;
        --jhs-status-filter-tint: #3a2323;
        --jhs-status-filter-hover: #f07171;
        --jhs-status-filter-text: #e87171;
        --jhs-status-filter-on: #14181d;
        --jhs-status-fav: #4dbbe0;
        --jhs-status-fav-tint: #1f3340;
        --jhs-status-fav-hover: #6fcbe8;
        --jhs-status-fav-text: #4dbbe0;
        --jhs-status-fav-on: #14181d;
        --jhs-status-down: #93d357;
        --jhs-status-down-tint: #25341a;
        --jhs-status-down-hover: #a8de73;
        --jhs-status-down-text: #93d357;
        --jhs-status-down-on: #14181d;
        --jhs-status-watch: #e0b32e;
        --jhs-status-watch-tint: #362f18;
        --jhs-status-watch-hover: #ecc347;
        --jhs-status-watch-text: #e0b32e;
        --jhs-status-watch-on: #14181d;

        /* 品牌色 */
        --jhs-brand-javdb: #e37ab6;
        --jhs-brand-javbus: #f0c040;

        /* 代码查看器 (终端语义, 亮暗一致, 不随主题) */
        --jhs-code-bg: #1e1e1e;
        --jhs-code-text: #ffffff;
        --jhs-code-line: #aaaaaa;

        --jhs-shadow-xs: 0 1px 2px rgba(0, 0, 0, .40);
        --jhs-shadow-sm: 0 1px 3px rgba(0, 0, 0, .50);
        --jhs-shadow-md: 0 4px 14px rgba(0, 0, 0, .55);
        --jhs-shadow-lg: 0 12px 36px rgba(0, 0, 0, .60);

        --jhs-icon-color: #9aa7b6;
    }

    /* JHS 表面输入框基座 + placeholder + 禁用态 (亮暗一致, 作用域限定 JHS 表面) */
    .jhs-ui input[type="text"],
    .jhs-ui input[type="number"],
    .jhs-ui textarea,
    .jhs-ui select,
    .layui-layer-content input[type="text"],
    .layui-layer-content input[type="number"],
    .layui-layer-content textarea,
    .layui-layer-content select {
        background-color: var(--jhs-input-bg);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }
    .jhs-ui ::placeholder,
    .layui-layer-content ::placeholder {
        color: var(--jhs-placeholder);
        opacity: 1;
    }
    .jhs-ui button:disabled,
    .jhs-ui input:disabled,
    .jhs-ui select:disabled,
    .layui-layer-content button:disabled,
    .layui-layer-content input:disabled,
    .layui-layer-content select:disabled {
        background-color: var(--jhs-disabled-bg);
        color: var(--jhs-disabled-text);
        border-color: var(--jhs-border);
        cursor: not-allowed;
        opacity: 1;
    }

    /* JHS 表面基础字体 */
    .jhs-ui, .layui-layer-content, .tabulator, .toastify, .jhs-fab, .menu-box {
        font-family: var(--jhs-font);
    }

    /* 焦点环 */
    :where(.jhs-ui) :focus-visible,
    :where(.layui-layer-content) :focus-visible,
    :where(.tabulator) :focus-visible {
        outline: 2px solid var(--jhs-accent);
        outline-offset: 2px;
    }

    /* 滚动条 (JHS 表面) */
    .jhs-scrollbar::-webkit-scrollbar,
    .content-panel::-webkit-scrollbar,
    .tabulator-tableholder::-webkit-scrollbar,
    .has-navbar-fixed-top::-webkit-scrollbar,
    .layui-layer-content::-webkit-scrollbar {
        width: 6px;
        height: 6px;
    }
    .jhs-scrollbar::-webkit-scrollbar-track,
    .content-panel::-webkit-scrollbar-track,
    .tabulator-tableholder::-webkit-scrollbar-track,
    .has-navbar-fixed-top::-webkit-scrollbar-track,
    .layui-layer-content::-webkit-scrollbar-track {
        background: var(--jhs-surface-2);
        border-radius: 10px;
    }
    .jhs-scrollbar::-webkit-scrollbar-thumb,
    .content-panel::-webkit-scrollbar-thumb,
    .tabulator-tableholder::-webkit-scrollbar-thumb,
    .has-navbar-fixed-top::-webkit-scrollbar-thumb,
    .layui-layer-content::-webkit-scrollbar-thumb {
        background: var(--jhs-border-strong);
        border-radius: 10px;
    }
    .jhs-scrollbar::-webkit-scrollbar-thumb:hover,
    .content-panel::-webkit-scrollbar-thumb:hover,
    .tabulator-tableholder::-webkit-scrollbar-thumb:hover,
    .has-navbar-fixed-top::-webkit-scrollbar-thumb:hover,
    .layui-layer-content::-webkit-scrollbar-thumb:hover {
        background: var(--jhs-text-faint);
    }

    @media (prefers-reduced-motion: reduce) {
        .jhs-ui, .layui-layer-content, .tabulator, .toastify, .jhs-fab, .menu-box,
        .jhs-ui *, .layui-layer-content *, .tabulator *, .toastify *, .jhs-fab *, .menu-box * {
            transition: none !important;
            animation: none !important;
        }
    }

    /* 暗色下覆盖 layui-layer 弹层 chrome (外部 layui.css 为亮色主题) */
    :root[data-jhs-theme="dark"] .layui-layer {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-lg);
    }
    :root[data-jhs-theme="dark"] .layui-layer-title {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .layui-layer-content {
        color: var(--jhs-text);
    }
    :root[data-jhs-theme="dark"] .layui-layer-btn a {
        background-color: var(--jhs-surface-2);
        border: 1px solid var(--jhs-border);
        color: var(--jhs-text);
    }
    :root[data-jhs-theme="dark"] .layui-layer-btn .layui-layer-btn0 {
        background-color: var(--jhs-accent);
        border-color: transparent;
        color: var(--jhs-accent-text-on);
    }
    .layui-layer-setwin .layui-layer-close {
        width: 36px!important;
        height: 36px!important;
        background: none!important;
        color: var(--jhs-text-muted)!important;
        font-size: 0!important;
        opacity: 1!important;
    }
    .layui-layer-setwin .layui-layer-close::before,
    .layui-layer-setwin .layui-layer-close::after {
        content: "";
        position: absolute;
        top: 17px;
        left: 9px;
        width: 18px;
        height: 2px;
        border-radius: 1px;
        background: currentColor;
    }
    .layui-layer-setwin .layui-layer-close::before { transform: rotate(45deg); }
    .layui-layer-setwin .layui-layer-close::after { transform: rotate(-45deg); }
    .layui-layer-setwin .layui-layer-close:hover,
    .layui-layer-setwin .layui-layer-close:focus-visible { color: var(--jhs-text)!important; }
    :root[data-jhs-theme="dark"] .layui-input,
    :root[data-jhs-theme="dark"] .layui-layer-content input[type="text"],
    :root[data-jhs-theme="dark"] .layui-layer-content input[type="number"],
    :root[data-jhs-theme="dark"] .layui-layer-content textarea,
    :root[data-jhs-theme="dark"] .layui-layer-content select {
        background-color: var(--jhs-input-bg);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }

    /* 暗色下覆盖 Tabulator 表格 chrome (semanticui 主题为亮色) */
    :root[data-jhs-theme="dark"] .tabulator {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-header {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-header .tabulator-col {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-right: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-row {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-row.tabulator-row-even {
        background-color: var(--jhs-surface-2);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-cell {
        color: var(--jhs-text);
        border-right: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-footer {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-top: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .tabulator .tabulator-responsive-collapse {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-top: 1px solid var(--jhs-border);
    }

    /* 暗色下图标翻转为单色, 避免深色 path 在暗表面上不可见 */
    :root[data-jhs-theme="dark"] .jhs-icon path {
        fill: var(--jhs-icon-color);
    }
</style>\n`;
}

/** 将 themeMode 设置(light/dark/auto)解析为具体主题并应用到 documentElement。 */
async function applyTheme() {
    const mode = await storageManager.getSetting("themeMode", "light");
    let resolved = "light";
    if ("dark" === mode) resolved = "dark";
    else if ("auto" === mode) resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-jhs-theme", resolved);
}

/** 跟随系统模式下, 监听系统深浅色切换并实时应用。 */
window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (() => {
    storageManager.getSetting("themeMode", "light").then((e => {
        "auto" === e && applyTheme();
    }));
}));
