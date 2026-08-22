/** CSS injection for site-specific layouts, global UI, and responsive behavior. */

const N = `
<style>
    .top-bar { z-index:var(--jhs-z-host-topbar)!important; }
    ${M}
    .masonry { display:grid; width:100%!important; height:100%!important; padding:0 15px!important; column-gap:10px; row-gap:10px; grid-template-columns:repeat(4,minmax(0,1fr)); align-items:start; }
    .masonry .item { top:initial!important; left:initial!important; float:none!important; position:relative!important; background-color:var(--jhs-surface-2); }
    .masonry .movie-box { width:100%!important; height:100%!important; margin:0!important; overflow:inherit!important; }
    .masonry .movie-box .photo-frame { height:auto!important; margin:0!important; position:relative; }
    .masonry .movie-box img { max-height:500px; height:100%!important; object-fit:contain; object-position:top; transform:none!important; transition:none!important; }
    .masonry .photo-info span { display:inline-block; max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
    .photo-frame .mheyzo, .photo-frame .mcaribbeancom2 { margin-left:0!important; }
    .avatar-box { display:flex!important; width:100%!important; margin:0!important; }
    .avatar-box .photo-info { display:flex; align-items:center; justify-content:center; gap:30px; flex-direction:row; background-color:var(--jhs-surface)!important; }
    footer { display:none!important; }
    .video-title { display:-webkit-box!important; height:75px; white-space:normal!important; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
</style>`;

const E = `
<style>
    ${j}
    .navbar { z-index:var(--jhs-z-host-nav)!important; padding:0; }
    .navbar-link:not(.is-arrowless) { padding-right:33px; }
    .sub-header, #footer, .app-desktop-banner,
    div[data-controller="movie-tab"] .tabs, h3.main-title,
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(3),
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(2),
    div.video-detail > div:nth-child(4) > div > div.tabs.no-bottom > ul > li:nth-child(1),
    .top-meta, .float-buttons { display:none!important; }
    div.tabs.no-bottom, .tabs ul { border-bottom:none!important; }
    .movie-list .item { position:relative!important; }
    .movie-list .item .cover img { transform:none!important; transition:none!important; }
    .video-title { display:-webkit-box; height:80px; white-space:normal!important; -webkit-box-orient:vertical; -webkit-line-clamp:3; }
    .main-tabs, .tabs { overflow-x:hidden; flex-wrap:wrap; justify-content:flex-start; }
    .main-tabs ul, .tabs ul { flex-wrap:wrap; flex-grow:0; }
    .toolbar { display:flex; }
</style>`;

const F = `
<style>
    .fr-btn { float:right; margin-left:4px!important; }
    .menu-box { position:fixed; right:10px; top:50%; display:flex; flex-direction:column; gap:6px; z-index:var(--jhs-z-dropdown); transform:translateY(-50%); }
    .do-hide { display:none!important; }
    .jhs-icon { width:16px; height:16px; }
    .tool-box .jhs-icon { width:1.5rem; height:1.5rem; }
    .jhs-nav-btn { color:var(--jhs-accent)!important; font-weight:600; }
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

H(buildThemeCss());
l && H(N), r && H(E);
H(F);
H(buildUiPrimitivesCss());
initializeUiAccessibility();
