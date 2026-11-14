// @ts-check

/** Shared feedback and diagnostics CSS, injected once with UI primitives. */
export function buildFeedbackCss() {
    return `
    .loading-container { position:fixed; inset:0; display:flex; align-items:center; justify-content:center; background:var(--jhs-loading-overlay); z-index:var(--jhs-z-loading); }
    .loading-animation { position:relative; width:64px; height:12px; border-radius:var(--jhs-radius-xs); background:var(--jhs-accent); box-shadow:var(--jhs-shadow-sm); animation:jhs-loading 1.8s var(--jhs-ease) infinite; }
    .loading-animation::before,.loading-animation::after { position:absolute; display:block; height:12px; border-radius:var(--jhs-radius-xs); box-shadow:var(--jhs-shadow-sm); animation:inherit; content:""; }
    .loading-animation::before { top:-24px; left:8px; width:48px; background:var(--jhs-accent-tint); }
    .loading-animation::after { bottom:-24px; left:16px; width:32px; background:var(--jhs-border-strong); }
    @keyframes jhs-loading { 0%,100% { transform:translateX(32px); } 50% { transform:translateX(-32px); } }

    .toastify.jhs-toast { display:flex; align-items:center; gap:var(--jhs-space-3); max-width:calc(100vw - var(--jhs-space-6)); padding:var(--jhs-space-3) var(--jhs-space-4); border:1px solid var(--jhs-feedback-color); border-radius:var(--jhs-radius-md); background:var(--jhs-feedback-bg); color:var(--jhs-feedback-color); box-shadow:var(--jhs-shadow-md); font-family:var(--jhs-font); font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-normal); line-height:var(--jhs-line-height-ui); text-align:left; z-index:var(--jhs-z-tooltip); }
    .toastify.jhs-toast.toastify-center { width:fit-content; }
    .jhs-toast--info { --jhs-feedback-color:var(--jhs-accent); --jhs-feedback-bg:var(--jhs-accent-tint); }
    .jhs-toast--success { --jhs-feedback-color:var(--jhs-success); --jhs-feedback-bg:var(--jhs-success-tint); }
    .jhs-toast--warning { --jhs-feedback-color:var(--jhs-warning); --jhs-feedback-bg:var(--jhs-warning-tint); }
    .jhs-toast--error { --jhs-feedback-color:var(--jhs-danger); --jhs-feedback-bg:var(--jhs-danger-tint); }
    .jhs-toast__content { display:flex; align-items:center; gap:var(--jhs-space-2); min-width:0; }
    .jhs-toast__content > .jhs-icon { flex:none; width:var(--jhs-icon-md); height:var(--jhs-icon-md); }
    .jhs-toast__message { overflow-wrap:anywhere; }
    .jhs-toast .toast-close { display:inline-flex; align-items:center; justify-content:center; flex:none; width:var(--jhs-control-height-sm); height:var(--jhs-control-height-sm); margin:0; padding:0; border:0; border-radius:var(--jhs-radius-sm); background:transparent; color:inherit; opacity:1; cursor:pointer; }
    .jhs-toast .toast-close:hover { background:color-mix(in srgb,currentColor 12%,transparent); }
    .jhs-feedback { display:flex; align-items:flex-start; gap:var(--jhs-space-2); padding:var(--jhs-space-3); border-radius:var(--jhs-radius-md); color:var(--jhs-danger-text); background:var(--jhs-danger-tint); font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); }
    .jhs-feedback .jhs-icon { flex:none; }
    .jhs-field-error { display:flex; align-items:center; gap:var(--jhs-space-2); margin-top:var(--jhs-space-1); color:var(--jhs-danger-text); font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); }
    .jhs-field-error[hidden] { display:none; }

    .jhs-image-viewer .viewer-canvas { overflow:hidden!important; touch-action:none; }
    .jhs-image-viewer-status { font-family:var(--jhs-font); font-size:var(--jhs-font-size-md); line-height:var(--jhs-line-height-ui); position:absolute; top:var(--jhs-space-6); left:50%; transform:translateX(-50%); display:flex; align-items:center; gap:var(--jhs-space-3); padding:var(--jhs-space-3); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); color:var(--jhs-text); }
    .jhs-image-viewer-status[hidden] { display:none; }
    .jhs-image-viewer .viewer-footer { font-family:var(--jhs-font); font-size:var(--jhs-font-size-md); line-height:var(--jhs-line-height-ui); padding:var(--jhs-space-2); box-sizing:border-box; background:var(--jhs-surface); }
    .jhs-image-viewer-toolbar { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
    .jhs-image-viewer .jhs-btn { min-width:var(--jhs-touch-target); min-height:var(--jhs-touch-target); }
    .jhs-image-viewer-nav,.jhs-image-viewer-close { position:absolute; z-index:var(--jhs-z-local-popover); padding:0; width:var(--jhs-touch-target); height:var(--jhs-touch-target); }
    .jhs-image-viewer-nav { top:calc(50% - var(--jhs-touch-target) / 2); }
    .jhs-image-viewer-prev { left:var(--jhs-space-2); }
    .jhs-image-viewer-next { right:var(--jhs-space-2); }
    .jhs-image-viewer-close { right:var(--jhs-space-2); top:var(--jhs-space-2); }
    .jhs-image-viewer .viewer-close,.jhs-image-viewer-close { background:var(--jhs-overlay)!important; color:var(--jhs-overlay-text)!important; border-color:transparent!important; }
    .jhs-image-viewer .viewer-close:hover,.jhs-image-viewer-close:hover { background:var(--jhs-overlay-hover)!important; }
    .jhs-image-viewer-count { min-width:48px; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); font-variant-numeric:tabular-nums; }

    .js-tooltip { position:fixed; display:none; max-width:min(var(--jhs-tooltip-max-width),calc(100vw - var(--jhs-space-4))); padding:var(--jhs-space-2) var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface-2); color:var(--jhs-text); box-shadow:var(--jhs-shadow-md); font-family:var(--jhs-font); font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); white-space:normal; overflow-wrap:anywhere; pointer-events:auto; z-index:var(--jhs-z-tooltip); }
    .js-tooltip.is-active { display:block!important; }

    body[data-jhs-debug-visible="true"]::after { content:""; display:block; height:calc(var(--jhs-touch-target) + var(--jhs-space-4)); pointer-events:none; }
    .console-logger-container { pointer-events:none; position:fixed; bottom:0; right:0; display:flex; flex-direction:column; align-items:flex-end; width:fit-content; font-family:var(--jhs-font); color:var(--jhs-text); z-index:var(--jhs-z-debug); }
    .console-logger-toggle { pointer-events:auto; display:flex; align-items:center; justify-content:center; width:var(--jhs-touch-target); height:var(--jhs-control-height-sm); padding:0; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md) var(--jhs-radius-md) 0 0; background:var(--jhs-accent); color:var(--jhs-accent-text-on); box-shadow:var(--jhs-shadow-sm); cursor:pointer; transition:background-color var(--jhs-motion-fast) var(--jhs-ease); }
    .console-logger-toggle:hover { background:var(--jhs-accent-hover); }
    .console-logger-toggle .jhs-icon { transition:transform var(--jhs-motion-base) var(--jhs-ease); }
    .console-logger-toggle.collapsed .jhs-icon { transform:rotate(180deg); }
    .console-logger-window { pointer-events:auto; display:flex; flex-direction:column; box-sizing:border-box; width:min(400px,100vw); height:400px; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-lg) 0 var(--jhs-radius-lg) var(--jhs-radius-lg); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-lg); overflow:hidden; transform:translateY(0); opacity:1; transition:width var(--jhs-motion-base) var(--jhs-ease),height var(--jhs-motion-base) var(--jhs-ease),opacity var(--jhs-motion-base) var(--jhs-ease),transform var(--jhs-motion-base) var(--jhs-ease); }
    .console-logger-window.maximized { width:min(600px,100vw)!important; height:85vh!important; border-radius:var(--jhs-radius-lg) 0 0 var(--jhs-radius-lg); }
    .console-logger-window.collapsed { height:0!important; min-height:0!important; opacity:0; visibility:hidden; }
    .console-logger-header { display:flex; align-items:center; justify-content:space-between; flex:none; gap:var(--jhs-space-2); padding:var(--jhs-space-3) var(--jhs-space-4); background:var(--jhs-surface-2); border-bottom:1px solid var(--jhs-border); color:var(--jhs-text); }
    .console-logger-title { font-size:var(--jhs-font-size-lg); font-weight:var(--jhs-font-weight-semibold); line-height:var(--jhs-line-height-tight); }
    .console-logger-controls { display:flex; gap:var(--jhs-space-2); }
    .console-logger-controls button,.console-logger-scroll-to-bottom { display:inline-flex; align-items:center; justify-content:center; gap:var(--jhs-space-1); min-height:var(--jhs-control-height-sm); padding:var(--jhs-space-1) var(--jhs-space-2); border:1px solid var(--jhs-border-strong); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface); color:var(--jhs-text); font:inherit; font-size:var(--jhs-font-size-sm); font-weight:var(--jhs-font-weight-semibold); line-height:var(--jhs-line-height-tight); cursor:pointer; transition:background-color var(--jhs-motion-fast) var(--jhs-ease); }
    .console-logger-controls button:hover,.console-logger-scroll-to-bottom:hover { background:var(--jhs-surface-hover); }
    .console-logger-maximize-toggle { min-width:var(--jhs-control-height-sm); }
    .console-logger-filters { display:flex; align-items:center; flex:none; gap:var(--jhs-space-2); padding:var(--jhs-space-2); background:var(--jhs-surface-2); border-bottom:1px solid var(--jhs-border); overflow:hidden; }
    .console-logger-filter-group { display:flex; flex:1; min-width:0; gap:var(--jhs-space-1); padding-right:var(--jhs-space-2); overflow-x:auto; }
    .console-logger-filter { flex:none; min-height:var(--jhs-control-height-sm); padding:var(--jhs-space-1) var(--jhs-space-2); border:1px solid var(--jhs-border-strong); border-radius:var(--jhs-radius-pill); background:var(--jhs-input-bg); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); line-height:var(--jhs-line-height-tight); white-space:nowrap; cursor:pointer; transition:background-color var(--jhs-motion-fast) var(--jhs-ease),border-color var(--jhs-motion-fast) var(--jhs-ease); }
    .console-logger-filter.active { background:var(--jhs-accent-tint); color:var(--jhs-accent); border-color:var(--jhs-accent); }
    .console-logger-scroll-to-bottom { flex:none; margin-left:auto; white-space:nowrap; }
    .console-logger-content { flex:1; min-height:0; padding:var(--jhs-space-2); overflow-y:auto; background:var(--jhs-surface); overflow-wrap:anywhere; text-align:left; }
    .console-logger-entry { padding:var(--jhs-space-2) var(--jhs-space-3); margin-bottom:var(--jhs-space-1); border-left:3px solid transparent; border-radius:var(--jhs-radius-sm); font-size:var(--jhs-font-size-sm); line-height:var(--jhs-line-height-ui); }
    .console-logger-entry[data-type="base"] { border-left-color:var(--jhs-accent); background:var(--jhs-accent-tint); }
    .console-logger-entry[data-type="warn"] { border-left-color:var(--jhs-warning); background:var(--jhs-warning-tint); }
    .console-logger-entry[data-type="error"] { border-left-color:var(--jhs-danger); background:var(--jhs-danger-tint); }
    .console-logger-entry[data-type="debug"] { border-left-color:var(--jhs-border-strong); background:var(--jhs-surface-2); }
    .console-logger-timestamp { margin-right:var(--jhs-space-1); color:var(--jhs-text-muted); font-family:var(--jhs-font-mono); font-size:var(--jhs-font-size-xs); font-variant-numeric:tabular-nums; line-height:var(--jhs-line-height-tight); }
    .console-logger-message[data-type="json"] { white-space:pre-wrap; font-family:var(--jhs-font-mono); }
    @media (max-width:767px) { .console-logger-container { right:var(--jhs-space-2); bottom:var(--jhs-space-2); } .console-logger-window,.console-logger-window.maximized { width:calc(100vw - var(--jhs-space-4))!important; height:320px; } }
    @media (max-width:767px),(pointer:coarse) { .jhs-toast .toast-close,.console-logger-toggle,.console-logger-controls button,.console-logger-scroll-to-bottom,.console-logger-filter { min-width:var(--jhs-touch-target); min-height:var(--jhs-touch-target); } }
    @media (prefers-reduced-motion:reduce) { .loading-animation,.loading-animation::before,.loading-animation::after { animation:none; } .console-logger-toggle,.console-logger-toggle .jhs-icon,.console-logger-window,.console-logger-controls button,.console-logger-filter,.console-logger-scroll-to-bottom { transition:none; } }
`;
}
