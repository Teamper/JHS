// @ts-check

import { H, getJavBusHiddenNavCss, getJavDbHiddenNavCss, l, r } from "./constants.js";
import { buildThemeCss } from "./theme.js";
import { buildUiPrimitivesCss } from "./ui-primitives.js";

/** CSS injection for site-specific layouts, global UI, and responsive behavior. */

function buildJavBusCss() { return `
<style>
    .top-bar { z-index:var(--jhs-z-host-topbar)!important; }
    ${getJavBusHiddenNavCss()}
    .masonry { display:grid; box-sizing:border-box; width:100%!important; height:100%!important; padding:0 var(--jhs-space-4)!important; column-gap:var(--jhs-space-3); row-gap:var(--jhs-space-3); grid-template-columns:repeat(4,minmax(0,1fr)); align-items:start; }
    .masonry .item { top:initial!important; left:initial!important; float:none!important; position:relative!important; background-color:var(--jhs-surface-2); }
    .masonry .movie-box { width:100%!important; height:100%!important; margin:0!important; overflow:inherit!important; }
    .masonry .movie-box .photo-frame { height:auto!important; margin:0!important; position:relative; }
    .masonry .movie-box img { max-height:500px; height:100%!important; object-fit:contain; object-position:top; transform:none!important; transition:none!important; }
    .masonry .photo-info span { display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .photo-frame .mheyzo, .photo-frame .mcaribbeancom2 { margin-left:0!important; }
    .avatar-box { display:flex!important; width:100%!important; margin:0!important; }
    .avatar-box .photo-info { display:flex; align-items:center; justify-content:center; gap:var(--jhs-space-6); flex-direction:row; background-color:var(--jhs-surface)!important; }
    footer:not(:where(.jhs-ui, .jhs-ui *)) { display:none!important; }
    .video-title { display:-webkit-box!important; height:75px; white-space:normal!important; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
</style>`; }

function buildJavDbCss() { return `
<style>
    ${getJavDbHiddenNavCss()}
    .navbar { z-index:var(--jhs-z-host-nav)!important; padding:0; }
    .navbar-link:not(.is-arrowless) { padding-right:33px; }
    .sub-header, #footer, .app-desktop-banner,
    div[data-controller="movie-tab"] .tabs, h3.main-title,
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(3),
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(2),
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(1),
    .top-meta, .float-buttons { display:none!important; }
    div.tabs.no-bottom, .tabs ul { border-bottom:none!important; }
    [data-jhs-primary-list] { display:grid; gap:var(--jhs-space-3); min-width:0; }
    [data-jhs-primary-list] > .item { min-width:0; width:100%; }
    @media(max-width:767px) { [data-jhs-native-recommendations] { grid-template-columns:repeat(2,minmax(0,1fr))!important; } }
    :is([data-jhs-primary-list],[data-jhs-native-recommendations]) .item { position:relative!important; }
    .item > a[data-jhs-fc2-primary="true"], .item > a[data-jhs-fc2-primary="true"] .cover, .item > a[data-jhs-fc2-primary="true"] .cover img { display:block!important; width:100%!important; }
    :is([data-jhs-primary-list],[data-jhs-native-recommendations]) .item .cover img { transform:none!important; transition:none!important; }
    :is([data-jhs-primary-list],[data-jhs-native-recommendations]) .video-title { min-width:0; overflow:hidden; overflow-wrap:anywhere; clip-path:inset(0 0 max(0px,calc(100% - 3lh)) 0); }
    :is([data-jhs-primary-list],[data-jhs-native-recommendations]) .video-title { display:-webkit-box; height:80px; white-space:normal!important; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
    .main-tabs, .tabs { overflow-x:hidden; flex-wrap:wrap; justify-content:flex-start; }
    .main-tabs ul, .tabs ul { flex-wrap:wrap; flex-grow:0; }
    .toolbar { display:flex; }
</style>`; }

const F = `
<style>
    .fr-btn { float:right; margin-left:var(--jhs-space-1)!important; }
    .menu-box { position:fixed; right:10px; top:50%; display:flex; flex-direction:column; gap:var(--jhs-space-2); z-index:var(--jhs-z-dropdown); transform:translateY(-50%); }
    .do-hide { display:none!important; }
    .jhs-icon { width:var(--jhs-icon-sm); height:var(--jhs-icon-sm); }
    .tool-box .jhs-icon { width:var(--jhs-icon-lg); height:var(--jhs-icon-lg); }
    .jhs-nav-btn { color:var(--jhs-accent)!important; font-weight:var(--jhs-font-weight-semibold); }
    .jhs-nav-btn:hover { color:var(--jhs-accent-hover)!important; }
    .tabulator .tabulator-row .action-cell-dropdown { overflow:visible!important; }
    .tabulator .tabulator-row.tabulator-selectable:hover { cursor:default!important; }
    .tabulator .tabulator-col.tabulator-sortable[aria-sort="ascending"] .tabulator-arrow { border-bottom-color:var(--jhs-accent)!important; }
    .tabulator .tabulator-col.tabulator-sortable[aria-sort="descending"] .tabulator-arrow { border-top-color:var(--jhs-accent)!important; }
    .tabulator-responsive-collapse { border-top:none!important; }
    .tabulator-responsive-collapse table { margin-left:50px!important; }
    .tabulator-cell { height:auto!important; }
    .tabulator .tabulator-cell { white-space:normal!important; text-overflow:clip!important; }
    .tabulator-tableholder { overflow-x:hidden!important; }
</style>`;

let coreCssInjected = false;

/** 在 Bootstrap 阶段一次性注入核心、宿主和 UI primitive 样式。 @param {{register?: (id: string, css: string) => unknown}} [styles] @param {string} [detailPanelCss] */
export function injectCoreCss(styles, detailPanelCss = "") {
    if (coreCssInjected) return;
    const register = (/** @type {string} */ id, /** @type {string} */ css) => styles?.register ? styles.register(id, css.replace(/^\s*<style\b[^>]*>|<\/style>\s*$/g, "")) : H(css);
    register("jhs-core-theme", buildThemeCss());
    l && register("jhs-host-javbus", buildJavBusCss()), r && register("jhs-host-javdb", buildJavDbCss());
    register("jhs-core-layout", F);
    register("jhs-ui-primitives", buildUiPrimitivesCss());
    if (detailPanelCss) register("jhs-detail-panels", detailPanelCss);
    coreCssInjected = true;
}
