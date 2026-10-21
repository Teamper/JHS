// @ts-check

/** New Video workspace styles registered on first open by its Feature. */
export const NEW_VIDEO_STYLES = `.newVideoToolBox { display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; box-sizing:border-box; overflow:hidden; padding:var(--jhs-space-3); }
                .jhs-new-video-toolbar { display:flex; flex-wrap:wrap; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-new-video-toolbar__actions, .jhs-new-video-toolbar__filters { display:flex; min-width:0; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .jhs-new-video-toolbar select { min-width:150px; }
                #actress-card-container { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; max-width:1680px; box-sizing:border-box; margin:0 auto; padding:var(--jhs-space-1); overflow-x:hidden; overflow-y:auto; }
                .actress-card { position:relative; display:flex; flex-direction:column; min-width:0; padding:var(--jhs-space-4); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
                .actress-card.is-paused { background:var(--jhs-surface-2); }
                .actress-card__badges { display:flex; align-items:center; gap:var(--jhs-space-1); margin-bottom:var(--jhs-space-3); }
                .actress-card__profile { display:grid; grid-template-columns:64px minmax(0,1fr); align-items:center; gap:var(--jhs-space-3); color:inherit; text-decoration:none; }
                .actress-card__profile > span { display:block; min-width:0; }
                .actress-card-avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; background:var(--jhs-surface-2); }
                .actress-card-name { display:block; min-width:0; overflow:hidden; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); font-weight:var(--jhs-font-weight-semibold); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card-allname { display:block; min-width:0; overflow:hidden; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__meta { display:grid; gap:var(--jhs-space-2); margin:var(--jhs-space-3) 0; }
                .actress-card__meta-row { display:grid; grid-template-columns:76px minmax(0,1fr); gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__meta-row dt { color:var(--jhs-text-faint); }
                .actress-card__meta-row dd { overflow:hidden; margin:0; color:var(--jhs-text); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__note { min-height:20px; margin-bottom:var(--jhs-space-3); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__actions { display:flex; align-items:center; gap:var(--jhs-space-2); margin-top:auto; }
                .actress-card__actions .btn-check-actress { flex:1; }
                .actress-card__menu { position:relative; }



                .actress-card__menu-popover button { width:100%; justify-content:flex-start; }
                .card-tag.is-uncensored { color:var(--jhs-status-down-text); background:var(--jhs-status-down-tint); }
                .card-tag.is-censored { color:var(--jhs-status-watch-text); background:var(--jhs-status-watch-tint); }
                .card-tag.is-unknown { color:var(--jhs-text-muted); background:var(--jhs-surface-2); }
                #new-video-list-container { display:none; flex:1; min-width:0; min-height:0; overflow-x:hidden; overflow-y:auto; }
                #new-video-list-footer { display:none; padding:var(--jhs-space-2) 0; border-top:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-new-video-view { flex:0 0 auto; }
                .jhs-new-video-batch { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--jhs-space-2); width:100%; }
                .jhs-new-video-batch__actions { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .jhs-new-video-batch__more { position:relative; }
                .jhs-new-video-batch__more summary { list-style:none; }
                .jhs-new-video-batch__more summary::-webkit-details-marker { display:none; }
                .jhs-new-video-batch__menu { top:auto; bottom:calc(100% + var(--jhs-space-1)); }
                .jhs-task-status-list { display:grid; grid-template-columns:repeat(3,minmax(0,1fr)); gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-3); }
                .jhs-task-status { padding:var(--jhs-space-2) var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
                .jhs-task-status__name { color:var(--jhs-text); font-weight:var(--jhs-font-weight-semibold); }
                .jhs-task-status__meta { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; box-sizing:border-box; padding:var(--jhs-space-1); }
                .nv-card__link { display:block; color:inherit; text-decoration:none; }
                .nv-card__cover { position:relative; width:100%; overflow:hidden; aspect-ratio:3/2; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
                .nv-cover-img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
                .nv-card__empty { display:flex; align-items:center; justify-content:center; height:100%; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                .nv-card__rating { position:absolute; top:var(--jhs-space-1); right:var(--jhs-space-1); }
                .nv-card__body { display:grid; gap:var(--jhs-space-1); padding:var(--jhs-space-3) 0 0; }
                .nv-card__title, .nv-card__actress { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .nv-card__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:var(--jhs-font-weight-semibold); }
                .nv-card__actress, .nv-card__date { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-pagination { flex:0 0 auto; padding:var(--jhs-space-2) 0; border-top:1px solid var(--jhs-border); text-align:center; }
                .jhs-form-dialog { display:grid; gap:var(--jhs-space-3); padding:var(--jhs-space-4); }
                .jhs-avatar-editor { display:grid; grid-template-columns:100px minmax(0,1fr); gap:var(--jhs-space-3); align-items:start; }
                .jhs-avatar-editor__preview { width:100px; height:100px; border:2px solid var(--jhs-border); border-radius:50%; object-fit:cover; }
                .jhs-avatar-editor__actions { margin-top:var(--jhs-space-2); }
                #gfriends-image-list-container { height:100%; box-sizing:border-box; padding:var(--jhs-space-4); background:var(--jhs-surface-2); }
                #gfriends-prompt { margin:0 0 var(--jhs-space-3); padding-bottom:var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-weight:var(--jhs-font-weight-semibold); }
                #gfriends-image-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(144px,1fr)); gap:var(--jhs-space-3); }
                .gfriends-image-item-wrapper { display:grid; grid-template-rows:200px auto; min-height:44px; overflow:hidden; padding:0; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); color:var(--jhs-text); cursor:pointer; }
                .gfriends-image-item-wrapper:hover { border-color:var(--jhs-border-strong); background:var(--jhs-surface-hover); }
                .gfriends-image-item-wrapper:focus-visible { outline:2px solid var(--jhs-focus); outline-offset:2px; }
                .gfriends-image-item-wrapper[aria-pressed="true"] { border-color:var(--jhs-accent); box-shadow:var(--jhs-focus-ring); }
                .gfriends-selectable-img { width:100%; height:200px; object-fit:cover; }
                .gfriends-size-tag { min-height:28px; padding:var(--jhs-space-1) var(--jhs-space-2); border-top:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); line-height:var(--jhs-line-height-tight); text-align:center; }
                .jhs-form-dialog__body, .jhs-form-field { display:grid; gap:var(--jhs-space-1); }
                .jhs-form-label, .jhs-form-dialog__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:var(--jhs-font-weight-semibold); }
                .jhs-form-dialog :where(.jhs-field,.jhs-select,.jhs-textarea) { width:100%; }
                .jhs-form-dialog .jhs-textarea { min-height:60px; overflow-y:hidden; }
                .jhs-option-row { display:flex; align-items:center; gap:var(--jhs-space-2); min-height:36px; }
                #actress-pagination { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--jhs-space-1); }

                @media (max-height:500px) { .newVideoToolBox { overflow-y:auto; overscroll-behavior:contain; } .jhs-new-video-toolbar,.jhs-task-status-list,#new-video-list-footer { flex-shrink:0; } .newVideoToolBox #new-video-list-container { flex:1 0 160px; min-height:160px; } }
                @media (prefers-reduced-motion:reduce) { .gfriends-image-item-wrapper { transition:none; } }

                .newVideoToolBox [hidden] { display:none!important; }
                .jhs-new-video-toolbar { flex:0 0 auto; align-items:flex-end; gap:var(--jhs-space-2); }
                .jhs-new-video-commandbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--jhs-space-2); width:100%; }
                .jhs-new-video-searchbar { display:flex; align-items:center; gap:var(--jhs-space-2); min-width:0; }
                .jhs-new-video-searchbar #nvSearch { width:240px; min-width:0; }
                .jhs-new-video-more, #nvFilterToggle, #nvTaskToggle { display:none; }
                .jhs-new-video-toolbar__filters { align-items:flex-end; flex:1; }
                .jhs-new-video-filter-field { display:grid; min-width:0; gap:var(--jhs-space-1); margin:0; color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-toolbar #checkNewVideoMsg:empty { display:none; }
                .jhs-new-video-tasks { flex:0 0 auto; min-width:0; }
                #actress-card-container { flex:1; min-height:0; align-content:start; }
                .newVideoToolBox[data-jhs-compact="true"] { overflow-y:auto; overscroll-behavior:contain; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-toolbar { display:flex; flex-direction:column; align-items:stretch; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-commandbar { flex-wrap:nowrap; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-view { flex:1; min-width:0; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-commandbar .jhs-btn { min-height:44px; padding-inline:var(--jhs-space-2); font-size:var(--jhs-font-size-sm); }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-toolbar__actions { flex-wrap:nowrap; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-more { display:block; }
                .newVideoToolBox[data-jhs-compact="true"] #nvFilterToggle { display:inline-flex; flex:none; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-searchbar #nvSearch { flex:1; width:0; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-toolbar__filters { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); flex:none; max-height:200px; overflow:auto; padding:var(--jhs-space-1); }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-toolbar__filters :is(select,.jhs-select-control) { min-width:0; width:100%; }
                .newVideoToolBox[data-jhs-compact="true"] #nvTaskToggle { display:flex; width:100%; justify-content:space-between; min-height:44px; }
                .newVideoToolBox[data-jhs-compact="true"] #nvTaskToggle span { min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .newVideoToolBox[data-jhs-compact="true"] #nvTaskToggle[aria-expanded="true"] svg { transform:rotate(180deg); }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-task-status-list { grid-template-columns:1fr; max-height:200px; overflow:auto; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-task-status { min-width:0; }
                .newVideoToolBox[data-jhs-compact="true"] :is(#new-video-list-container,#actress-card-container) { flex:1 0 200px; min-height:200px; }
                .newVideoToolBox[data-jhs-compact="true"] :is(.jhs-new-video-pagination,#new-video-list-footer,#actress-pagination) { flex-shrink:0; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-batch__actions { gap:var(--jhs-space-1); }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-batch :is(.jhs-btn,.jhs-new-video-selection) { white-space:nowrap; }
                .newVideoToolBox[data-jhs-compact="true"] .jhs-new-video-batch .jhs-btn { padding-inline:var(--jhs-space-2); }
                .newVideoToolBox[data-jhs-compact="true"] .page-number-btn { display:none!important; }
                @media(max-height:500px) { .newVideoToolBox[data-jhs-compact="true"] :is(#new-video-list-container,#actress-card-container) { flex-basis:160px; min-height:160px; } }
`;
