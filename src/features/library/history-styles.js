// @ts-check

/** History dialog styles registered with its Library Feature. */
export const HISTORY_BASE_STYLES = `                .jhs-history-layout { display:flex; flex-direction:column; flex:1; height:100%; min-height:0; min-width:0; box-sizing:border-box; padding:var(--jhs-space-3) var(--jhs-space-4); overflow-y:auto; overflow-x:hidden; gap:var(--jhs-space-3); }
                .jhs-history-layout > :not(#table-container) { flex-shrink:0; }
                .jhs-history-dialog #filterBox, .jhs-history-dialog #allSelectBox { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
                .jhs-history-selection-summary { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-history-dialog #table-container { flex:1 0 420px; min-height:420px; overflow-x:hidden; }
                .sub-btns { position:relative; display:inline-block; }
                .table-link-param { cursor:pointer; }
                .action-btns { display:flex; justify-content:center; gap:var(--jhs-space-2); }
                .jhs-history-edit-field { width:100%; padding:var(--jhs-space-2); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); }
                .jhs-history-edit-field[readonly] { background:var(--jhs-input-bg); }
                textarea.jhs-history-edit-field { min-height:60px; overflow-y:hidden; }
            `;

export const HISTORY_DETAIL_STYLES = `.jhs-history-car-number { display:inline-flex; align-items:center; white-space:nowrap; font-variant-numeric:tabular-nums; }
.jhs-table .tabulator-responsive-collapse { background:inherit!important; border-top:1px solid var(--jhs-border); border-bottom:1px solid var(--jhs-border); color:var(--jhs-text); }
.jhs-history-more-icon { display:none; }
.jhs-history-dialog .jhs-table .jhs-history-choice-cell { padding:0; justify-content:center; }
.jhs-history-dialog .jhs-table .tabulator-col:has(.jhs-history-choice-label) .tabulator-col-content { padding:0; display:flex; justify-content:center; }
.jhs-history-choice-label { width:44px; min-height:44px; margin:0; justify-content:center; }
.jhs-details-toggle[aria-expanded="true"] svg { transform:rotate(180deg); }
@media(max-width:767px),(pointer:coarse) { .jhs-history-more-label { display:none; } .jhs-history-more-icon { display:inline-flex; } .jhs-history-dialog .jhs-table .tabulator-cell .jhs-btn { min-width:44px; } }
.jhs-history-details { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr)); gap:var(--jhs-space-2); margin:0; padding:var(--jhs-space-3); text-align:left; }
.jhs-history-details > div { display:grid; grid-template-columns:5em minmax(0,1fr); gap:var(--jhs-space-2); }
.jhs-history-details :is(dt,dd) { margin:0; white-space:normal; overflow-wrap:anywhere; font-size:var(--jhs-font-size-sm); color:var(--jhs-text); }
.jhs-history-details dt { color:var(--jhs-text-muted); font-weight:var(--jhs-font-weight-normal); }`;

export const HISTORY_STYLES = HISTORY_BASE_STYLES + HISTORY_DETAIL_STYLES + `
.jhs-history-dialog [data-enhancement-command][hidden] { display:none!important; }
@media(max-height:500px) { .jhs-history-layout { overflow-y:auto; } .jhs-history-dialog #table-container { flex:1 0 240px; min-height:240px; } }
`;
