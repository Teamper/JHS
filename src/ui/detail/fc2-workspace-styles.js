// @ts-check

/** Shared FC2 workspace styles registered by the owning Features. */
export const FC2_WORKSPACE_STYLES = `
            .movie-detail-layer .layui-layer-content { min-height:0; overflow:hidden; background:var(--jhs-bg); }
            .movie-detail-layer .jhs-fc2-dialog-host { height:100%; min-height:0; }
            .jhs-fc2-workspace { display:grid; grid-auto-rows:max-content; align-content:start; width:min(100%,1440px); min-width:0; margin:0 auto; padding:var(--jhs-space-5); gap:var(--jhs-space-4); box-sizing:border-box; background:var(--jhs-bg); color:var(--jhs-text); }
            .jhs-fc2-workspace[data-jhs-fc2-mode="dialog"] { height:100%; min-height:0; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; -webkit-overflow-scrolling:touch; }
            .jhs-fc2-section { min-width:0; overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
            .jhs-fc2-section__header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); padding:var(--jhs-space-3) var(--jhs-space-5); border-bottom:1px solid var(--jhs-border); background:var(--jhs-surface-2); }
            .jhs-fc2-section__header h2 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); }
            .jhs-fc2-section__actions { display:flex; align-items:center; gap:var(--jhs-space-2); }
            .jhs-fc2-section__content { min-width:0; padding:var(--jhs-space-5); }
            .jhs-fc2-summary { display:grid; grid-template-columns:minmax(220px,34%) minmax(0,1fr); gap:var(--jhs-space-5); }
            .jhs-fc2-preview { display:grid; min-height:240px; place-items:center; overflow:hidden; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
            .jhs-fc2-preview:empty::after { color:var(--jhs-text-faint); content:"暂无预览"; }
            .jhs-fc2-preview img { display:block; width:100%; height:100%; max-height:520px; object-fit:contain; }
            .jhs-fc2-title { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:clamp(20px,2.4vw,28px); line-height:1.35; }
            .jhs-fc2-meta { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2) var(--jhs-space-4); margin-bottom:var(--jhs-space-3); color:var(--jhs-text-muted); }
            .jhs-fc2-actors { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-2); }
            .jhs-fc2-actor { display:inline-flex; padding:var(--jhs-space-1) var(--jhs-space-2); border-radius:var(--jhs-radius-pill); background:var(--jhs-surface-2); color:var(--jhs-text); font-size:var(--jhs-font-size-sm); }
            .jhs-fc2-toolbar { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); margin-top:var(--jhs-space-4); }
            .jhs-fc2-gallery-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(112px,144px)); justify-content:start; gap:var(--jhs-space-3); }
            .jhs-fc2-gallery-item { display:block; width:100%; min-width:0; padding:0; overflow:hidden; border:1px solid transparent; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); aspect-ratio:3/2; cursor:zoom-in; }
            .jhs-fc2-gallery-item:focus-visible { border-color:var(--jhs-accent); outline:2px solid var(--jhs-accent); outline-offset:2px; }
            .jhs-fc2-gallery__image { display:block; width:100%; height:100%; object-fit:cover; }
            .jhs-fc2-screenshot { margin-top:var(--jhs-space-4); overflow:hidden; border-radius:var(--jhs-radius-sm); }
            .jhs-fc2-screenshot:empty { display:none; margin:0; }
            .jhs-fc2-screenshot-thumbnail { width:112px; max-width:100%; }
            .jhs-fc2-resource-stack { display:grid; gap:var(--jhs-space-4); }
            .jhs-fc2-resource-group { min-width:0; }
            .jhs-fc2-resource-group + .jhs-fc2-resource-group { padding-top:var(--jhs-space-4); border-top:1px solid var(--jhs-border); }
            .jhs-fc2-resource-title { margin:0 0 var(--jhs-space-3); color:var(--jhs-text); font-size:var(--jhs-font-size-md); }
            .jhs-fc2-magnet-item { display:grid; grid-template-columns:minmax(0,1fr) auto; gap:var(--jhs-space-3); padding:var(--jhs-space-3) 0; border-bottom:1px solid var(--jhs-border); }
            .jhs-fc2-magnet-item:last-child { border-bottom:0; }
            .jhs-fc2-magnet-name { min-width:0; overflow-wrap:anywhere; }
            .jhs-fc2-magnet-tags { display:flex; flex-wrap:wrap; gap:var(--jhs-space-1); margin-top:var(--jhs-space-2); }
            .jhs-fc2-source-links { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2); margin-top:var(--jhs-space-3); }
            .jhs-fc2-resource-group.is-collapsed > [data-jhs-role="magnet-hub"] > [data-jhs-role="magnet-hub-content"] { display:none; }
            .jhs-fc2-state { padding:var(--jhs-space-5); color:var(--jhs-text-muted); text-align:center; }
            .jhs-fc2-state.is-error { color:var(--jhs-danger); }
            @media (max-width:767px) {
                .jhs-fc2-workspace { padding:var(--jhs-space-3); gap:var(--jhs-space-3); }
                .jhs-fc2-section__header,.jhs-fc2-section__content { padding:var(--jhs-space-3); }
                .jhs-fc2-summary { grid-template-columns:1fr; }
                .jhs-fc2-preview { min-height:200px; }
                .jhs-fc2-gallery-grid { grid-template-columns:repeat(2,minmax(0,1fr)); gap:var(--jhs-space-2); }
                .jhs-fc2-toolbar .jhs-btn,.jhs-fc2-section__actions .jhs-btn { min-height:44px; }
                .jhs-fc2-magnet-item { grid-template-columns:1fr; }
            }
            @media (max-width:420px) { .jhs-fc2-toolbar { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); } .jhs-fc2-toolbar .jhs-btn { width:100%; } }
            @media (max-width:339px) { .jhs-fc2-toolbar { grid-template-columns:1fr; } }
            @media (prefers-reduced-motion:reduce) { .jhs-fc2-workspace * { scroll-behavior:auto!important; transition-duration:0.01ms!important; } }
        `;
