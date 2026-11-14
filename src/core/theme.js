// @ts-check

/** 设计令牌层 (Design tokens): 全部 --jhs-* 变量, 亮色(:root) + 暗色(:root[data-jhs-theme="dark"])。
 * 在 css-injection.js 最先注入, 供所有后续插件 CSS 通过 var(--jhs-*) 消费。 */

export const JHS_Z_INDEX = Object.freeze({
    content: 10,
    elevated: 20,
    localPopover: 30,
    popover: 100,
    dropdown: 1e3,
    fabBackdrop: 12345691,
    fabMenu: 12345692,
    fab: 12345693,
    pagePopover: 12345694,
    debugLow: 12345678,
    hostNav: 12345679,
    hostTopbar: 12345689,
    // 悬停预览必须低于 modal/layer：弹窗打开期间预览不得盖住详情内容（tooltip 档保留给需覆盖弹窗的原生提示）
    hoverPreview: 12345690,
    modal: 12345699,
    sheetBackdrop: 12345789,
    sheet: 12345790,
    layer: 999999991,
    // 弹窗内部（如新片工作区）的悬停预览：须盖住所属 layer，但让位 viewer/loading
    dialogHoverPreview: 999999992,
    viewer: 999999993,
    loading: 999999994,
    debug: 999999999,
    tooltip: 1_000_000_000
});

export function buildThemeCss() {
  return `\n<style>\n    :root {\n        /* 字体 */
        --jhs-font: system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif;
        --jhs-font-mono: Consolas, Monaco, "Andale Mono", monospace;
        --jhs-font-weight-normal: 400;
        --jhs-font-weight-semibold: 600;
        --jhs-line-height-tight: 1.3;
        --jhs-line-height-ui: 1.5;
        --jhs-line-height-read: 1.7;

        /* 中性色 */
        --jhs-bg: #f4f6f9;
        --jhs-color-scheme: light;
        --jhs-surface: #ffffff;
        --jhs-surface-2: #f2f4f8;
        --jhs-surface-hover: #e9edf4;
        --jhs-focus: var(--jhs-accent);
        --jhs-focus-ring: 0 0 0 2px var(--jhs-accent);
        --jhs-border: #e3e7ee;
        --jhs-border-strong: #7d899c;
        --jhs-text: #1f2733;
        --jhs-text-muted: #5b6b7c;
        --jhs-text-faint: var(--jhs-text-muted);
        --jhs-text-disabled: #8a94a6;
        --jhs-input-bg: #f2f4f8;
        --jhs-placeholder: var(--jhs-text-muted);
        --jhs-disabled-bg: var(--jhs-surface-2);
        --jhs-disabled-text: var(--jhs-text-disabled);
        --jhs-loading-overlay: rgba(244, 246, 249, .6);
        --jhs-overlay: rgba(20, 24, 29, .72);
        --jhs-overlay-hover: rgba(20, 24, 29, .9);
        --jhs-overlay-icon: #ffffff;
        --jhs-overlay-text: var(--jhs-overlay-icon);
        --jhs-media-bg: #000000;
        --jhs-media-shadow: 0 0 12px rgba(0, 0, 0, .5);
        --jhs-preview-scrim: rgba(0, 0, 0, .03);
        --jhs-success: #387213;
        --jhs-success-tint: #eff8e6;

        /* 间距 / 排版 / 控件尺寸 */
        --jhs-space-half: 2px;
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
        --jhs-font-size-2xl: 20px;
        --jhs-line-height-display: 28px;
        --jhs-control-height-sm: 32px;
        --jhs-control-height: 36px;
        --jhs-touch-target: 44px;
        --jhs-fab-size: 56px;
        --jhs-fab-offset: 24px;
        --jhs-icon-sm: 16px;
        --jhs-icon-md: 18px;
        --jhs-icon-lg: 24px;
        --jhs-icon-hero: var(--jhs-icon-lg);
        --jhs-tooltip-max-width: 320px;
        --jhs-motion-fast: 120ms;
        --jhs-motion-base: 180ms;
        --jhs-ease: cubic-bezier(.2, 0, 0, 1);

        /* 层级：业务模块只消费语义令牌，不自行发明数值 */
        --jhs-z-content: ${JHS_Z_INDEX.content};
        --jhs-z-elevated: ${JHS_Z_INDEX.elevated};
        --jhs-z-local-popover: ${JHS_Z_INDEX.localPopover};
        --jhs-z-popover: ${JHS_Z_INDEX.popover};
        --jhs-z-page-popover: ${JHS_Z_INDEX.pagePopover};
        --jhs-z-dropdown: ${JHS_Z_INDEX.dropdown};
        --jhs-z-fab-backdrop: ${JHS_Z_INDEX.fabBackdrop};
        --jhs-z-fab-menu: ${JHS_Z_INDEX.fabMenu};
        --jhs-z-fab: ${JHS_Z_INDEX.fab};
        --jhs-z-debug-low: ${JHS_Z_INDEX.debugLow};
        --jhs-z-host-nav: ${JHS_Z_INDEX.hostNav};
        --jhs-z-host-topbar: ${JHS_Z_INDEX.hostTopbar};
        --jhs-z-hover-preview: ${JHS_Z_INDEX.hoverPreview};
        --jhs-z-modal: ${JHS_Z_INDEX.modal};
        --jhs-z-sheet-backdrop: ${JHS_Z_INDEX.sheetBackdrop};
        --jhs-z-sheet: ${JHS_Z_INDEX.sheet};
        --jhs-z-layer: ${JHS_Z_INDEX.layer};
        --jhs-z-dialog-hover-preview: ${JHS_Z_INDEX.dialogHoverPreview};
        --jhs-z-viewer: ${JHS_Z_INDEX.viewer};
        --jhs-z-loading: ${JHS_Z_INDEX.loading};
        --jhs-z-debug: ${JHS_Z_INDEX.debug};
        --jhs-z-tooltip: ${JHS_Z_INDEX.tooltip};

        /* 主操作色 (中性蓝灰; 状态色仅表达数据语义) */
        --jhs-accent: #3b6ea5;
        --jhs-accent-hover: #2f5b8a;
        --jhs-accent-tint: #e7eef6;
        --jhs-accent-text: var(--jhs-accent);
        --jhs-accent-text-on: #ffffff;

        /* 通用反馈语义（不得代替影片状态色） */
        --jhs-success-text: var(--jhs-success);
        --jhs-success-text-on: #ffffff;
        --jhs-danger: #c02b2b;
        --jhs-danger-tint: #fde8e8;
        --jhs-danger-text: var(--jhs-danger);
        --jhs-danger-text-on: #ffffff;
        --jhs-warning: #826207;
        --jhs-warning-tint: #faf3df;
        --jhs-warning-text: var(--jhs-warning);
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
        --jhs-site-javtrailers: #d4a72c;
        --jhs-site-av123: #e05d44;
        --jhs-site-jable: #c94556;
        --jhs-site-avgle: #4677c8;
        --jhs-site-missav: #8b5cf6;
        --jhs-site-supjav: #ef6c35;
        --jhs-site-javdb: #2684ff;
        --jhs-site-javbus: #cc3d3d;
        --jhs-site-dmm: #ea4c89;

        /* 代码查看器 (终端语义, 亮暗一致, 不随主题) */
        --jhs-code-bg: #1e1e1e;
        --jhs-code-text: #ffffff;
        --jhs-code-line: #aaaaaa;

        /* 圆角: 唯一一套 */
        --jhs-radius-xs: 6px;
        --jhs-radius-sm: 8px;
        --jhs-radius-md: 12px;
        --jhs-radius-lg: 16px;
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
        --jhs-color-scheme: dark;
        --jhs-surface: #1d232b;
        --jhs-surface-2: #262d37;
        --jhs-surface-hover: #2e3642;
        --jhs-focus: var(--jhs-accent);
        --jhs-border: #333c47;
        --jhs-border-strong: #72819a;
        --jhs-text: #e6ebf1;
        --jhs-text-muted: #9aa7b6;
        --jhs-text-disabled: #64728a;
        --jhs-input-bg: #262d37;
        --jhs-loading-overlay: rgba(20, 24, 29, .6);
        --jhs-success: #93d357;
        --jhs-success-tint: #25341a;
        --jhs-success-text-on: #14181d;

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
        --jhs-site-javtrailers: #e5be53;
        --jhs-site-av123: #ee7d66;
        --jhs-site-jable: #e06c7b;
        --jhs-site-avgle: #6b96e0;
        --jhs-site-missav: #a78bfa;
        --jhs-site-supjav: #f58c60;
        --jhs-site-javdb: #5c9eff;
        --jhs-site-javbus: #e86b6b;
        --jhs-site-dmm: #f174a4;

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

    /* 控件状态由 ui-primitives 统一负责，避免主题选择器覆盖 hover/focus。 */
    .jhs-ui ::placeholder,
    .jhs-dialog .layui-layer-content ::placeholder {
        color: var(--jhs-placeholder);
        opacity: 1;
    }
    .jhs-ui button:disabled,
    .jhs-ui input:disabled,
    .jhs-ui select:disabled,
    .jhs-ui textarea:disabled,
    .jhs-dialog .layui-layer-content button:disabled,
    .jhs-dialog .layui-layer-content input:disabled,
    .jhs-dialog .layui-layer-content select:disabled,
    .jhs-dialog .layui-layer-content textarea:disabled {
        background-color: var(--jhs-disabled-bg);
        color: var(--jhs-disabled-text);
        border-color: var(--jhs-border);
        cursor: not-allowed;
        opacity: 1;
    }

    /* JHS 表面基础字体 */
    .jhs-ui, .jhs-dialog .layui-layer-content, .tabulator, .toastify, #jhs-fab, .jhs-fab, .menu-box {
        font-family: var(--jhs-font);
    }

    :where(.jhs-ui, .jhs-dialog, .jhs-btn, .jhs-field, .jhs-switch, .mini-switch, .jhs-icon-btn, .card-btn, .jhs-checkbox, .jhs-radio) { color-scheme:var(--jhs-color-scheme); }
    :where(.jhs-ui, .jhs-dialog .layui-layer-content, .jhs-popover, .jhs-owned-popover) :focus-visible,
    :where(.jhs-btn, .jhs-icon-btn, .card-btn, .jhs-link, .jhs-checkbox, .jhs-radio, .jhs-switch, .mini-switch, .jhs-field, .jhs-textarea, .jhs-select-trigger):focus-visible {
        outline:2px solid var(--jhs-focus);
        outline-offset:2px;
    }

    :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar) { scrollbar-width:thin; scrollbar-color:var(--jhs-border-strong) var(--jhs-surface); }
    @supports not (scrollbar-color: auto) {
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar { width:10px; height:10px; }
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar-track { background:var(--jhs-surface); }
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar-thumb { background:var(--jhs-border-strong); border:2px solid var(--jhs-surface); border-radius:var(--jhs-radius-pill); }
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar-thumb:hover { background:var(--jhs-text-faint); }
    }
    :is(.jhs-owned-popover,.jhs-fab-menu,.simple-setting__scroll) { overscroll-behavior:contain; }
    .jhs-dialog :is(.layui-layer-content,.jhs-history-layout,.jhs-record-list,#actress-card-container,#new-video-list-container,.content-panel,.jhs-stats,.jhs-resource-form,.jhs-scroll-frame,.tabulator-tableholder,.jhs-code-viewer) { overscroll-behavior:contain; }
    @media (pointer:coarse), (forced-colors:active) {
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar) { scrollbar-width:auto; }
    }
    @media (pointer:coarse) {
        @supports not (scrollbar-color: auto) {
            :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar { width:auto; height:auto; }
        }
    }
    @media (forced-colors:active) {
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar) { scrollbar-color:auto; }
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar { width:auto; height:auto; }
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar-thumb { background:CanvasText; border-color:Canvas; }
        :is(.jhs-ui, .jhs-ui *, .jhs-scrollbar)::-webkit-scrollbar-track { background:Canvas; }
    }

    @media (prefers-reduced-motion: reduce) {
        .jhs-ui, .jhs-dialog .layui-layer-content, .tabulator, .toastify, #jhs-fab, .jhs-fab, .menu-box,
        .jhs-ui *, .jhs-dialog .layui-layer-content *, .tabulator *, .toastify *, #jhs-fab *, .jhs-fab *, .menu-box * {
            transition: none !important;
            animation: none !important;
        }
    }

    /* 暗色下覆盖 layui-layer 弹层 chrome (外部 layui.css 为亮色主题) */
    :root[data-jhs-theme="dark"] .jhs-dialog.layui-layer {
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-lg);
    }
    :root[data-jhs-theme="dark"] .jhs-dialog .layui-layer-title {
        background-color: var(--jhs-surface-2);
        color: var(--jhs-text);
        border-bottom: 1px solid var(--jhs-border);
    }
    :root[data-jhs-theme="dark"] .jhs-dialog .layui-layer-content {
        color: var(--jhs-text);
    }
    :root[data-jhs-theme="dark"] .jhs-dialog .layui-layer-btn a {
        background-color: var(--jhs-surface-2);
        border: 1px solid var(--jhs-border);
        color: var(--jhs-text);
    }
    :root[data-jhs-theme="dark"] .jhs-dialog .layui-layer-btn .layui-layer-btn0 {
        background-color: var(--jhs-accent);
        border-color: transparent;
        color: var(--jhs-accent-text-on);
    }
    .jhs-dialog .layui-layer-setwin .layui-layer-close {
        width: var(--jhs-touch-target)!important;
        height: var(--jhs-touch-target)!important;
        background: none!important;
        color: var(--jhs-text-muted)!important;
        font-size: 0!important;
        opacity: 1!important;
    }
    .jhs-dialog .layui-layer-setwin .layui-layer-close::before,
    .jhs-dialog .layui-layer-setwin .layui-layer-close::after {
        content: "";
        position: absolute;
        top: calc(var(--jhs-touch-target) / 2 - 1px);
        left: calc((var(--jhs-touch-target) - var(--jhs-icon-md)) / 2);
        width: var(--jhs-icon-md);
        height: 2px;
        border-radius: 1px;
        background: currentColor;
    }
    .jhs-dialog .layui-layer-setwin .layui-layer-close::before { transform: rotate(45deg); }
    .jhs-dialog .layui-layer-setwin .layui-layer-close::after { transform: rotate(-45deg); }
    .jhs-dialog .layui-layer-setwin .layui-layer-close:hover,
    .jhs-dialog .layui-layer-setwin .layui-layer-close:focus-visible { color: var(--jhs-text)!important; }
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
        background-color: var(--jhs-surface);
        color: var(--jhs-text);
        border-top: 1px solid var(--jhs-border);
    }

</style>\n`;
}

/** 将 themeMode 设置(light/dark/auto)解析为具体主题并应用到 documentElement。 */
export function applyThemeMode(mode = "light") {
    let resolved = "light";
    if ("dark" === mode) resolved = "dark";
    else if ("auto" === mode) resolved = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    document.documentElement.setAttribute("data-jhs-theme", resolved);
}

/** @deprecated Prefer applyThemeMode(snapshot.themeMode) to avoid legacy cache reads. */
export async function applyTheme() {
    const mode = await storageManager.getSetting("themeMode", "light");
    applyThemeMode(mode);
}

/** @param {import("./lifecycle-scope.js").LifecycleScope} scope */
export function initializeThemeRuntime(scope) {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    scope.listen(media, "change", () => {
        const mode = /** @type {any} */ (globalThis).settingsService?.snapshot?.().themeMode ?? storageManager.getSettingSync("themeMode", "light");
        if ("auto" === mode) applyThemeMode(mode);
    });
}
