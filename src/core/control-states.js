// @ts-check

/** Shared interaction states; ownership and variant colors stay explicit. @param {string} fields */
export function buildControlStatesCss(fields) {
    return `
    :where(.jhs-ui) :is(input[type="checkbox"],input[type="radio"]):not(.mini-switch,.jhs-switch),
    :is(.jhs-checkbox,.jhs-radio) {
        width:18px; height:18px; min-height:18px; margin:0;
        accent-color:var(--jhs-accent); cursor:pointer;
    }
    :where(.jhs-ui) input[type="color"] { box-sizing:border-box; width:48px; height:var(--jhs-control-height); padding:2px; border:1px solid var(--jhs-border-strong); border-radius:var(--jhs-radius-sm); background:var(--jhs-input-bg); cursor:pointer; }
    :where(.jhs-ui) input[type="color"]::-webkit-color-swatch-wrapper { padding:2px; }
    :where(.jhs-ui) input[type="color"]::-webkit-color-swatch { border:0; border-radius:var(--jhs-radius-xs); }
    :where(.jhs-ui) input[type="color"]::-moz-color-swatch { border:0; border-radius:var(--jhs-radius-xs); }
    ${fields}:is(:autofill, :-webkit-autofill):not(:disabled):not([aria-disabled="true"]) {
        -webkit-text-fill-color:var(--jhs-text);
        caret-color:var(--jhs-text);
        background-color:var(--jhs-input-bg);
        box-shadow:inset 0 0 0 1000px var(--jhs-input-bg);
        transition:none;
    }
    :where(.jhs-range,.jhs-ui input[type="range"])::-moz-range-track { height:4px; border:0; border-radius:var(--jhs-radius-pill); background:var(--jhs-border-strong); }
    :where(.jhs-range,.jhs-ui input[type="range"])::-moz-range-thumb { box-sizing:border-box; width:18px; height:18px; border:2px solid var(--jhs-surface); border-radius:50%; background:var(--jhs-accent); }
    :where(.jhs-range,.jhs-ui input[type="range"]):disabled::-moz-range-thumb { background:var(--jhs-disabled-text); }
    :where(.jhs-range,.jhs-ui input[type="range"]):disabled::-webkit-slider-thumb { background:var(--jhs-disabled-text); }

    .jhs-link { color:var(--jhs-accent); text-decoration:underline; text-underline-offset:.15em; }
    .jhs-link:hover { color:var(--jhs-accent-hover); text-decoration-thickness:2px; }
    .jhs-link:active { color:var(--jhs-accent-hover); }
    .jhs-image-viewer :is(.viewer-button,.viewer-toolbar li):focus-visible { outline:2px solid var(--jhs-focus); outline-offset:2px; }
    :is(.jhs-tab,.jhs-segmented__item)[aria-selected="true"] {
        border-color:var(--jhs-accent); background:var(--jhs-accent-tint); color:var(--jhs-accent);
        box-shadow:inset 0 -2px 0 var(--jhs-accent);
    }
    :is(.jhs-btn,.jhs-btn--secondary,.jhs-btn--muted,.jhs-btn--ghost,.jhs-btn--soft):not(.jhs-btn--primary,.jhs-btn--accent,.jhs-btn--danger,.jhs-btn--filter,.jhs-btn--fav,.jhs-btn--down,.jhs-btn--watch,.pagination-btn):is([aria-pressed="true"],.active) {
        border-color:var(--jhs-accent); background:var(--jhs-accent-tint); color:var(--jhs-accent);
    }
    :is(.jhs-popover,.jhs-owned-popover,.jhs-fab-menu,.jhs-mobile-filter-menu,.jhs-mobile-sort-menu) [role="menuitemradio"][aria-checked="true"] {
        background:var(--jhs-accent-tint); color:var(--jhs-accent); font-weight:var(--jhs-font-weight-semibold);
    }
    :is(.jhs-popover,.jhs-owned-popover,.jhs-fab-menu,.jhs-mobile-filter-menu,.jhs-mobile-sort-menu) [role="menuitemradio"][aria-checked="true"]::after {
        content:"\\2713"; margin-left:auto; padding-left:var(--jhs-space-2); font-weight:var(--jhs-font-weight-semibold);
    }
    .jhs-select-option[aria-selected="true"] { border-color:var(--jhs-accent); background:var(--jhs-accent-tint); color:var(--jhs-accent); }
    .jhs-select-option.is-active { outline:2px solid var(--jhs-focus); outline-offset:-2px; }
    .jhs-table .tabulator-row.tabulator-selected { background:var(--jhs-accent-tint)!important; outline:2px solid var(--jhs-accent); outline-offset:-2px; }
    .jhs-table .tabulator-row.tabulator-selected:hover { background:var(--jhs-surface-hover)!important; }
    .jhs-table .tabulator-row:focus-visible { outline:2px solid var(--jhs-focus); outline-offset:-2px; }

    .jhs-dialog .layui-layer-btn > a:hover { border-color:var(--jhs-accent)!important; background:var(--jhs-surface-hover)!important; }
    .jhs-dialog:not(.jhs-confirm-actions) .layui-layer-btn > .layui-layer-btn0:hover,
    .jhs-dialog.jhs-confirm-actions:not(.jhs-confirm-actions--danger) .layui-layer-btn > .layui-layer-btn1:hover { border-color:var(--jhs-accent-hover)!important; background:var(--jhs-accent-hover)!important; color:var(--jhs-accent-text-on)!important; }
    .jhs-dialog.jhs-confirm-actions.jhs-confirm-actions--danger .layui-layer-btn > .layui-layer-btn1:hover { border-color:var(--jhs-danger)!important; background:var(--jhs-danger)!important; color:var(--jhs-danger-text-on)!important; filter:brightness(.92); }
    :is(.jhs-btn,.jhs-filter-btn,.site-btn,.magnet-hub-btn,.pagination-btn,.jhs-segmented__item,.jhs-icon-btn,.card-btn,
        .jhs-fab,.jhs-fab-menu-item,.console-logger-toggle,.console-logger-controls button,.console-logger-scroll-to-bottom,
        .jhs-image-viewer .viewer-button,.jhs-image-viewer .viewer-toolbar li,.jhs-toast .toast-close,
        .jhs-dialog .layui-layer-btn > a,.jhs-dialog .layui-layer-close):active:not(:disabled):not([aria-disabled="true"]) {
        box-shadow:inset 0 0 0 1px currentColor;
        border-color:currentColor;
    }
    :is(.jhs-btn,.jhs-icon-btn,.card-btn,.jhs-segmented__item):not(#jhs-fab):active { transform:none; }
    :is(.jhs-btn--secondary,.jhs-btn--muted,.jhs-btn--ghost,.jhs-icon-btn,.card-btn,.jhs-fab-menu-item,.jhs-toast .toast-close):active:not(:disabled):not([aria-disabled="true"]) { background:var(--jhs-surface-hover); }
    :is(.jhs-btn--primary,.jhs-btn--accent,.console-logger-toggle):active:not(:disabled):not([aria-disabled="true"]) { background:var(--jhs-accent-hover); }
    .jhs-image-viewer .viewer-close:active { background:var(--jhs-overlay-hover)!important; }
    :is(.jhs-btn,.jhs-filter-btn,.jhs-icon-btn,.card-btn,.jhs-segmented__item,.jhs-dialog .layui-layer-btn > a):is(:disabled,[aria-disabled="true"]) {
        border-color:var(--jhs-border)!important; background:var(--jhs-disabled-bg)!important; color:var(--jhs-disabled-text)!important;
        cursor:not-allowed; opacity:1; box-shadow:none; filter:none; transform:none;
    }
    :where(.jhs-ui) input:is([type="checkbox"],[type="radio"],[type="color"]):disabled { cursor:not-allowed; }
    :is(.jhs-tab,.jhs-segmented__item)[aria-selected="true"]:is(:disabled,[aria-disabled="true"]) { text-decoration:underline; text-underline-offset:.3em; }
    .jhs-skeleton { pointer-events:none; }
    @media (prefers-reduced-motion:reduce) {
        :is(.jhs-switch,.mini-switch)::before { transition:none; }
    }
    @media (prefers-contrast:more) {
        .jhs-ui { --jhs-border:var(--jhs-text-muted); --jhs-border-strong:var(--jhs-text); }
        .jhs-ui :focus-visible,.jhs-btn:focus-visible { outline-width:3px; }
    }
    @media (forced-colors:active) {
        .jhs-ui { --jhs-surface:Canvas; --jhs-surface-2:Canvas; --jhs-surface-hover:Canvas; --jhs-input-bg:Canvas; --jhs-text:CanvasText; --jhs-text-muted:CanvasText; --jhs-border:ButtonText; --jhs-border-strong:ButtonText; --jhs-accent:Highlight; --jhs-accent-hover:Highlight; --jhs-accent-tint:Canvas; --jhs-focus:Highlight; --jhs-disabled-bg:Canvas; --jhs-disabled-text:GrayText; }
        .jhs-ui :focus-visible,.jhs-btn:focus-visible { outline-color:Highlight!important; }
        :is(.jhs-switch,.mini-switch) { border-color:ButtonText; background:Canvas; }
        :is(.jhs-switch,.mini-switch)::before { background:ButtonText; border:1px solid ButtonText; box-sizing:border-box; }
        :is(.jhs-switch,.mini-switch):checked { border-color:Highlight; background:Canvas; }
        :is(.jhs-switch,.mini-switch):checked::before { background:Highlight; border-color:Highlight; }
        :is(.jhs-switch,.mini-switch):disabled::before { background:GrayText; border-color:GrayText; }
        .jhs-ui :is([role="tab"][aria-selected="true"],.jhs-btn[aria-pressed="true"],[role="menuitemradio"][aria-checked="true"],.tabulator-selected,.jhs-select-option[aria-selected="true"],.pagination-btn:is(.active,.is-current,[aria-current="page"])) { outline:2px solid Highlight; outline-offset:-2px; }
        .jhs-link { color:LinkText; }
    }
    `;
}
