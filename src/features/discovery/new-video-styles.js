// @ts-check

/** New Video workspace styles registered on first open by its Feature. */
export const NEW_VIDEO_STYLES = `.newVideoToolBox { display:flex; flex-direction:column; width:100%; height:100%; min-width:0; min-height:0; box-sizing:border-box; overflow:hidden; padding:var(--jhs-space-3); }
                .jhs-new-video-toolbar { display:flex; align-items:center; justify-content:space-between; gap:var(--jhs-space-3); margin-bottom:var(--jhs-space-3); }
                .jhs-new-video-toolbar__actions, .jhs-new-video-toolbar__filters { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
                .jhs-new-video-toolbar select { min-width:150px; }
                #actress-card-container { display:grid; grid-template-columns:repeat(auto-fit,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; max-width:1680px; box-sizing:border-box; margin:0 auto; padding:var(--jhs-space-1); overflow-x:hidden; overflow-y:auto; }
                .actress-card { position:relative; display:flex; flex-direction:column; min-width:0; padding:var(--jhs-space-4); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); }
                .actress-card.is-paused { background:var(--jhs-surface-2); }
                .actress-card__badges { display:flex; align-items:center; gap:var(--jhs-space-1); margin-bottom:var(--jhs-space-3); }
                .actress-card__profile { display:grid; grid-template-columns:64px minmax(0,1fr); align-items:center; gap:var(--jhs-space-3); color:inherit; text-decoration:none; }
                .actress-card-avatar { width:64px; height:64px; border-radius:50%; object-fit:cover; background:var(--jhs-surface-2); }
                .actress-card-name { overflow:hidden; color:var(--jhs-text); font-size:var(--jhs-font-size-lg); font-weight:700; text-overflow:ellipsis; white-space:nowrap; }
                .actress-card-allname { overflow:hidden; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__meta { display:grid; gap:var(--jhs-space-2); margin:var(--jhs-space-3) 0; }
                .actress-card__meta-row { display:grid; grid-template-columns:76px minmax(0,1fr); gap:var(--jhs-space-2); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__meta-row dt { color:var(--jhs-text-faint); }
                .actress-card__meta-row dd { overflow:hidden; margin:0; color:var(--jhs-text); text-overflow:ellipsis; white-space:nowrap; }
                .actress-card__note { min-height:20px; margin-bottom:var(--jhs-space-3); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .actress-card__actions { display:flex; align-items:center; gap:var(--jhs-space-2); margin-top:auto; }
                .actress-card__actions .btn-check-actress { flex:1; }
                .actress-card__menu { position:relative; }
                .actress-card__menu summary { list-style:none; }
                .actress-card__menu summary::-webkit-details-marker { display:none; }
                .actress-card__menu-popover { position:static; min-width:128px; margin-top:var(--jhs-space-1); padding:var(--jhs-space-1); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .actress-card__menu-popover button { width:100%; justify-content:flex-start; }
                .card-tag.is-uncensored { color:var(--jhs-status-down); background:var(--jhs-status-down-tint); }
                .card-tag.is-censored { color:var(--jhs-status-watch); background:var(--jhs-status-watch-tint); }
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
                .jhs-task-status__name { color:var(--jhs-text); font-weight:700; }
                .jhs-task-status__meta { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(min(100%,260px),1fr)); gap:var(--jhs-space-3); width:100%; min-width:0; box-sizing:border-box; padding:var(--jhs-space-1); }
                .nv-card__link { display:block; color:inherit; text-decoration:none; }
                .nv-card__cover { position:relative; width:100%; overflow:hidden; aspect-ratio:3/2; border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
                .nv-cover-img { width:100%; height:100%; object-fit:cover; cursor:zoom-in; }
                .nv-card__empty { display:flex; align-items:center; justify-content:center; height:100%; color:var(--jhs-text-faint); font-size:var(--jhs-font-size-xs); }
                .nv-card__rating { position:absolute; top:var(--jhs-space-1); right:var(--jhs-space-1); }
                .nv-card__body { padding:var(--jhs-space-2) var(--jhs-space-1); }
                .nv-card__title, .nv-card__actress { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
                .nv-card__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:700; }
                .nv-card__actress, .nv-card__date { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
                .jhs-new-video-pagination { flex:0 0 auto; padding:var(--jhs-space-2) 0; border-top:1px solid var(--jhs-border); text-align:center; }
                .jhs-form-dialog { display:grid; gap:var(--jhs-space-3); padding:var(--jhs-space-4); }
                .jhs-avatar-editor { display:grid; grid-template-columns:100px minmax(0,1fr); gap:var(--jhs-space-3); align-items:start; }
                .jhs-avatar-editor__preview { width:100px; height:100px; border:2px solid var(--jhs-border); border-radius:50%; object-fit:cover; }
                .jhs-avatar-editor__actions { margin-top:var(--jhs-space-2); }
                #gfriends-image-list-container { height:100%; box-sizing:border-box; padding:var(--jhs-space-4); background:var(--jhs-surface-2); }
                #gfriends-prompt { margin:0 0 var(--jhs-space-3); padding-bottom:var(--jhs-space-2); border-bottom:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-weight:600; }
                #gfriends-image-list { display:grid; grid-template-columns:repeat(auto-fill,minmax(144px,1fr)); gap:var(--jhs-space-3); }
                .gfriends-image-item-wrapper { display:grid; grid-template-rows:200px auto; min-height:44px; overflow:hidden; padding:0; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); color:var(--jhs-text); cursor:pointer; }
                .gfriends-image-item-wrapper:hover { border-color:var(--jhs-border-strong); background:var(--jhs-surface-hover); }
                .gfriends-image-item-wrapper:focus-visible { outline:2px solid var(--jhs-focus); outline-offset:2px; }
                .gfriends-image-item-wrapper[aria-pressed="true"] { border-color:var(--jhs-accent); box-shadow:0 0 0 2px var(--jhs-accent-tint); }
                .gfriends-selectable-img { width:100%; height:200px; object-fit:cover; }
                .gfriends-size-tag { min-height:28px; padding:var(--jhs-space-1) var(--jhs-space-2); border-top:1px solid var(--jhs-border); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); line-height:20px; text-align:center; }
                .jhs-form-dialog__body, .jhs-form-field { display:grid; gap:var(--jhs-space-1); }
                .jhs-form-label, .jhs-form-dialog__title { color:var(--jhs-text); font-size:var(--jhs-font-size-sm); font-weight:600; }
                .jhs-form-dialog :where(.jhs-field,.jhs-select,.jhs-textarea) { width:100%; }
                .jhs-form-dialog .jhs-textarea { min-height:60px; overflow-y:hidden; }
                .jhs-option-row { display:flex; align-items:center; gap:var(--jhs-space-2); min-height:36px; }
                #actress-pagination { display:flex; align-items:center; justify-content:center; flex-wrap:wrap; gap:var(--jhs-space-1); }
                @media (max-width:767px) { .jhs-new-video-toolbar { align-items:stretch; flex-direction:column; } .jhs-new-video-toolbar select, .jhs-new-video-toolbar .jhs-btn { min-height:44px; } .newVideoToolBox .jhs-task-status-list { display:flex; flex-shrink:0; overflow-x:auto; } .newVideoToolBox .jhs-task-status { flex:0 0 180px; } .page-number-btn { display:none !important; } }
                @media (prefers-reduced-motion:reduce) { .gfriends-image-item-wrapper { transition:none; } }
                @media (max-width:767px) { .newVideoToolBox { overflow-y:auto; } .newVideoToolBox #new-video-list-container { min-height:160px; } }`;
