// @ts-check
/** Geometry shared by owned views; feature styles only supply content-specific layout. */
export function buildUiGeometryCss() {
    return `
    :is(.jhs-setting-layout,.jhs-resource-form,.jhs-rule-form,.jhs-record-list,.jhs-media-card,.jhs-metric) :where(h2,h3,h4,p,label,strong,dl,dt,dd) { margin:0; color:inherit; font-family:var(--jhs-font); line-height:var(--jhs-line-height-ui); }
    :is(.jhs-setting-row,.jhs-form-field,.jhs-resource-form,.jhs-rule-form) :where(input,textarea) { font-weight:var(--jhs-font-weight-normal); }
    .jhs-setting-row { min-width:0; grid-template-columns:minmax(0,1fr) minmax(0,280px); gap:var(--jhs-space-4); }
    .jhs-setting-row__copy { display:grid; min-width:0; gap:var(--jhs-space-1); }
    .jhs-setting-row__control { display:flex; align-items:center; justify-content:flex-end; flex-wrap:wrap; min-width:0; gap:var(--jhs-space-2); }
    .jhs-setting-row__control > :is(.jhs-select-control,.jhs-field,.jhs-textarea) { width:100%; min-width:0; }
    .jhs-setting-row--stacked { grid-template-columns:minmax(0,1fr); align-items:start; }
    .jhs-setting-row--stacked .jhs-setting-row__control { width:100%; }
    .jhs-setting-row--action { grid-template-columns:minmax(0,1fr) auto; }
    .jhs-resource-card > .jhs-setting-row { padding:0; border:0; }
    .jhs-resource-card .jhs-setting-row__control { display:flex; width:auto; justify-content:flex-end; }
    .jhs-resource-card .jhs-setting-row__control > button { width:auto; flex:0 0 auto; }
    .jhs-setting-layout .jhs-setting-section { display:grid; gap:var(--jhs-space-3); min-width:0; }
    .jhs-setting-layout .jhs-setting-section + .jhs-setting-section { margin-top:var(--jhs-space-6); }
    .jhs-setting-layout .jhs-setting-section__header { display:grid; gap:var(--jhs-space-1); margin:0; }
    .jhs-setting-layout :is(.jhs-toolbar,.jhs-setting-section__header) :is(h3,h4) { font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-setting-layout .jhs-toolbar { gap:var(--jhs-space-2); margin:0; }
    .jhs-setting-layout .jhs-setting-subheading { margin-top:var(--jhs-space-3); }
    .jhs-choice-group { display:flex; flex-wrap:wrap; gap:var(--jhs-space-3); margin:0; padding:0; min-width:0; border:0; }
    .jhs-choice-group legend { padding:0; font-size:var(--jhs-font-size-sm); }
    .jhs-choice { display:inline-flex; align-items:center; justify-content:center; min-height:var(--jhs-touch-target); gap:var(--jhs-space-2); padding:var(--jhs-space-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); cursor:pointer; color:var(--jhs-text); }
    .jhs-choice:has(:checked) { background:var(--jhs-accent-tint); border-color:var(--jhs-accent); }
    .jhs-choice:has(:focus-visible) { outline:2px solid var(--jhs-focus); outline-offset:2px; }
    .jhs-owned-popover.jhs-popover { box-sizing:border-box; overflow-x:hidden; overflow-y:auto; overscroll-behavior:contain; padding:var(--jhs-space-1); background:var(--jhs-surface); color:var(--jhs-text); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); box-shadow:var(--jhs-shadow-md); }
    .jhs-owned-popover :is(button,a,[role=menuitem],[role=menuitemradio]) { min-width:0; max-width:100%; width:100%; white-space:normal; overflow-wrap:anywhere; height:auto; min-height:var(--jhs-control-height); text-align:left; justify-content:flex-start; }
    .jhs-owned-popover .jhs-select-group { display:grid; gap:var(--jhs-space-1); }
    .jhs-task-times { display:grid; gap:var(--jhs-space-1); min-width:0; margin:var(--jhs-space-2) 0 0; font-size:var(--jhs-font-size-xs); color:var(--jhs-text-muted); }
    .jhs-task-times > div { display:grid; grid-template-columns:6em minmax(0,1fr); gap:var(--jhs-space-2); align-items:start; }
    .jhs-task-times :is(dt,dd) { margin:0; font-weight:var(--jhs-font-weight-normal); line-height:var(--jhs-line-height-ui); overflow-wrap:anywhere; font-variant-numeric:tabular-nums; }
    .jhs-task-setting-status { grid-template-columns:minmax(0,1fr) minmax(0,340px); }
    .jhs-task-setting-status .jhs-task-times { margin:0; }
    .jhs-table { box-sizing:border-box; max-width:100%; min-width:0; }
    .jhs-table * { box-sizing:border-box; }
    .jhs-record-list { display:flex; flex-direction:column; gap:var(--jhs-space-3); padding:var(--jhs-space-1); overflow:auto; }
    .jhs-record-card { display:grid; flex:0 0 auto; gap:var(--jhs-space-2); padding:var(--jhs-space-4); overflow-wrap:anywhere; }
    .jhs-record-card > strong { font-size:var(--jhs-font-size-md); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-record-card > p { font-size:var(--jhs-font-size-sm); }
    .jhs-record-card > .jhs-toolbar { margin-top:var(--jhs-space-1); }
    .jhs-media-card { min-width:0; padding:var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); transition:border-color var(--jhs-motion-fast) var(--jhs-ease); }
    .jhs-media-card:hover { border-color:var(--jhs-border-strong); }
    .jhs-media-card__header { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-2); min-width:0; margin-bottom:var(--jhs-space-2); }
    .jhs-media-card__header .jhs-choice { flex:none; }
    .jhs-media-card:has(.nv-select:checked) { border-color:var(--jhs-accent); background:var(--jhs-accent-tint); }
    .jhs-stats__group { display:grid; gap:var(--jhs-space-3); }
    .jhs-stats__group > h3 { margin:0; font-size:var(--jhs-font-size-lg); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-metric-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,220px),1fr)); gap:var(--jhs-space-3); }
    .jhs-metric-grid--single { max-width:320px; grid-template-columns:minmax(0,1fr); }
    .jhs-metric { display:grid; align-content:center; justify-content:stretch; align-items:start; gap:var(--jhs-space-1); box-sizing:border-box; min-width:0; min-height:96px; margin:0; padding:var(--jhs-space-4); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); color:var(--jhs-text); text-align:left; white-space:normal; font:inherit; }
    .jhs-metric strong { font-size:var(--jhs-font-size-xl); font-weight:var(--jhs-font-weight-semibold); }
    .jhs-metric span { font-size:var(--jhs-font-size-sm); color:var(--jhs-text-muted); }
    button.jhs-metric { cursor:pointer; }
    button.jhs-metric:hover { border-color:var(--jhs-border-strong); background:var(--jhs-surface-hover); }
    button.jhs-metric:focus-visible { outline:2px solid var(--jhs-focus); outline-offset:2px; }
    @media(max-width:767px) { .jhs-setting-row,.jhs-task-setting-status { grid-template-columns:minmax(0,1fr); } .jhs-setting-row__control { width:100%; } .jhs-setting-row--action { grid-template-columns:minmax(0,1fr); } }
    @media(max-width:767px),(pointer:coarse) { .jhs-owned-popover :is(button,a,[role=menuitem],[role=menuitemradio]) { min-height:var(--jhs-touch-target); } }
    `;
}
