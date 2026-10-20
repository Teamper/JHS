// @ts-check
import { getIcon } from "../../core/icons.js";
import { formatUiDateTime } from "../../core/ui-date-time.js";
import { OwnedPopover } from "../../core/owned-popover.js";

import { PRODUCT_NAMES } from "../../core/product-names.js";

const ACTIVITY_LABELS = Object.freeze({
    "record-delete": "移除记录", "new-video-decision": "更新新作品处理状态", "new-video-remove": "移除新作品",
    "history-state": "更新影片状态", "history-batch-state": "批量更新状态", "history-edit": "编辑记录",
    "javdb-list-import": "导入影片", "list-card-state": "更新影片状态", "list-batch-state": "批量更新状态",
    "actor-page-block": "屏蔽演员影片", "actor-page-batch-state": "批量更新状态", "offline-mark-downloaded": "标记已下载",
    "new-video-batch-state": "批量更新新作品", "detail-state": "更新影片状态", "legacy-save": "更新影片状态", "legacy-update": "更新影片状态",
});

import { b, d, g, h, k, m, normalizeCarNum, p, u, v, y, escapeHtml } from "../../core/constants.js";
import { hasAnyState, legacyActionToFlag, normalizeStateFlags } from "../../core/state-model.js";
import { HistorySelectionModel } from "./history-selection-model.js";
import { HistoryRepository } from "./history-repository.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";

/** @typedef {Record<string, any>} HistoryRecord */
/** @typedef {any} JQueryHandle */
/** @typedef {any} TableHandle */

/**
 * Pure DOM builders for the History table and edit dialog. Imported/legacy data
 * fields (carNum, names, url, remark) are treated as text — never interpolated
 * into HTML or attributes — so hostile backup records stay inert.
 */
/** Build the carNum cell: clickable prefix button + remainder. @param {string} [carNum] @param {Document} [documentRuntime] */
export function buildCarNumCell(carNum, documentRuntime = document) {
    const value = String(carNum || ""), i = value.indexOf("-");
    if (-1 === i) return documentRuntime.createTextNode(value);
    const wrapper = documentRuntime.createElement("span"), button = documentRuntime.createElement("button");
    button.type = "button";
    button.className = "jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param";
    button.textContent = value.substring(0, i + 1);
    wrapper.className = "jhs-history-car-number";
    wrapper.appendChild(button), wrapper.appendChild(documentRuntime.createTextNode(value.substring(i + 1)));
    return wrapper;
}

/** Build the actress names cell with one clickable button per name. @param {string} [names] @param {Document} [documentRuntime] */
export function buildNamesCell(names, documentRuntime = document) {
    const wrapper = documentRuntime.createElement("span");
    String(names || "").split(" ").filter((name) => "" !== name.trim()).forEach((name) => {
        const button = documentRuntime.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param";
        button.textContent = name;
        wrapper.appendChild(button);
    });
    return wrapper;
}

/** Build the per-row action buttons; carNum/url go into dataset, never into HTML attributes. @param {Record<string, any>} record @param {Document} [documentRuntime] */
export function buildActionButtons(record, documentRuntime = document) {
    const container = documentRuntime.createElement("div");
    container.className = "action-btns";
    container.dataset.carNum = String(record.carNum || "");
    container.dataset.href = record.url ? String(record.url) : "";
    const detail = documentRuntime.createElement("button");
    detail.type = "button", detail.className = "jhs-btn jhs-btn--secondary history-detailBtn";
    const detailSpan = documentRuntime.createElement("span"); detailSpan.textContent = "查看"; detail.appendChild(detailSpan);
    container.appendChild(detail);
    const subBtns = documentRuntime.createElement("div");
    subBtns.className = "sub-btns";
    const toggle = documentRuntime.createElement("button");
    toggle.type = "button", toggle.className = "jhs-btn jhs-btn--ghost sub-btns-toggle";
    toggle.setAttribute("aria-haspopup", "menu"), toggle.setAttribute("aria-expanded", "false");
    const toggleSpan = documentRuntime.createElement("span"); toggleSpan.className="jhs-history-more-label"; toggleSpan.textContent = "更多操作"; toggle.appendChild(toggleSpan);
    toggle.setAttribute("aria-label","更多操作"); toggle.title="更多操作";
    const icon=documentRuntime.createElement("span"); icon.className="jhs-history-more-icon"; icon.innerHTML=getIcon("chevron-down"); toggle.appendChild(icon);
    subBtns.appendChild(toggle);
    const menu = documentRuntime.createElement("div");
    menu.className = "sub-btns-menu jhs-popover", menu.setAttribute("role", "menu");
    /** @type {Array<[string, string, string]>} */
    const menuItems = [ [ "history-editBtn", "编辑", "" ], [ "history-deleteBtn", "移除", "jhs-btn--danger" ], [ "history-hasWatchBtn", k, "" ], [ "history-hasDownBtn", y, "" ], [ "history-favoriteBtn", v, "" ], [ "history-filterBtn", m, "" ] ];
    for (const [ cls, label, extra ] of menuItems) {
        const item = /** @type {HTMLButtonElement} */ (documentRuntime.createElement("button"));
        item.type = "button", item.className = `jhs-btn jhs-btn--ghost ${cls}`, item.setAttribute("role", "menuitem");
        extra && item.classList.add(extra);
        item.textContent = label;
        menu.appendChild(item);
    }
    subBtns.appendChild(menu), container.appendChild(subBtns);
    return container;
}

/** Static edit-record form; values are back-filled via .val()/.text() so imported data stays inert. @param {{favorite?: boolean, downloaded?: boolean, watched?: boolean, blocked?: boolean}} flags */
export function buildEditRecordForm(flags) {
    return `\n            <div class="jhs-layout-8cddc29a">\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">番号</label>\n                    <input type="text" id="edit-carNum" class="jhs-field jhs-history-edit-field" readonly>\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">演员（用空格分隔）</label>\n                    <textarea id="edit-names" class="jhs-textarea jhs-history-edit-field"></textarea>\n                </div>\n                <fieldset class="jhs-layout-da303dcf"><legend class="jhs-layout-27f87d75">状态</legend>\n                    <label class="jhs-option-row">收藏 <input type="checkbox" id="edit-favorite" class="jhs-checkbox" ${flags.favorite ? "checked" : ""}></label>\n                    <label class="jhs-option-row">已下载 <input type="checkbox" id="edit-downloaded" class="jhs-checkbox" ${flags.downloaded ? "checked" : ""}></label>\n                    <label class="jhs-option-row">已观看 <input type="checkbox" id="edit-watched" class="jhs-checkbox" ${flags.watched ? "checked" : ""}></label>\n                    <label class="jhs-option-row">屏蔽 <input type="checkbox" id="edit-blocked" class="jhs-checkbox" ${flags.blocked ? "checked" : ""}></label>\n                </fieldset>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">链接</label>\n                    <input type="text" id="edit-url" class="jhs-field jhs-history-edit-field">\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">备注</label>\n                    <textarea id="edit-remark" class="jhs-textarea jhs-history-edit-field"></textarea>\n                </div>\n            </div>\n        `;
}

export class HistoryDialogController {
    /** @param {{document: Document, window: Window & typeof globalThis, jquery: (value: any) => any, domUi: any, dialog: any, notifications: any, logger: any, clipboard: any, movie: any, settings: any, storage: any, state: any, repository?: HistoryRepository, selectionModel?: HistorySelectionModel, site: string, resolveLegacy?: (name: string) => any, fc2WorkspaceAvailable?: boolean, getFc2Workspace?: () => Promise<any>}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.jquery = options.jquery;
        this.domUi = options.domUi;
        this.dialog = options.dialog;
        this.notifications = options.notifications;
        this.logger = options.logger;
        this.clipboard = options.clipboard;
        this.movie = options.movie;
        this.settings = options.settings;
        this.storage = options.storage;
        this.state = options.state;
        this.site = options.site;
        this.resolveLegacy = options.resolveLegacy ?? (() => null);
        this.fc2WorkspaceAvailable = options.fc2WorkspaceAvailable ?? false;
        this.getFc2Workspace = options.getFc2Workspace ?? null;
        /** @type {TableHandle | null} */ this.tableObj = null;
        /** @type {JQueryHandle | null} */ this.historyRoot = null;
        this.historySelectionModel = options.selectionModel ?? new HistorySelectionModel();
        /** @type {HistoryRepository} */ this._historyRepository = options.repository ?? new HistoryRepository({ storage: this.storage, state: this.state });
        /** @type {HistoryRecord[]} */ this.historySorters = [];
        this.historyFilteredCount = 0;
        this.historySelectionSyncing = !1;
        this.allCount = 0;
        this.filterCount = 0;
        this.favoriteCount = 0;
        this.hasDownCount = 0;
        this.hasWatchCount = 0;
        this.waitCheckCount = 0;
        this.dialogId = null;
        this.disposed = false;
        this.historyDialogGeneration = 0;
        this.historyViewGeneration = 0;
    }
    /** @param {string} value */
    getSourceLabel(value) {
        if (!value) return "";
        const movie = this.movie, settings = this.settings.snapshot();
        if (movie.matchesProviderUrl("av123", value)) return PRODUCT_NAMES.av123;
        try {
            const origin = new URL(value).origin;
            if (origin === movie.externalSiteOrigin("javDbBtn", settings)) return PRODUCT_NAMES.javdb;
            if (origin === movie.externalSiteOrigin("javBusBtn", settings)) return PRODUCT_NAMES.javbus;
        } catch {}
        return value.includes("javdb") ? PRODUCT_NAMES.javdb : value.includes("javbus") ? PRODUCT_NAMES.javbus : value.includes("123av") ? PRODUCT_NAMES.av123 : "其他";
    }
    get historyRepository() {
        return this._historyRepository;
    }
    refresh() { return this.tableObj?.setData(); }
    openHistory() {
        if (this.disposed) return undefined;
        if (this.dialogId != null) return this.dialogId;
        const generation = ++this.historyDialogGeneration;
        let e = `\n            <div class="jhs-history-layout jhs-history-dialog"> \n                 <div id="filterBox" class="jhs-layout-53809f1e">\n                    <select id="dataType" class="jhs-select-source" aria-label="按影片状态筛选记录">\n                        <option value="all" selected>所有</option>\n                        <option value="waitCheck">待鉴定</option>\n                        <option value="filter">${u}</option>\n                        <option value="favorite">${b}</option>\n                        <option value="hasDown">${y}</option>\n                        <option value="hasWatch">${k}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号、标题或演员" class="jhs-field">\n                    <button type="button" id="clearSearchbtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n                </div>\n                <div id="allSelectBox" class="jhs-layout-66253c00">\n                    <button type="button" class="jhs-btn jhs-btn--dark multiple-history-deleteBtn jhs-layout-7daea5fa"> <span>移除</span> </button>\n                    <button type="button" class="jhs-btn jhs-btn--watch multiple-history-hasWatchBtn jhs-layout-2e003268">标记观看</button>\n                    <button type="button" class="jhs-btn jhs-btn--down multiple-history-hasDownBtn jhs-layout-2e003268">标记下载</button>\n                    <button type="button" class="jhs-btn jhs-btn--fav multiple-history-favoriteBtn jhs-layout-2e003268">标记收藏</button>\n                    <button type="button" class="jhs-btn jhs-btn--filter multiple-history-filterBtn jhs-layout-2e003268">标记屏蔽</button>\n                </div>\n                <div id="table-container"></div>\n            </div>\n        `;
        e = e.replace('<div id="filterBox"', '<div id="historyViewTabs" class="jhs-segmented" role="tablist"><button type="button" class="jhs-btn jhs-segmented__item active" data-history-view="state">影片状态</button><button type="button" class="jhs-btn jhs-segmented__item" data-history-view="activity">操作记录</button><button type="button" class="jhs-btn jhs-segmented__item" data-history-view="offline">离线任务</button></div><div id="filterBox"');
        this.dialogId = this.dialog.open({
            type: 1,
            title: "鉴定记录",
            ui: { body: "table" },
            content: e,
            scrollbar: !1,
            shadeClose: !0,
            area: this.domUi.getDialogArea("xl"),
            anim: -1,
            success: async (/** @type {any} */ e) => {
                if (this.disposed || generation !== this.historyDialogGeneration) return;
                const root = this.jquery(e);
                this.historyViewGeneration++;
                this.historyRoot = root, root.find("#allSelectBox").prepend('<span id="historySelectionSummary" class="jhs-history-selection-summary" role="status" aria-live="polite"></span>'),
                root.find("#filterBox").append('<select id="historySort" class="jhs-select-source" aria-label="记录排序"><option value="">按表头排序</option><option value="updateDate:desc">更新时间 新→旧</option><option value="updateDate:asc">更新时间 旧→新</option><option value="createDate:desc">创建时间 新→旧</option><option value="createDate:asc">创建时间 旧→新</option><option value="publishTime:desc">发行时间 新→旧</option><option value="publishTime:asc">发行时间 旧→新</option><option value="carNum:asc">番号 A→Z</option><option value="carNum:desc">番号 Z→A</option><option value="names:asc">演员 A→Z</option><option value="names:desc">演员 Z→A</option><option value="url:asc">来源 A→Z</option><option value="url:desc">来源 Z→A</option><option value="remark:asc">备注 A→Z</option><option value="remark:desc">备注 Z→A</option></select>');
                root.on("change.jhsHistory", "#historySort", (/** @type {any} */ event) => { const [field,dir]=String(this.jquery(event.currentTarget).val()).split(":"); if (field) this.tableObj?.setSort(field,dir); });
                this.resetHistorySelection(!1), this.domUi.enhanceSelect(root);
                await this.loadTableData();
                if (this.disposed || root !== this.historyRoot || generation !== this.historyDialogGeneration) return;
                root.on("click.jhsHistory", "#clearSearchbtn", (async (/** @type {any} */ e) => {
                    root.find("#searchCarNum").val(""), this.domUi.setSelectValue(root.find("#dataType"), "all"), await this.reloadTable(),
                    root.find("#allSelectBox").hide();
                })).on("focusout.jhsHistory keydown.jhsHistory", "#searchCarNum", (async (/** @type {any} */ e) => {
                    if ("focusout" === e.type || "Enter" === e.key) {
                        if ("Enter" === e.key && e.preventDefault(), "keydown" === e.type && "Enter" !== e.key) return;
                        await this.reloadTable();
                    }
                })).on("click.jhsHistory", ".table-link-param", (async (/** @type {any} */ e) => {
                    let t = this.jquery(e.currentTarget);
                    root.find("#searchCarNum").val(t.text()), await this.reloadTable();
                })).on("change.jhsHistory", "#dataType", (async () => {
                    await this.reloadTable();
                })).on("click.jhsHistory", "[data-history-view]", (async (/** @type {any} */ event) => {
                    const view = this.jquery(event.currentTarget).data("history-view");
                    root.find("[data-history-view]").removeClass("active"), this.jquery(event.currentTarget).addClass("active"), await this.showHistoryView(view);
                })).on("click.jhsHistory", ".jhs-undo-activity", (async (/** @type {any} */ event) => {
                    const viewGeneration = this.historyViewGeneration;
                    try {
                        const result = await this.historyRepository.undo(this.jquery(event.currentTarget).data("transaction"));
                        this.notifications.info(`撤销完成：${result.reverted.length} 项成功，${result.conflicts.length} 项冲突`);
                        if (this.isCurrentHistoryView(root, viewGeneration)) await this.renderActivityHistory();
                    } catch (error) {
                        this.logger.error("撤销失败:", error), this.notifications.error("撤销失败，请稍后重试");
                    }
                })).on("click.jhsHistory", ".jhs-copy-offline", (async (/** @type {any} */ event) => {
                    await this.clipboard.copyText("离线资源", this.jquery(event.currentTarget).data("resource"));
                })).on("click.jhsHistory", ".jhs-retry-offline", (async (/** @type {any} */ event) => {
                    const viewGeneration = this.historyViewGeneration;
                    const id = this.jquery(event.currentTarget).data("id"), item = (await this.historyRepository.offline()).find((/** @type {HistoryRecord} */ entry) => entry.id === id), offline = this.resolveLegacy("UnifiedOfflinePlugin");
                    if (!this.isCurrentHistoryView(root, viewGeneration)) return;
                    item && offline && await offline.submitResource(event, item.resource, this.jquery(event.currentTarget), { carNum: item.carNum }, item.id, { forceAvailabilityRefresh: !0, preferredProviderId: item.providerId, previousOutcome: item.submissionOutcome });
                    if (this.isCurrentHistoryView(root, viewGeneration)) await this.renderOfflineHistory();
                })).on("click.jhsHistory", ".jhs-open-offline", (async (/** @type {any} */ event) => {
                    const id = this.jquery(event.currentTarget).data("id"), item = (await this.historyRepository.offline()).find((/** @type {HistoryRecord} */ entry) => entry.id === id), provider = this.resolveLegacy("UnifiedOfflinePlugin")?.registry?.providers?.get(item?.providerId), url = provider?.openUrl?.();
                    url && this.window.open(url, "_blank", "noopener,noreferrer");
                })).on("click.jhsHistory", ".jhs-delete-offline", (async (/** @type {any} */ event) => {
                    const viewGeneration = this.historyViewGeneration;
                    await this.historyRepository.removeOffline(this.jquery(event.currentTarget).data("id"));
                    if (this.isCurrentHistoryView(root, viewGeneration)) await this.renderOfflineHistory();
                })), this.bindHistoryActions(root);
            },
            end: () => {
                if (generation !== this.historyDialogGeneration) return;
                this.historyDialogGeneration++, this.historyViewGeneration++;
                this.dialogId = null;
                this.resetHistorySelection(), this.historyRoot?.off(".jhsHistory"), this.historyRoot = null, this.tableObj && (this.tableObj.destroy(), this.tableObj = null);
            }
        });
        return this.dialogId;
    }
    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.historyDialogGeneration++, this.historyViewGeneration++;
        if (this.dialogId != null) this.dialog.close(this.dialogId);
        this.dialogId = null;
        this.historyRoot?.off(".jhsHistory");
        this.historyRoot = null;
        this.tableObj?.destroy();
        this.tableObj = null;
        this.historySelectionModel.clear();
    }
    /** @param {string} view */
    async showHistoryView(view) {
        if (this.disposed || !this.historyRoot) return;
        this.historyViewGeneration++;
        const stateView = "state" === view;
        this.historyRoot?.find("#table-container").toggleClass("jhs-record-list jhs-scrollbar", !stateView);
        this.resetHistorySelection(), this.historyRoot?.find("#filterBox,#allSelectBox").toggle(stateView), this.tableObj?.destroy(), this.tableObj = null;
        return stateView ? this.loadTableData() : "activity" === view ? this.renderActivityHistory() : this.renderOfflineHistory();
    }
    /** @param {JQueryHandle | null} root @param {number} generation */
    isCurrentHistoryView(root, generation) {
        return !this.disposed && root != null && root === this.historyRoot && generation === this.historyViewGeneration;
    }
    async renderActivityHistory() {
        const root = this.historyRoot, generation = ++this.historyViewGeneration;
        if (!root || this.disposed) return;
        const log = await this.historyRepository.activity();
        if (!this.isCurrentHistoryView(root, generation)) return;
        const host = root.find("#table-container").empty().addClass("jhs-record-list jhs-scrollbar");
        if (!log.entries.length) return void host.html('<div class="jhs-state jhs-state--empty">暂无操作记录</div>');
        log.entries.slice().reverse().forEach((/** @type {HistoryRecord} */ entry) => {
            const reverted = entry.changes.filter((/** @type {HistoryRecord} */ change) => "reverted" === change.undoState).length, conflicts = entry.changes.filter((/** @type {HistoryRecord} */ change) => "conflict" === change.undoState).length;
        const label = ACTIVITY_LABELS[/** @type {keyof typeof ACTIVITY_LABELS} */ (entry.type)] || "更新影片状态";
        host.append(this.jquery("<article class=\"jhs-card jhs-record-card\"></article>").append(this.jquery("<strong></strong>").text(`${label} · ${entry.changes.length} 项`), this.jquery("<p></p>").text(`${formatUiDateTime(entry.createdAt)} · 已撤销 ${reverted} · 冲突 ${conflicts}`), this.jquery("<p></p>").text(entry.changes.map((/** @type {HistoryRecord} */ change) => change.carNum).join("、")), this.jquery("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary jhs-undo-activity\">撤销可恢复项</button>").attr("data-transaction", entry.id).prop("disabled", "committed" !== entry.commitState || reverted === entry.changes.length)));
        });
    }
    async renderOfflineHistory() {
        const root = this.historyRoot, generation = ++this.historyViewGeneration;
        if (!root || this.disposed) return;
        const history = await this.historyRepository.offline();
        if (!this.isCurrentHistoryView(root, generation)) return;
        const host = root.find("#table-container").empty().addClass("jhs-record-list jhs-scrollbar");
        if (!history.length) return void host.html('<div class="jhs-state jhs-state--empty">暂无离线任务</div>');
        history.slice().reverse().forEach((/** @type {HistoryRecord} */ item) => {
            const offline = this.resolveLegacy("UnifiedOfflinePlugin"), provider = offline?.registry?.providers?.get?.(item.providerId);
            const unknown = item.status === "pending" || item.submissionOutcome === "unknown" || !item.submissionOutcome && item.status === "failed" && ["TIMEOUT", "NETWORK_ERROR", "ABORTED"].includes(item.errorCode);
            const actions = this.jquery("<div class=\"jhs-toolbar\"></div>").append(this.jquery("<button type=\"button\" class=\"jhs-btn jhs-copy-offline\">复制资源</button>").attr("data-resource", item.resource));
            if (offline && provider) actions.append(this.jquery("<button type=\"button\" class=\"jhs-btn jhs-retry-offline\"></button>").text(unknown ? "核实后重试" : "重试").attr("data-id", item.id));
            if (provider && typeof provider.openUrl === "function") actions.append(this.jquery("<button type=\"button\" class=\"jhs-btn jhs-open-offline\">打开服务</button>").attr("data-id", item.id));
            actions.append(this.jquery("<button type=\"button\" class=\"jhs-btn jhs-btn--danger jhs-delete-offline\">移除记录</button>").attr("data-id", item.id));
            const statuses = { submitted: "已提交", success: "已完成", failed: "提交失败", pending: "待提交" };
            const status = unknown ? "提交结果待确认" : item.submissionOutcome === "exists" ? "云端任务已存在" : statuses[/** @type {keyof typeof statuses} */ (item.status)] || "状态待确认";
            const providerName = item.providerId === "115" ? PRODUCT_NAMES.one115 : item.providerId === "123" ? PRODUCT_NAMES.pan123 : item.providerName || "离线服务";
            host.append(this.jquery("<article class=\"jhs-card jhs-record-card\"></article>").append(this.jquery("<strong></strong>").text(`${providerName} · ${status}`), this.jquery("<p></p>").text(`${item.carNum || "未关联番号"} · ${formatUiDateTime(item.createdAt)}${item.retryOf ? " · 重试任务" : ""}`), this.jquery("<p></p>").text(unknown ? "请先打开云盘核实任务，再确认是否重新提交" : item.errorMessage || item.status === "failed" ? "离线提交失败，请检查授权后重试" : item.resource), actions));
        });
    }
    async reloadTable(resetSelection = !0) {
        resetSelection && this.resetHistorySelection(), await this.tableObj?.setPage(1);
    }
    /** @param {unknown} carNum */
    normalizeHistoryCarNum(carNum) {
        return normalizeCarNum(carNum) || String(carNum || "").trim().toUpperCase();
    }
    isHistoryAllFiltered() {
        return "all-filtered" === this.historySelectionModel.mode;
    }
    /** 清空 History 的全选、排除项和当前页选择。 */
    resetHistorySelection(deselectRows = !0) {
        this.historySelectionModel.clear();
        if (deselectRows && this.tableObj) {
            this.historySelectionSyncing = !0;
            try {
                this.tableObj.deselectRow();
            } finally {
                this.historySelectionSyncing = !1;
            }
        }
        this.updateHistorySelectionUi();
    }
    createHistorySelectAllCheckbox() {
        const checkbox = this.document.createElement("input");
        return checkbox.type = "checkbox", checkbox.className = "jhs-history-select-all", checkbox.setAttribute("aria-label", "选择当前筛选条件下的全部记录"),
        checkbox.addEventListener("change", (() => {
            checkbox.checked ? (this.historySelectionModel.selectAllFiltered(), this.syncHistoryPageSelection()) : this.resetHistorySelection();
        })), checkbox;
    }
    syncHistoryPageSelection() {
        if (!this.tableObj || !this.isHistoryAllFiltered()) return void this.updateHistorySelectionUi();
        const currentRows = /** @type {HistoryRecord[]} */ (this.tableObj.getData?.() || []), selectedIds = currentRows.filter((item => this.historySelectionModel.has(item))).map((item => item.carNum));
        this.historySelectionSyncing = !0;
        try {
            this.tableObj.deselectRow(), selectedIds.length && this.tableObj.selectRow(selectedIds);
        } finally {
            this.historySelectionSyncing = !1;
        }
        this.updateHistorySelectionUi();
    }
    /** @param {TableHandle} row @param {boolean} selected */
    updateHistoryRowSelection(row, selected) {
        if (this.historySelectionSyncing) return void this.updateHistorySelectionUi();
        const item = row?.getData?.();
        item && this.historySelectionModel.set(item, selected), this.updateHistorySelectionUi();
    }
    getHistorySelectionSummary() {
        if (this.isHistoryAllFiltered()) {
            const excluded = this.historySelectionModel.excluded.size, selected = Math.max(0, this.historyFilteredCount - excluded);
            return {
                count: selected,
                text: excluded ? `已选择当前筛选结果 ${selected} 条，已排除 ${excluded} 条` : `已选择当前筛选结果 ${selected} 条`
            };
        }
        const count = this.historySelectionModel.selected.size;
        return {
            count,
            text: `已选择当前页 ${count} 条`
        };
    }
    updateHistorySelectionUi() {
        if (!this.historyRoot) return;
        const summary = this.getHistorySelectionSummary(), batchBox = this.historyRoot.find("#allSelectBox"), filterBox = this.historyRoot.find("#filterBox");
        this.historyRoot.find("#historySelectionSummary").text(summary.text), summary.count > 0 ? (filterBox.hide(), batchBox.show()) : (filterBox.show(), batchBox.hide());
        this.historyRoot.find(".jhs-history-select-all").each(((/** @type {number} */ index, /** @type {HTMLInputElement} */ element) => {
            element.checked = this.isHistoryAllFiltered(), element.indeterminate = this.isHistoryAllFiltered() ? this.historySelectionModel.excluded.size > 0 : summary.count > 0;
        }));
    }
    /** 解析批量操作实际要处理的当前页或完整筛选结果。 */
    async getHistoryBatchSelection() {
        if (!this.isHistoryAllFiltered()) return this.historySelectionModel.values(this.tableObj?.getData?.() || []);
        const root = this.historyRoot, generation = this.historyViewGeneration;
        const rows = await this.getFilteredHistoryData(this.historySorters), available = new Set(rows.map((/** @type {HistoryRecord} */ item) => this.normalizeHistoryCarNum(item.carNum)));
        if (!this.isCurrentHistoryView(root, generation)) return [];
        for (const carNum of this.historySelectionModel.excluded) available.has(carNum) || this.historySelectionModel.excluded.delete(carNum);
        return this.historyFilteredCount = rows.length, this.historySelectionModel.values(rows);
    }
    /** @param {JQueryHandle} root */
    /** @param {any} e @param {HistoryRecord | null} [record] */
    handleRowAction(e, record = null) {
            e.preventDefault(), e.stopPropagation();
            const t = this.jquery(e.currentTarget), n = t.closest(".action-btns"), a = String(record?.carNum || n.attr("data-car-num") || ""), i = String(record?.url || n.attr("data-href") || ""), s = async (/** @type {string} */ actionType) => {
                try {
                    const flag = legacyActionToFlag(actionType);
                    if (!flag) throw new TypeError(`无效历史状态操作: ${actionType}`);
                    await this.historyRepository.toggle(a, flag, { type: "history-state", record: { carNum: a, url: i } }), await this.reloadTable();
                } catch (s) { this.logger.error("历史记录操作失败:", s), this.notifications.error("状态更新失败，请重试"); }
            };
            if (t.hasClass("history-filterBtn")) {
                const record = this.tableObj?.getRow(a)?.getData(), isBlocked = normalizeStateFlags(record?.stateFlags).blocked;
                isBlocked ? void s(d) : this.domUi.confirm(e, `屏蔽「${escapeHtml(a)}」？`, (() => s(d)), { confirmText: "屏蔽" });
            } else t.hasClass("history-favoriteBtn") ? void s(h) : t.hasClass("history-hasDownBtn") ? void s(g) : t.hasClass("history-hasWatchBtn") ? void s(p) : t.hasClass("history-deleteBtn") ? this.handleDelete(e, a) : t.hasClass("history-detailBtn") && void this.handleClickDetail(e, {
                carNum: a,
                url: i
            }).catch((error => this.logger.error("历史详情打开失败", error)));
    }
    /** @param {JQueryHandle} root */
    bindHistoryActions(root) {
        root.on("click.jhsHistory", ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasDownBtn, .history-hasWatchBtn, .history-detailBtn", this.handleRowAction.bind(this)), root.on("click.jhsHistory", ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasDownBtn, .multiple-history-hasWatchBtn", (async (/** @type {any} */ e) => {
            e.preventDefault(), e.stopPropagation();
            const t = this.jquery(e.currentTarget);
            /** @type {HistoryRecord[]} */
            let n = await this.getHistoryBatchSelection();
            let a = "", i = "";
            t.hasClass("multiple-history-filterBtn") ? (a = "屏蔽", i = d) : t.hasClass("multiple-history-favoriteBtn") ? (a = "收藏",
            i = h) : t.hasClass("multiple-history-hasDownBtn") ? (a = "已下载", i = g) : t.hasClass("multiple-history-hasWatchBtn") ? (a = "已观看",
            i = p) : t.hasClass("multiple-history-deleteBtn") && (a = "移除", i = "delete");
            if (!n.length) return void this.notifications.info("请先选择要处理的记录");
            const selectionText = this.isHistoryAllFiltered() ? this.historySelectionModel.excluded.size ? `当前筛选结果中已选择 ${n.length} 条，排除 ${this.historySelectionModel.excluded.size} 条` : `当前筛选结果中已选择全部 ${n.length} 条` : `当前页已选择 ${n.length} 条`;
            this.domUi.confirm(e, `${selectionText}<br>${"delete" === i ? "移除这些记录？" : `标记为${a}？`}`, (async () => {
                let e = this.domUi.loading();
                try {
                    if ("delete" === i) {
                        const e = n.map((/** @type {HistoryRecord} */ e) => e.carNum), t = await this.historyRepository.remove(e);
                        if (!t.changed.length) return void this.notifications.error("所选记录已不存在");
                        this.notifications.ok(`已移除 ${t.changed.length} 条记录`);
                    } else {
                        const flag = legacyActionToFlag(i);
                        if (!flag) throw new TypeError(`无效历史批量操作: ${i}`);
                        await this.historyRepository.patch(n.map((item => item.carNum)), { [flag]: !0 }, { type: "history-batch-state", records: n }), this.notifications.ok(`已标记${a}`);
                    }
                    this.resetHistorySelection(), await this.reloadTable(!1);
                } catch (t) {
                    this.logger.error(t), this.notifications.error("记录更新失败，请重试");
                } finally {
                    e.close();
                }
            }), { confirmText: "delete" === i ? "移除" : `标记${a}` });
        }));
    }
    /** 返回应用当前搜索、状态筛选和排序后的完整 History 数据。 */
    /** @param {HistoryRecord[]} [sorters] @returns {Promise<HistoryRecord[]>} */
    async getFilteredHistoryData(sorters = this.historySorters) {
        const root = this.historyRoot, generation = this.historyViewGeneration;
        if (!root || this.disposed) return [];
        /** @type {HistoryRecord[]} */
        let a = await this.historyRepository.list();
        if (!this.isCurrentHistoryView(root, generation)) return [];
        this.allCount = a.length, this.filterCount = 0, this.favoriteCount = 0, this.hasDownCount = 0,
        this.hasWatchCount = 0, this.waitCheckCount = 0, a.forEach((/** @type {HistoryRecord} */ e) => {
            const flags = normalizeStateFlags(e.stateFlags);
            flags.blocked && this.filterCount++, flags.favorite && this.favoriteCount++, flags.downloaded && this.hasDownCount++, flags.watched && this.hasWatchCount++, hasAnyState(flags) || this.waitCheckCount++;
        }), root.find('#dataType option[value="all"]').text(`所有（${this.allCount}）`), root.find('#dataType option[value="waitCheck"]').text(`待鉴定（${this.waitCheckCount}）`),
        root.find('#dataType option[value="filter"]').text(`${u}（${this.filterCount}）`),
        root.find('#dataType option[value="favorite"]').text(`${b}（${this.favoriteCount}）`), root.find('#dataType option[value="hasDown"]').text(`${y}（${this.hasDownCount}）`),
        root.find('#dataType option[value="hasWatch"]').text(`${k}（${this.hasWatchCount}）`);
        const i = String(root.find("#dataType").val() || "all");
        /** @type {Record<string, keyof import("../../core/state-model.js").StateFlags>} */
        const flagByFilter = { filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" };
        const selectedFlag = flagByFilter[i];
        let s = "all" === i ? a : "waitCheck" === i ? a.filter((e => !hasAnyState(e.stateFlags))) : selectedFlag ? a.filter((e => normalizeStateFlags(e.stateFlags)[selectedFlag])) : a;
        const o = String(root.find("#searchCarNum").val() || "").trim();
        if (o) {
            let e = o.toLowerCase().replace("-c", "").replace("-uc", "").replace("-4k", "");
            s = s.filter((/** @type {HistoryRecord} */ t) => {
                const n = t.carNum.toLowerCase().includes(e);
                const a = (t.names ? t.names : "").toLowerCase().includes(e);
                return n || a;
            });
        }
        if (sorters && sorters.length > 0) {
            const e = /** @type {HistoryRecord} */ (sorters[0]), t = e.field, a = e.dir;
            s.sort(((/** @type {HistoryRecord} */ e, /** @type {HistoryRecord} */ n) => {
                const i = e[t], s = n[t], o = null == i || "" === i, r = null == s || "" === s;
                return o && !r ? 1 : !o && r ? -1 : o && r ? 0 : i < s ? "asc" === a ? -1 : 1 : i > s ? "asc" === a ? 1 : -1 : 0;
            }));
        }
        return s;
    }
    /** @param {number} e @param {number} t @param {HistoryRecord[]} n */
    async getDataList(e, t, n) {
        const root = this.historyRoot, generation = this.historyViewGeneration;
        this.historySorters = Array.isArray(n) ? n.map((/** @type {HistoryRecord} */ sorter) => ({
            ...sorter
        })) : [];
        const rows = await this.getFilteredHistoryData(this.historySorters), r = rows.length, l = Math.ceil(r / t), c = (e - 1) * t, m = c + t;
        if (this.isCurrentHistoryView(root, generation)) this.historyFilteredCount = r;
        return {
            maxPage: l,
            dataList: rows.slice(c, m),
            totalCount: r
        };
    }
    /** @param {TableHandle} row */
    renderHistoryDetails(row) {
        const element = row.getElement(), target = element.querySelector(".tabulator-responsive-collapse");
        if (!target) return;
        const record = row.getData(), details = this.document.createElement("dl"); details.className="jhs-history-details";
        const fields = [["来源", this.getSourceLabel(record.url)], ["创建时间",formatUiDateTime(record.createDate)], ["发行时间",record.publishTime], ["备注",record.remark]];
        if (!row.getTable().getColumn("names")?.isVisible()) fields.unshift(["演员",record.names]);
        if (!row.getTable().getColumn("updateDate")?.isVisible()) fields.push(["更新时间",formatUiDateTime(record.updateDate)]);
        for (const [label,value] of fields) { if (!value) continue; const pair=this.document.createElement("div"), dt=this.document.createElement("dt"), dd=this.document.createElement("dd"); dt.textContent=label; dd.textContent=String(value); pair.append(dt,dd); details.append(pair); }
        target.replaceChildren(details);
    }
    async loadTableData() {
        const root = this.historyRoot, generation = this.historyViewGeneration;
        if (!root || this.disposed) return;
        root.find("#table-container").removeClass("jhs-record-list");
        const table = createJhsTable(/** @type {any} */ (this.window).Tabulator, root.find("#table-container").get(0), {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: !0,
            pagination: !0,
            paginationMode: "remote",
            sortMode: "remote",
            ajaxURL: "queryRealm",
            dataLoader: !1,
            ajaxRequestFunc: async (/** @type {any} */ e, /** @type {any} */ t, /** @type {HistoryRecord} */ n) => {
                if (!this.isCurrentHistoryView(root, generation)) return { maxPage: 0, dataList: [], totalCount: 0 };
                const a = n.page, i = n.size, s = n.sort;
                return await this.getDataList(a, i, s);
            },
            dataReceiveParams: {
                last_page: "maxPage",
                last_row: "totalCount",
                data: "dataList"
            },
            paginationSize: 50,
            paginationSizeSelector: [ 50, 100, 1e3 ],
            paginationCounter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n, /** @type {number} */ a, /** @type {any} */ i) => `共 ${a} 条记录`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: !0,
            responsiveLayoutCollapseStartOpen: false,
            responsiveLayoutCollapseFormatter: () => false,
            rowFormatter: (/** @type {any} */ row) => this.renderHistoryDetails(row),
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            selectableRowsPersistence: !1,
            index: "carNum",
            columns: [ {
                title:"", width:44, minWidth:44, cssClass:"jhs-history-choice-cell", responsive:0, headerSort:false,
                formatter: (/** @type {any} */ cell) => {
                    const button = this.document.createElement("button"); button.type="button"; button.className="jhs-btn jhs-btn--ghost jhs-details-toggle"; button.innerHTML=getIcon("chevron-down"); button.setAttribute("aria-label","展开影片资料"); button.setAttribute("aria-expanded","false");
                    button.addEventListener("click", () => { const row=cell.getRow(), details=row.getElement().querySelector(".tabulator-responsive-collapse"); if (!details) return; const open=details.style.display === "none"; details.style.display=open ? "" : "none"; button.setAttribute("aria-expanded",String(open)); row.normalizeHeight(); }); return button;
                }
            }, {
                formatter: "rowSelection",
                titleFormatter: () => { const label=this.document.createElement("label"); label.className="jhs-choice jhs-history-choice-label"; label.append(this.createHistorySelectAllCheckbox()); return label; },
                hozAlign: "center",
                headerSort: !1,
                responsive: 0,
                width: 44, minWidth:44, cssClass:"jhs-history-choice-cell",
                cellClick: (/** @type {any} */ e, /** @type {TableHandle} */ t) => {
                    t.getRow().toggleSelect();
                }
            }, {
                title: "番号",
                field: "carNum",
                minWidth:90, widthGrow:1,
                sorter: "string",
                responsive: 0,
                formatter: (/** @type {TableHandle} */ e) => buildCarNumCell(e.getData().carNum, this.document)
            }, {
                title: "演员",
                field: "names",
                minWidth: 100,
                sorter: "string",
                responsive: 5,
                headerSort: !0,
                formatter: (/** @type {TableHandle} */ e) => buildNamesCell(e.getData().names, this.document)
            }, {
                title: "创建时间",
                field: "createDate",
                formatter: (/** @type {TableHandle} */ cell) => formatUiDateTime(cell.getValue()),
                visible: false,
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "修改时间",
                field: "updateDate",
                formatter: (/** @type {TableHandle} */ cell) => formatUiDateTime(cell.getValue()),
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "发行时间",
                field: "publishTime",
                visible: false,
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "来源",
                field: "url",
                visible: false,
                width: 80,
                sorter: "string",
                responsive: 5,
                hozAlign: "left",
                formatter: (/** @type {TableHandle} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    let a = e.getData().url;
                    return a ? `<span class="jhs-badge jhs-badge--neutral">${this.getSourceLabel(a)}</span>` : "";
                }
            }, {
                title: "状态",
                field: "stateFlags",
                minWidth: 100,
                sorter: !1,
                responsive: 1,
                headerSort: !1,
                formatter: (/** @type {TableHandle} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    const flags = normalizeStateFlags(e.getData().stateFlags);
                    /** @type {Array<[boolean, string, string]>} */
                    const badgeItems = [ [ flags.blocked, "filter", u ], [ flags.favorite, "fav", b ], [ flags.downloaded, "down", y ], [ flags.watched, "watch", k ] ];
                    const badges = badgeItems.filter((item => item[0])).map((item => `<span class="jhs-badge jhs-badge--soft jhs-badge--${item[1]}">${item[2]}</span>`));
                    return badges.join(" ") || '<span class="jhs-badge jhs-badge--neutral">待鉴定</span>';
                }
            }, {
                title: "备注",
                field: "remark",
                visible: false,
                width: 100,
                sorter: "string",
                responsive: 6
            }, {
                title: "操作",
                sorter: "string",
                minWidth: 116,
                cssClass: "action-cell-dropdown",
                responsive: 0,
                headerSort: !1,
                formatter: (/** @type {TableHandle} */ e, /** @type {any} */ t, /** @type {(callback: () => void) => void} */ n) => {
                    const a = e.getData(), element = buildActionButtons(a, this.document);
                    n((() => {
                        const anchor = /** @type {HTMLElement} */ (element.querySelector(".sub-btns-toggle")), menu = /** @type {HTMLElement} */ (element.querySelector(".sub-btns-menu")), popover = new OwnedPopover(anchor,menu);
                        anchor.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); popover.opened ? popover.close(true) : popover.open(); });
                        menu.querySelectorAll("button:not(.history-editBtn)").forEach(button => button.addEventListener("click", event => { this.handleRowAction({currentTarget:button, preventDefault:()=>event.preventDefault(), stopPropagation:()=>event.stopPropagation()},a); popover.close(); }));
                        element.querySelector(".history-editBtn")?.addEventListener("click", ((/** @type {Event} */ ev) => {
                            popover.close(); this.editRecord(a);
                        }));
                    }));
                    return element;
                }
            } ],
            initialSort: [ {
                column: "updateDate",
                dir: "desc"
            } ]
        });
        this.tableObj = table;
        const isCurrentTable = () => this.tableObj === table && this.isCurrentHistoryView(root, generation);
        table.on("renderComplete", () => {
            if (!isCurrentTable()) return;
            table.getRows("visible").forEach((/** @type {any} */ row) => this.renderHistoryDetails(row));
            root.find("select.tabulator-page-size").addClass("jhs-select-source"); this.domUi.enhanceSelect(root);
        });
        // 数据刷新时 Tabulator 会先取消当前页选择；该阶段不应写入“全选筛选结果”的排除集。
        table.on("dataProcessing", (() => {
            if (!isCurrentTable()) return;
            this.historySelectionSyncing = !0;
        }));
        table.on("dataProcessed", (() => {
            if (!isCurrentTable()) return;
            this.historySelectionSyncing = !1;
            this.isHistoryAllFiltered() ? this.syncHistoryPageSelection() : this.updateHistorySelectionUi();
        })), table.on("rowSelected", ((/** @type {TableHandle} */ row) => {
            if (!isCurrentTable()) return;
            this.updateHistoryRowSelection(row, !0);
        })), table.on("rowDeselected", ((/** @type {TableHandle} */ row) => {
            if (!isCurrentTable()) return;
            this.updateHistoryRowSelection(row, !1);
        })), table.on("rowSelectionChanged", (() => {
            if (!isCurrentTable()) return;
            this.updateHistorySelectionUi();
        })), table.on("rowDblClick", ((/** @type {any} */ e, /** @type {TableHandle} */ t) => {
            if (!isCurrentTable()) return;
            t.toggleSelect();
        }));
    }
    /** @param {any} e @param {string} t */
    handleDelete(e, t) {
        this.domUi.confirm(e, `移除「${escapeHtml(t)}」的记录？`, (async () => {
            try {
                await this.historyRepository.remove(t), this.resolveLegacy("ListPagePlugin")?.showCarNumBox?.(t),
                await this.reloadTable();
            } catch (error) {
                this.logger.error("移除历史记录失败:", error), this.notifications.error("记录移除失败，请重试");
            }
        }), { confirmText: "移除" });
    }
    /** @param {any} e @param {HistoryRecord} t */
    async handleClickDetail(e, t) {
        if (t.carNum.includes("FC2-")) {
            const plugin = this.fc2WorkspaceAvailable && this.getFc2Workspace
                ? await this.getFc2Workspace()
                : this.resolveLegacy("Fc2Plugin");
            if (!plugin) return t.url ? void this.domUi.openPage(t.url, t.carNum, !1, e) : void this.notifications.info(`${PRODUCT_NAMES.fc2} 详情功能已关闭`);
            const source = await plugin.resolveFc2Source(t), movieId = await plugin.resolveMovieIdForRecord(t.carNum, t.url);
            if (this.site === "javdb") plugin.openFc2Dialog(movieId, t.carNum, t.url, { source });
            else if (this.site === "javbus") await plugin.openFc2Page(movieId, t.carNum, t.url, { newTab: !0 }, { source });
            return;
        }
        if (this.site === "javdb") {
            if (!t.url) return void this.window.open("/search?q=" + t.carNum, "_blank");
            this.domUi.openPage(t.url, t.carNum, !1, e);
        }
        if (this.site === "javbus") {
            // 无来源链接时不能退化为打开站点首页
            if (!t.url) return void this.notifications.info("该记录没有来源链接");
            t.url.includes("javdb") ? this.window.open(t.url, "_blank") : this.domUi.openPage(t.url, t.carNum, !1, e);
        }
    }
    /** @param {HistoryRecord} e */
    async editRecord(e) {
        const carNum = e.carNum, names = e.names || "", url = e.url || "", remark = e.remark || "", flags = normalizeStateFlags(e.stateFlags);
        let editRoot = this.jquery(this.document.createDocumentFragment());
        let saving = false, closed = false;
        const parentRoot = this.historyRoot, parentGeneration = this.historyDialogGeneration, parentViewGeneration = this.historyViewGeneration, parentTable = this.tableObj;
        const active = () => !closed && !this.disposed && editRoot[0]?.isConnected;
        const c = buildEditRecordForm(flags);
        this.dialog.open({
            type: 1,
            title: `编辑记录：${carNum}`,
            area: this.domUi.getDialogArea("sm"),
            content: c,
            btn: [ "保存", "取消" ],
            end: () => { closed = true; editRoot.find("textarea").off("input"); },
            success: (/** @type {any} */ layerEl, /** @type {number} */ _index) => {
                editRoot = this.jquery(layerEl);
                editRoot.find("#edit-carNum").val(carNum);
                editRoot.find("#edit-names").val(names);
                editRoot.find("#edit-url").val(url);
                editRoot.find("#edit-remark").val(remark);
                const resize = (/** @type {JQueryHandle} */ el) => {
                    el.css("height", "auto"), el.css("height", el[0].scrollHeight + 15 + "px");
                }, namesField = editRoot.find("#edit-names");
                namesField.on("input", ((/** @type {any} */ event) => resize(this.jquery(event.currentTarget)))), resize(namesField);
                const remarkField = editRoot.find("#edit-remark");
                remarkField.on("input", ((/** @type {any} */ event) => resize(this.jquery(event.currentTarget)))), resize(remarkField);
            },
            yes: async (/** @type {number} */ index) => {
                if (saving || !active()) return;
                const nextNames = String(editRoot.find("#edit-names").val() || "").trim(), nextUrl = String(editRoot.find("#edit-url").val() || "").trim(), nextRemark = String(editRoot.find("#edit-remark").val() || "").trim(), nextFlags = {
                    favorite: editRoot.find("#edit-favorite").prop("checked"), downloaded: editRoot.find("#edit-downloaded").prop("checked"), watched: editRoot.find("#edit-watched").prop("checked"), blocked: editRoot.find("#edit-blocked").prop("checked")
                };
                const save = async () => {
                    if (saving || !active()) return;
                    saving = true;
                    const button = editRoot.find(".layui-layer-btn0").attr("aria-disabled", "true").attr("aria-busy", "true");
                    try {
                        await this.historyRepository.patch(e.carNum, nextFlags, { type: "history-edit", replaceMetadata: !0, record: { ...e, names: nextNames, url: nextUrl, remark: nextRemark } });
                    } catch (error) {
                        this.logger.error("记录保存失败", error);
                        if (active()) this.notifications.error("记录保存失败，请重试");
                        saving = false; button.removeAttr("aria-disabled aria-busy");
                        return;
                    }
                    try {
                        if (parentRoot === this.historyRoot && parentGeneration === this.historyDialogGeneration && parentViewGeneration === this.historyViewGeneration && parentTable === this.tableObj) await parentTable?.setData();
                    } catch (error) { this.logger.error("记录已保存，列表刷新失败", error); }
                    try { if (active()) this.dialog.close(index); }
                    finally { saving = false; button.removeAttr("aria-disabled aria-busy"); }
                };
                if (!flags.blocked && nextFlags.blocked) return this.domUi.confirm(null, `屏蔽「${escapeHtml(e.carNum)}」？`, (() => void save()), { confirmText: "屏蔽" }), !1;
                await save();
            }
        });
    }
}
