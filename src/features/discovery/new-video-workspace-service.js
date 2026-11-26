// @ts-check
import { AVATAR_SOURCE_INDEX_KEY } from "./new-video-preferences.js";
import { debounce } from "../../core/timing.js";
import { OwnedPopover } from "../../core/owned-popover.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { A, normalizeCarNum } from "../../core/constants.js";
import { parseNumberSetting } from "../../core/feature-helpers.js";
import { FEATURE_ICONS } from "../../core/feature-icons.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { renderStateView } from "../../core/ui-primitives.js";
import { openDialog, openNewVideoDialog, cleanupNewVideoWorkspace, bindWorkspaceLayout, syncWorkspaceLayout, readBodyFilter, resetBodyFilter, syncFilterSummary, refreshCurrentView, bindClick, setViewMode, applyViewMode, renderCurrentView, renderWorkspaceLoading } from "./new-video-dialog-view.js";
import { getTaskButtonTips, resetBtnTip, runManualTask, renderTaskStatuses } from "./new-video-task-status.js";
import { applyNewVideoRemovals, getNewVideoFlatList, getActorCoverRequest, loadCoverForItems, hydrateVisibleCovers, pruneNewVideoSelection, renderNewVideoList, selectedItems, applyProcessedSelection, runBatchMutation, bindBatchActions, executeBatchAction, renderBatchBar, bindBatchPopover, nvSortList, nvCardHtml, nvRenderPage } from "./new-video-movie-list.js";
import { syncMeasurementsCaches, getActressMeasurements, matchesNewVideoBodyFilter, renderActressCards, renderPagination, removeFavoriteActressRecord, removeUnavailableActress } from "./new-video-actress-list.js";
import { isEditorCurrent, closeActressEditor, cancelAvatarSearch, openEditorChild, editActress, searchAvatar, openAvatarCandidates } from "./new-video-actress-editor.js";
import { closeRebindDialogs, parseActorIdInput, resolveActorBaseUrl, applyActorRebind, openRebindActorDialog } from "./new-video-actor-rebind.js";
/** @typedef {{scope: LifecycleScope, id: number | null, ended: boolean, close: () => void, root?: any}} EditorChild */
/** @typedef {{coverUrl: string, title?: string}} MovieCover */
/** @typedef {{starId?: string, id?: string, name?: string, avatar?: string, url?: string, allName?: string[], actressType?: string}} ActorTarget */



/** @typedef {import("../../core/state-service.js").StateRecord} StateRecord */
/** @typedef {MouseEvent & {currentTarget: HTMLElement, target: HTMLElement, key: string, delegateTarget: HTMLElement}} JQueryEvent */
/** @typedef {Event & {currentTarget: HTMLInputElement, target: HTMLElement}} JQueryInputEvent */
/** @typedef {Record<string, any> & {starId: string, name: string, newVideoList?: Array<string | StateRecord>}} ActorRecord */
/** @typedef {{carNum: string, title: string, url: string, coverUrl: string, actressName: string, actresses?: string[], starId: string, starIds: string[], categories: string[], publishTime: string, isVr: boolean, score: number, voteCount: number, flags: import("../../core/state-model.js").StateFlags, decision: Decision | null, decisionState: string}} MovieRow */
/** @typedef {{action: string, until?: string}} Decision */
/** @typedef {import("../../core/actress-measurements.js").ParsedMeasurements} Measurements */
/** @typedef {ReturnType<typeof debounce>} CancelDebounce */
/** @typedef {{scope: LifecycleScope, generation: number, root: any, record: ActorRecord, id: number | null, search: {scope: LifecycleScope, generation: number} | null, searchGeneration: number, avatarChild: EditorChild | null, savePending: boolean, saved?: boolean, mounted?: boolean, layer?: any}} ActressEditor */

/** @template {(...args: any[]) => unknown} F @typedef {Parameters<F> extends [any, ...infer Args] ? Args : never} ActionArgs */
export class NewVideoWorkspaceService {
    /** @param {{runtimeServices?: Record<string, any>, task?: {available: () => boolean, current: () => any, activate: () => Promise<any>}, openTaskSettings?: (callback: () => void) => unknown, batchController?: any, workspaceController?: any, loadStyles?: () => Promise<void>, startLoading?: () => {close?: () => void}, jquery: (value: any) => any, utilities: any, notifications: any, logger: any, events: any, createImageHoverPreview: (config: Record<string, any>) => any, document: Document, window: Window & typeof globalThis}} options */
    constructor(options) {
        this.runtimeServices = options.runtimeServices ?? {};
        this.openTaskSettings = options.openTaskSettings;
        this.task = options.task;
        this.jquery = options.jquery;
        this.utils = options.utilities;
        this.notifications = options.notifications;
        this.logger = options.logger;
        this.startLoading = options.startLoading;
        this.events = options.events;
        this.createImageHoverPreview = options.createImageHoverPreview;
        this.document = options.document;
        this.window = options.window;
        this.disposed = false;
        /** @type {EventListener | null} */ this._tipSettingsChanged = null;
        /** @type {number | null} */ this.nvDialogId = null;
        this.nvDialogGeneration = 0;
        this.nvLoadGeneration = 0;
        this.nvWorkspaceLoading = false;
        /** @type {Promise<number | undefined> | null} */ this.nvDialogOpenPromise = null;
        /** @type {LifecycleScope | null} */ this.workspaceLayoutScope = null;
        /** @type {OwnedPopover | null} */ this.workspaceMorePopover = null;
        /** @type {OwnedPopover | null} */ this.batchPopover = null;
        /** @type {ActressEditor | null} */ this.editor = null;
        this.editorGeneration = 0;
        /** @type {Set<() => void>} */ this.rebindDialogClosers = new Set();
        this.settingSvg = FEATURE_ICONS.settingSvg;
        this.editSvg = FEATURE_ICONS.editSvg;
        this.deleteSvg = FEATURE_ICONS.deleteSvg;
        this.checkSvg = FEATURE_ICONS.checkSvg;
        this.actressSvg = FEATURE_ICONS.actressSvg;
        this.newSvg = FEATURE_ICONS.newSvg;
        this.refreshSvg = FEATURE_ICONS.refreshSvg;
        this.currentPage = 1;
        this.pageSize = 30;
        this.nvCurrentPage = 1;
        this.nvPageSize = 60;
        this.nvRenderGeneration = 0;
        this.nvRuleTime = 8760;
        this.avatarSourceIndex = 0;
        /** @type {MovieRow[]} */ this.nvFlatListCache = [];
        /** @type {Map<string, MovieRow>} */ this.nvAllItemsMap = new Map();
        /** @type {ActorRecord[]} */ this.nvActressesCache = [];
        /** @type {Map<string, StateRecord>} */ this.nvCarMapCache = new Map();
        /** @type {Map<string, Measurements | null>} */ this.nvMeasurementsByStarId = new Map();
        /** @type {Map<string, Measurements>} */ this.nvMeasurementsByName = new Map();
        this.nvSortBy = "publishTime_desc";
        /** @type {Set<string>} */ this.nvSelected = new Set();
        /** @type {Record<string, Decision>} */ this.nvDecisionsCache = {};
        /** @type {Map<string, string>} */ this.nvCoverCache = new Map();
        /** @type {Map<string, Promise<Map<string, MovieCover>>>} */ this.nvActorCoverRequests = new Map();
        /** @type {CancelDebounce | null} */ this.nvSearchDebounced = null;
        /** @type {CancelDebounce | null} */ this.nvBodyFilterDebounced = null;
        /** @type {number | null} */ this.nvInvalidationTimer = null;
        /** @type {Promise<void> | null} */ this.nvWorkspaceReloadPromise = null;
        this.nvWorkspaceReloadDirty = false;
        this.nvWorkspaceMounted = false;
        /** @type {import('../../core/image-hover-preview.js').ImageHoverPreview | null} */ this.nvCoverPreview = null;
        /** @type {any} */ this.nvWorkspaceRoot = null;
        this.nvJavDbUrl = "";
        /** @type {ReturnType<import("../../services/actress-info-service.js").ActressInfoService["getAvatarSources"]>} */ this.avatarSources = [];
        this.nvWorkspaceFullReloadRequested = false;
        /** @type {Set<string>} */ this.nvPendingRemovals = new Set();
        /** @type {Set<Element>} */ this.nvRemovingCards = new Set();
        /** @type {MovieRow[]} */ this.nvCurrentPageItems = [];
        this._viewMode = "actress";
        this.nvFiltersExpanded = false;
        this.nvTasksExpanded = false;
        this.nvCompact = false;
        /** @type {Array<{id: string, button: any, label: string}>} */ this.workspaceCommands = [];
        /** @type {any} */ this._editActressRoot = null;
        /** @type {(() => Promise<void>) | undefined} */ this.loadStyles = options.loadStyles;
        /** @type {any} */ this.featureNewVideoBatchController = options.batchController;
        /** @type {any} */ this.featureNewVideoWorkspaceController = options.workspaceController;
    }
    getName() {
        return "NewVideoPlugin";
    }
    /** @param {string} name */
    getRuntimeService(name) { return this.runtimeServices[name]; }
    /** Broadcasts a durable workspace change without turning notification failures into write failures. */
    async notifyCommittedNewVideoChange(/** @type {string} */ reason) {
        try { await this.events.emit("new-video-changed", { reason }); }
        catch (error) {
            try { this.logger.warn("新作品记录已保存，但跨标签通知失败", error); }
            catch { /* A failed diagnostic must not reclassify a committed write. */ }
        }
    }
    prepareFeatureActivation() {
        this.disposed = false;
    }
    getStartupMode() {
        return "idle";
    }
    initializeLocalState() {
        this.avatarSources = this.getRuntimeService("actressInfo").getAvatarSources();
        const value = parseInt(this.getRuntimeService("storage").getLocal(AVATAR_SOURCE_INDEX_KEY) || "0", 10);
        this.avatarSourceIndex = Number.isInteger(value) && value >= 0 && value < this.avatarSources.length ? value : 0;
    }
    isWorkspaceMounted() {
        return this.nvWorkspaceMounted && this.jquery(".newVideoToolBox").length > 0;
    }
    scheduleWorkspaceReload(/** @type {{carNums?: string[], reason?: string}} */ payload = {}) {
        const carNums = Array.isArray(payload?.carNums) ? payload.carNums.map(normalizeCarNum).filter(carNum => carNum !== null) : [];
        if ([ "browse", "state-handled", "manual" ].includes(payload.reason ?? "") && carNums.length) carNums.forEach((carNum) => this.nvPendingRemovals.add(carNum));
        else this.nvWorkspaceFullReloadRequested = !0;
        this.nvWorkspaceReloadDirty = !0;
        this.nvInvalidationTimer || (this.nvInvalidationTimer = setTimeout((() => {
            this.nvInvalidationTimer = null, void this.flushWorkspaceReload();
        }), 0));
    }
    async flushWorkspaceReload() {
        if (this.nvWorkspaceReloadPromise) return this.nvWorkspaceReloadPromise;
        if (!this.nvWorkspaceReloadDirty) return;
        return this.nvWorkspaceReloadPromise = (async () => {
            do {
                const fullReload = this.nvWorkspaceFullReloadRequested, removals = new Set(this.nvPendingRemovals);
                this.nvWorkspaceFullReloadRequested = !1, this.nvPendingRemovals.clear();
                this.nvWorkspaceReloadDirty = !1, await this.showNewVideoCount();
                if (this.isWorkspaceMounted()) {
                    if (!fullReload && removals.size && this._viewMode === "list" && this.jquery("#nv-grid").length) await this.applyNewVideoRemovals(removals);
                    else await this.reloadNewVideoWorkspaceData({ preservePage: !0 });
                }
            } while (this.nvWorkspaceReloadDirty);
        })().catch((error => this.logger.error("新作品数据刷新失败", error))).finally((() => {
            this.nvWorkspaceReloadPromise = null;
        })), this.nvWorkspaceReloadPromise;
    }
    /** @param {ActionArgs<typeof applyNewVideoRemovals>} args */
    applyNewVideoRemovals(...args) { return applyNewVideoRemovals(this, ...args); }
    getPendingNewVideoCount(/** @type {ActorRecord} */ e, /** @type {Map<string, StateRecord>} */ t) {
        if (this.featureNewVideoWorkspaceController?.getPendingNewVideoCount) return this.featureNewVideoWorkspaceController.getPendingNewVideoCount(e, t, this.nvDecisionsCache);
        return Array.isArray(e?.newVideoList) ? new Set(e.newVideoList.map(((item) => normalizeCarNum("string" == typeof item ? item : item.carNum))).filter(((/** @type {string | null} */ carNum) => carNum && !t.has(carNum) && !this.isDecisionHidden(carNum)))).size : 0;
    }
    isDecisionHidden(/** @type {string} */ carNum) {
        const decision = this.nvDecisionsCache[normalizeCarNum(carNum) ?? ""];
        if (!decision) return !1;
        return [ "ignored", "dismissed" ].includes(decision.action) || "snoozed" === decision.action && (!decision.until || Date.parse(decision.until) > Date.now());
    }
    async getPendingNewVideoTotal() {
        if (this.featureNewVideoWorkspaceController) {
            const summary = await this.featureNewVideoWorkspaceController.getPendingSummary();
            this.nvDecisionsCache = summary.decisions;
            return summary.count;
        }
        const state = this.getRuntimeService("state"), e = await state.getCarMap(), keys = new Set;
        this.nvDecisionsCache = await state.getNewVideoDecisions();
        (await state.getFavoriteActressList()).forEach(((/** @type {ActorRecord} */ actress) => Array.isArray(actress.newVideoList) && actress.newVideoList.forEach(((/** @type {string | StateRecord} */ item) => {
            const carNum = normalizeCarNum("string" == typeof item ? item : item.carNum);
            carNum && !hasAnyState(normalizeStateFlags(e.get(carNum)?.stateFlags)) && !this.isDecisionHidden(carNum) && keys.add(carNum);
        }))));
        return keys.size;
    }
    async showNewVideoCount() {
        const e = await this.getPendingNewVideoTotal();
        if (this.disposed) return;
        this.jquery("#newVideoCount").text(`${e}`);
    }
    getTaskButtonTips() { return getTaskButtonTips(this); }
    /** @param {ActionArgs<typeof resetBtnTip>} args */
    resetBtnTip(...args) { return resetBtnTip(this, ...args); }
    openDialog() { return openDialog(this); }
    /** @param {ActionArgs<typeof openNewVideoDialog>} args */
    openNewVideoDialog(...args) { return openNewVideoDialog(this, ...args); }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.nvDialogGeneration++;
        this.nvDialogOpenPromise = null;
        if (this.nvInvalidationTimer) clearTimeout(this.nvInvalidationTimer ?? undefined);
        this.nvInvalidationTimer = null;
        const dialogId = this.nvDialogId;
        this.nvDialogId = null;
        if (dialogId != null) this.getRuntimeService("dialog")?.close?.(dialogId);
        this.closeActressEditor();
        this.cleanupNewVideoWorkspace();
    }
    cleanupNewVideoWorkspace() { return cleanupNewVideoWorkspace(this); }
    closeRebindDialogs() { return closeRebindDialogs(this); }
    bindWorkspaceLayout() { return bindWorkspaceLayout(this); }
    syncWorkspaceLayout() { return syncWorkspaceLayout(this); }
    readBodyFilter() { return readBodyFilter(this); }
    resetBodyFilter() { return resetBodyFilter(this); }
    syncFilterSummary() { return syncFilterSummary(this); }
    /** @param {ActionArgs<typeof refreshCurrentView>} args */
    refreshCurrentView(...args) { return refreshCurrentView(this, ...args); }
    bindClick() { return bindClick(this); }
    /** @param {ActionArgs<typeof runManualTask>} args */
    runManualTask(...args) { return runManualTask(this, ...args); }
    /** @param {ActionArgs<typeof setViewMode>} args */
    setViewMode(...args) { return setViewMode(this, ...args); }
    applyViewMode() { return applyViewMode(this); }
    renderCurrentView() { return renderCurrentView(this); }
    /** @param {ActionArgs<typeof renderWorkspaceLoading>} args */
    renderWorkspaceLoading(...args) { return renderWorkspaceLoading(this, ...args); }
    loadData() {
        this.currentPage = 1;
        return this.reloadNewVideoWorkspaceData();
    }
    async reloadNewVideoWorkspaceData({ preservePage = !1, skipTaskStatusRender = !1 } = {}) {
        if (!this.isWorkspaceMounted()) return;
        const generation = ++this.nvLoadGeneration, root = this.nvWorkspaceRoot;
        const current = () => generation === this.nvLoadGeneration && root === this.nvWorkspaceRoot && this.isWorkspaceMounted();
        this.nvWorkspaceLoading = true, this.nvRenderGeneration++;
        preservePage || (this.currentPage = 1, this.nvCurrentPage = 1);
        this.jquery("#nv-pagination-bar").remove();
        this.renderCurrentView();
        try {
            if (!this.featureNewVideoWorkspaceController) throw new Error("Discovery workspace feature is unavailable");
            const workspace = await this.featureNewVideoWorkspaceController.loadWorkspace();
            const { actresses, carMap, decisions, measurementsByStarId, ruleTime, javDbUrl } = workspace;
            if (!current()) return;
            this.nvActressesCache = actresses, this.nvCarMapCache = carMap, this.nvDecisionsCache = decisions, this.nvJavDbUrl = javDbUrl, this.nvRuleTime = parseNumberSetting(ruleTime, 8760, { min: 0 });
            this.syncMeasurementsCaches(actresses, measurementsByStarId);
            if (!Array.isArray(workspace.items)) throw new TypeError("Discovery workspace projection is unavailable");
            const items = workspace.items, nextMap = new Map;
            items.forEach(((/** @type {MovieRow} */ item) => nextMap.set(normalizeCarNum(item.carNum), { ...item, carNum: normalizeCarNum(item.carNum) }))), this.nvAllItemsMap = nextMap;
            this.pruneNewVideoSelection();
            this.nvWorkspaceLoading = false, this.nvRenderGeneration++, await this.renderCurrentView();
            current() && !skipTaskStatusRender && this.renderTaskStatuses();
        } catch (error) {
            if (!current()) return;
            const container = this.jquery("list" === this._viewMode ? "#new-video-list-container" : "#actress-card-container");
            this.logger.error("加载新作品工作区失败", error), renderStateView(container, { type: "error", title: "加载失败", description: "请稍后重试", actionLabel: "重试", onAction: () => this.reloadNewVideoWorkspaceData({ preservePage: !0 }) });
        } finally {
            if (current()) this.nvWorkspaceLoading = false, this.jquery("#new-video-list-container,#actress-card-container").attr("aria-busy", "false");
        }
    }
    renderTaskStatuses() { return renderTaskStatuses(this); }
    /** @param {ActionArgs<typeof syncMeasurementsCaches>} args */
    syncMeasurementsCaches(...args) { return syncMeasurementsCaches(this, ...args); }
    /** @param {ActionArgs<typeof getActressMeasurements>} args */
    getActressMeasurements(...args) { return getActressMeasurements(this, ...args); }
    /** @param {ActionArgs<typeof matchesNewVideoBodyFilter>} args */
    matchesNewVideoBodyFilter(...args) { return matchesNewVideoBodyFilter(this, ...args); }
    renderActressCards() { return renderActressCards(this); }
    getNewVideoFlatList() { return getNewVideoFlatList(this); }
    /** @param {ActionArgs<typeof getActorCoverRequest>} args */
    getActorCoverRequest(...args) { return getActorCoverRequest(this, ...args); }
    /** @param {ActionArgs<typeof loadCoverForItems>} args */
    loadCoverForItems(...args) { return loadCoverForItems(this, ...args); }
    /** @param {ActionArgs<typeof hydrateVisibleCovers>} args */
    hydrateVisibleCovers(...args) { return hydrateVisibleCovers(this, ...args); }
    pruneNewVideoSelection() { return pruneNewVideoSelection(this); }
    /** @param {ActionArgs<typeof renderNewVideoList>} args */
    renderNewVideoList(...args) { return renderNewVideoList(this, ...args); }
    selectedItems() { return selectedItems(this); }
    /** @param {ActionArgs<typeof applyProcessedSelection>} args */
    applyProcessedSelection(...args) { return applyProcessedSelection(this, ...args); }
    /** @param {ActionArgs<typeof runBatchMutation>} args */
    runBatchMutation(...args) { return runBatchMutation(this, ...args); }
    bindBatchActions() { return bindBatchActions(this); }
    /** @param {ActionArgs<typeof executeBatchAction>} args */
    executeBatchAction(...args) { return executeBatchAction(this, ...args); }
    renderBatchBar() { return renderBatchBar(this); }
    /** @param {ActionArgs<typeof bindBatchPopover>} args */
    bindBatchPopover(...args) { return bindBatchPopover(this, ...args); }
    /** @param {ActionArgs<typeof nvSortList>} args */
    nvSortList(...args) { return nvSortList(this, ...args); }
    /** @param {ActionArgs<typeof nvCardHtml>} args */
    nvCardHtml(...args) { return nvCardHtml(this, ...args); }
    /** @param {ActionArgs<typeof nvRenderPage>} args */
    nvRenderPage(...args) { return nvRenderPage(this, ...args); }
    /** @param {ActressEditor | null} editor @returns {editor is ActressEditor} */
    isEditorCurrent(editor) { return isEditorCurrent(this, editor); }
    /** @param {ActionArgs<typeof closeActressEditor>} args */
    closeActressEditor(...args) { return closeActressEditor(this, ...args); }
    /** @param {ActionArgs<typeof cancelAvatarSearch>} args */
    cancelAvatarSearch(...args) { return cancelAvatarSearch(this, ...args); }
    /** @param {ActionArgs<typeof openEditorChild>} args */
    openEditorChild(...args) { return openEditorChild(this, ...args); }
    /** @param {ActionArgs<typeof editActress>} args */
    editActress(...args) { return editActress(this, ...args); }
    /** @param {ActionArgs<typeof renderPagination>} args */
    renderPagination(...args) { return renderPagination(this, ...args); }
    /** @param {ActionArgs<typeof searchAvatar>} args */
    searchAvatar(...args) { return searchAvatar(this, ...args); }
    /** @param {ActionArgs<typeof openAvatarCandidates>} args */
    openAvatarCandidates(...args) { return openAvatarCandidates(this, ...args); }
    /** @param {ActionArgs<typeof removeFavoriteActressRecord>} args */
    removeFavoriteActressRecord(...args) { return removeFavoriteActressRecord(this, ...args); }
    /** @param {ActionArgs<typeof removeUnavailableActress>} args */
    removeUnavailableActress(...args) { return removeUnavailableActress(this, ...args); }
    /** @param {Parameters<typeof parseActorIdInput>} args */
    static parseActorIdInput(...args) { return parseActorIdInput(...args); }
    resolveActorBaseUrl() { return resolveActorBaseUrl(this); }
    /** @param {ActionArgs<typeof applyActorRebind>} args */
    applyActorRebind(...args) { return applyActorRebind(this, ...args); }
    /** @param {ActionArgs<typeof openRebindActorDialog>} args */
    openRebindActorDialog(...args) { return openRebindActorDialog(this, ...args); }
}
