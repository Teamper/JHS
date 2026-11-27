// @ts-check


/** Generate the settings page CSS based on container config and site type. */
/** @param {number | string} containerWidth @param {number} containerColumns @param {boolean} isJavBus */
export function buildSettingCss(containerWidth, containerColumns, isJavBus) {
    let base;
    if (isJavBus) {
        base = `
    .container-fluid .row{
        max-width: 1000px !important;
        margin: auto;
    }

    .container {
        max-width: 1000px !important;
        width: ${containerWidth}%;
        margin: auto auto;
    }

    .masonry {
        grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
    }
`;
    } else {
        base = `
section .container{
    max-width: 1000px !important;
    min-width: ${containerWidth}%;
}
[data-jhs-primary-list], [data-jhs-primary-list].v{
    grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
}
[data-jhs-native-recommendations]:not(.tile-images) { grid-template-columns:repeat(var(--jhs-recommendation-columns, ${containerColumns}), minmax(0,1fr)); }
        `;
    }
    return `${base}${SETTING_ENTRY_STYLES}`;
}

export const SETTING_ENTRY_STYLES = `
    .nav-btn::after {
        content:none !important;
    }

    .simple-setting, .mini-simple-setting {
        --jhs-quick-setting-gap: var(--jhs-space-2);
        display: none;
        background: var(--jhs-surface);
        position: absolute;
        top: calc(100% + var(--jhs-quick-setting-gap));
        right: 0;
        z-index: var(--jhs-z-page-popover);
        border: 1px solid var(--jhs-border);
        border-radius: var(--jhs-radius-md);
        box-shadow: var(--jhs-shadow-md);
        padding: 0;
        color: var(--jhs-text);
        width: min(360px, calc(100vw - 16px));
        max-height: min(720px, calc(100vh - 80px));
    }
    :is(.simple-setting, .mini-simple-setting).is-open::before {
        content: "";
        position: absolute;
        inset-inline: 0;
        inset-block-end: 100%;
        block-size: var(--jhs-quick-setting-gap);
    }
    .simple-setting__panel { display:flex; max-height:inherit; flex-direction:column; }
    .jhs-quick-setting { color:var(--jhs-text); background:var(--jhs-surface); }
    .jhs-quick-setting .simple-setting__panel { max-height:min(720px, calc(100vh - 96px)); }
    .jhs-quick-setting-backdrop { position:fixed; inset:0; z-index:var(--jhs-z-sheet-backdrop); background:var(--jhs-overlay); backdrop-filter:blur(2px); }
    .jhs-quick-setting-sheet { position:fixed; right:0; bottom:0; left:0; z-index:var(--jhs-z-sheet); max-height:calc(100dvh - 16px); border:1px solid var(--jhs-border); border-bottom:0; border-radius:var(--jhs-radius-lg) var(--jhs-radius-lg) 0 0; background:var(--jhs-surface); box-shadow:var(--jhs-shadow-lg); overflow:hidden; }
    .jhs-quick-setting__header { display:flex; min-height:52px; align-items:center; justify-content:space-between; padding:0 var(--jhs-space-3) 0 var(--jhs-space-4); border-bottom:1px solid var(--jhs-border); }
    .jhs-quick-setting__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); }
    .jhs-quick-setting__close { min-width:var(--jhs-touch-target); padding:0; font-size:var(--jhs-icon-lg); }
    .simple-setting__scroll { min-height:0; padding:var(--jhs-space-2) var(--jhs-space-3); overflow-y:auto; overscroll-behavior:contain; }
    .simple-setting__footer { display:flex; justify-content:flex-end; gap:var(--jhs-space-2); padding:var(--jhs-space-3); border-top:1px solid var(--jhs-border); }
    .simple-setting__list { display:grid; }
    .simple-setting .jhs-setting-row, .mini-simple-setting .jhs-setting-row, .jhs-quick-setting .jhs-setting-row { grid-template-columns:minmax(0,1fr) auto; gap:var(--jhs-space-3); min-height:48px; padding:var(--jhs-space-3) 0; border-bottom:0; }
    .simple-setting .jhs-setting-row__control, .mini-simple-setting .jhs-setting-row__control, .jhs-quick-setting .jhs-setting-row__control { width:auto; justify-self:end; }
    .simple-setting .jhs-setting-row__description, .mini-simple-setting .jhs-setting-row__description, .jhs-quick-setting .jhs-setting-row__description { display:-webkit-box; overflow:hidden; -webkit-box-orient:vertical; -webkit-line-clamp:2; line-height:var(--jhs-line-height-ui); }
    @media (max-width:767px) { .simple-setting .jhs-setting-row__description, .mini-simple-setting .jhs-setting-row__description, .jhs-quick-setting .jhs-setting-row__description { -webkit-line-clamp:unset; white-space:normal; } }
    .jhs-setting-nav-item { position:relative; }
    .jhs-nav-button { padding-right:var(--jhs-space-4) !important; }
    .jhs-mini-setting-box { position:relative; margin-left:auto; }
    .jhs-mini-setting-trigger { padding-left:0 !important; padding-right:0 !important; }
    .jhs-setting-anchor { position:relative; display:flex; flex-grow:1; justify-content:flex-end; z-index:var(--jhs-z-host-nav); }
    .jhs-setting-anchor:has(.simple-setting.is-open) { z-index:var(--jhs-z-page-popover); }
    .jhs-setting-detail-anchor { margin-top:var(--jhs-space-5); }
    .jhs-backup-cards { display:grid; gap:var(--jhs-space-3); padding:0 var(--jhs-space-1); }
    .jhs-help-title { margin:0 0 var(--jhs-space-5); padding-bottom:var(--jhs-space-3); border-bottom:1px solid var(--jhs-border); color:var(--jhs-accent); font-size:var(--jhs-font-size-xl); }

`;

export const FULL_SETTINGS_STYLES = `
    .jhs-settings-search {
        grid-column:1; grid-row:1; background:var(--jhs-surface-2); border-right:1px solid var(--jhs-border);
        padding:var(--jhs-space-3) var(--jhs-space-2) var(--jhs-space-1);
    }
    .jhs-settings-search .jhs-field { width:100%; }
    .jhs-settings-searching .jhs-setting-layout .content-panel:not([data-jhs-search-hidden]) { display:block; height:auto; overflow:visible; padding-bottom:0; }

    .jhs-source-priority { width:70px; }
    .jhs-settings-searching .jhs-setting-layout [data-jhs-search-hidden] { display:none; }
    .jhs-settings-searching .jhs-setting-layout .content-panel[data-jhs-search-hidden] { display:none; }
    .jhs-setting-group-header { justify-content:space-between; align-items:center; margin-bottom:var(--jhs-space-6); }
    .side-menu-item[data-jhs-dirty]::after { content:""; width:6px; height:6px; border-radius:50%; background:var(--jhs-accent); margin-inline-start:auto; }


    #cache-data-display pre {
        font-family: var(--jhs-font-mono);
        white-space: pre-wrap;
        word-wrap: break-word;
        line-height: var(--jhs-line-height-ui);
        color: var(--jhs-text);
        border: 1px solid var(--jhs-border);
    }

    .cache-item { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); padding:var(--jhs-space-2) 0; }
    .cache-item__title { color:var(--jhs-text); font-weight:var(--jhs-font-weight-semibold); }
    .cache-item__actions, .jhs-inline-fields { display:flex; gap:var(--jhs-space-2); }
    .cache-item__actions > * { flex:1; text-align:center; }
    .jhs-setting-label-inline { display:flex; align-items:center; gap:var(--jhs-space-1); }
    .jhs-import-result[hidden] { display:none!important; }
    .jhs-import-result { display:grid; gap:var(--jhs-space-3); min-width:0; }
    .jhs-import-result h4,.jhs-import-result h5 { margin:0; font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-import-metrics { display:flex; flex-wrap:wrap; gap:var(--jhs-space-5); margin:0; }
    .jhs-import-metrics > div { display:flex; align-items:baseline; gap:var(--jhs-space-2); }
    .jhs-import-metrics dt { color:var(--jhs-text-muted); }
    .jhs-import-metrics dd { margin:0; font-weight:var(--jhs-font-weight-semibold); }
    .jhs-import-message { margin:0; color:var(--jhs-text-muted); }
    .jhs-import-details summary { display:flex; min-height:var(--jhs-touch-target); align-items:center; cursor:pointer; }
    .jhs-import-detail-list { display:grid; gap:var(--jhs-space-3); box-sizing:border-box; max-height:240px; padding:var(--jhs-space-3); overflow:auto; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); }
    .jhs-import-detail-list ul { margin:var(--jhs-space-2) 0 0; padding-left:var(--jhs-space-5); overflow-wrap:anywhere; }
    .jhs-import-detail-list li { margin:0; }
    .jhs-cloud-section { gap:0!important; }
    .jhs-cloud-section > header { margin-bottom:var(--jhs-space-2)!important; }
    .jhs-setting-toggle-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-2); }
    .jhs-setting-toggle-grid label { display:flex; align-items:center; gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
    .jhs-cache-preview { max-height:400px; padding:var(--jhs-space-3); overflow:auto; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }

    .keyword-label {
        display: inline-flex;
        align-items: center;
        padding: var(--jhs-space-1) var(--jhs-space-2);
        border-radius: var(--jhs-radius-sm);
        font-size: var(--jhs-font-size-md);
        position: relative;
        margin-left: var(--jhs-space-2);
        margin-bottom: var(--jhs-space-1);
        background:var(--jhs-surface-2);
        color:var(--jhs-text);
    }
    .keyword-remove {
        margin-left: var(--jhs-space-1);
        cursor: pointer;
        font-size: var(--jhs-font-size-xs);
        line-height: var(--jhs-line-height-tight);
    }
    .keyword-input {
        flex: 1 1 160px;
        min-width: 0;
        padding: var(--jhs-space-2) var(--jhs-space-3);
        border: 1px solid var(--jhs-border-strong);
        border-radius: var(--jhs-radius-sm);
        font-size: var(--jhs-font-size-md);
    }
    .add-tag-btn { flex: 0 0 auto; }
    .tag-box {
        margin-top:var(--jhs-space-4);
    }

    .jhs-setting-layout {
        display:grid; grid-template-columns:176px minmax(0,1fr); grid-template-rows:auto minmax(0,1fr); height:100%; min-height:0;
        background:var(--jhs-surface);
    }

    .jhs-mobile-sidebar {
        grid-column: 1;
        grid-row: 2;
        display: flex;
        min-width: 0;
        flex-direction: column;
        gap: var(--jhs-space-1);
        padding: var(--jhs-space-3) var(--jhs-space-2);
        border-right: 1px solid var(--jhs-border);
        background: var(--jhs-surface-2);
        overflow-y: auto;
    }

    .jhs-setting-layout .side-menu-item {
        width: 100%;
        min-height: var(--jhs-control-height);
        padding: 0 var(--jhs-space-3);
        border: 0;
        border-radius: var(--jhs-radius-sm);
        background: transparent;
        cursor: pointer;
        color: var(--jhs-text);
        display: flex;
        align-items: center;
        gap: var(--jhs-space-2);
        font: inherit;
        font-weight:var(--jhs-font-weight-normal);
        box-shadow:none;
        font-size: var(--jhs-font-size-sm);
        text-align: left;
        transition: background-color var(--jhs-motion-fast) var(--jhs-ease), color var(--jhs-motion-fast) var(--jhs-ease);
    }

    .side-menu-item .icon {
         height: var(--jhs-icon-lg);
         width: var(--jhs-icon-lg);
    }

    .side-menu-item:hover {
        background-color: var(--jhs-surface);
    }

    .side-menu-item.active {
        background-color: var(--jhs-accent-tint);
        color: var(--jhs-accent);
        font-weight: var(--jhs-font-weight-semibold);
    }

    .jhs-setting-group-title {
        margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-2xl);
        font-weight:var(--jhs-font-weight-semibold); line-height:var(--jhs-line-height-display);
    }
    .jhs-setting-footer > [hidden] { display:none; }
    .jhs-setting-footer__copy { display:grid; flex:1; min-width:0; gap:var(--jhs-space-1); }
    .jhs-setting-footer .jhs-caption { margin:0; }
    .jhs-setting-section output { min-width:3ch; font-size:var(--jhs-font-size-sm); font-variant-numeric:tabular-nums; }
    .jhs-setting-row__control:has(input[type="range"]) { display:flex; align-items:center; flex-wrap:nowrap; gap:var(--jhs-space-2); }
    .jhs-setting-row__control:has(input[type="range"]) > input[type="range"] { flex:1; min-width:0; }
    .jhs-setting-row__control:has(input[type="range"]) > output { flex:0 0 auto; }
    [data-jhs-setting-section="card-buttons"] { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:0 var(--jhs-space-4); }
    [data-jhs-setting-section="card-buttons"] .jhs-setting-row__control { width:auto; }
    .keyword-remove.jhs-btn { padding:0; min-width:var(--jhs-icon-sm); min-height:var(--jhs-icon-sm); border:0; }
    .keyword-remove .jhs-icon { width:var(--jhs-icon-sm); height:var(--jhs-icon-sm); }
    .jhs-data-table .is-right,.jhs-setting-metric strong { font-variant-numeric:tabular-nums; }
    .jhs-setting-main {
        grid-column: 2;
        grid-row: 1 / -1;
        display: flex;
        min-width: 0;
        min-height: 0;
        flex-direction: column;
        height: 100%;
    }

    .jhs-setting-body { flex:1; min-height:0; overflow:hidden; }
    .jhs-settings-searching .jhs-setting-body { overflow:auto; }

    .jhs-setting-body-inner { width:100%; max-width:640px; margin-inline:auto; }

    .jhs-setting-layout .content-panel {
        display:none; box-sizing:border-box; height:100%; margin:0; padding:var(--jhs-space-6);
        overflow:hidden auto; scrollbar-gutter:stable;
    }
    .jhs-setting-layout .content-panel.active:not([hidden],[data-jhs-search-hidden]) { display:block; }

    .jhs-setting-section + .jhs-setting-section { margin-top:var(--jhs-space-6); }
    .jhs-setting-layout .jhs-setting-group { border:0; border-radius:0; background:transparent; overflow:visible; }

    .jhs-setting-section__header { display:grid; gap:var(--jhs-space-1); margin-bottom:var(--jhs-space-2); }

    .jhs-setting-section__header h3 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); line-height:var(--jhs-line-height-tight); }

    .jhs-setting-section__header p { margin:0; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
    .jhs-setting-section__header p:empty { display:none; }

    .jhs-setting-layout .jhs-setting-row__description { font-size:var(--jhs-font-size-xs); line-height:var(--jhs-line-height-ui); }

    .jhs-setting-layout .jhs-setting-row__control { width:100%; justify-self:end; }
    .keyword-label--link { color:var(--jhs-accent); }

    .jhs-setting-output {
        max-height: 360px;
        padding: var(--jhs-space-3);
        overflow: auto;
        border: 0;
        border-radius: var(--jhs-radius-sm);
        background: var(--jhs-surface-2);
    }
    .jhs-setting-output:empty { display:none; }
    .jhs-setting-output--compact { max-height:250px; }
    .jhs-setting-help { margin: 0 0 var(--jhs-space-3); color: var(--jhs-text-muted); font-size: var(--jhs-font-size-sm); }
    .jhs-setting-subheading { margin:var(--jhs-space-5) 0 var(--jhs-space-2); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
    .jhs-setting-rows { border:0; padding:0; }
    .jhs-setting-subtitle { margin:0; padding:var(--jhs-space-2) var(--jhs-space-4); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
    .jhs-setting-metrics { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); margin-bottom:var(--jhs-space-3); }
    .jhs-setting-metric { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-2) var(--jhs-space-3); border-right:1px solid var(--jhs-border); text-align:center; }
    .jhs-setting-metric:last-child { border-right:0; }
    .jhs-setting-metric strong { color: var(--jhs-text); font-size: var(--jhs-font-size-xl); }
    .jhs-setting-metric span { color: var(--jhs-text-muted); font-size: var(--jhs-font-size-xs); }
    .jhs-plugin-group { margin-bottom:var(--jhs-space-4); }
    .jhs-plugin-group__title { margin:0; padding:var(--jhs-space-3) 0; border-bottom:0; color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
    .jhs-plugin-row { display:flex; min-height:48px; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); padding:var(--jhs-space-3) 0; border-bottom:0; }
    .jhs-plugin-copy { display:grid; min-width:0; gap:var(--jhs-space-1); }
    .jhs-plugin-copy strong { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
    .jhs-table-scroll { min-width:0; max-width:100%; overflow-x:auto; }
    .jhs-data-table { width:100%; border-collapse:collapse; color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
    .jhs-data-table th { padding:var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); text-align:left; }
    .jhs-data-table td { padding:var(--jhs-space-1) var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); }
    .jhs-data-table .is-center { text-align:center; }
    .jhs-data-table .is-right { text-align:right; }
    .jhs-data-table .is-danger { color:var(--jhs-danger-text); }
    .jhs-data-table .is-warning { color:var(--jhs-warning-text); }
    .jhs-data-table .is-success { color:var(--jhs-success-text); }
    .jhs-data-table .is-muted { color:var(--jhs-text-faint); }
    .jhs-data-table .is-slow { color:var(--jhs-danger-text); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-diagnostics { margin-top:var(--jhs-space-5); }
    .jhs-diagnostics > summary { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; padding:var(--jhs-space-3) 0; color:var(--jhs-text); font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-semibold); cursor:pointer; }
    .jhs-diagnostics > summary::after { color:var(--jhs-text-muted); content:"展开"; font-size:var(--jhs-font-size-sm); font-weight:var(--jhs-font-weight-normal); }
    .jhs-diagnostics[open] > summary::after { content:"收起"; }
    .jhs-diagnostics__content { padding-bottom:var(--jhs-space-3); }
    .jhs-empty-note { display:grid; justify-items:center; gap:var(--jhs-space-2); padding:var(--jhs-space-5); color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); text-align:center; }
    .jhs-caption { margin:var(--jhs-space-2) 0 0; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
    .jhs-inline-metrics { display:flex; flex-wrap:wrap; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-2); font-size:var(--jhs-font-size-sm); }
    .jhs-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-3); }
    .jhs-summary-card { padding:var(--jhs-space-3); border-radius:var(--jhs-radius-md); background:var(--jhs-surface-2); text-align:center; }
    .jhs-summary-card strong { display:block; font-size:var(--jhs-font-size-xl); }
    .jhs-summary-card--success { background:var(--jhs-success-tint); color:var(--jhs-success-text); }
    .jhs-summary-card--danger { background:var(--jhs-danger-tint); color:var(--jhs-danger-text); }
    .jhs-summary-card--warning { background:var(--jhs-warning-tint); color:var(--jhs-warning-text); }
    .jhs-scroll-frame { max-height:350px; overflow:auto; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); }
    .jhs-warning-note { margin-top:var(--jhs-space-3); color:var(--jhs-danger-text); font-size:var(--jhs-font-size-xs); }
    .jhs-health-summary { margin-bottom:var(--jhs-space-2); }
    .jhs-health-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-3); }
    .jhs-health-columns h4 { margin:0 0 var(--jhs-space-1); }

    .jhs-setting-footer {
        display:flex; flex-shrink:0; justify-content:flex-end; align-items:center; gap:var(--jhs-space-2);
        padding:var(--jhs-space-3) var(--jhs-space-6); border-top:1px solid var(--jhs-border);
        background:var(--jhs-surface);
    }

    .jhs-cache-grid { display:grid; gap:var(--jhs-space-3); }

    .jhs-resource-card-list { display:grid; gap:var(--jhs-space-3); min-width:0; }
    .jhs-resource-card {
        min-width:0; overflow:hidden; border:0; border-radius:0; padding:var(--jhs-space-2) 0;
        background:transparent; box-shadow:none;
    }
    .jhs-resource-card strong { color:var(--jhs-text); font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-resource-card .jhs-setting-row { align-items:flex-start; }
    .jhs-resource-card small { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); overflow-wrap:anywhere; }
    .jhs-resource-card .jhs-badge { margin-left:var(--jhs-space-2); }
    .jhs-resource-form, .jhs-parser-fields { display:grid; gap:var(--jhs-space-2); min-width:0; }
    .jhs-resource-form { padding:var(--jhs-space-4); max-height:70vh; overflow-y:auto; overflow-x:hidden; }
    .jhs-resource-advanced > summary { cursor:pointer; font-weight:var(--jhs-font-weight-semibold); }
    #advanced-resource-json { width:100%; box-sizing:border-box; margin-top:var(--jhs-space-3); }

    .jhs-setting-layout .jhs-setting-row {
        grid-template-columns:minmax(0,1fr) 240px; min-height:52px; padding:var(--jhs-space-2) 0;
        border:0; gap:var(--jhs-space-4) var(--jhs-space-6);
    }
    .jhs-setting-highlight { animation:jhs-setting-highlight 1.2s var(--jhs-ease); }
    @keyframes jhs-setting-highlight { from { background:var(--jhs-accent-tint); } to { background:transparent; } }
    .jhs-setting-layout .jhs-setting-row--indent { padding-inline-start:var(--jhs-space-4); border-inline-start:2px solid var(--jhs-border); }
    .jhs-setting-layout .jhs-setting-row--stacked { grid-template-columns:minmax(0,1fr); }
    .jhs-setting-layout :is(.jhs-setting-row--action,.jhs-setting-row:has(> .jhs-setting-row__control > input[type=checkbox])),
    .jhs-setting-layout [data-jhs-setting-section="card-buttons"] .jhs-setting-row { grid-template-columns:minmax(0,1fr) auto; }
    .jhs-setting-layout .jhs-setting-row__label { font-size:var(--jhs-font-size-md); }
    .jhs-setting-layout :is(.jhs-field,.jhs-select-trigger,.jhs-btn) { min-height:var(--jhs-control-height); border-radius:var(--jhs-radius-sm); }
    .jhs-setting-layout .jhs-choice { border:0; background:transparent; padding-inline:0; justify-content:flex-start; }
    .jhs-setting-save-hint { display:block; margin:var(--jhs-space-1) 0 0; }
    .jhs-setting-navigation-hint { grid-column:1 / -1; margin:0; }
    .jhs-setting-layout #resource-sources-panel .jhs-record-card { padding:var(--jhs-space-2) 0; border:0; border-radius:0; background:transparent; box-shadow:none; }
    .jhs-resource-form .jhs-setting-row { gap:var(--jhs-space-2); border:0; padding:var(--jhs-space-2) 0; }
    .jhs-resource-form :is(.jhs-field,.jhs-select-trigger,.jhs-btn) { border-radius:var(--jhs-radius-sm); }
    .jhs-setting-layout :is(#settings-hydration-status,#settings-draft-status,.jhs-shortcut-feedback):empty,
    .jhs-settings-mobile-category { display:none; }
    .jhs-settings-mobile-category .jhs-select-control { width:100%; }

    @media (max-width:767px), (max-height:500px) and (pointer:coarse) {
        .jhs-setting-layout { grid-template-columns:minmax(0,1fr); grid-template-rows:auto auto minmax(0,1fr); }
        .jhs-settings-search { background:var(--jhs-surface); border-right:0; border-bottom:1px solid var(--jhs-border); padding:var(--jhs-space-2) var(--jhs-space-4); }
        .jhs-mobile-sidebar { display:none; }
        .jhs-settings-mobile-category { display:block; grid-column:1; grid-row:2; padding:var(--jhs-space-2) var(--jhs-space-4); border-bottom:1px solid var(--jhs-border); }
        .jhs-setting-main { grid-column:1; grid-row:3; }
        .jhs-setting-layout .content-panel { padding-inline:var(--jhs-space-4); }
        .jhs-setting-layout .jhs-setting-row { grid-template-columns:minmax(0,1fr); gap:var(--jhs-space-2); }
        .jhs-setting-layout .jhs-setting-row:has(> .jhs-setting-row__control > input[type=checkbox]) { grid-template-columns:minmax(0,1fr) auto; }
        .jhs-setting-layout .jhs-setting-row__control:has(> input[type=checkbox]) { width:auto; }
        .jhs-setting-layout :is(.jhs-setting-row__label,input,.jhs-select-trigger) { font-size:var(--jhs-font-size-lg); }
        .jhs-setting-layout :is(.jhs-field,.jhs-select-trigger,.jhs-btn) { min-height:var(--jhs-touch-target); }
        .jhs-setting-footer { padding-inline:var(--jhs-space-4); }
        .jhs-summary-grid, .jhs-health-columns, [data-jhs-setting-section="card-buttons"] { grid-template-columns:minmax(0,1fr); }
        .jhs-resource-card .jhs-setting-row { align-items:stretch; }
        .jhs-resource-card .jhs-toolbar { flex-wrap:wrap; }
    }
    @media (max-width:767px), (pointer:coarse) {
        .keyword-remove.jhs-btn { min-width:var(--jhs-touch-target); min-height:var(--jhs-touch-target); }
    }
`;
