/** Generate the settings page CSS based on container config and site type. */
function buildSettingCss(containerWidth, containerColumns, isJavBus, isJavDB) {
    let base;
    if (isJavBus) {
        base = `
                .container-fluid .row{
                    max-width: 1000px !important;
                    min-width: ${containerWidth}%;
                    margin: auto auto;
                }

                .container {
                    max-width: 1000px !important;
                    min-width: 80%;
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
            .movie-list, .movie-list.v{
                grid-template-columns: repeat(${containerColumns}, minmax(0, 1fr));
            }
        `;
    }
    return `
            <style>
                ${base}
                .nav-btn::after {
                    content:none !important;
                }

                #cache-data-display pre {
                    font-family: Consolas, Monaco, 'Andale Mono', monospace;
                    white-space: pre-wrap;
                    word-wrap: break-word;
                    line-height: 1.5;
                    color: var(--jhs-text);
                    border: 1px solid var(--jhs-border);
                }

                .cache-item {
                    transition: all 0.2s ease;
                }
                .cache-item:hover {
                    box-shadow: 0 2px 8px rgba(0,0,0,0.1);
                    transform: translateY(-2px);
                }
                .cache-item { padding:var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); }
                .cache-item__title { margin-bottom:var(--jhs-space-2); color:var(--jhs-text); font-weight:700; }
                .cache-item__actions, .jhs-inline-fields { display:flex; gap:var(--jhs-space-2); }
                .cache-item__actions > * { flex:1; text-align:center; }
                .jhs-setting-label-inline { display:flex; align-items:center; gap:var(--jhs-space-1); }
                .jhs-setting-toggle-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-2); }
                .jhs-setting-toggle-grid label { display:flex; align-items:center; gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-cache-preview { max-height:400px; padding:var(--jhs-space-3); overflow:auto; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }

                .keyword-label {
                    display: inline-flex;
                    align-items: center;
                    padding: 4px 8px;
                    border-radius: var(--jhs-radius-sm);
                    font-size: 14px;
                    position: relative;
                    margin-left: 8px;
                    margin-bottom: 5px;
                }
                .keyword-remove {
                    margin-left: 6px;
                    cursor: pointer;
                    font-size: 12px;
                    line-height: 1;
                }
                .keyword-input {
                    padding: 6px 12px;
                    border: 1px solid var(--jhs-border);
                    border-radius: var(--jhs-radius-sm);
                    font-size: 14px;
                    float:right;
                }
                .add-tag-btn {
                    padding: 6px 12px;
                    background-color: var(--jhs-surface-2);
                    color: var(--jhs-text);
                    border: none;
                    border-radius: var(--jhs-radius-sm);
                    cursor: pointer;
                    font-size: 14px;
                    margin-left: 8px;
                    float:right;
                }
                .add-tag-btn:hover {
                    background-color: var(--jhs-border-strong);
                }
                .tag-box {
                    margin-top:15px;
                }


                .simple-setting, .mini-simple-setting {
                    display: none;
                    background: var(--jhs-surface);
                    position: absolute;
                    top: ${isJavDB ? "35px" : "25px"};
                    right: 0;
                    z-index: 1000;
                    border: 1px solid var(--jhs-border);
                    border-radius: var(--jhs-radius-sm);
                    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
                    padding: 0;
                    margin-top: 5px;
                    color: var(--jhs-text);
                    width: min(360px, calc(100vw - 16px));
                    max-height: min(720px, calc(100vh - 16px));
                }
                .simple-setting__panel { display:flex; max-height:inherit; flex-direction:column; }
                .simple-setting__scroll { min-height:0; padding:var(--jhs-space-2) var(--jhs-space-3); overflow-y:auto; }
                .simple-setting__footer { display:flex; justify-content:flex-end; gap:var(--jhs-space-2); padding:var(--jhs-space-3); border-top:1px solid var(--jhs-border); }
                .simple-setting__list { display:grid; }
                .simple-setting .jhs-setting-row { grid-template-columns:minmax(0,1fr) auto; gap:var(--jhs-space-3); min-height:48px; padding:var(--jhs-space-2) 0; border-bottom:1px solid var(--jhs-border); }
                .simple-setting .jhs-setting-row:last-child { border-bottom:0; }
                .simple-setting .jhs-setting-row__control { width:auto; justify-self:end; }
                .simple-setting .jhs-setting-row__description { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .jhs-setting-nav-item { position:relative; }
                .jhs-nav-button { padding-right:15px !important; }
                .jhs-mini-setting-box { position:relative; margin-left:auto; }
                .jhs-mini-setting-trigger { padding-left:0 !important; padding-right:0 !important; }
                .jhs-setting-anchor { position:relative; display:flex; flex-grow:1; justify-content:flex-end; z-index:12345679 !important; }
                .jhs-setting-detail-anchor { margin-top:var(--jhs-space-5); }
                .jhs-more-tools-panel { display:none; }
                .jhs-backup-cards { padding:0 var(--jhs-space-1); }
                .jhs-table-dialog { height:100%; overflow:hidden; }
                .jhs-table-dialog__content { margin:auto !important; }
                .jhs-help-title { margin:0 0 var(--jhs-space-5); padding-bottom:var(--jhs-space-3); border-bottom:1px solid var(--jhs-border); color:var(--jhs-accent); font-size:22px; }
                .jhs-list-btn-row { display:flex; align-items:center; gap:var(--jhs-space-2); margin:var(--jhs-space-2) 0; }

                .jhs-setting-layout {
                    display: grid;
                    grid-template-columns: 180px minmax(0, 1fr);
                    height: 100%;
                    min-height: 0;
                    background: var(--jhs-surface);
                }

                .jhs-mobile-sidebar {
                    display: flex;
                    min-width: 0;
                    flex-direction: column;
                    gap: 2px;
                    padding: var(--jhs-space-3) var(--jhs-space-2);
                    border-right: 1px solid var(--jhs-border);
                    background: var(--jhs-surface-2);
                    overflow-y: auto;
                }

                .side-menu-item {
                    width: 100%;
                    min-height: 36px;
                    padding: 0 var(--jhs-space-3);
                    border: 0;
                    border-radius: var(--jhs-radius-sm);
                    background: transparent;
                    cursor: pointer;
                    color: var(--jhs-text);
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    font: inherit;
                    font-size: var(--jhs-font-size-sm);
                    text-align: left;
                    transition: background-color var(--jhs-motion-fast) var(--jhs-ease), color var(--jhs-motion-fast) var(--jhs-ease);
                }

                .side-menu-item .icon {
                     height: 24px;
                     width: 24px;
                }

                .side-menu-item:hover {
                    background-color: var(--jhs-surface);
                }

                .side-menu-item.active {
                    background-color: var(--jhs-accent-tint);
                    color: var(--jhs-accent);
                    font-weight: 700;
                }

                .jhs-setting-main {
                    display: flex;
                    min-width: 0;
                    min-height: 0;
                    flex-direction: column;
                    height: 100%;
                }

                .jhs-setting-body {
                    flex: 1;
                    min-height: 0;
                    padding: 0 var(--jhs-space-4);
                    overflow: hidden;
                }

                .jhs-setting-body-inner {
                    width: min(100%, 880px);
                    height: 100%;
                    margin-inline: auto;
                }

                .content-panel {
                    display: none;
                    box-sizing: border-box;
                    margin: 0;
                    padding: var(--jhs-space-4) 0;
                    height: 100%;
                    overflow-x: hidden;
                    overflow-y: auto;
                }

                .content-panel.active {
                    display: block;
                }

                .jhs-setting-section + .jhs-setting-section {
                    margin-top: var(--jhs-space-5);
                }
                .jhs-setting-section > .jhs-setting-group { overflow:visible; border:0; border-radius:0; }

                .jhs-setting-section__header {
                    margin-bottom: var(--jhs-space-2);
                }

                .jhs-setting-section__header h3 {
                    margin: 0;
                    color: var(--jhs-text);
                    font-size: var(--jhs-font-size-lg);
                }

                .jhs-setting-section__header p {
                    margin: var(--jhs-space-1) 0 0;
                    color: var(--jhs-text-muted);
                    font-size: var(--jhs-font-size-sm);
                }

                .jhs-setting-row__copy {
                    min-width: 0;
                }

                .jhs-setting-row__description {
                    display: block;
                    margin-top: var(--jhs-space-1);
                    color: var(--jhs-text-muted);
                    font-size: var(--jhs-font-size-sm);
                    font-weight: 400;
                    line-height: 1.45;
                }

                .jhs-setting-row__control {
                    width: min(100%, 360px);
                    justify-self: end;
                }
                .keyword-label { background:var(--jhs-surface-2); color:var(--jhs-text); }
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
                .jhs-plugin-group__title { margin:0; padding:var(--jhs-space-2) 0; border-bottom:1px solid var(--jhs-border); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-plugin-row { display:flex; min-height:48px; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); padding:var(--jhs-space-2) 0; border-bottom:1px solid var(--jhs-border); }
                .jhs-plugin-row:last-child { border-bottom:0; }
                .jhs-plugin-copy { display:grid; min-width:0; gap:2px; }
                .jhs-plugin-copy strong { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-data-table { width:100%; border-collapse:collapse; color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
                .jhs-data-table th { padding:var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); text-align:left; }
                .jhs-data-table td { padding:var(--jhs-space-1) var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); }
                .jhs-data-table .is-center { text-align:center; }
                .jhs-data-table .is-right { text-align:right; }
                .jhs-data-table .is-danger { color:var(--jhs-danger); }
                .jhs-data-table .is-warning { color:var(--jhs-warning); }
                .jhs-data-table .is-success { color:var(--jhs-status-down); }
                .jhs-data-table .is-muted { color:var(--jhs-text-faint); }
                .jhs-data-table .is-slow { color:var(--jhs-danger); font-weight:700; }
                .jhs-diagnostics { margin-top:var(--jhs-space-5); border-top:1px solid var(--jhs-border); }
                .jhs-diagnostics > summary { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; padding:var(--jhs-space-3) 0; color:var(--jhs-text); font-size:var(--jhs-font-size-md); font-weight:600; cursor:pointer; }
                .jhs-diagnostics > summary::after { color:var(--jhs-text-muted); content:"展开"; font-size:var(--jhs-font-size-sm); font-weight:400; }
                .jhs-diagnostics[open] > summary::after { content:"收起"; }
                .jhs-diagnostics__content { padding-bottom:var(--jhs-space-3); }
                .jhs-empty-note { padding:var(--jhs-space-5); color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); text-align:center; }
                .jhs-caption { margin:var(--jhs-space-2) 0 0; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                .jhs-inline-metrics { display:flex; flex-wrap:wrap; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-2); font-size:var(--jhs-font-size-sm); }
                .jhs-summary-grid { display:grid; grid-template-columns:repeat(4,minmax(0,1fr)); gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-3); }
                .jhs-summary-card { padding:var(--jhs-space-3); border-radius:var(--jhs-radius-md); background:var(--jhs-surface-2); text-align:center; }
                .jhs-summary-card strong { display:block; font-size:var(--jhs-font-size-xl); }
                .jhs-summary-card--success { background:var(--jhs-status-down-tint); color:var(--jhs-status-down); }
                .jhs-summary-card--danger { background:var(--jhs-status-filter-tint); color:var(--jhs-status-filter); }
                .jhs-summary-card--warning { background:var(--jhs-status-watch-tint); color:var(--jhs-status-watch); }
                .jhs-scroll-frame { max-height:350px; overflow:auto; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); }
                .jhs-dialog-content { padding:var(--jhs-space-4); }
                .jhs-warning-note { margin-top:var(--jhs-space-3); color:var(--jhs-status-filter); font-size:var(--jhs-font-size-xs); }
                .jhs-health-summary { margin-bottom:var(--jhs-space-2); }
                .jhs-health-columns { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-3); }
                .jhs-health-columns h4 { margin:0 0 var(--jhs-space-1); }

                .jhs-setting-footer {
                    display: flex;
                    flex-shrink: 0;
                    justify-content: flex-end;
                    gap: var(--jhs-space-2);
                    padding: var(--jhs-space-3) var(--jhs-space-4);
                    border-top: 1px solid var(--jhs-border);
                    background: var(--jhs-surface);
                }

                .jhs-cache-grid {
                    display: grid;
                    grid-template-columns: repeat(2, minmax(0, 1fr));
                    gap: var(--jhs-space-3);
                    margin-top: var(--jhs-space-4);
                }

                @media (max-width: 768px) {
                    .jhs-setting-layout {
                        grid-template-columns: minmax(0, 1fr);
                        grid-template-rows: auto minmax(0, 1fr);
                    }
                    .jhs-mobile-sidebar {
                        flex-direction: row;
                        padding: var(--jhs-space-2);
                        border-right: 0;
                        border-bottom: 1px solid var(--jhs-border);
                        overflow-x: auto;
                        overflow-y: hidden;
                    }
                    .side-menu-item {
                        width: auto;
                        min-width: max-content;
                        min-height: var(--jhs-touch-target);
                    }
                    .jhs-setting-body {
                        padding-inline: var(--jhs-space-3);
                    }
                    .jhs-cache-grid {
                        grid-template-columns: minmax(0, 1fr);
                    }
                    .jhs-summary-grid, .jhs-health-columns { grid-template-columns:minmax(0,1fr); }
                }

                input[type="checkbox"]:disabled {
                    opacity: 0.6;
                    cursor: default !important;
                }
            </style>
        `;
}

/** Toggle between vertical (cover-fit) and normal (contain) image display modes. */
async function applyImageMode() {
    $("#verticalImgStyle").remove();
    if (await storageManager.getSetting("enableVerticalModel", C) === _) {
        let e = "100% 50% !important";
        window.location.href.includes("/advanced_search?type=100") && (e = "50% 50% !important");
        const t = `
                .cover {
                    min-height: 350px !important;
                    overflow: hidden !important;
                    padding-top: 142% !important;
                }

                .cover img {
                    object-fit: cover !important;
                    object-position: ${e};
                }

                /* bus的 */
                .masonry .movie-box img {
                    min-height: 500px !important;
                    object-fit: cover !important;
                    object-position: top right;
                }
            `;
        $("<style>").attr("id", "verticalImgStyle").text(t).appendTo("head");
    } else {
        const e = `
                .cover {
                    min-height:auto !important;
                    padding-top: 67% !important;
                }
                .cover img {
                    object-fit: contain !important;
                    object-position: 50% 50% !important
                }

                /* bus的 */
                 .masonry .movie-box img {
                    min-height:auto !important;
                    object-fit: contain !important;
                    object-position: top;
                }
            `;
        $("<style>").attr("id", "verticalImgStyle").text(e).appendTo("head");
    }
    l && window.getBeanForSetting("BusImgPlugin").logImageHeightsByRow();
}
