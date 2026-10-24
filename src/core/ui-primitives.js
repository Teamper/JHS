// @ts-check
import { OwnedPopover } from "./owned-popover.js";
import { buildUiGeometryCss } from "./ui-geometry.js";

import { buildFeedbackCss } from "./feedback-styles.js";
import { getIcon } from "./icons.js";
import { buildControlStatesCss } from "./control-states.js";

const fieldSelector = `:is(.jhs-field, .jhs-input, .jhs-select, .jhs-textarea, .jhs-select-trigger,
    :where(.jhs-ui, .jhs-dialog .layui-layer-content) input:not([type="checkbox"], [type="radio"], [type="range"], [type="hidden"], [type="button"], [type="submit"], [type="reset"], [type="image"], [type="color"], [type="file"]),
    :where(.jhs-ui, .jhs-dialog .layui-layer-content) select,
    :where(.jhs-ui, .jhs-dialog .layui-layer-content) textarea)`;

/** JHS 原生 UI 组件基座：现代桌面工具风格，不依赖宿主站点或第三方框架。 */
export function buildUiPrimitivesCss() {
    return `
<style id="jhs-ui-primitives">
    :where(.jhs-ui, .jhs-dialog .layui-layer-content, .menu-box, .jhs-fab-menu) {
        color: var(--jhs-text);
        font-family: var(--jhs-font);
        font-size: var(--jhs-font-size-md);
        font-weight: var(--jhs-font-weight-normal);
        line-height:var(--jhs-line-height-ui);
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
        font-size: var(--jhs-font-size-md);
        font-weight:var(--jhs-font-weight-semibold);
        line-height:var(--jhs-line-height-tight);
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
        box-shadow:inset 0 0 0 1px currentColor;
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
    .jhs-btn--dark {
        border-color: var(--jhs-border-strong);
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
    }
    .jhs-btn--dark:hover {
        background: var(--jhs-surface-hover);
    }
    /* 图片查看器的离屏临时容器（showImageViewer 字符串入口） */
    .temporary-container {
        position: absolute;
        left: -9999px;
        top: 0;
        width: 1px;
        height: 1px;
        overflow: hidden;
        opacity: 0;
        pointer-events: none;
    }
    /* 识图结果等面板内通用块容器 */
    .jhs-layout-c8be1ccb { display: block; width: 100%; min-width: 0; }
    .jhs-btn--ghost:hover {
        border-color: transparent;
        background: var(--jhs-surface-2);
        color: var(--jhs-text);
    }

    .jhs-video-player {
        display: block;
        width: 100%;
        height: 100%;
        background: var(--jhs-media-bg);
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
    body:has(.fancybox-content #video-bottom-toolbar) #jhs-fab { visibility:hidden; }
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
        width: var(--jhs-icon-md);
        height: var(--jhs-icon-md);
    }

    ${fieldSelector} {
        box-sizing: border-box;
        min-height: var(--jhs-control-height);
        padding: var(--jhs-space-2) var(--jhs-space-3);
        border: 1px solid var(--jhs-border-strong);
        border-radius: var(--jhs-radius-sm);
        background: var(--jhs-input-bg);
        color: var(--jhs-text);
        font: inherit;
        font-size: var(--jhs-font-size-md);
        line-height: var(--jhs-line-height-ui);
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease),
                    border-color var(--jhs-motion-fast) var(--jhs-ease),
                    box-shadow var(--jhs-motion-fast) var(--jhs-ease);
    }
    ${fieldSelector}:hover:not(:disabled):not([aria-disabled="true"]):not(:focus-visible):not([aria-invalid="true"]) {
        border-color: var(--jhs-text-muted);
        background: var(--jhs-input-bg);
        color: var(--jhs-text);
    }
    ${fieldSelector}:focus-visible:not(:disabled):not([aria-disabled="true"]) {
        border-color: var(--jhs-accent);
        outline: 2px solid var(--jhs-accent);
        outline-offset: 2px;
        box-shadow: none;
    }
    ${fieldSelector}[aria-invalid="true"] { border-color:var(--jhs-danger); }
    ${fieldSelector}:is(:disabled, [aria-disabled="true"]) {
        border-color: var(--jhs-border);
        background: var(--jhs-surface-2);
        color: var(--jhs-text-disabled);
        cursor: not-allowed;
        opacity: 1;
        outline: none;
        box-shadow: none;
    }
    :where(.jhs-textarea, .jhs-ui textarea, .jhs-dialog .layui-layer-content textarea) {
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
        border: 1px solid var(--jhs-border-strong);
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
        background: var(--jhs-border-strong);
        box-shadow: var(--jhs-shadow-xs);
        content: "";
        transition: transform var(--jhs-motion-fast) var(--jhs-ease);
    }
    :where(.jhs-switch, .mini-switch):checked {
        border-color: var(--jhs-accent);
        background: var(--jhs-accent);
    }
    :where(.jhs-switch, .mini-switch):checked::before {
        background: var(--jhs-accent-text-on);
        transform: translateX(18px);
    }
    :is(.jhs-switch, .mini-switch):hover:not(:checked):not(:disabled):not([aria-disabled="true"]):not(:focus-visible) {
        border-color: var(--jhs-text-muted);
    }
    :is(.jhs-switch, .mini-switch):hover:checked:not(:disabled):not([aria-disabled="true"]) {
        border-color: var(--jhs-accent-hover);
        background: var(--jhs-accent-hover);
    }
    :is(.jhs-switch, .mini-switch):focus-visible:not(:disabled):not([aria-disabled="true"]) {
        border-color: var(--jhs-accent);
        outline: 2px solid var(--jhs-accent);
        outline-offset: 2px;
        box-shadow: none;
    }
    :is(.jhs-switch, .mini-switch):is(:disabled, [aria-disabled="true"]) {
        border-color: var(--jhs-border);
        background: var(--jhs-disabled-bg);
        cursor: not-allowed;
        outline: none;
        box-shadow: none;
    }
    :is(.jhs-switch, .mini-switch):is(:disabled, [aria-disabled="true"])::before {
        background: var(--jhs-disabled-text);
    }

    :where(.jhs-range, .jhs-ui input[type="range"], .jhs-dialog .layui-layer-content input[type="range"]) {
        appearance: none;
        width: 100%;
        height: 22px;
        margin: 0;
        padding: 0;
        border: 0;
        background: transparent;
        cursor: pointer;
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .jhs-dialog .layui-layer-content input[type="range"])::-webkit-slider-runnable-track {
        height: 4px;
        border-radius: var(--jhs-radius-pill);
        background: var(--jhs-border-strong);
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .jhs-dialog .layui-layer-content input[type="range"])::-webkit-slider-thumb {
        box-sizing: border-box;
        appearance: none;
        width: 18px;
        height: 18px;
        margin-top: -7px;
        border: 2px solid var(--jhs-surface);
        border-radius: 50%;
        background: var(--jhs-accent);
        box-shadow: 0 0 0 1px var(--jhs-accent), var(--jhs-shadow-xs);
    }
    :where(.jhs-range, .jhs-ui input[type="range"], .jhs-dialog .layui-layer-content input[type="range"]):disabled {
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
        font-weight:var(--jhs-font-weight-semibold);
        line-height:var(--jhs-line-height-tight);
    }
    .jhs-section__description, .jhs-helper-text {
        margin: 0;
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-sm);
        line-height:var(--jhs-line-height-ui);
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
        font-size: var(--jhs-font-size-md);
        font-weight:var(--jhs-font-weight-normal);
        line-height:var(--jhs-line-height-ui);
    }
    .jhs-setting-row__description {
        display: block;
        margin-top: var(--jhs-space-1);
        color: var(--jhs-text-muted);
        font-size: var(--jhs-font-size-sm);
        font-weight:var(--jhs-font-weight-normal);
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
        font-weight:var(--jhs-font-weight-semibold);
        line-height:var(--jhs-line-height-tight);
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
    .jhs-select-trigger > .jhs-icon { width:var(--jhs-icon-sm); height:var(--jhs-icon-sm); color:var(--jhs-text-muted); transition:transform var(--jhs-motion-fast) var(--jhs-ease); }
    .jhs-select-control.is-open .jhs-select-trigger > .jhs-icon { transform:rotate(180deg); }
    .jhs-select-menu { left:0; right:auto; min-width:100%; max-height:320px; overflow-y:auto; }
    .jhs-select-group { display:grid; gap:var(--jhs-space-1); }
    .jhs-select-group__label { padding:var(--jhs-space-1) var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-select-option[aria-checked="true"] { background:var(--jhs-accent-tint); color:var(--jhs-accent); }

    .jhs-task-emphasis { color:var(--jhs-status-filter-text); }
    .jhs-code-viewer { height:100%; overflow:auto; padding:var(--jhs-space-4) var(--jhs-space-1); background:var(--jhs-code-bg); color:var(--jhs-code-text); font-family:var(--jhs-font-mono); white-space:pre-wrap; }
    .jhs-code-line-number { color:var(--jhs-code-line); }
    .jhs-count-table__cell { padding:var(--jhs-space-1); border:1px solid var(--jhs-border); }
    .jhs-count-table__head { padding:var(--jhs-space-1); border:1px solid var(--jhs-border); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-play-overlay { position:absolute; inset:50% auto auto 50%; transform:translate(-50%,-50%); color:var(--jhs-overlay-icon); font-size:var(--jhs-icon-hero); text-shadow:var(--jhs-media-shadow); }
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
        font-weight:var(--jhs-font-weight-semibold);
        line-height:var(--jhs-line-height-tight);
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
    .jhs-state__content { display:grid; gap:var(--jhs-space-1); justify-items:center; }
    .jhs-state__title { margin:0; color:inherit; font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-state__description { margin:0; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
    .jhs-panel-state { padding:var(--jhs-space-4) 0; color:var(--jhs-text-muted); text-align:center; }
    .jhs-task-status { padding:var(--jhs-space-2) var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
    .jhs-task-status__name { color:var(--jhs-text); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-task-status__meta { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
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
        display: flex;
        flex-direction: column;
        overflow: hidden;
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-lg) !important;
        background: var(--jhs-surface);
        color: var(--jhs-text);
        box-shadow: var(--jhs-shadow-lg) !important;
    }
    /* 内容区占满标题/按钮栏以下的剩余空间，配合表格 height:100% 让尾行与分页条始终可达；
       auto 高度的 layer（消息/确认框）中 flex 退化为自然高度，不受影响 */
    .jhs-dialog .layui-layer-content {
        flex: 1 1 auto;
        min-height: 0;
        box-sizing: border-box;
    }
    /* 表格类弹窗（黑名单/历史/备份）的通用全高布局，配合 Tabulator height:100% 让尾行与分页条始终可达 */
    .jhs-table-dialog {
        display: flex;
        flex-direction: column;
        height: 100%;
        min-height: 0;
        padding: var(--jhs-space-3) var(--jhs-space-4);
    }
    .jhs-table-dialog .jhs-table-dialog__content,
    .jhs-table-dialog #table-container {
        flex: 1;
        min-height: 0;
    }
    .jhs-dialog .layui-layer-title {
        display: flex;
        align-items: center;
        min-height: 48px;
        box-sizing: border-box;
        padding: 0 52px 0 var(--jhs-space-4);
        border-bottom: 1px solid var(--jhs-border);
        background: var(--jhs-surface);
        color: var(--jhs-text);
        font-size: var(--jhs-font-size-lg);
        font-weight:var(--jhs-font-weight-semibold);
        line-height:var(--jhs-line-height-tight);
    }
    .jhs-dialog .layui-layer-btn {
        display: flex;
        justify-content: flex-end;
        gap: var(--jhs-space-2);
        padding: var(--jhs-space-3) var(--jhs-space-4) !important;
        border-top: 1px solid var(--jhs-border);
        background: var(--jhs-surface);
    }
    .jhs-dialog .layui-layer-btn a {
        display: inline-flex;
        align-items: center;
        justify-content: center;
        min-height: var(--jhs-control-height);
        margin: 0 !important;
        padding: 0 var(--jhs-space-3) !important;
        border: 1px solid var(--jhs-border-strong) !important;
        border-radius: var(--jhs-radius-sm) !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
        line-height: var(--jhs-line-height-tight) !important;
    }
    .jhs-dialog .layui-layer-btn .layui-layer-btn0 {
        border-color: var(--jhs-accent) !important;
        background: var(--jhs-accent) !important;
        color: var(--jhs-accent-text-on) !important;
    }
    .layui-layer.jhs-confirm-actions .layui-layer-btn .layui-layer-btn0 {
        border-color: var(--jhs-border-strong) !important;
        background: var(--jhs-surface) !important;
        color: var(--jhs-text) !important;
    }
    .layui-layer.jhs-confirm-actions .layui-layer-btn .layui-layer-btn1 {
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
    .tabulator .tabulator-tableholder .tabulator-placeholder .tabulator-placeholder-contents {
        color:var(--jhs-text-muted);
        font-size:var(--jhs-font-size-md);
        font-weight:var(--jhs-font-weight-normal);
        line-height:var(--jhs-line-height-ui);
    }
    .tabulator .tabulator-footer .tabulator-footer-contents,
    .tabulator .tabulator-footer .tabulator-paginator {
        display:flex;
        flex-wrap:wrap;
        align-items:center;
        gap:var(--jhs-space-1);
        min-width:0;
        white-space:normal;
    }
    .tabulator .tabulator-footer .tabulator-paginator { justify-content:flex-end; margin-left:auto; }
    .tabulator .tabulator-footer .tabulator-paginator label { color:var(--jhs-text-muted); font-weight:var(--jhs-font-weight-normal); }
    .tabulator .tabulator-footer .tabulator-pages { display:inline-flex; flex-wrap:wrap; gap:var(--jhs-space-1); margin:0; }
    .tabulator .tabulator-footer .tabulator-page { min-height:var(--jhs-control-height); min-width:var(--jhs-control-height); margin:0; padding:0 var(--jhs-space-1); border:1px solid var(--jhs-border-strong); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface); color:var(--jhs-text); font:inherit; cursor:pointer; }
    .tabulator .tabulator-footer .tabulator-page:disabled { color:var(--jhs-text-disabled); border-color:var(--jhs-border); background:var(--jhs-disabled-bg); cursor:not-allowed; }
    .tabulator .tabulator-footer .tabulator-page.active { color:var(--jhs-accent); border-color:var(--jhs-accent); background:var(--jhs-accent-tint); }
    @media (max-width:767px),(pointer:coarse) { .tabulator .tabulator-footer .tabulator-page { min-width:var(--jhs-touch-target); min-height:var(--jhs-touch-target); } }

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
        line-height: var(--jhs-line-height-tight);
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
        font-weight:var(--jhs-font-weight-semibold) !important;
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

    @media (max-width: 767px) {
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
            width: 100%;
            min-width: 0;
            max-width: 100%;
            box-sizing: border-box;
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

        .jhs-layout-06cf30c0 { margin-top:var(--jhs-space-4);display:flex;justify-content:center;gap:var(--jhs-space-2); }



        .jhs-layout-186f17ef { padding:var(--jhs-space-4) var(--jhs-space-4) !important; }


        .jhs-layout-1b3790ef { display:flex;margin-bottom:var(--jhs-space-2); }

        .jhs-layout-1e90930a { display:flex;gap:var(--jhs-space-2);flex-wrap:wrap; }



        .jhs-layout-2100e73d { margin-left:var(--jhs-space-5); }

        .jhs-layout-21a4fe43 { margin-left:0 }

        .jhs-layout-2335597e { padding:var(--jhs-space-4) var(--jhs-space-4) !important;margin-left:calc(var(--jhs-space-5) * 2) }

        .jhs-layout-27f87d75 { display:block;margin-bottom:var(--jhs-space-1); }


        .jhs-layout-294497f1 { top:-15px }


        .jhs-layout-2e003268 { margin-bottom:var(--jhs-space-1) }

        .jhs-layout-31a824a2 { display:flex;gap:var(--jhs-space-1) }



        .jhs-layout-3536a853 { margin-top:var(--jhs-space-6);cursor:auto }




        .jhs-layout-3b6a3a65 { cursor:pointer }


        .jhs-layout-3fed2a7e { margin-left:var(--jhs-space-1); }

        .jhs-layout-3fefafab { overflow-y:auto;height:calc(100% - 40px); }




        .jhs-layout-481ed7e7 { padding:var(--jhs-space-2); }

        .jhs-layout-53809f1e { display:flex;gap:var(--jhs-space-1); }

        .jhs-layout-583c2485 { height:100%;padding-bottom:var(--jhs-space-5) }

        .jhs-layout-598afa5a { margin-bottom:var(--jhs-space-5); }




        .jhs-layout-5f3e3549 { width:140px;text-align:center;padding:var(--jhs-space-2) 0; }





        .jhs-layout-66253c00 { margin-top:var(--jhs-space-2);display:none }


        .jhs-layout-6b99de8b { display:none }


        .jhs-layout-6d489fc7 { margin:0 0.75rem }

        .jhs-layout-701bf0f9 { margin-bottom:0!important; }


        .jhs-layout-761d3add { margin-bottom:var(--jhs-space-2) }

        .jhs-layout-769fed37 { padding:var(--jhs-space-5) }

        .jhs-layout-78fa54ea { margin-left:var(--jhs-space-2) }

        .jhs-layout-7cb3f981 { padding:var(--jhs-space-2) var(--jhs-space-5);height:100%;overflow:hidden; }

        .jhs-layout-7daea5fa { margin-bottom:var(--jhs-space-1); }

        .jhs-layout-81eaab28 { height:calc(100% - 50px);overflow-x:hidden; }

        .jhs-layout-8453d189 { display:flex;align-items:center;flex-grow:1;justify-content:flex-end; }



        .jhs-layout-8896c95d { margin-right:var(--jhs-space-1) }

        .jhs-layout-8cddc29a { padding:var(--jhs-space-5); }

        .jhs-layout-8cf76fd7 { width:150px;height:auto; }




        .jhs-layout-9813a0dd { margin-left:var(--jhs-space-1) }

        .jhs-layout-9db87399 { margin-top:calc(var(--jhs-space-5) * 2);cursor:auto }

        .jhs-layout-9e3c853e { margin-bottom:var(--jhs-space-4); }

        .jhs-layout-9ea2322d { margin:var(--jhs-space-5) auto }

        .jhs-layout-9fe45cd8 { width:120px; }

        .jhs-layout-a38a0e50 { max-height:100%;max-width:100%;object-fit:contain }




        .jhs-layout-b12542a5 { width:100% }

        .jhs-layout-b5c4e4f7 { overflow:hidden;height:110px;text-align:center; }

        .jhs-layout-ba4750c8 { margin:var(--jhs-space-6) 0 }

        .jhs-layout-bd59a2e1 { text-align:center;margin-bottom:var(--jhs-space-4); }

        .jhs-layout-c0d4a511 { margin-top:var(--jhs-space-1); }

        .jhs-layout-c4eb15bf { width:100%;padding:var(--jhs-space-3);\n cursor:pointer;\n  }


        .jhs-layout-cad980f4 { width:100%; }

        .jhs-layout-cd9d5db1 { overflow:hidden;max-height:215px;text-align:center; }

        .jhs-layout-d10a577d { margin-bottom:var(--jhs-space-5);text-align:center;display:none; }

        .jhs-layout-d2c171b1 { margin-top:var(--jhs-space-2) }

        .jhs-layout-d44e70c7 { height:calc(100% - 50px); }

        .jhs-layout-d4a09a0d { width:200px; }

        .jhs-layout-d4a575e8 { height:inherit;width:100%; }

        .jhs-layout-d50e4f09 { margin-top:var(--jhs-space-4);display:none; }

        .jhs-layout-d543acf8 { display:flex;justify-content:center;align-items:center;position:absolute;top:0;left:0;height:100%;width:100%;z-index:var(--jhs-z-content);overflow:hidden }




        .jhs-layout-d9caa2c0 { display:flex;align-items:center;gap:var(--jhs-space-1); }

        .jhs-layout-da303dcf { margin-bottom:var(--jhs-space-4); }

        .jhs-layout-da5a4919 { display:flex;justify-content:space-between; }

        .jhs-layout-dd5a75f6 { width:300px; }

        .jhs-layout-e2965a97 { margin:var(--jhs-space-2) auto;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:var(--jhs-space-5); }

        .jhs-layout-e32cff7f { padding:var(--jhs-space-6); }

        .jhs-layout-e5d57abb { overflow:hidden;max-height:150px;max-width:150px;text-align:center; }






        .jhs-layout-f43f0d6d { width:160px;text-align:center;padding:var(--jhs-space-2) 0; }

        .jhs-layout-f4e719ae { margin:var(--jhs-space-2) 0 }

        .jhs-layout-f5f47b30 { margin-left:calc(var(--jhs-space-5) * 4);width:400px; }

    @media (prefers-reduced-motion: reduce) {
        :where(.jhs-ui, .jhs-dialog .layui-layer-content, .menu-box, .jhs-fab-menu) *,
        :where(.jhs-ui, .jhs-dialog .layui-layer-content, .menu-box, .jhs-fab-menu) *::before,
        :where(.jhs-ui, .jhs-dialog .layui-layer-content, .menu-box, .jhs-fab-menu) *::after {
            scroll-behavior: auto !important;
            transition-duration: 0.01ms !important;
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
        }
    }
    .jhs-state-actions { container:jhs-state-actions / inline-size; width:100%; min-width:0; flex:1 1 344px; }
    .jhs-state-actions__buttons { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); }
    .jhs-state-actions .jhs-state-action { min-width:80px; width:auto; padding:0 var(--jhs-space-3); }
    .jhs-state-action[aria-pressed="true"] { border-color:currentColor; box-shadow:inset 0 0 0 1px currentColor; }
    .jhs-state-actions[data-jhs-state-count="2"] { width:auto; flex:0 1 auto; container-type:normal; }
    .jhs-fc2-toolbar > .jhs-state-actions { grid-column:1 / -1; flex-basis:100%; }
    @container jhs-state-actions (max-width:479px) {
        .jhs-state-actions[data-jhs-state-count="4"] .jhs-state-actions__buttons { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); }
    }
    .jhs-detail-btn-row { gap:var(--jhs-space-4); }
    :is(.jhs-detail-owned-slot,.jhs-review-panel,.jhs-related-panel) { background:var(--jhs-surface); color:var(--jhs-text); }
    .jhs-detail-btn-row > :not(.jhs-state-actions) { gap:var(--jhs-space-2); }
    .jhs-btn[aria-busy="true"] { cursor:progress; }
    .jhs-table .tabulator-cell .jhs-btn { min-height:var(--jhs-control-height-sm); font-size:var(--jhs-font-size-xs); padding:0 var(--jhs-space-2); }
    .jhs-dialog.layui-layer { display:flex; flex-direction:column; box-sizing:border-box; overflow:hidden; border-radius:var(--jhs-radius-lg); }
    .jhs-dialog > .layui-layer-title { flex:0 0 auto; padding-right:52px; }
    .jhs-dialog > .layui-layer-content { min-height:0; min-width:0; flex:1 1 auto; overflow:auto; }
    .jhs-dialog[data-jhs-dialog-body="table"] > .layui-layer-content { display:flex; flex-direction:column; overflow:hidden; }
    .jhs-dialog[data-jhs-dialog-body="media"] > .layui-layer-content { display:flex; flex-direction:column; overflow:hidden; }
    .jhs-dialog > .layui-layer-content > iframe { min-height:0; width:100%; max-width:100%; }
    .jhs-dialog > .layui-layer-btn { flex:0 0 auto; display:flex; flex-wrap:wrap; justify-content:flex-end; gap:var(--jhs-space-2); padding:var(--jhs-space-4); }
    .jhs-dialog > .layui-layer-btn > a { display:inline-flex; align-items:center; justify-content:center; box-sizing:border-box; min-height:var(--jhs-control-height); margin:0; padding:0 var(--jhs-space-3); border-radius:var(--jhs-radius-sm); font-size:var(--jhs-font-size-sm); }
    .jhs-dialog .layui-layer-setwin { top:0; right:0; }
    .jhs-dialog .layui-layer-setwin .layui-layer-close { display:block; width:44px; height:44px; margin:0; background-position:center; }
    :is(.jhs-ui,.jhs-dialog) label:not(.jhs-setting-row):has(> :is(input[type="checkbox"],.jhs-switch,.mini-switch)) { display:inline-flex; align-items:center; min-height:var(--jhs-control-height); gap:var(--jhs-space-2); }
    @media (max-width:767px), (pointer:coarse) {
        ${fieldSelector}:not(textarea),
        :is(.jhs-btn,.jhs-filter-btn,.jhs-select-trigger,.jhs-icon-btn,.card-btn), .jhs-table .tabulator-cell .jhs-btn,
        .jhs-dialog > .layui-layer-btn > a { min-height:var(--jhs-touch-target); }
        :is(.jhs-ui,.jhs-dialog) label:not(.jhs-setting-row):has(> :is(input[type="checkbox"],.jhs-switch,.mini-switch)) { min-height:var(--jhs-touch-target); }
        .jhs-dialog .layui-layer-close { width:44px!important; height:44px!important; }
        .jhs-dialog .layui-layer-close::before,.jhs-dialog .layui-layer-close::after { top:21px; left:13px; }
    }
    ${buildFeedbackCss()}
    ${buildUiGeometryCss()}
    ${buildControlStatesCss(fieldSelector)}
</style>`;
}

/**
 * 在现有容器内渲染安全的 loading、empty 或 error 状态。
 * @param {any} container
 * @param {{ type?: string, title?: string, description?: string, actionLabel?: string, onAction?: (() => unknown) | null }} [options]
 */
export function renderStateView(container, { type = "empty", title = "", description = "", actionLabel = "", onAction = null } = {}) {
    const root = container?.jquery ? container : $(container), state = $('<div class="jhs-state"></div>').addClass(`jhs-state--${type}`).attr("role", "error" === type ? "alert" : "status"), content = $('<div class="jhs-state__content"></div>');
    root.attr("aria-busy", String(type === "loading"));
    if (type === "loading" && !title) title = "加载中…";
    title && content.append($('<p class="jhs-state__title"></p>').text(title)), description && content.append($('<p class="jhs-state__description"></p>').text(description));
    if (actionLabel && "function" == typeof onAction) content.append($('<button type="button" class="jhs-btn jhs-btn--secondary"></button>').text(actionLabel).on("click", onAction));
    return state.append(content), root.empty().append(state), state;
}

/** 为动态注入的 JHS 控件补齐可访问名称与图标按钮语义。 */
/** @param {import("./lifecycle-scope.js").LifecycleScope} lifecycleScope */
export function initializeUiAccessibility(lifecycleScope) {
    if (!lifecycleScope || "function" != typeof lifecycleScope.observe) throw new TypeError("UI accessibility requires an app LifecycleScope");
    const selector = "button.jhs-btn, a.jhs-btn[role='button'], .card-btn, .jhs-icon-btn, [class*='jhs-'] button, [class*='jhs-'] a[role='button']";
    const enhance = (/** @type {any} */ e) => {
        const links = e.querySelectorAll ? [...e.querySelectorAll(".jhs-ui a[href]")] : [];
        if (e.nodeType === Node.ELEMENT_NODE && e.closest?.(".jhs-ui")) {
            if (e.matches?.("a[href]")) links.push(e);
            links.push(...e.querySelectorAll("a[href]"));
        }
        links.forEach(link => {
            if (!link.matches(".jhs-btn,.jhs-segmented__item,[role='button'],[role='tab'],.movie-box,.jhs-media-card") && !link.querySelector("img,svg")) link.classList.add("jhs-link");
        });
        const skeletons = e.querySelectorAll ? [...e.querySelectorAll(".jhs-skeleton")] : [];
        if (e.matches?.(".jhs-skeleton")) skeletons.push(e);
        skeletons.forEach(node => node.setAttribute("aria-hidden", "true"));
        const t = e.nodeType === Node.ELEMENT_NODE && e.matches?.(selector) ? [ e ] : [];
        const n = e.querySelectorAll ? [ ...e.querySelectorAll(selector) ] : [];
        [ ...t, ...n ].forEach((e => {
            if (e.hasAttribute("aria-label") || e.hasAttribute("aria-labelledby") || e.textContent.trim()) return;
            const t = e.getAttribute("title") || e.getAttribute("data-tip");
            t && e.setAttribute("aria-label", t);
        }));
    };
    enhance(document);
    const blockDisabled = (/** @type {Event} */ event) => {
        if (event.type === "keydown" && !["Enter", " "].includes(/** @type {KeyboardEvent} */ (event).key)) return;
        const disabled = /** @type {Element | null} */ (event.target)?.closest?.('[aria-disabled="true"]');
        if (disabled?.closest(".jhs-ui,.jhs-btn,.jhs-icon-btn,.card-btn")) { event.preventDefault(); event.stopImmediatePropagation(); }
    };
    lifecycleScope.listen(document, "click", blockDisabled, true);
    lifecycleScope.listen(document, "keydown", blockDisabled, true);
    const pending = new Set;
    let scheduled = !1;
    let timer = 0;
    lifecycleScope.addCleanup(() => { clearTimeout(timer); pending.clear(); });
    const flush = () => {
        scheduled = !1;
        if (lifecycleScope.disposed) { pending.clear(); return; }
        const roots = [...pending].filter(node => {
            for (let parent = node.parentElement; parent; parent = parent.parentElement) if (pending.has(parent)) return false;
            return node.isConnected;
        });
        pending.clear();
        const deadline = performance.now() + 4;
        for (let index = 0; index < roots.length; index++) {
            if (index > 0 && performance.now() >= deadline) {
                roots.slice(index).forEach(node => pending.add(node));
                scheduled = true;
                timer = setTimeout(flush, 0);
                break;
            }
            enhance(roots[index]);
        }
    };
    return lifecycleScope.observe(document.documentElement, (records => {
        records.forEach((record => record.addedNodes.forEach((node => {
            node.nodeType === Node.ELEMENT_NODE && pending.add(node);
        }))));
        pending.size && !scheduled && (scheduled = !0, queueMicrotask(flush));
    }), {
        childList: true,
        subtree: true
    });
}

/** 以隐藏原生 select 为值源的统一 JHS 选择器。 */
export class JhsSelect {
    /** @type {WeakMap<object, JhsSelect>} */
    static instances = new WeakMap();
    static _globalClickBound = false;
    static nextId = 0;
    id = "";
    activeIndex = -1;
    search = "";
    searchTime = 0;
    /** @type {HTMLLabelElement[]} */
    labels = [];
    static _ensureGlobalClickHandler() {
        if (JhsSelect._globalClickBound) return;
        JhsSelect._globalClickBound = true;
        $(document).on("click.jhsSelect", (/** @type {any} */ event) => {
            if (!$(event.target).closest(".jhs-select-control,.jhs-owned-popover").length) JhsSelect.closeAll();
        });
    }
    /** @param {any} select */
    constructor(select) {
        this.source = $(select);
        if (!this.source.length) return;
        const existing = JhsSelect.instances.get(this.source[0]);
        if (existing) return existing;
        this.id = `jhs-select-${++JhsSelect.nextId}`;
        this.activeIndex = -1;
        this.search = "";
        this.searchTime = 0;
        const initiallyHidden = this.source.hasClass("jhs-is-hidden") || this.source[0].style.display === "none";
        this.labels = [...(this.source[0].labels || [])];
        this.trigger = $('<button type="button" class="jhs-btn jhs-field jhs-select-trigger" role="combobox" aria-haspopup="listbox" aria-expanded="false"><span class="jhs-select-value"></span></button>').attr({ id: this.id, "aria-controls": `${this.id}-listbox` }).append(getIcon("chevron-down"));
        this.menu = $('<div class="jhs-popover jhs-select-menu" role="listbox"></div>').attr("id", `${this.id}-listbox`);
        this.source.wrap('<div class="jhs-select-control"></div>');
        this.control = this.source.parent().append(this.trigger, this.menu);
        this.source.addClass("jhs-select-source-native").attr({ "aria-hidden": "true", tabindex: "-1" });
        if (initiallyHidden) this.control.addClass("jhs-is-hidden");
        this.popover = new OwnedPopover(this.trigger[0], this.menu[0], { manageKeyboard: false, onClose: () => {
            this.control.removeClass("is-open");
            this.trigger.attr("aria-expanded", "false").removeAttr("aria-activedescendant");
            this.menu.find(".is-active").removeClass("is-active");
            this.menu.find(".jhs-select-option").each((/** @type {number} */ _, /** @type {HTMLElement} */ item) => item.setAttribute("aria-selected", String(Number(item.dataset.index) === this.source[0].selectedIndex)));
            this.activeIndex = -1;
        } });
        JhsSelect.instances.set(this.source[0], this);
        this.bind(); this.refresh();
    }
    /** @param {any} [root] */
    static enhance(root = document) {
        const scope = $(root), selects = scope.is("select.jhs-select-source") ? scope : scope.find("select.jhs-select-source");
        selects.each((/** @type {number} */ _, /** @type {HTMLSelectElement} */ select) => new JhsSelect(select));
        return selects;
    }
    /** @param {any} select */
    static get(select) { const element = $(select)[0]; return element ? JhsSelect.instances.get(element) || new JhsSelect(element) : null; }
    /** @param {any} select @param {any} value @param {boolean} [emit] */
    static setValue(select, value, emit = false) {
        const instance = JhsSelect.get(select);
        if (!instance) return;
        instance.source.val(value);
        if (emit) instance.emitChange(); else instance.refresh();
    }
    /** @param {any} select */
    static refresh(select) { JhsSelect.get(select)?.refresh(); }
    /** @param {any} [root] */
    static refreshAll(root = document) {
        JhsSelect.enhance(root);
        $(root).find("select.jhs-select-source").each((/** @type {number} */ _, /** @type {HTMLSelectElement} */ select) => JhsSelect.refresh(select));
    }
    /** @param {any} select @param {boolean} visible */
    static setVisible(select, visible) { const instance = JhsSelect.get(select); if (!visible) instance?.close(); instance?.control.toggleClass("jhs-is-hidden", !visible); }
    /** @param {JhsSelect | null} [except] */
    static closeAll(except = null) {
        $(".jhs-select-control.is-open").each((/** @type {number} */ _, /** @type {HTMLElement} */ control) => {
            const source = $(control).children("select.jhs-select-source")[0], instance = source && JhsSelect.instances.get(source);
            if (instance && instance !== except) instance.close();
        });
    }
    render() {
        this.menu.empty();
        let index = 0;
        const appendOption = (/** @type {HTMLOptionElement} */ option, /** @type {any} */ target, disabled = false) => {
            const item = $('<button type="button" class="jhs-btn jhs-btn--ghost jhs-select-option" role="option" tabindex="-1"></button>');
            const unavailable = disabled || option.disabled;
            item.attr({ id: `${this.id}-option-${index}`, "data-index": String(index++), "data-value": option.value, "aria-selected": String(option.selected), "aria-disabled": String(unavailable) }).prop("disabled", unavailable).text(option.text);
            target.append(item);
        };
        this.source.children().each((/** @type {number} */ _, /** @type {HTMLOptionElement | HTMLOptGroupElement} */ child) => {
            if (child.tagName === "OPTGROUP") {
                const group = $('<div class="jhs-select-group" role="group"></div>').attr("aria-label", child.label);
                group.append($('<div class="jhs-select-group__label" aria-hidden="true"></div>').text(child.label));
                $(child).children("option").each((/** @type {number} */ _, /** @type {HTMLOptionElement} */ option) => appendOption(option, group, child.disabled));
                this.menu.append(group);
            } else if (child.tagName === "OPTION") appendOption(/** @type {HTMLOptionElement} */ (child), this.menu);
        });
    }
    bind() {
        this.trigger.on("click", (/** @type {any} */ event) => {
            event.preventDefault(); event.stopPropagation();
            if (!this.source.prop("disabled")) this.popover?.opened ? this.close() : this.open();
        }).on("keydown", (/** @type {any} */ event) => this.handleKey(event));
        this.menu.on("pointerdown", ".jhs-select-option", (/** @type {any} */ event) => event.preventDefault())
            .on("click", ".jhs-select-option", (/** @type {any} */ event) => { event.preventDefault(); this.choose($(event.currentTarget)); });
        this.source.on("change.jhsSelect", () => this.refresh()).on("invalid.jhsSelect", (/** @type {any} */ event) => {
            event.preventDefault(); this.trigger.attr("aria-invalid", "true").trigger("focus");
        });
        this.labels.forEach((/** @type {HTMLLabelElement} */ label) => $(label).on("click.jhsSelect", (/** @type {any} */ event) => {
            if ($(event.target).closest("button,input,select,textarea,a").length) return;
            event.preventDefault(); this.trigger.trigger("focus");
        }));
        JhsSelect._ensureGlobalClickHandler();
    }
    /** @param {any} event */
    handleKey(event) {
        if (this.source.prop("disabled")) return;
        const key = event.key, opened = this.popover?.opened;
        if (key === "Tab") { if (opened) this.choose(this.activeOption(), false); return; }
        if (key === "Escape") {
            if (opened) { event.preventDefault(); event.stopPropagation(); this.close(true); }
            return;
        }
        if (["Enter", " "].includes(key)) {
            event.preventDefault(); event.stopPropagation();
            if (opened) this.choose(this.activeOption()); else this.open();
            return;
        }
        if (["ArrowDown", "ArrowUp", "Home", "End"].includes(key)) {
            event.preventDefault(); event.stopPropagation();
            if (!opened) { this.open(key === "Home" ? "first" : key === "End" ? "last" : "selected"); return; }
            const items = this.options(), index = items.index(this.activeOption()[0]);
            const next = key === "Home" ? 0 : key === "End" ? items.length - 1 : Math.max(0, Math.min(items.length - 1, index + (key === "ArrowDown" ? 1 : -1)));
            this.setActive(items.eq(next));
            return;
        }
        if (key?.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
            event.preventDefault();
            if (!opened) this.open();
            const now = Date.now(), letter = key.toLocaleLowerCase();
            this.search = now - this.searchTime < 700 ? this.search + letter : letter; this.searchTime = now;
            const text = [...this.search].every(character => character === letter) ? letter : this.search;
            const items = this.options(), current = items.index(this.activeOption()[0]);
            for (let offset = 1; offset <= items.length; offset++) {
                const item = items.eq((current + offset + items.length) % items.length);
                if (item.text().trim().toLocaleLowerCase().startsWith(text)) { this.setActive(item); break; }
            }
        }
    }
    options() { return this.menu.find(".jhs-select-option:not(:disabled)"); }
    activeOption() { return this.menu.find(`.jhs-select-option[data-index="${this.activeIndex}"]:not(:disabled)`); }
    /** @param {any} item */
    setActive(item) {
        if (!item.length || item.prop("disabled")) return;
        this.activeIndex = Number(item.attr("data-index"));
        this.menu.find(".jhs-select-option").removeClass("is-active").attr("aria-selected", "false"); item.addClass("is-active").attr("aria-selected", "true");
        this.trigger.attr("aria-activedescendant", item.attr("id"));
        item[0].scrollIntoView?.({ block: "nearest" });
    }
    open(focus = "selected") {
        if (this.source.prop("disabled")) return;
        JhsSelect.closeAll(this); this.refresh();
        this.control.addClass("is-open"); this.trigger.attr("aria-expanded", "true");
        this.popover?.open(this.trigger[0]);
        const items = this.options(), selected = items.filter('[aria-selected="true"]');
        this.setActive(focus === "last" ? items.last() : focus === "first" ? items.first() : selected.length ? selected.first() : items.first());
    }
    close(focus = false) { this.popover?.close(focus); }
    /** @param {any} item @param {boolean} [restoreFocus] */
    choose(item, restoreFocus = true) {
        if (!item.length || item.prop("disabled") || this.source.prop("disabled")) return this.close();
        this.source[0].selectedIndex = Number(item.attr("data-index"));
        this.emitChange(); this.close(restoreFocus);
    }
    /** Dispatch exactly one native change for both DOM and jQuery listeners. */
    emitChange() { this.source[0]?.dispatchEvent(new Event("change", { bubbles: true })); }
    refresh() {
        const source = this.source[0], selected = this.source.find("option:selected").first();
        const active = this.activeIndex;
        this.render();
        this.trigger.find(".jhs-select-value").text(selected.text());
        this.trigger.prop("disabled", source.disabled).attr("aria-disabled", String(source.disabled));
        for (const name of ["aria-labelledby", "aria-label", "aria-describedby", "aria-invalid"]) {
            const value = source.getAttribute(name);
            if (value != null) this.trigger.attr(name, value); else this.trigger.removeAttr(name);
        }
        if (!source.hasAttribute("aria-labelledby") && !source.hasAttribute("aria-label")) {
            const name = this.labels.map((/** @type {HTMLLabelElement} */ label) => {
                const copy = label.cloneNode(true);
                /** @type {Element} */ (copy).querySelectorAll("input,select,textarea,button,.jhs-select-control,.jhs-setting-row__description").forEach(node => node.remove());
                return copy.textContent?.trim() || "";
            }).filter(Boolean).join(" ");
            if (name) this.trigger.attr("aria-label", name);
        }
        this.trigger.attr("aria-required", String(source.required));
        for (const name of ["aria-labelledby", "aria-label"]) {
            const value = this.trigger.attr(name); if (value) this.menu.attr(name, value); else this.menu.removeAttr(name);
        }
        if (source.disabled) this.close();
        else if (this.popover?.opened) {
            const item = this.menu.find(`.jhs-select-option[data-index="${active}"]:not(:disabled)`);
            this.setActive(item.length ? item : this.options().first());
        }
    }
}
