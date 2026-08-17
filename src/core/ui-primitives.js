/** JHS 原生 UI 组件基座：现代桌面工具风格，不依赖宿主站点或第三方框架。 */
function buildUiPrimitivesCss() {
    return `
<style id="jhs-ui-primitives">
    :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) {
        color: var(--jhs-text);
        font-family: var(--jhs-font);
        font-size: var(--jhs-font-size-md);
        line-height: 1.5;
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn) {
        box-sizing: border-box;
        display: inline-flex;
        min-height: var(--jhs-control-height);
        align-items: center;
        justify-content: center;
        gap: var(--jhs-space-2);
        padding: 0 var(--jhs-space-3);
        margin: 0;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-sm);
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: none;
        font: inherit;
        font-size: var(--jhs-font-size-sm);
        font-weight: 600;
        line-height: 1;
        text-align: center;
        text-decoration: none;
        text-shadow: none;
        white-space: nowrap;
        cursor: pointer;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease),
                    border-color var(--jhs-motion-fast) var(--jhs-ease),
                    color var(--jhs-motion-fast) var(--jhs-ease),
                    transform var(--jhs-motion-fast) var(--jhs-ease);
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn):hover {
        border-color: var(--jhs-accent);
        background: var(--jhs-surface-2);
        color: var(--jhs-accent);
        box-shadow: none;
        filter: none;
        transform: none;
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn):active {
        transform: translateY(1px);
    }

    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn):disabled,
    :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn)[aria-disabled="true"] {
        border-color: var(--jhs-border);
        background: var(--jhs-disabled-bg);
        color: var(--jhs-disabled-text);
        cursor: not-allowed;
        opacity: 1;
        transform: none;
    }

    :is(.jhs-btn--primary, .jhs-btn--accent) {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
        color: var(--jhs-accent-text-on);
    }
    :is(.jhs-btn--primary, .jhs-btn--accent):hover {
        border-color: var(--jhs-accent-hover);
        background: var(--jhs-accent-hover);
        color: var(--jhs-accent-text-on);
    }

    :is(.jhs-btn--secondary, .jhs-btn--muted, .site-btn) {
        border-color: var(--jhs-border);
        background: var(--jhs-surface);
        color: var(--jhs-text);
    }
    .jhs-btn--danger {
        border-color: var(--jhs-danger);
        background: var(--jhs-danger);
        color: var(--jhs-danger-text-on);
    }
    .jhs-btn--danger:hover {
        border-color: var(--jhs-danger);
        background: var(--jhs-danger);
        color: var(--jhs-danger-text-on);
        filter: brightness(.92);
    }
    .jhs-btn--ghost {
        border-color: transparent;
        background: transparent;
        color: var(--jhs-text-muted);
    }
    .jhs-btn--ghost:hover {
        border-color: transparent;
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
    }

    .jhs-video-player {
        display: block;
        width: 100%;
        height: 100%;
        background: #000;
    }
    .jhs-video-toolbar {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--jhs-space-2);
        padding-block: var(--jhs-space-2);
    }
    .jhs-video-toolbar > .jhs-toolbar {
        margin-left: auto;
    }
    .jhs-video-quality-list {
        display: flex;
        align-items: center;
        flex-wrap: wrap;
        gap: var(--jhs-space-2);
    }
    .jhs-video-quality-btn {
        min-width: 80px;
    }
    .jhs-video-quality-btn.active,
    .jhs-video-quality-btn[aria-pressed="true"] {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
        color: var(--jhs-accent-text-on);
    }
    .jhs-btn--soft {
        border-color: transparent;
        background: var(--jhs-accent-tint);
        color: var(--jhs-accent);
    }
    .jhs-btn--filter {
        border-color: transparent;
        background: var(--jhs-status-filter-tint);
        color: var(--jhs-status-filter-text);
    }
    .jhs-btn--fav {
        border-color: transparent;
        background: var(--jhs-status-fav-tint);
        color: var(--jhs-status-fav-text);
    }
    .jhs-btn--down {
        border-color: transparent;
        background: var(--jhs-status-down-tint);
        color: var(--jhs-status-down-text);
    }
    .jhs-btn--watch {
        border-color: transparent;
        background: var(--jhs-status-watch-tint);
        color: var(--jhs-status-watch-text);
    }
    :is(.jhs-btn--filter, .jhs-btn--fav, .jhs-btn--down, .jhs-btn--watch):hover {
        border-color: var(--jhs-border-strong);
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
    }
    .jhs-btn--sm {
        min-height: var(--jhs-control-height-sm);
        padding-inline: var(--jhs-space-2);
        font-size: var(--jhs-font-size-xs);
    }
    .jhs-icon-btn, .card-btn {
        width: var(--jhs-control-height);
        min-width: var(--jhs-control-height);
        height: var(--jhs-control-height);
        min-height: var(--jhs-control-height);
        padding: 0;
        border: 1px solid transparent;
        border-radius: var(--jhs-radius-sm);
        background: transparent;
        color: var(--jhs-icon-color);
        box-shadow: none;
    }
    :where(.jhs-icon-btn, .card-btn):hover {
        border-color: var(--jhs-border);
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
        box-shadow: none;
        transform: none;
    }
    :where(.jhs-icon-btn, .card-btn) svg {
        width: 18px;
        height: 18px;
    }

    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input:not([type]), .jhs-ui input[type="text"], .jhs-ui input[type="number"], .jhs-ui input[type="url"], .jhs-ui input[type="password"],
        .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input:not([type]), .layui-layer-content input[type="text"], .layui-layer-content input[type="number"],
        .layui-layer-content input[type="url"], .layui-layer-content input[type="password"], .layui-layer-content select, .layui-layer-content textarea) {
        box-sizing: border-box;
        min-height: var(--jhs-control-height);
        padding: var(--jhs-space-2) var(--jhs-space-3);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-sm);
        background: var(--jhs-input-bg);
        color: var(--jhs-text);
        font: inherit;
        font-size: var(--jhs-font-size-sm);
        line-height: 1.35;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease),
                    border-color var(--jhs-motion-fast) var(--jhs-ease),
                    box-shadow var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input, .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input, .layui-layer-content select, .layui-layer-content textarea):hover:not(:disabled) {
        border-color: var(--jhs-accent);
    }
    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input, .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input, .layui-layer-content select, .layui-layer-content textarea):focus-visible {
        border-color: var(--jhs-accent);
        outline: 2px solid var(--jhs-accent-tint);
        outline-offset: 1px;
        box-shadow: 0 0 0 1px var(--jhs-accent);
    }
    :where(.jhs-field, .jhs-select, .jhs-textarea,
        .jhs-ui input[type="text"], .jhs-ui input[type="number"], .jhs-ui input[type="url"],
        .jhs-ui select, .jhs-ui textarea,
        .layui-layer-content input[type="text"], .layui-layer-content input[type="number"],
        .layui-layer-content input[type="url"], .layui-layer-content select, .layui-layer-content textarea):hover:not(:focus) {
        border-color: var(--jhs-border-strong);
    }
    :where(.jhs-textarea, .jhs-ui textarea, .layui-layer-content textarea) {
        min-height: 76px;
        resize: vertical;
    }

    .jhs-switch, .mini-switch {
        appearance: none;
        box-sizing: border-box;
        width: 40px;
        min-width: 40px;
        height: 22px;
        min-height: 22px;
        padding: 2px;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-surface-2);
        cursor: pointer;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease), border-color var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-switch, .mini-switch)::before {
        display: block;
        width: 16px;
        height: 16px;
        border-radius: 50%;
        background: var(--jhs-surface);
        box-shadow: var(--jhs-shadow-xs);
        content: "";
        transition: transform var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-switch, .mini-switch):checked {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
    }
    :where(.jhs-switch, .mini-switch):checked::before {
        transform: translateX(18px);
    }

    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"]) {
        appearance: none;
        width: 100%;
        height: 22px;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"])::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-border);
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"])::-webkit-slider-thumb {
        appearance: none;
        width: 18px;
        height: 18px;
        margin-top: -7px;
        border: 2px solid var(--jhs-surface);
        border-radius: 50%;
        background: var(--jhs-accent);
        box-shadow: 0 0 0 1px var(--jhs-accent), var(--jhs-shadow-xs);
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .layui-layer-content input[type="range"]):disabled {
        cursor: not-allowed;
        opacity: .55;
    }

    .jhs-toolbar {
        display: flex;
        align-items: center;
        gap: var(--jhs-space-2);
        flex-wrap: wrap;
        min-width: 0;
    }
    .jhs-toolbar--between {
        justify-content: space-between;
    }
    .jhs-toolbar__group {
        display: flex;
        align-items: center;
        gap: var(--jhs-space-2);
        flex-wrap: wrap;
        min-width: 0;
    }
    .jhs-section {
        display: grid;
        gap: var(--jhs-space-3);
        margin-block: 0 var(--jhs-space-4);
    }
    .jhs-section__heading {
        margin: 0;
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-lg);
        font-weight: 700;
        line-height: 1.3;
    }
    .jhs-section__description, .jhs-helper-text {
        margin: 0;
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-xs);
        line-height: 1.5;
    }
    .jhs-card, .jhs-setting-group {
        box-sizing: border-box;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface);
        box-shadow: none;
    }
    .jhs-card {
        padding: var(--jhs-space-4);
    }
    .jhs-setting-group {
        overflow: hidden;
    }
    .jhs-setting-row {
        box-sizing: border-box;
        display: grid;
        grid-template-columns: minmax(180px, 1fr) minmax(180px, 280px);
        gap: var(--jhs-space-4);
        align-items: center;
        min-height: 52px;
        margin: 0;
        padding: var(--jhs-space-3) var(--jhs-space-4);
        border-bottom: 1px solid var(--jhs-border);
    }
    :where(.jhs-setting-group, .content-panel) > .jhs-setting-row:last-child {
        border-bottom: 0;
    }
    .jhs-setting-row__label, .setting-label {
        min-width: 0;
        margin: 0;
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-sm);
        font-weight: 600;
        line-height: 1.4;
    }
    .jhs-setting-row__description {
        display: block;
        margin-top: var(--jhs-space-1);
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-xs);
        font-weight: 400;
    }
    .jhs-setting-row__control, .form-content {
        display: flex;
        min-width: 0;
        max-width: none;
        align-items: center;
        justify-content: flex-end;
        gap: var(--jhs-space-2);
    }
    :where(.jhs-setting-row__control, .form-content) > :where(input, select, textarea) {
        width: min(100%, 280px);
        margin: 0;
    }

    .jhs-segmented, .magnet-tabs__options {
        display: inline-flex;
        align-items: center;
        gap: var(--jhs-space-1);
        padding: var(--jhs-space-1);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface-2);
    }
    .jhs-segmented__item, .magnet-tab {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: var(--jhs-control-height-sm);
        padding: 0 var(--jhs-space-3);
        border: 0;
        border-radius: var(--jhs-radius-xs);
        background: transparent;
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-sm);
        font-weight: 600;
        line-height: 1;
        cursor: pointer;
    }
    :where(.jhs-segmented__item, .magnet-tab):hover {
        background: var(--jhs-surface);
        color: var(--jhs-text);
    }
    :where(.jhs-segmented__item, .magnet-tab).active,
    :where(.jhs-segmented__item, .magnet-tab)[aria-selected="true"] {
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-xs);
    }

    .jhs-popover {
        position: absolute;
        top: calc(100% + var(--jhs-space-2));
        right: 0;
        z-index: var(--jhs-z-local-popover);
        display: none;
        min-width: 152px;
        padding: var(--jhs-space-2);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface);
        box-shadow: var(--jhs-shadow-md);
    }
    .jhs-popover.is-open { display: grid; gap: var(--jhs-space-1); }
    .jhs-popover [role="menuitem"], .jhs-popover [role="menuitemradio"] { width: 100%; justify-content: flex-start; }

    .jhs-select-control { position:relative; display:inline-flex; min-width:140px; max-width:100%; }
    .jhs-select-source-native { display:none!important; }
    .jhs-select-trigger { width:100%; justify-content:space-between; }
    .jhs-select-trigger::after { content:"▾"; margin-left:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:11px; }
    .jhs-select-control.is-open .jhs-select-trigger::after { content:"▴"; }
    .jhs-select-menu { left:0; right:auto; min-width:100%; max-height:320px; overflow-y:auto; }
    .jhs-select-group { display:grid; gap:var(--jhs-space-1); }
    .jhs-select-group__label { padding:var(--jhs-space-1) var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); font-weight:600; }
    .jhs-select-option[aria-checked="true"] { background:var(--jhs-accent-tint); color:var(--jhs-accent); }

    .jhs-task-emphasis { color:var(--jhs-status-filter-text); }
    .jhs-code-viewer { height:100%; overflow:auto; padding:15px 5px; background:var(--jhs-code-bg); color:var(--jhs-code-text); font-family:Consolas,Monaco,monospace; white-space:pre-wrap; }
    .jhs-code-line-number { color:var(--jhs-code-line); }
    .jhs-count-table__cell { padding:3px; border:1px solid var(--jhs-border); }
    .jhs-count-table__head { padding:3px; border:1px solid var(--jhs-border); font-weight:700; }
    .jhs-play-overlay { position:absolute; inset:50% auto auto 50%; transform:translate(-50%,-50%); color:#fff; font-size:40px; text-shadow:0 0 10px rgba(0,0,0,.5); }
    .jhs-image-preview { max-width:100%; max-height:300px; border-radius:var(--jhs-radius-xs); box-shadow:var(--jhs-shadow-xs); }

    .jhs-badge, .jhs-chip, .card-tag, .card-new-count-tag, .magnet-score {
        box-sizing: border-box;
        display: inline-flex;
        min-height: 24px;
        align-items: center;
        justify-content: center;
        gap: var(--jhs-space-1);
        padding: 2px var(--jhs-space-2);
        border: 1px solid transparent;
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-surface-2);
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-xs);
        font-weight: 600;
        line-height: 1.2;
        white-space: nowrap;
    }
    .jhs-badge--accent, .card-new-count-tag {
        background: var(--jhs-accent-tint);
        color: var(--jhs-accent);
    }
    .jhs-badge--danger, .card-tag {
        background: var(--jhs-status-filter-tint);
        color: var(--jhs-status-filter-text);
    }
    .jhs-badge--success {
        background: var(--jhs-status-down-tint);
        color: var(--jhs-status-down-text);
    }
    .jhs-badge--neutral { border-color: var(--jhs-border); background: var(--jhs-surface-2); color: var(--jhs-text-muted); }
    .jhs-badge--filter { background: var(--jhs-status-filter-tint); color: var(--jhs-status-filter-text); }
    .jhs-badge--fav { background: var(--jhs-status-fav-tint); color: var(--jhs-status-fav-text); }
    .jhs-badge--down { background: var(--jhs-status-down-tint); color: var(--jhs-status-down-text); }
    .jhs-badge--watch { background: var(--jhs-status-watch-tint); color: var(--jhs-status-watch-text); }

    .jhs-pagination, #actress-pagination, #nv-pagination-bar {
        display: flex;
        align-items: center;
        justify-content: center;
        gap: var(--jhs-space-1);
        flex-wrap: wrap;
        padding-top: var(--jhs-space-3);
        border-top: 1px solid var(--jhs-border);
    }
    :where(.jhs-pagination, #actress-pagination, #nv-pagination-bar) .pagination-btn {
        min-width: var(--jhs-control-height-sm);
        min-height: var(--jhs-control-height-sm);
        padding-inline: var(--jhs-space-2);
    }
    :where(.jhs-pagination, #actress-pagination, #nv-pagination-bar) .pagination-btn.active,
    :where(.jhs-pagination, #actress-pagination, #nv-pagination-bar) .pagination-btn[aria-current="page"] {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
        color: var(--jhs-accent-text-on);
    }

    .jhs-state, .magnet-loading, .magnet-error {
        box-sizing: border-box;
        display: grid;
        min-height: 120px;
        place-items: center;
        gap: var(--jhs-space-2);
        padding: var(--jhs-space-5);
        border: 1px dashed var(--jhs-border-strong);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface-2);
        color: var(--jhs-text-muted);
        text-align: center;
    }
    .jhs-state--error, .magnet-error {
        border-color: var(--jhs-status-filter-text);
        background: var(--jhs-status-filter-tint);
        color: var(--jhs-status-filter-text);
    }
    .jhs-is-hidden { display: none !important; }
    .jhs-dialog-title { padding: 0 var(--jhs-space-2); }
    .jhs-pagination__summary { margin-left: var(--jhs-space-3); color: var(--jhs-text-muted); font-size: var(--jhs-font-size-sm); }
    .jhs-skeleton {
        overflow: hidden;
        border-radius: var(--jhs-radius-xs);
        background: var(--jhs-surface-2);
    }
    @media (prefers-reduced-motion: no-preference) {
        .jhs-skeleton {
            background: linear-gradient(90deg, var(--jhs-surface-2) 25%, var(--jhs-border) 50%, var(--jhs-surface-2) 75%);
            background-size: 200% 100%;
            animation: jhs-skeleton-shimmer 1.4s ease-in-out infinite;
        }
        @keyframes jhs-skeleton-shimmer {
            to { background-position-x: -200%; }
        }
    }

    .layui-layer {
        overflow: hidden;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-lg) !important;
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-lg) !important;
    }
    .layui-layer-title {
        min-height: 48px;
        padding: 0 52px 0 var(--jhs-space-4);
        border-bottom: 1px solid var(--jhs-border);
        background: var(--jhs-surface);
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-lg);
        font-weight: 700;
        line-height: 48px;
    }
    .layui-layer-btn {
        display: flex;
        justify-content: flex-end;
        gap: var(--jhs-space-2);
        padding: var(--jhs-space-3) var(--jhs-space-4) !important;
        border-top: 1px solid var(--jhs-border);
        background: var(--jhs-surface);
    }
    .layui-layer-btn a {
        min-height: var(--jhs-control-height);
        margin: 0 !important;
        padding: 0 var(--jhs-space-3) !important;
        border: 1px solid var(--jhs-border-strong) !important;
        border-radius: var(--jhs-radius-sm) !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
        line-height: var(--jhs-control-height) !important;
    }
    .layui-layer-btn .layui-layer-btn0 {
        border-color: var(--jhs-accent) !important;
        background: var(--jhs-accent) !important;
        color: var(--jhs-accent-text-on) !important;
    }

    .tabulator {
        overflow: hidden;
        border: 1px solid var(--jhs-border) !important;
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
        font-family: var(--jhs-font);
        font-size: var(--jhs-font-size-sm);
    }
    .tabulator .tabulator-header,
    .tabulator .tabulator-header .tabulator-col {
        min-height: 40px;
        border-color: var(--jhs-border) !important;
        background: var(--jhs-surface-2) !important;
        color: var(--jhs-text) !important;
    }
    .tabulator .tabulator-row {
        min-height: 44px;
        border-color: var(--jhs-border) !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
    }
    .tabulator .tabulator-row:hover {
        background: var(--jhs-surface-2) !important;
    }
    .tabulator .tabulator-cell {
        display: inline-flex;
        min-height: 44px;
        align-items: center;
        border-right: 0 !important;
        color: var(--jhs-text) !important;
    }
    .tabulator .tabulator-row { border-bottom: 1px solid var(--jhs-border) !important; }
    .tabulator .tabulator-header .tabulator-col { border-right-color: color-mix(in srgb, var(--jhs-border) 55%, transparent) !important; }
    .tabulator .tabulator-footer {
        border-color: var(--jhs-border) !important;
        background: var(--jhs-surface-2) !important;
        color: var(--jhs-text) !important;
    }

    /* 新作品列表卡保留轻边框，结构布局由插件自身样式负责。 */
    .nv-card {
        border: 1px solid var(--jhs-border) !important;
        border-radius: var(--jhs-radius-md) !important;
        background: var(--jhs-surface) !important;
        box-shadow: none !important;
        transform: none !important;
        transition: border-color var(--jhs-motion-fast) var(--jhs-ease) !important;
    }
    .nv-card:hover {
        border-color: var(--jhs-accent) !important;
        box-shadow: none !important;
        transform: none !important;
    }
    /* 磁力搜索：分段控件、紧凑结果行和明确反馈状态。 */
    .magnet-container {
        width: 100%;
        margin: var(--jhs-space-3) auto !important;
        color: var(--jhs-text);
        font-family: var(--jhs-font) !important;
    }
    .magnet-tabs {
        display: flex;
        align-items: center;
        justify-content: space-between !important;
        gap: var(--jhs-space-3);
        margin-bottom: var(--jhs-space-3) !important;
        padding: 0 !important;
        border-bottom: 0 !important;
    }
    .magnet-tabs > div {
        display: inline-flex !important;
        gap: var(--jhs-space-1);
        padding: var(--jhs-space-1);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface-2);
    }
    .magnet-tab {
        min-height: var(--jhs-control-height-sm);
        margin: 0 !important;
        padding: 0 var(--jhs-space-3) !important;
        border: 0 !important;
        border-radius: var(--jhs-radius-xs) !important;
        background: transparent !important;
        color: var(--jhs-text-muted);
        line-height: var(--jhs-control-height-sm);
    }
    .magnet-tab.active {
        margin: 0 !important;
        border: 0 !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-xs);
    }
    .magnet-results {
        min-height: 200px;
        overflow: hidden;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        background: var(--jhs-surface);
    }
    .magnet-result {
        min-height: 68px;
        padding: var(--jhs-space-3) 190px var(--jhs-space-3) var(--jhs-space-4) !important;
        border-bottom: 1px solid var(--jhs-border) !important;
        background: var(--jhs-surface);
    }
    .magnet-result:last-child {
        border-bottom: 0 !important;
    }
    .magnet-result:hover {
        background: var(--jhs-surface-2) !important;
    }
    .magnet-title {
        margin-bottom: var(--jhs-space-1) !important;
        padding-right: 0 !important;
        font-weight: 600 !important;
    }
    .magnet-title a {
        display: inline-block;
        max-width: calc(100% - 52px);
        overflow: hidden;
        text-overflow: ellipsis;
        vertical-align: bottom;
        white-space: nowrap;
    }
    .magnet-score { margin-right: var(--jhs-space-1); font-size: var(--jhs-font-size-sm); cursor: help; }
    .magnet-info {
        justify-content: flex-start !important;
        gap: var(--jhs-space-4);
        margin: 0 !important;
        color: var(--jhs-text-muted) !important;
    }
    .magnet-copy {
        top: 50% !important;
        right: var(--jhs-space-3) !important;
        display: flex;
        flex: 0 0 auto;
        flex-wrap: nowrap;
        gap: var(--jhs-space-2);
        transform: translateY(-50%);
    }
    .magnet-hub-btn {
        flex: 0 0 auto;
        min-height: var(--jhs-control-height-sm) !important;
        margin: 0 !important;
        padding: 0 var(--jhs-space-2) !important;
        border-radius: var(--jhs-radius-sm) !important;
        font-size: var(--jhs-font-size-xs) !important;
        white-space: nowrap;
    }
    .magnet-hub-btn.copied {
        border-color: transparent !important;
        background: var(--jhs-status-down-tint) !important;
        color: var(--jhs-status-down-text) !important;
    }

    @media (max-width: 768px) {
        :is(.jhs-btn, .jhs-filter-btn, .site-btn, .magnet-hub-btn, .pagination-btn, .jhs-icon-btn, .card-btn) {
            min-height: var(--jhs-touch-target);
        }
        :where(.jhs-icon-btn, .card-btn) {
            width: var(--jhs-touch-target);
            min-width: var(--jhs-touch-target);
            height: var(--jhs-touch-target);
        }
        .jhs-setting-row {
            grid-template-columns: 1fr;
            gap: var(--jhs-space-2);
            padding: var(--jhs-space-3);
        }
        .jhs-setting-row__control, .form-content {
            justify-content: stretch;
        }
        :where(.jhs-setting-row__control, .form-content) > :where(input, select, textarea, button, a) {
            width: 100%;
            max-width: none;
        }
        .jhs-toolbar--between {
            align-items: stretch;
            flex-direction: column;
        }
        .magnet-tabs {
            align-items: stretch;
            flex-direction: column;
        }
        .magnet-tabs > div {
            max-width: 100%;
            overflow-x: auto;
        }
        .magnet-result {
            padding-right: var(--jhs-space-4) !important;
        }
        .magnet-copy {
            position: static !important;
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            margin-top: var(--jhs-space-2);
            transform: none;
        }
        .magnet-copy .magnet-hub-btn { width: 100%; min-height: var(--jhs-touch-target) !important; }
        .jhs-segmented {
            max-width: 100%;
            overflow-x: auto;
        }
    }

        /* migrated template layout utilities */

        .jhs-layout-06cf30c0 { margin-top:15px;display:flex;justify-content:center;gap:10px; }



        .jhs-layout-186f17ef { padding:18px 18px !important; }


        .jhs-layout-1b3790ef { display:flex;margin-bottom:10px; }

        .jhs-layout-1e90930a { display:flex;gap:10px;flex-wrap:wrap; }



        .jhs-layout-2100e73d { margin-left:20px; }

        .jhs-layout-21a4fe43 { margin-left:0 }

        .jhs-layout-2335597e { padding:18px 18px !important;margin-left:50px }

        .jhs-layout-27f87d75 { display:block;margin-bottom:5px; }


        .jhs-layout-294497f1 { top:-15px }

        .jhs-layout-2afc43dc { min-width:120px; }

        .jhs-layout-2e003268 { margin-bottom:5px }

        .jhs-layout-31a824a2 { display:flex;gap:5px }



        .jhs-layout-3536a853 { margin-top:30px;cursor:auto }




        .jhs-layout-3b6a3a65 { cursor:pointer }

        .jhs-layout-3f0d74e1 { min-width:120px; }

        .jhs-layout-3fed2a7e { margin-left:5px; }

        .jhs-layout-3fefafab { overflow-y:auto;height:calc(100% - 40px); }

        .jhs-layout-44293084 { width:120px;text-align:center;padding:8px 0; }



        .jhs-layout-481ed7e7 { padding:10px; }

        .jhs-layout-53809f1e { display:flex;gap:5px; }

        .jhs-layout-583c2485 { height:100%;padding-bottom:20px }

        .jhs-layout-598afa5a { margin-bottom:25px; }


        .jhs-layout-5c319329 { min-width:120px; }


        .jhs-layout-5f3e3549 { width:140px;text-align:center;padding:8px 0; }



        

        .jhs-layout-66253c00 { margin-top:8px;display:none }


        .jhs-layout-6b99de8b { display:none }


        .jhs-layout-6d489fc7 { margin:0 0.75rem }

        .jhs-layout-701bf0f9 { margin-bottom:0!important; }


        .jhs-layout-761d3add { margin-bottom:10px }

        .jhs-layout-769fed37 { padding:20px }

        .jhs-layout-78fa54ea { margin-left:10px }

        .jhs-layout-7cb3f981 { padding:10px 20px;height:100%;overflow:hidden; }

        .jhs-layout-7daea5fa { margin-bottom:5px; }

        .jhs-layout-81eaab28 { height:calc(100% - 50px);overflow-x:hidden; }

        .jhs-layout-8453d189 { display:flex;align-items:center;flex-grow:1;justify-content:flex-end; }



        .jhs-layout-8896c95d { margin-right:5px }

        .jhs-layout-8cddc29a { padding:20px; }

        .jhs-layout-8cf76fd7 { width:150px;height:auto; }




        .jhs-layout-9813a0dd { margin-left:5px }

        .jhs-layout-9db87399 { margin-top:50px;cursor:auto }

        .jhs-layout-9e3c853e { margin-bottom:15px; }

        .jhs-layout-9ea2322d { margin:20px auto }

        .jhs-layout-9fe45cd8 { width:120px; }

        .jhs-layout-a38a0e50 { max-height:100%;max-width:100%;object-fit:contain }




        .jhs-layout-b12542a5 { width:100% }

        .jhs-layout-b5c4e4f7 { overflow:hidden;height:110px;text-align:center; }

        .jhs-layout-ba4750c8 { margin:30px 0 }

        .jhs-layout-bd59a2e1 { text-align:center;margin-bottom:15px; }

        .jhs-layout-c0d4a511 { margin-top:5px; }

        .jhs-layout-c4eb15bf { width:100%;padding:12px;\n cursor:pointer;\n  }


        .jhs-layout-cad980f4 { width:100%; }

        .jhs-layout-cd9d5db1 { overflow:hidden;max-height:215px;text-align:center; }

        .jhs-layout-d10a577d { margin-bottom:20px;text-align:center;display:none; }

        .jhs-layout-d2c171b1 { margin-top:10px }

        .jhs-layout-d44e70c7 { height:calc(100% - 50px); }

        .jhs-layout-d4a09a0d { width:200px; }

        .jhs-layout-d4a575e8 { height:inherit;width:100%; }

        .jhs-layout-d50e4f09 { margin-top:15px;display:none; }

        .jhs-layout-d543acf8 { display:flex;justify-content:center;align-items:center;position:absolute;top:0;left:0;height:100%;width:100%;z-index:var(--jhs-z-content);overflow:hidden }




        .jhs-layout-d9caa2c0 { display:flex;align-items:center;gap:5px; }

        .jhs-layout-da303dcf { margin-bottom:15px; }

        .jhs-layout-da5a4919 { display:flex;justify-content:space-between; }

        .jhs-layout-dd5a75f6 { width:300px; }

        .jhs-layout-e2965a97 { margin:10px auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:20px; }

        .jhs-layout-e32cff7f { padding:30px; }

        .jhs-layout-e5d57abb { overflow:hidden;max-height:150px;max-width:150px;text-align:center; }






        .jhs-layout-f43f0d6d { width:160px;text-align:center;padding:8px 0; }

        .jhs-layout-f4e719ae { margin:10px 0 }

        .jhs-layout-f5f47b30 { margin-left:100px;width:400px; }

    @media (prefers-reduced-motion: reduce) {
        :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) *,
        :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) *::before,
        :where(.jhs-ui, .layui-layer-content, .menu-box, .jhs-fab-menu) *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
        }
    }
</style>`;
}

/** 为动态注入的 JHS 控件补齐可访问名称与图标按钮语义。 */
function initializeUiAccessibility() {
    const selector = "button.jhs-btn, a.jhs-btn[role='button'], .card-btn, .jhs-icon-btn, [class*='jhs-'] button, [class*='jhs-'] a[role='button']";
    const enhance = (e) => {
        const t = e.nodeType === Node.ELEMENT_NODE && e.matches?.(selector) ? [ e ] : [];
        const n = e.querySelectorAll ? [ ...e.querySelectorAll(selector) ] : [];
        [ ...t, ...n ].forEach((e => {
            if (e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby") || e.textContent.trim()) return;
            const t = e.getAttribute("title") || e.getAttribute("data-tip");
            t && e.setAttribute("aria-label", t);
        }));
    };
    enhance(document);
    const pending = new Set;
    let scheduled = !1;
    const flush = () => {
        scheduled = !1;
        const all = [ ...pending ], roots = all.filter((e => !all.some((t => t !== e && t.contains?.(e)))));
        pending.clear(), roots.forEach(enhance);
    };
    new MutationObserver((records => {
        records.forEach((record => record.addedNodes.forEach((node => {
            node.nodeType === Node.ELEMENT_NODE && pending.add(node);
        }))));
        pending.size && !scheduled && (scheduled = !0, queueMicrotask(flush));
    })).observe(document.documentElement, {
        childList: true,
        subtree: true
    });
}

/** 以隐藏原生 select 为值源的统一 JHS 选择器。 */
class JhsSelect {
    static instances = new WeakMap;
    constructor(select) {
        this.source = $(select);
        if (!this.source.length || JhsSelect.instances.has(this.source[0])) return JhsSelect.instances.get(this.source[0]);
        const initiallyHidden = this.source.hasClass("jhs-is-hidden") || "none" === this.source[0].style.display;
        this.control = $('<div class="jhs-select-control"></div>');
        this.trigger = $('<button type="button" class="jhs-btn jhs-btn--secondary jhs-select-trigger" aria-haspopup="menu" aria-expanded="false"><span class="jhs-select-value"></span></button>');
        this.menu = $('<div class="jhs-popover jhs-select-menu" role="menu"></div>');
        this.source.wrap(this.control), this.control = this.source.parent(), this.control.append(this.trigger, this.menu),
        this.source.addClass("jhs-select-source-native").attr({ "aria-hidden": "true", tabindex: "-1" }), initiallyHidden && this.control.addClass("jhs-is-hidden"),
        JhsSelect.instances.set(this.source[0], this), this.render(), this.bind(), this.refresh();
    }
    static enhance(root = document) {
        const scope = $(root), selects = scope.is("select.jhs-select-source") ? scope : scope.find("select.jhs-select-source");
        selects.each(((_, select) => new JhsSelect(select)));
        return selects;
    }
    static get(select) {
        const element = $(select)[0];
        return element ? JhsSelect.instances.get(element) || new JhsSelect(element) : null;
    }
    static setValue(select, value, emit = !1) {
        const instance = JhsSelect.get(select);
        if (!instance) return;
        instance.source.val(value), instance.refresh(), emit && instance.source.trigger("change");
    }
    static refresh(select) {
        JhsSelect.get(select)?.refresh();
    }
    static refreshAll(root = document) {
        JhsSelect.enhance(root), $(root).find("select.jhs-select-source").each(((_, select) => JhsSelect.refresh(select)));
    }
    static setVisible(select, visible) {
        const instance = JhsSelect.get(select);
        instance?.control.toggleClass("jhs-is-hidden", !visible);
    }
    static closeAll(except = null) {
        $(".jhs-select-control.is-open").each(((_, control) => {
            const source = $(control).children("select.jhs-select-source")[0], instance = source && JhsSelect.instances.get(source);
            instance && instance !== except && instance.close();
        }));
    }
    render() {
        this.menu.empty();
        const appendOption = (option, target) => {
            const button = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-select-option" role="menuitemradio" tabindex="-1"></button>');
            button.attr({ "data-value": option.value, "aria-checked": option.selected ? "true" : "false" }).prop("disabled", option.disabled).text(option.text), target.append(button);
        };
        this.source.children().each(((_, child) => {
            if ("OPTGROUP" === child.tagName) {
                const group = $('<div class="jhs-select-group" role="group"></div>').attr("aria-label", child.label), label = $('<div class="jhs-select-group__label"></div>').text(child.label);
                group.append(label), $(child).children("option").each(((_, option) => appendOption(option, group))), this.menu.append(group);
            } else "OPTION" === child.tagName && appendOption(child, this.menu);
        }));
    }
    bind() {
        this.trigger.on("click", (event => {
            event.preventDefault(), event.stopPropagation(), this.source.prop("disabled") || (this.control.hasClass("is-open") ? this.close() : this.open());
        })).on("keydown", (event => {
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault(), this.open("ArrowUp" === event.key || "End" === event.key ? "last" : "selected");
        }));
        this.menu.on("click", ".jhs-select-option", (event => {
            event.preventDefault(), this.choose($(event.currentTarget));
        })).on("keydown", ".jhs-select-option", (event => {
            const items = this.options(), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), this.close(!0);
            if ("Tab" === event.key) return void this.close();
            if ([ "Enter", " " ].includes(event.key)) return event.preventDefault(), this.choose($(event.currentTarget));
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        }));
        this.source.on("change.jhsSelect", (() => this.refresh())), $(document).on("click.jhsSelect", (event => {
            $(event.target).closest(this.control).length || this.close();
        }));
    }
    options() {
        return this.menu.find(".jhs-select-option:not(:disabled)");
    }
    open(focus = "selected") {
        JhsSelect.closeAll(this), this.control.addClass("is-open"), this.menu.addClass("is-open"), this.trigger.attr("aria-expanded", "true");
        const items = this.options(), selected = items.filter('[aria-checked="true"]');
        ("last" === focus ? items.last() : selected.length ? selected.first() : items.first()).trigger("focus");
    }
    close(focus = !1) {
        this.control.removeClass("is-open"), this.menu.removeClass("is-open"), this.trigger.attr("aria-expanded", "false"), focus && this.trigger.trigger("focus");
    }
    choose(item) {
        if (item.prop("disabled")) return;
        this.source.val(item.attr("data-value")).trigger("change"), this.close(!0);
    }
    refresh() {
        const selected = this.source.find("option:selected").first(), value = this.source.val();
        this.trigger.find(".jhs-select-value").text(selected.text()), this.trigger.prop("disabled", this.source.prop("disabled")),
        this.menu.find(".jhs-select-option").attr("aria-checked", "false").filter(((_, item) => $(item).attr("data-value") === String(value ?? ""))).attr("aria-checked", "true");
    }
}
