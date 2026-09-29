// @ts-check

/** History dialog styles registered with its Library Feature. */
export const HISTORY_STYLES = `                .jhs-history-layout { display:flex; flex-direction:column; flex:1; height:100%; min-height:0; min-width:0; box-sizing:border-box; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
                .jhs-history-layout > :not(#table-container) { flex-shrink:0; }
                .jhs-history-dialog #filterBox, .jhs-history-dialog #allSelectBox { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
                .jhs-history-selection-summary { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-history-select-all { width:18px; height:18px; accent-color:var(--jhs-accent); cursor:pointer; }
                .jhs-history-dialog #table-container { flex:1; min-height:0; overflow-x:hidden; }
                .sub-btns { position:relative; display:inline-block; }
                .sub-btns-menu { position:absolute; top:calc(100% + var(--jhs-space-1)); right:0; z-index:var(--jhs-z-popover); display:none; min-width:156px; padding:var(--jhs-space-1); overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .sub-btns-menu.show { display:grid !important; gap:var(--jhs-space-1); }
                .sub-btns-menu .jhs-btn { width:100%; justify-content:flex-start; }
                .table-link-param { cursor:pointer; }
                .action-btns { display:flex; justify-content:center; gap:var(--jhs-space-2); }
                .jhs-history-edit-field { width:100%; padding:8px; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); }
                .jhs-history-edit-field[readonly] { background:var(--jhs-input-bg); }
                textarea.jhs-history-edit-field { min-height:60px; overflow-y:hidden; }
            `;
