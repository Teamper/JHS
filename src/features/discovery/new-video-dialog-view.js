// @ts-check

import { debounce } from "../../core/timing.js";
import { OwnedPopover } from "../../core/owned-popover.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { dismissActiveTooltip } from "../../core/tooltip-controller.js";
import { PRODUCT_NAMES } from "../../core/product-names.js";
import { getIcon } from "../../core/icons.js";
import { CUP_FILTER_OPTIONS, hasActiveBodyFilter, normalizeBodyFilter } from "../../core/actress-measurements.js";
import { A, C, _, escapeHtml } from "../../core/constants.js";
import { JhsSelect, renderStateView } from "../../core/ui-primitives.js";

/** @typedef {import("./new-video-workspace-service.js").NewVideoWorkspaceService} NewVideoWorkspaceService */
/** @typedef {import("./new-video-workspace-service.js").JQueryEvent} JQueryEvent */

/** @param {NewVideoWorkspaceService} owner */
export async function openDialog(owner) {
    if (owner.disposed) return;
    if (owner.nvDialogId != null) return owner.nvDialogId;
    if (owner.nvDialogOpenPromise) return owner.nvDialogOpenPromise;
    const generation = ++owner.nvDialogGeneration;
    const pending = owner.openNewVideoDialog(generation);
    owner.nvDialogOpenPromise = pending;
    try { return await pending; }
    finally { if (owner.nvDialogOpenPromise === pending) owner.nvDialogOpenPromise = null; }
}

/** Opens one workspace after its prerequisites finish for the current activation. */
/** @param {NewVideoWorkspaceService} owner */
export async function openNewVideoDialog(owner, /** @type {number} */ generation) {
    await owner.loadStyles?.();
    if (owner.disposed || generation !== owner.nvDialogGeneration) return;
    const storage = owner.getRuntimeService("storage");
    owner.cleanupNewVideoWorkspace(), owner._viewMode = "list" === storage.getLocal("jhs_newVideoViewMode") ? "list" : "actress", owner.currentPage = 1, owner.nvCurrentPage = 1, owner.nvSelected = new Set, owner.nvCoverCache = new Map, owner.nvActorCoverRequests = new Map, owner.nvRenderGeneration++;
    const tips = await owner.getTaskButtonTips();
    if (owner.disposed || generation !== owner.nvDialogGeneration) return;
    let o = `
        <div class="newVideoToolBox jhs-ui" data-jhs-compact="false">
            <div class="jhs-new-video-toolbar" role="toolbar" aria-label="新作品工作区工具">
                <div class="jhs-new-video-commandbar">
                    <div class="jhs-segmented jhs-new-video-view" role="tablist" aria-label="新作品视图">
                        <button type="button" class="jhs-btn jhs-segmented__item" id="nvViewActress" role="tab" aria-controls="actress-card-container" data-view="actress">演员视图</button>
                        <button type="button" class="jhs-btn jhs-segmented__item" id="nvViewList" role="tab" aria-controls="new-video-list-container" data-view="list">新作品</button>
                    </div>
                    <div class="jhs-new-video-toolbar__actions">
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkFavoriteActress" data-tip="${escapeHtml(tips.favorite)}">${owner.actressSvg}<span>手动同步演员</span></button>
                        <button type="button" class="jhs-btn jhs-btn--secondary" id="checkNewVideo" data-tip="${escapeHtml(tips.newVideo)}">${owner.newSvg}<span>检测新作品</span></button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="reLoad">${owner.refreshSvg}<span>刷新</span></button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="toSetting">${owner.settingSvg}<span>设置</span></button>
                    </div>
                    <div class="jhs-new-video-more">
                        <button type="button" id="nvWorkspaceMore" class="jhs-btn jhs-icon-btn" aria-label="更多工作区操作" aria-haspopup="menu" aria-expanded="false">${getIcon("menu")}</button>
                        <div class="jhs-popover jhs-new-video-more__menu" role="menu" aria-label="工作区操作"></div>
                    </div>
                </div>
                <div class="jhs-new-video-searchbar">
                    <input id="nvSearch" class="jhs-field jhs-is-hidden" type="search" placeholder="搜索番号、标题或演员" aria-label="搜索新作品">
                    <button type="button" id="nvFilterToggle" class="jhs-btn jhs-btn--secondary" aria-expanded="false" aria-controls="nv-filter-panel">${getIcon("list")}<span>筛选</span></button>
                </div>
                <div id="nv-filter-panel" class="jhs-new-video-toolbar__filters" aria-label="新作品筛选">
                    <label class="jhs-new-video-filter-field"><span>演员类型</span><select id="paramActressType" class="jhs-select-source" aria-label="演员类型"><option value="all" selected>所有</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="">未知</option></select></label>
                    <label class="jhs-new-video-filter-field"><span>新作品类别</span><select id="nvCategoryFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作品类别"><option value="all" selected>所有类别</option><option value="uncensored">无码</option><option value="censored">有码</option><option value="unknown">未知</option><option value="vr">VR</option></select></label>
                    <label class="jhs-new-video-filter-field"><span>影片状态</span><select id="nvStateFilter" class="jhs-select-source jhs-is-hidden" aria-label="影片状态"><option value="all">所有状态</option><option value="pending" selected>待处理</option><option value="favorite">已收藏</option><option value="downloaded">已下载</option><option value="watched">已观看</option><option value="blocked">已屏蔽</option></select></label>
                     <label class="jhs-new-video-filter-field"><span>新作决策</span><select id="nvDecisionFilter" class="jhs-select-source jhs-is-hidden" aria-label="新作决策"><option value="pending" selected>待处理</option><option value="ignored">已忽略</option><option value="snoozed">已暂缓</option><option value="dismissed">已移除</option><option value="all">所有决策</option></select></label>
                    <label class="jhs-new-video-filter-field"><span>演员排序</span><select id="paramSortBy" class="jhs-select-source" aria-label="演员排序">
                        <option value="default" selected>默认排序</option><optgroup label="发行时间"><option value="lastPublishTime_desc">发行时间 新→旧</option><option value="lastPublishTime_asc">发行时间 旧→新</option></optgroup><optgroup label="检测时间"><option value="lastCheckTime_desc">检测时间 新→旧</option><option value="lastCheckTime_asc">检测时间 旧→新</option></optgroup><optgroup label="新作品数"><option value="newVideoCount_desc">新作品数 多→少</option><option value="newVideoCount_asc">新作品数 少→多</option></optgroup>
                    </select></label>
                    <label class="jhs-new-video-filter-field"><span>新作品排序</span><select id="nvSortBy" class="jhs-select-source jhs-is-hidden" aria-label="新作品排序"><option value="publishTime_desc" selected>发行时间 新→旧</option><option value="publishTime_asc">发行时间 旧→新</option><option value="voteCount_desc">评价人数 多→少</option><option value="voteCount_asc">评价人数 少→多</option><option value="actress_asc">演员名 A→Z</option><option value="actress_desc">演员名 Z→A</option><option value="carNum_asc">番号 A→Z</option><option value="carNum_desc">番号 Z→A</option></select></label>
                    <div class="jhs-new-video-filter-field jhs-nv-range-field">
                        <span id="nvHeightLabel">身高(cm)</span>
                        <div class="jhs-nv-range-inputs" role="group" aria-labelledby="nvHeightLabel">
                            <input id="nvHeightMin" type="number" inputmode="numeric" min="100" max="230" class="jhs-field jhs-nv-range-input" placeholder="最低" aria-label="最低身高(cm)">
                            <span class="jhs-nv-range-sep" aria-hidden="true">-</span>
                            <input id="nvHeightMax" type="number" inputmode="numeric" min="100" max="230" class="jhs-field jhs-nv-range-input" placeholder="最高" aria-label="最高身高(cm)">
                        </div>
                    </div>
                    <div class="jhs-new-video-filter-field jhs-nv-range-field">
                        <span id="nvAgeLabel">年龄</span>
                        <div class="jhs-nv-range-inputs" role="group" aria-labelledby="nvAgeLabel">
                            <input id="nvAgeMin" type="number" inputmode="numeric" min="15" max="99" class="jhs-field jhs-nv-range-input" placeholder="最小" aria-label="最小年龄">
                            <span class="jhs-nv-range-sep" aria-hidden="true">-</span>
                            <input id="nvAgeMax" type="number" inputmode="numeric" min="15" max="99" class="jhs-field jhs-nv-range-input" placeholder="最大" aria-label="最大年龄">
                        </div>
                    </div>
                    <fieldset class="jhs-new-video-filter-field jhs-nv-cup-field">
                        <legend>罩杯</legend>
                        <div class="jhs-nv-cup-group">${CUP_FILTER_OPTIONS.map(cup => `<label class="jhs-choice jhs-nv-cup-choice"><input type="checkbox" class="jhs-nv-cup-checkbox" value="${cup}" aria-label="罩杯 ${cup}"><span>${cup}</span></label>`).join("")}</div>
                    </fieldset>
                    <div class="jhs-new-video-filter-field jhs-nv-body-reset-field">
                        <button type="button" id="nvBodyReset" class="jhs-btn jhs-btn--ghost" hidden>重置身材</button>
                    </div>
                </div>
                <span id="checkNewVideoMsg" role="status" aria-live="polite"></span>
            </div>
            <div class="jhs-new-video-tasks">
                <button type="button" id="nvTaskToggle" class="jhs-btn jhs-btn--ghost" aria-expanded="false" aria-controls="jhs-task-status-list"><span>任务状态</span>${getIcon("chevron-down")}</button>
                <div id="jhs-task-status-list" class="jhs-task-status-list" aria-live="polite"></div>
            </div>
            <div id="actress-card-container" class="jhs-scrollbar"></div>
            <div id="new-video-list-container" class="jhs-scrollbar"></div>
            <div id="new-video-list-footer"></div>
            <div id="actress-pagination"></div>
        </div>`;
    /** @type {number | null} */ let ownedDialogId = null;
    let ended = false;
    const dialogId = owner.getRuntimeService("dialog").open({
        type: 1,
        title: '<span class="jhs-dialog-title" data-tip="数据来自演员首页，含磁力分类">新作品检测</span>',
        content: o,
        scrollbar: !1,
        ui: { size: "workspace", body: "scroll" },
        anim: -1,
        success: async (/** @type {HTMLElement | {0: HTMLElement}} */ e, /** @type {number} */ t) => {
            if (owner.disposed || generation !== owner.nvDialogGeneration || ended) return;
            ownedDialogId = t, owner.nvDialogId = t;
            owner.nvWorkspaceMounted = !0, owner.nvWorkspaceRoot = e, JhsSelect.enhance(e), owner.bindClick(), owner.bindWorkspaceLayout(), owner.applyViewMode(), owner.renderTaskStatuses(), owner.utils.setupEscClose(t);
            const settings = owner.getRuntimeService("settings");
            owner._tipSettingsChanged = (/** @type {Event} */ rawEvent) => {
                const event = /** @type {CustomEvent<{names?: string[]}>} */ (rawEvent);
                if (owner.disposed || generation !== owner.nvDialogGeneration) return;
                if (event.detail?.names?.some((/** @type {string} */ name) => ["checkFavoriteActress_IntervalTime", "checkNewVideo_intervalTime"].includes(name))) void owner.resetBtnTip({ root: e, generation });
                if (event.detail?.names?.some((/** @type {string} */ name) => ["enableCheckBlacklist", "enableCheckFavoriteActress", "enableCheckNewVideo"].includes(name))) owner.renderTaskStatuses();
            };
            settings?.addEventListener?.("settings.changed", owner._tipSettingsChanged);
            await owner.reloadNewVideoWorkspaceData({ skipTaskStatusRender: true });
        },
        end: () => {
            if (ended) return;
            ended = true;
            if (ownedDialogId != null) owner.utils.releaseEscClose?.(ownedDialogId);
            if (generation !== owner.nvDialogGeneration) return;
            owner.nvDialogGeneration++, owner.nvDialogId = null, owner.cleanupNewVideoWorkspace();
        }
    });
    if (!ended && !owner.disposed && generation === owner.nvDialogGeneration) owner.nvDialogId = dialogId;
    return dialogId;
}

/** @param {NewVideoWorkspaceService} owner */
export function cleanupNewVideoWorkspace(owner) {
    owner.nvLoadGeneration++, owner.nvWorkspaceLoading = false;
    clearTimeout(owner.nvInvalidationTimer ?? undefined), owner.nvInvalidationTimer = null, owner.nvWorkspaceReloadDirty = !1, owner.nvWorkspaceFullReloadRequested = !1, owner.nvPendingRemovals.clear();
    owner.closeActressEditor();
    owner.closeRebindDialogs();
    owner.workspaceLayoutScope?.dispose(); owner.workspaceLayoutScope = null;
    owner.workspaceMorePopover?.close(); owner.workspaceMorePopover = null;
    owner.batchPopover?.close(); owner.batchPopover = null;
    owner.nvWorkspaceRoot?.find('[aria-busy="true"]').attr("aria-busy", "false");
    if (owner._tipSettingsChanged) owner.getRuntimeService("settings")?.removeEventListener?.("settings.changed", owner._tipSettingsChanged);
    owner._tipSettingsChanged = null;
    owner.nvSearchDebounced?.cancel?.(), owner.nvSearchDebounced = null, owner.nvBodyFilterDebounced?.cancel?.(), owner.nvBodyFilterDebounced = null, owner.nvWorkspaceMounted = !1, owner.nvWorkspaceRoot = null, owner.nvRenderGeneration++, owner.nvSelected.clear(), owner.nvCoverCache = new Map, owner.nvActorCoverRequests = new Map,
    owner.nvCoverPreview?.destroy?.(), owner.nvCoverPreview = null,
    owner.nvAllItemsMap.clear(), owner.nvFlatListCache = [], owner.nvActressesCache = [], owner.nvCarMapCache = new Map, owner.nvMeasurementsByStarId.clear(), owner.nvMeasurementsByName.clear(), owner.nvDecisionsCache = {}, owner.nvCurrentPageItems = [];
    owner.jquery(Array.from(owner.nvRemovingCards)).stop(!0, !0), owner.nvRemovingCards.clear();
}

/** @param {NewVideoWorkspaceService} owner */
export function bindWorkspaceLayout(owner) {
    owner.workspaceLayoutScope?.dispose();
    const scope = owner.workspaceLayoutScope = new LifecycleScope("new-video-layout"), root = owner.nvWorkspaceRoot;
    owner.nvFiltersExpanded = false; owner.nvTasksExpanded = false;
    owner.workspaceCommands = ["checkFavoriteActress", "checkNewVideo", "reLoad", "toSetting"].map(id => ({ id, button: root.find(`#${id}`), label: root.find(`#${id} span`).last().text() }));
    const anchor = root.find("#nvWorkspaceMore"), menu = root.find(".jhs-new-video-more__menu");
    if (anchor.length && menu.length) {
        const popover = owner.workspaceMorePopover = new OwnedPopover(anchor[0], menu[0]);
        anchor.on("click.jhsNvLayout", () => popover.opened ? popover.close(true) : popover.open());
        menu.on("click.jhsNvLayout", "button", () => popover.close());
    }
    root.find("#nvFilterToggle").on("click.jhsNvLayout", () => { owner.nvFiltersExpanded = !owner.nvFiltersExpanded; owner.syncWorkspaceLayout(); });
    root.find("#nvTaskToggle").on("click.jhsNvLayout", () => { owner.nvTasksExpanded = !owner.nvTasksExpanded; owner.syncWorkspaceLayout(); });
    root.find("#nv-filter-panel").on("change.jhsNvLayout", "select", () => owner.syncFilterSummary());
    const profile = owner.getRuntimeService("profile");
    if (profile?.addEventListener) scope.listen(profile, "profile.changed", () => owner.syncWorkspaceLayout());
    else {
        scope.listen(owner.window, "resize", () => owner.syncWorkspaceLayout());
        const settings = owner.getRuntimeService("settings");
        if (settings?.addEventListener) scope.listen(settings, "settings.changed", () => owner.syncWorkspaceLayout());
    }
    scope.addCleanup(() => root.find("*").addBack().off(".jhsNvLayout"));
    owner.syncWorkspaceLayout();
}

/** @param {NewVideoWorkspaceService} owner */
export function syncWorkspaceLayout(owner) {
    if (!owner.nvWorkspaceRoot) return;
    const profile = owner.getRuntimeService("profile"), compact = profile?.current ? profile.current() === "compact" : !!owner.utils.isMobileMode?.();
    const root = owner.nvWorkspaceRoot, workspace = root.find(".newVideoToolBox").addBack(".newVideoToolBox");
    const changed = owner.nvCompact !== compact;
    const active = owner.document.activeElement, menuFocused = owner.workspaceMorePopover?.opened && owner.workspaceMorePopover.menu.contains(active);
    if (changed) dismissActiveTooltip(owner.document, workspace[0]);
    owner.nvCompact = compact; workspace.attr("data-jhs-compact", String(compact));
    owner.workspaceMorePopover?.close();
    const actions = root.find(".jhs-new-video-toolbar__actions"), menu = root.find(".jhs-new-video-more__menu");
    const primary = owner._viewMode === "list" ? "checkNewVideo" : "checkFavoriteActress";
    for (const command of owner.workspaceCommands || []) {
        const inMenu = compact && command.id !== primary;
        command.button.appendTo(inMenu ? menu : actions).attr("role", inMenu ? "menuitem" : null);
        if (command.button.attr("aria-busy") !== "true") command.button.find("span").last().text(compact && !inMenu ? (primary === "checkNewVideo" ? "检测" : "同步") : command.label);
    }
    if (menuFocused) {
        const command = owner.workspaceCommands.find(item => item.button[0] === active), visibleCommand = command && command.button.parent()[0] === actions[0] && !command.button.prop("disabled");
        (visibleCommand ? command.button : actions.find("button:not(:disabled)").first().length ? actions.find("button:not(:disabled)").first() : root.find('.jhs-new-video-view [aria-selected="true"]')).trigger("focus");
    }
    root.find("#nv-filter-panel").prop("hidden", compact && !owner.nvFiltersExpanded);
    root.find("#nvFilterToggle").attr("aria-expanded", String(!!owner.nvFiltersExpanded));
    root.find("#jhs-task-status-list").prop("hidden", compact && !owner.nvTasksExpanded);
    root.find("#nvTaskToggle").attr("aria-expanded", String(!!owner.nvTasksExpanded));
    owner.syncFilterSummary();
    if (changed && owner._viewMode === "list") owner.renderBatchBar();
}

/** @param {NewVideoWorkspaceService} owner */
export function readBodyFilter(owner) {
    return normalizeBodyFilter({
        heightMin: owner.jquery("#nvHeightMin").val(),
        heightMax: owner.jquery("#nvHeightMax").val(),
        ageMin: owner.jquery("#nvAgeMin").val(),
        ageMax: owner.jquery("#nvAgeMax").val(),
        cups: owner.jquery(".jhs-nv-cup-checkbox:checked").toArray().map((/** @type {HTMLInputElement} */ node) => owner.jquery(node).val()),
    });
}

/** @param {NewVideoWorkspaceService} owner */
export function resetBodyFilter(owner) {
    owner.jquery("#nvHeightMin,#nvHeightMax,#nvAgeMin,#nvAgeMax").val("");
    owner.jquery(".jhs-nv-cup-checkbox").prop("checked", false);
    owner.syncFilterSummary();
}

/** @param {NewVideoWorkspaceService} owner */
export function syncFilterSummary(owner) {
    const root = owner.nvWorkspaceRoot;
    if (!root) return;
    const selectors = owner._viewMode === "list" ? [["#nvCategoryFilter", "类别"], ["#nvStateFilter", "状态"], ["#nvDecisionFilter", "决策"]] : [["#paramActressType", "演员类别"]];
    const filters = selectors.map(([selector, label]) => {
        const select = root.find(selector); return select.val() && select.val() !== "all" ? `${label}：${select.find("option:selected").text()}` : "";
    }).filter(Boolean);
    const body = owner.readBodyFilter();
    if (body.heightMin !== null || body.heightMax !== null) filters.push(`身高：${body.heightMin ?? ""}~${body.heightMax ?? ""}cm`);
    if (body.ageMin !== null || body.ageMax !== null) filters.push(`年龄：${body.ageMin ?? ""}~${body.ageMax ?? ""}岁`);
    if (body.cups.length) filters.push(`罩杯：${body.cups.join("/")}`);
    root.find("#nvBodyReset").prop("hidden", !hasActiveBodyFilter(body));
    const summary = filters.length ? `筛选，${filters.join("；")}` : "筛选，全部";
    root.find("#nvFilterToggle").attr("aria-label", summary).find("span").text(filters.length ? `筛选 ${filters.length}` : "筛选");
}

/** @param {NewVideoWorkspaceService} owner */
export function refreshCurrentView(owner, { resetPage = true } = {}) {
    if (resetPage) {
        if ("list" === owner._viewMode) owner.nvCurrentPage = 1;
        else owner.currentPage = 1;
    }
    owner.nvRenderGeneration++;
    owner.syncFilterSummary();
    return owner.renderCurrentView();
}

/** @param {NewVideoWorkspaceService} owner */
export function bindClick(owner) {
    const refreshView = () => {
        void owner.refreshCurrentView({ resetPage: true });
    };
    owner.task?.available() || owner.jquery("#checkFavoriteActress,#checkNewVideo").prop("disabled", !0).attr("title", "后台任务已关闭");
    owner.jquery("#reLoad").on("click", (() => {
        void owner.reloadNewVideoWorkspaceData(), owner.jquery("#checkNewVideoMsg").text("");
    })), owner.jquery("#new-video-list-container").on("click", ".nv-card__link", (async (/** @type {JQueryEvent} */ e) => {
        const t = owner.jquery(e.currentTarget).closest(".nv-card").attr("data-car");
        if (!t) return;
        try {
            const enabled = owner.getRuntimeService("settings").snapshot().autoRemoveNewVideoMarkAfterBrowse ?? C;
            if (enabled !== _) return;
            await owner.getRuntimeService("state").removeFromNewVideoList([ t ], "browse");
        } catch (n) {
            owner.logger.error("移除新作品标记失败:", n);
        }
    })), owner.jquery("#toSetting").on("click", ((/** @type {JQueryEvent} */ e) => {
        owner.openTaskSettings?.(() => {
            owner.jquery("#setting-checkFavoriteActress").css({
                border: "1px solid var(--jhs-accent)"
            }), owner.jquery("#setting-checkNewVideo").css({
                border: "1px solid var(--jhs-accent)"
            });
        });
    }));
    owner.jquery("#checkFavoriteActress").on("click", ((/** @type {JQueryEvent} */ event) => {
        void owner.runManualTask(owner.jquery(event.currentTarget), "同步中…", (async task => {
            if (!owner.jquery('a[href*="/users/profile"]').length) return void owner.notifications.error(`请先登录 ${PRODUCT_NAMES.javdb}`);
            await task.checkFavoriteActress(true);
        }));
    })), owner.jquery("#checkNewVideo").on("click", ((/** @type {JQueryEvent} */ event) => {
        void owner.runManualTask(owner.jquery(event.currentTarget), "检测中…", task => task.checkNewVideo(true));
    })), owner.jquery("#paramActressType,#paramSortBy,#nvSortBy,#nvCategoryFilter,#nvStateFilter,#nvDecisionFilter").off("change.jhsNvFilter").on("change.jhsNvFilter", refreshView),
    owner.jquery("#nv-filter-panel").off("change.jhsNvBody").on("change.jhsNvBody", ".jhs-nv-cup-checkbox", refreshView),
    owner.nvBodyFilterDebounced?.cancel?.(), owner.nvBodyFilterDebounced = debounce(refreshView, 200),
    owner.jquery("#nv-filter-panel").off("input.jhsNvBody").on("input.jhsNvBody", "#nvHeightMin,#nvHeightMax,#nvAgeMin,#nvAgeMax", owner.nvBodyFilterDebounced),
    owner.jquery("#nv-filter-panel").off("click.jhsNvBody").on("click.jhsNvBody", "#nvBodyReset", () => {
        owner.nvBodyFilterDebounced?.cancel?.();
        owner.resetBodyFilter();
        refreshView();
    }),
    owner.nvSearchDebounced?.cancel?.(), owner.nvSearchDebounced = debounce(refreshView, 200), owner.jquery("#nvSearch").off("input.jhsNvSearch").on("input.jhsNvSearch", owner.nvSearchDebounced), owner.jquery(".jhs-new-video-view").on("click", '[role="tab"]', ((/** @type {JQueryEvent} */ event) => {
        owner.setViewMode(owner.jquery(event.currentTarget).data("view"));
    })).on("keydown", '[role="tab"]', ((/** @type {JQueryEvent} */ event) => {
        if (![ "ArrowLeft", "ArrowRight", "Home", "End" ].includes(event.key)) return;
        event.preventDefault();
        const tabs = owner.jquery(event.delegateTarget).find('[role="tab"]'), index = tabs.index(event.currentTarget), next = "Home" === event.key ? 0 : "End" === event.key ? tabs.length - 1 : "ArrowRight" === event.key ? (index + 1) % tabs.length : (index - 1 + tabs.length) % tabs.length;
        tabs.eq(next).trigger("click").trigger("focus");
    })), owner.bindBatchActions();
}

/** @param {NewVideoWorkspaceService} owner */
export function setViewMode(owner, /** @type {string} */ mode) {
    if (![ "actress", "list" ].includes(mode) || mode === owner._viewMode) return;
    owner._viewMode = mode, owner.getRuntimeService("storage").setLocal("jhs_newVideoViewMode", mode), owner.applyViewMode(), owner.refreshCurrentView({ resetPage: true });
}

/** @param {NewVideoWorkspaceService} owner */
export function applyViewMode(owner) {
    const list = "list" === owner._viewMode;
    owner.jquery("#nv-pagination-bar").toggle(list);
    owner.jquery("#actress-card-container").toggle(!list), owner.jquery("#actress-pagination").toggle(!list), owner.jquery("#new-video-list-container").toggle(list), owner.jquery("#new-video-list-footer").toggle(list), JhsSelect.setVisible("#paramSortBy", !list), JhsSelect.setVisible("#nvSortBy", list), JhsSelect.setVisible("#paramActressType", !list), JhsSelect.setVisible("#nvCategoryFilter", list), JhsSelect.setVisible("#nvStateFilter", list), JhsSelect.setVisible("#nvDecisionFilter", list), owner.jquery("#nvSearch").toggleClass("jhs-is-hidden", !list), owner.jquery(".jhs-new-video-view [role='tab']").each(((/** @type {number} */ index, /** @type {HTMLElement} */ tab) => {
        const active = owner.jquery(tab).data("view") === owner._viewMode;
        owner.jquery(tab).attr({ "aria-selected": String(active), tabindex: active ? "0" : "-1" }).toggleClass("active", active);
    }));
    owner.jquery("#nv-filter-panel .jhs-new-video-filter-field").each((/** @type {number} */ _, /** @type {HTMLElement} */ label) => {
        const field = owner.jquery(label), selectControl = field.find(".jhs-select-control");
        if (selectControl.length) field.prop("hidden", selectControl.hasClass("jhs-is-hidden"));
    });
    owner.syncWorkspaceLayout();
}

/** @param {NewVideoWorkspaceService} owner */
export function renderCurrentView(owner) {
    return "list" === owner._viewMode ? owner.renderNewVideoList() : owner.renderActressCards();
}

/** @param {NewVideoWorkspaceService} owner */
export function renderWorkspaceLoading(owner, /** @type {any} */ container) {
    if (!owner.nvWorkspaceLoading) return false;
    renderStateView(container, { type: "loading", title: "加载中…" }), container.attr("aria-busy", "true");
    return true;
}
