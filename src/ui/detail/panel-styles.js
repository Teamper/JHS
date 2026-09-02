// @ts-check

/** Shared styles for detail panels that may be mounted by more than one feature. */
export function buildDetailPanelCss() {
    return `
        .jhs-review-panel { min-width:0; }
        .jhs-panel-header { display:flex; min-height:var(--jhs-control-height); align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
        .jhs-panel-header h3 { margin:0; color:var(--jhs-text); font-size:var(--jhs-font-size-xl); }
        .jhs-panel-toggle { flex:none; }
        .jhs-review-list { display:grid; }
        .jhs-review-item { min-width:0; padding:var(--jhs-space-4) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
        .jhs-review-item:last-child { border-bottom:0; }
        .jhs-review-meta { display:flex; flex-wrap:wrap; align-items:center; gap:var(--jhs-space-1) var(--jhs-space-3); color:var(--jhs-text-muted); font-size:14px; }
        .jhs-review-author { color:var(--jhs-text); font-size:15px; font-weight:600; }
        .jhs-review-floor { margin-left:auto; color:var(--jhs-text-faint); }
        .jhs-review-content { margin:var(--jhs-space-3) 0 0; color:var(--jhs-text); font-size:16px; line-height:1.7; overflow-wrap:anywhere; white-space:pre-wrap; }
        .jhs-review-link { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); padding:2px var(--jhs-space-2); border:0; border-radius:var(--jhs-radius-pill); background:var(--jhs-accent-tint); color:var(--jhs-accent); font:inherit; font-size:var(--jhs-font-size-sm); line-height:1.5; text-decoration:none; vertical-align:baseline; cursor:pointer; }
        .jhs-review-link-copy { color:var(--jhs-text-muted); }
        .jhs-review-link-wrap { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-2); width:100%; margin:var(--jhs-space-1) 0; }
        .jhs-review-inline-controls { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin:0 var(--jhs-space-1); }
        .jhs-review-link-main { display:inline-flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
        .jhs-review-link-actions { display:inline-flex; align-items:center; gap:var(--jhs-space-1); margin-left:auto; flex-shrink:0; }
        .jhs-review-offline-btn { background:var(--jhs-accent) !important; color:var(--jhs-accent-text-on) !important; }
        .jhs-panel-state { padding:var(--jhs-space-4) 0; color:var(--jhs-text-muted); text-align:center; }
        .jhs-panel-footer { display:flex; justify-content:center; padding-top:var(--jhs-space-3); }
        .jhs-panel-end { color:var(--jhs-text-faint); font-size:var(--jhs-font-size-sm); }
        @media (max-width:767px) { .jhs-review-floor { width:100%; margin-left:0; } }
        .jhs-related-panel { min-width:0; }
        .jhs-related-list { display:grid; }
        .jhs-related-item { display:grid; gap:var(--jhs-space-2); padding:var(--jhs-space-3) 0; border-bottom:1px solid color-mix(in srgb,var(--jhs-border) 55%,transparent); }
        .jhs-related-item:last-child { border-bottom:0; }
        .jhs-related-heading { display:flex; min-width:0; align-items:baseline; gap:var(--jhs-space-2); }
        .jhs-related-index { flex:none; color:var(--jhs-text-faint); font-size:14px; }
        .jhs-related-title { min-width:0; overflow:hidden; color:var(--jhs-accent); font-size:16px; font-weight:600; text-overflow:ellipsis; text-decoration:none; white-space:nowrap; }
        .jhs-related-meta { display:flex; flex-wrap:wrap; gap:var(--jhs-space-2) var(--jhs-space-4); color:var(--jhs-text-muted); font-size:14px; }
        .jhs-related-time { color:var(--jhs-text-faint); font-size:14px; white-space:nowrap; }
    `;
}
