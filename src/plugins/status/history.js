// @ts-check

import { b, d, g, h, k, l, m, normalizeCarNum, p, r, u, v, y } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { hasAnyState, legacyActionToFlag, normalizeStateFlags } from "../../core/state-model.js";
import { JhsSelect } from "../../core/ui-primitives.js";
import { HistorySelectionModel } from "../../features/history/history-selection-model.js";
import { HistoryRepository } from "../../features/history/history-repository.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";

/** @typedef {Record<string, any>} HistoryRecord */
/** @typedef {any} JQueryHandle */
/** @typedef {any} TableHandle */

export class HistoryPlugin extends BasePlugin {
    constructor() {
        super(...arguments);
        /** @type {TableHandle | null} */ this.tableObj = null;
        /** @type {JQueryHandle | null} */ this.historyRoot = null;
        this.historySelectionModel = new HistorySelectionModel();
        /** @type {HistoryRepository | null} */ this._historyRepository = null;
        /** @type {HistoryRecord[]} */ this.historySorters = [];
        this.historyFilteredCount = 0;
        this.historySelectionSyncing = !1;
        this.allCount = 0;
        this.filterCount = 0;
        this.favoriteCount = 0;
        this.hasDownCount = 0;
        this.hasWatchCount = 0;
        this.waitCheckCount = 0;
    }
    getName() {
        return "HistoryPlugin";
    }
    /** @param {string} value */
    getSourceLabel(value) {
        if (!value) return "";
        const movie = this.getRuntimeService("movie"), settings = this.getRuntimeService("settings").snapshot();
        if (movie.matchesProviderUrl("av123", value)) return "123AV";
        try {
            const origin = new URL(value).origin;
            if (origin === movie.externalSiteOrigin("javDbBtn", settings)) return "JavDB";
            if (origin === movie.externalSiteOrigin("javBusBtn", settings)) return "JavBus";
        } catch {}
        return value.includes("javdb") ? "JavDB" : value.includes("javbus") ? "JavBus" : value.includes("123av") ? "123AV" : "其他";
    }
    get historyRepository() {
        return this._historyRepository ||= new HistoryRepository({ storage: storageManager, state: this.getRuntimeService("state") });
    }
    async initCss() {
        return `
            <style>
                .jhs-history-layout { display:flex; flex-direction:column; height:100%; min-height:0; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
                #filterBox, #allSelectBox { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
                .jhs-history-selection-summary { color:var(--jhs-text-muted); font-size:var(--jhs-font-size-sm); }
                .jhs-history-select-all { width:18px; height:18px; accent-color:var(--jhs-accent); cursor:pointer; }
                #table-container { flex:1; min-height:0; overflow-x:hidden; }
                .sub-btns { position:relative; display:inline-block; }
                .sub-btns-menu { position:absolute; top:calc(100% + var(--jhs-space-1)); right:0; z-index:var(--jhs-z-popover); display:none; min-width:156px; padding:var(--jhs-space-1); overflow:hidden; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-md); background:var(--jhs-surface); box-shadow:var(--jhs-shadow-md); }
                .sub-btns-menu.show { display:grid !important; gap:var(--jhs-space-1); }
                .sub-btns-menu .jhs-btn { width:100%; justify-content:flex-start; }
                .table-link-param { cursor:pointer; }
                .action-btns { display:flex; justify-content:center; gap:var(--jhs-space-2); }
                .jhs-history-edit-field { width:100%; padding:8px; border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); }
                .jhs-history-edit-field[readonly] { background:var(--jhs-input-bg); }
                textarea.jhs-history-edit-field { min-height:60px; overflow-y:hidden; }
            </style>`;
    }
    handleResize() {
        $(".navbar-search").is(":hidden") ? ($(".historyBtnBox").show(), $(".miniHistoryBtnBox").hide()) : ($(".historyBtnBox").hide(),
        $(".miniHistoryBtnBox").show());
    }
    async handle() {
        r && ($(".navbar-end").prepend('<div class="navbar-item has-sub-btns is-hoverable historyBtnBox">\n                    <button type="button" id="historyBtn" class="jhs-btn navbar-link nav-btn jhs-nav-btn">鉴定记录</button>\n                </div>'),
        $(".navbar-search").css("margin-left", "0").before('\n                <div class="navbar-item miniHistoryBtnBox">\n                    <button type="button" id="miniHistoryBtn" class="jhs-btn navbar-link nav-btn jhs-nav-btn">鉴定记录</button>\n                </div>\n            '),
        this.handleResize(), $(window).resize((() => {
            this.handleResize();
        })), $("#historyBtn,#miniHistoryBtn").on("click", ((/** @type {any} */ e) => this.openHistory()))), l && await this.createBusButton();
    }
    async createBusButton() {
        const ready = await new Promise((/** @type {(value: boolean) => void} */ resolve) => {
            const startedAt = Date.now(), timer = setInterval((() => {
                if ($("#setting-btn").length && $("#top-right-box").length) return clearInterval(timer), resolve(!0);
                Date.now() - startedAt >= 2500 && (clearInterval(timer), resolve(!1));
            }), 25);
        });
        if (!ready) return void clog.warn("鉴定记录入口未创建：JavBus 顶部工具区未就绪");
        $("#top-right-box").append('<button type="button" id="historyBtn" class="jhs-btn jhs-btn--secondary">鉴定记录</button>'),
        $("#historyBtn,#miniHistoryBtn").on("click", ((/** @type {any} */ e) => this.openHistory()));
    }
    openHistory() {
        let e = `\n            <div class="jhs-layout-7cb3f981"> \n                 <div id="filterBox" class="jhs-layout-53809f1e">\n                    <select id="dataType" class="jhs-select-source">\n                        <option value="all" selected>所有</option>\n                        <option value="waitCheck">待鉴定</option>\n                        <option value="filter">${u}</option>\n                        <option value="favorite">${b}</option>\n                        <option value="hasDown">${y}</option>\n                        <option value="hasWatch">${k}</option>\n                    </select>\n                    <input id="searchCarNum" type="text" placeholder="搜索番号|演员" class="jhs-field">\n                    <button type="button" id="clearSearchbtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n                </div>\n                <div id="allSelectBox" class="jhs-layout-66253c00">\n                    <button type="button" class="jhs-btn jhs-btn--dark multiple-history-deleteBtn jhs-layout-7daea5fa"> <span>移除</span> </button>\n                    <button type="button" class="jhs-btn jhs-btn--watch multiple-history-hasWatchBtn jhs-layout-2e003268">标记观看</button>\n                    <button type="button" class="jhs-btn jhs-btn--down multiple-history-hasDownBtn jhs-layout-2e003268">标记下载</button>\n                    <button type="button" class="jhs-btn jhs-btn--fav multiple-history-favoriteBtn jhs-layout-2e003268">标记收藏</button>\n                    <button type="button" class="jhs-btn jhs-btn--filter multiple-history-filterBtn jhs-layout-2e003268">标记屏蔽</button>\n                </div>\n                <div id="table-container" class="jhs-layout-81eaab28"></div>\n            </div>\n        `;
        e = e.replace('<div id="filterBox"', '<div id="historyViewTabs" class="jhs-segmented" role="tablist"><button type="button" class="jhs-btn jhs-segmented__item active" data-history-view="state">作品状态</button><button type="button" class="jhs-btn jhs-segmented__item" data-history-view="activity">操作记录</button><button type="button" class="jhs-btn jhs-segmented__item" data-history-view="offline">离线任务</button></div><div id="filterBox"');
        this.getRuntimeService("dialog").open({
            type: 1,
            title: "鉴定记录",
            content: e,
            scrollbar: !1,
            shadeClose: !0,
            area: utils.getDialogArea("xl"),
            anim: -1,
            success: async (/** @type {any} */ e) => {
                const root = $(e);
                this.historyRoot = root, root.find("#allSelectBox").prepend('<span id="historySelectionSummary" class="jhs-history-selection-summary" role="status" aria-live="polite"></span>'),
                this.resetHistorySelection(!1), JhsSelect.enhance(root);
                await this.loadTableData(), root.on("click.jhsHistory", "#clearSearchbtn", (async (/** @type {any} */ e) => {
                    root.find("#searchCarNum").val(""), JhsSelect.setValue(root.find("#dataType"), "all"), await this.reloadTable(),
                    root.find("#allSelectBox").hide();
                })).on("focusout keydown", "#searchCarNum", (async (/** @type {any} */ e) => {
                    if ("focusout" === e.type || "Enter" === e.key) {
                        if ("Enter" === e.key && e.preventDefault(), "keydown" === e.type && "Enter" !== e.key) return;
                        await this.reloadTable();
                    }
                })).on("click", ".table-link-param", (async (/** @type {any} */ e) => {
                    let t = $(e.currentTarget);
                    root.find("#searchCarNum").val(t.text()), await this.reloadTable();
                })).on("change", "#dataType", (async () => {
                    await this.reloadTable();
                })).on("click", "[data-history-view]", (async (/** @type {any} */ event) => {
                    const view = $(event.currentTarget).data("history-view");
                    root.find("[data-history-view]").removeClass("active"), $(event.currentTarget).addClass("active"), await this.showHistoryView(view);
                })).on("click", ".jhs-undo-activity", (async (/** @type {any} */ event) => {
                    const result = await this.historyRepository.undo($(event.currentTarget).data("transaction"));
                    show.info(`撤销完成：${result.reverted.length} 项成功，${result.conflicts.length} 项冲突`), await this.renderActivityHistory();
                })).on("click", ".jhs-copy-offline", (async (/** @type {any} */ event) => {
                    await utils.copyToClipboard("离线资源", $(event.currentTarget).data("resource"));
                })).on("click", ".jhs-retry-offline", (async (/** @type {any} */ event) => {
                    const id = $(event.currentTarget).data("id"), item = (await this.historyRepository.offline()).find((/** @type {HistoryRecord} */ entry) => entry.id === id);
                    const offline = this.getOptionalDependency("UnifiedOfflinePlugin");
                    item && offline && await offline.submitResource(event, item.resource, $(event.currentTarget), { carNum: item.carNum }, item.id, { forceAvailabilityRefresh: !0, preferredProviderId: item.providerId }), await this.renderOfflineHistory();
                })).on("click", ".jhs-open-offline", (async (/** @type {any} */ event) => {
                    const id = $(event.currentTarget).data("id"), item = (await this.historyRepository.offline()).find((/** @type {HistoryRecord} */ entry) => entry.id === id), provider = this.getOptionalDependency("UnifiedOfflinePlugin")?.registry?.providers?.get(item?.providerId), url = provider?.openUrl?.();
                    url && window.open(url, "_blank", "noopener,noreferrer");
                })).on("click", ".jhs-delete-offline", (async (/** @type {any} */ event) => {
                    await this.historyRepository.removeOffline($(event.currentTarget).data("id")), await this.renderOfflineHistory();
                })), this.bindHistoryActions(root);
            },
            end: () => {
                this.resetHistorySelection(), this.historyRoot?.off(".jhsHistory"), this.historyRoot = null, this.tableObj && (this.tableObj.destroy(), this.tableObj = null);
            }
        });
    }
    /** @param {string} view */
    async showHistoryView(view) {
        const stateView = "state" === view;
        this.resetHistorySelection(), this.historyRoot?.find("#filterBox,#allSelectBox").toggle(stateView), this.tableObj?.destroy(), this.tableObj = null;
        return stateView ? this.loadTableData() : "activity" === view ? this.renderActivityHistory() : this.renderOfflineHistory();
    }
    async renderActivityHistory() {
        const log = await this.historyRepository.activity(), host = this.historyRoot.find("#table-container").empty();
        if (!log.entries.length) return void host.html('<div class="jhs-state jhs-state--empty">暂无操作记录</div>');
        log.entries.slice().reverse().forEach((/** @type {HistoryRecord} */ entry) => {
            const reverted = entry.changes.filter((/** @type {HistoryRecord} */ change) => "reverted" === change.undoState).length, conflicts = entry.changes.filter((/** @type {HistoryRecord} */ change) => "conflict" === change.undoState).length;
            host.append($("<article class=\"jhs-card\"></article>").append($("<strong></strong>").text(`${entry.type} · ${entry.changes.length} 项`), $("<p></p>").text(`${new Date(entry.createdAt).toLocaleString()} · 已撤销 ${reverted} · 冲突 ${conflicts}`), $("<p></p>").text(entry.changes.map((/** @type {HistoryRecord} */ change) => change.carNum).join("、")), $("<button type=\"button\" class=\"jhs-btn jhs-btn--secondary jhs-undo-activity\">撤销可恢复项</button>").attr("data-transaction", entry.id).prop("disabled", "committed" !== entry.commitState || reverted === entry.changes.length)));
        });
    }
    async renderOfflineHistory() {
        const history = await this.historyRepository.offline(), host = this.historyRoot.find("#table-container").empty();
        if (!history.length) return void host.html('<div class="jhs-state jhs-state--empty">暂无离线任务</div>');
        history.slice().reverse().forEach((/** @type {HistoryRecord} */ item) => {
            const offline = this.getOptionalDependency("UnifiedOfflinePlugin"), provider = offline?.registry?.providers?.get?.(item.providerId);
            const actions = $("<div class=\"jhs-toolbar\"></div>").append($("<button type=\"button\" class=\"jhs-btn jhs-copy-offline\">复制资源</button>").attr("data-resource", item.resource));
            if (offline && provider) actions.append($("<button type=\"button\" class=\"jhs-btn jhs-retry-offline\">重试</button>").attr("data-id", item.id));
            if (provider && typeof provider.openUrl === "function") actions.append($("<button type=\"button\" class=\"jhs-btn jhs-open-offline\">打开服务</button>").attr("data-id", item.id));
            actions.append($("<button type=\"button\" class=\"jhs-btn jhs-btn--danger jhs-delete-offline\">移除记录</button>").attr("data-id", item.id));
            host.append($("<article class=\"jhs-card\"></article>").append($("<strong></strong>").text(`${item.providerName || item.providerId} · ${item.status}`), $("<p></p>").text(`${item.carNum || "未关联番号"} · ${new Date(item.createdAt).toLocaleString()}${item.retryOf ? ` · 重试自 ${item.retryOf}` : ""}`), $("<p></p>").text(item.errorMessage || item.resource), actions));
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
        const checkbox = document.createElement("input");
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
        const rows = await this.getFilteredHistoryData(this.historySorters), available = new Set(rows.map((/** @type {HistoryRecord} */ item) => this.normalizeHistoryCarNum(item.carNum)));
        for (const carNum of this.historySelectionModel.excluded) available.has(carNum) || this.historySelectionModel.excluded.delete(carNum);
        return this.historyFilteredCount = rows.length, this.historySelectionModel.values(rows);
    }
    /** @param {JQueryHandle} root */
    bindHistoryActions(root) {
        root.on("click.jhsHistory", (function(/** @type {any} */ e) {
            if (e.target.closest(".sub-btns-toggle")) {
                const button = e.target.closest(".sub-btns-toggle"), t = button.closest(".sub-btns").querySelector(".sub-btns-menu");
                root.find(".sub-btns-menu.show").each(((/** @type {number} */ index, /** @type {HTMLElement} */ e) => {
                    e !== t && (e.classList.remove("show"), e.previousElementSibling?.setAttribute("aria-expanded", "false"));
                })), t.classList.toggle("show"), button.setAttribute("aria-expanded", String(t.classList.contains("show")));
            } else root.find(".sub-btns-menu.show").each(((/** @type {number} */ index, /** @type {HTMLElement} */ e) => {
                e.classList.remove("show"), e.previousElementSibling?.setAttribute("aria-expanded", "false");
            }));
        })), root.on("keydown.jhsHistory", ".sub-btns", ((/** @type {any} */ e) => {
            const menu = $(e.currentTarget).find(".sub-btns-menu"), items = menu.find('[role="menuitem"]'), current = items.index(document.activeElement);
            if ("Escape" === e.key) return e.preventDefault(), menu.removeClass("show"), $(e.currentTarget).find(".sub-btns-toggle").attr("aria-expanded", "false").trigger("focus");
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(e.key) || !menu.hasClass("show")) return;
            e.preventDefault();
            const next = "Home" === e.key ? 0 : "End" === e.key ? items.length - 1 : "ArrowDown" === e.key ? (current + 1 + items.length) % items.length : (current - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        })), root.on("click.jhsHistory", ".history-deleteBtn, .history-filterBtn, .history-favoriteBtn, .history-hasDownBtn, .history-hasWatchBtn, .history-detailBtn", ((/** @type {any} */ e) => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget), n = t.closest(".action-btns"), a = /** @type {string} */ (n.attr("data-car-num")), i = /** @type {string} */ (n.attr("data-href")), s = async (/** @type {string} */ actionType) => {
                try {
                    const flag = legacyActionToFlag(actionType);
                    if (!flag) throw new TypeError(`无效历史状态操作: ${actionType}`);
                    await this.historyRepository.toggle(a, flag, { type: "history-state", record: { carNum: a, url: i } }), await this.reloadTable();
                } catch (s) { clog.error("历史记录操作失败:", s), show.error("操作失败"); }
            };
            if (t.hasClass("history-filterBtn")) {
                const record = this.tableObj?.getRow(a)?.getData(), isBlocked = normalizeStateFlags(record?.stateFlags).blocked;
                isBlocked ? void s(d) : utils.q(e, `是否屏蔽${a}?`, (() => s(d)));
            } else t.hasClass("history-favoriteBtn") ? void s(h) : t.hasClass("history-hasDownBtn") ? void s(g) : t.hasClass("history-hasWatchBtn") ? void s(p) : t.hasClass("history-deleteBtn") ? this.handleDelete(e, a) : t.hasClass("history-detailBtn") && void this.handleClickDetail(e, {
                carNum: a,
                url: i
            }).catch((error => clog.error("历史详情打开失败", error)));
        })), root.on("click.jhsHistory", ".multiple-history-deleteBtn, .multiple-history-filterBtn, .multiple-history-favoriteBtn, .multiple-history-hasDownBtn, .multiple-history-hasWatchBtn", (async (/** @type {any} */ e) => {
            e.preventDefault(), e.stopPropagation();
            const t = $(e.currentTarget);
            /** @type {HistoryRecord[]} */
            let n = await this.getHistoryBatchSelection();
            let a = "", i = "";
            t.hasClass("multiple-history-filterBtn") ? (a = "屏蔽", i = d) : t.hasClass("multiple-history-favoriteBtn") ? (a = "收藏",
            i = h) : t.hasClass("multiple-history-hasDownBtn") ? (a = "已下载", i = g) : t.hasClass("multiple-history-hasWatchBtn") ? (a = "已观看",
            i = p) : t.hasClass("multiple-history-deleteBtn") && (a = "移除", i = "delete");
            if (!n.length) return void show.info("请先选择要处理的记录");
            const selectionText = this.isHistoryAllFiltered() ? this.historySelectionModel.excluded.size ? `当前筛选结果中已选择 ${n.length} 条，排除 ${this.historySelectionModel.excluded.size} 条` : `当前筛选结果中已选择全部 ${n.length} 条` : `当前页已选择 ${n.length} 条`;
            utils.q(e, `${selectionText}，是否标记为${a}？`, (async () => {
                let e = loading();
                try {
                    if ("delete" === i) {
                        const e = n.map((/** @type {HistoryRecord} */ e) => e.carNum), t = await this.historyRepository.remove(e);
                        if (!t.changed.length) return void show.error("提供的番号中没有一个存在于列表中。");
                        show.ok(`已成功删除 ${t.changed.length} 个番号`);
                    } else {
                        const flag = legacyActionToFlag(i);
                        if (!flag) throw new TypeError(`无效历史批量操作: ${i}`);
                        await this.historyRepository.patch(n.map((item => item.carNum)), { [flag]: !0 }, { type: "history-batch-state", records: n }), show.ok("操作成功");
                    }
                    this.resetHistorySelection(), await this.reloadTable(!1);
                } catch (t) {
                    clog.error(t), show.error("操作失败，请稍后重试");
                } finally {
                    e.close();
                }
            }));
        }));
    }
    /** 返回应用当前搜索、状态筛选和排序后的完整 History 数据。 */
    /** @param {HistoryRecord[]} [sorters] @returns {Promise<HistoryRecord[]>} */
    async getFilteredHistoryData(sorters = this.historySorters) {
        /** @type {HistoryRecord[]} */
        let a = await this.historyRepository.list();
        this.allCount = a.length, this.filterCount = 0, this.favoriteCount = 0, this.hasDownCount = 0,
        this.hasWatchCount = 0, this.waitCheckCount = 0, a.forEach((/** @type {HistoryRecord} */ e) => {
            const flags = normalizeStateFlags(e.stateFlags);
            flags.blocked && this.filterCount++, flags.favorite && this.favoriteCount++, flags.downloaded && this.hasDownCount++, flags.watched && this.hasWatchCount++, hasAnyState(flags) || this.waitCheckCount++;
        }), this.historyRoot.find('#dataType option[value="all"]').text(`所有 (${this.allCount})`), this.historyRoot.find('#dataType option[value="waitCheck"]').text(`待鉴定 (${this.waitCheckCount})`),
        this.historyRoot.find('#dataType option[value="filter"]').text(`${u} (${this.filterCount})`),
        this.historyRoot.find('#dataType option[value="favorite"]').text(`${b} (${this.favoriteCount})`), this.historyRoot.find('#dataType option[value="hasDown"]').text(`${y} (${this.hasDownCount})`),
        this.historyRoot.find('#dataType option[value="hasWatch"]').text(`${k} (${this.hasWatchCount})`);
        const i = String(this.historyRoot.find("#dataType").val() || "all");
        /** @type {Record<string, keyof import("../../core/state-model.js").StateFlags>} */
        const flagByFilter = { filter: "blocked", favorite: "favorite", hasDown: "downloaded", hasWatch: "watched" };
        const selectedFlag = flagByFilter[i];
        let s = "all" === i ? a : "waitCheck" === i ? a.filter((e => !hasAnyState(e.stateFlags))) : selectedFlag ? a.filter((e => normalizeStateFlags(e.stateFlags)[selectedFlag])) : a;
        const o = String(this.historyRoot.find("#searchCarNum").val() || "").trim();
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
        this.historySorters = Array.isArray(n) ? n.map((/** @type {HistoryRecord} */ sorter) => ({
            ...sorter
        })) : [];
        const rows = await this.getFilteredHistoryData(this.historySorters), r = rows.length, l = Math.ceil(r / t), c = (e - 1) * t, m = c + t;
        return this.historyFilteredCount = r, {
            maxPage: l,
            dataList: rows.slice(c, m),
            totalCount: r
        };
    }
    async loadTableData() {
        this.tableObj = createJhsTable((/** @type {any} */ (globalThis)).Tabulator, this.historyRoot.find("#table-container").get(0), {
            layout: "fitColumns",
            placeholder: "暂无数据",
            virtualDom: !0,
            pagination: !0,
            paginationMode: "remote",
            sortMode: "remote",
            ajaxURL: "queryRealm",
            dataLoader: !1,
            ajaxRequestFunc: async (/** @type {any} */ e, /** @type {any} */ t, /** @type {HistoryRecord} */ n) => {
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
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            selectableRowsPersistence: !1,
            index: "carNum",
            columns: [ {
                formatter: "rowSelection",
                titleFormatter: () => this.createHistorySelectAllCheckbox(),
                hozAlign: "center",
                headerSort: !1,
                responsive: 0,
                width: 40,
                cellClick: (/** @type {any} */ e, /** @type {TableHandle} */ t) => {
                    t.getRow().toggleSelect();
                }
            }, {
                title: "番号",
                field: "carNum",
                width: 120,
                sorter: "string",
                responsive: 0,
                formatter: (/** @type {TableHandle} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    const a = e.getData().carNum, i = a.indexOf("-");
                    if (-1 === i) return a;
                    return `<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param">${a.substring(0, i + 1)}</button>${a.substring(i + 1)}`;
                }
            }, {
                title: "演员",
                field: "names",
                minWidth: 200,
                sorter: "string",
                responsive: 5,
                headerSort: !0,
                formatter: (/** @type {TableHandle} */ e, /** @type {any} */ t, /** @type {any} */ n) => (e.getData().names || "").split(" ").filter((/** @type {string} */ e) => "" !== e.trim()).map((/** @type {string} */ e) => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-btn--sm table-link-param">${e}</button>`).join(" ")
            }, {
                title: "创建时间",
                field: "createDate",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "修改时间",
                field: "updateDate",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "发行时间",
                field: "publishTime",
                width: 170,
                sorter: "string",
                responsive: 4
            }, {
                title: "来源",
                field: "url",
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
                width: 220,
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
                width: 100,
                sorter: "string",
                responsive: 6
            }, {
                title: "操作",
                sorter: "string",
                minWidth: 150,
                cssClass: "action-cell-dropdown",
                responsive: 0,
                headerSort: !1,
                formatter: (/** @type {TableHandle} */ e, /** @type {any} */ t, /** @type {(callback: () => void) => void} */ n) => {
                    const a = e.getData();
                    return n((() => {
                        var t;
                        null == (t = e.getElement().querySelector(".history-editBtn")) || t.addEventListener("click", ((/** @type {Event} */ e) => {
                            this.editRecord(a);
                        }));
                    })), `
                        <div class="action-btns" data-car-num="${a.carNum}" data-href="${a.url ? a.url : ""}">
                            <button type="button" class="jhs-btn jhs-btn--secondary history-detailBtn"><span>查看</span></button>
                            <div class="sub-btns">
                                <button type="button" class="jhs-btn jhs-btn--ghost sub-btns-toggle" aria-haspopup="menu" aria-expanded="false"><span>更多操作</span></button>
                                <div class="sub-btns-menu" role="menu">
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-editBtn" role="menuitem"><span>编辑</span></button>
                                    <button type="button" class="jhs-btn jhs-btn--danger history-deleteBtn" role="menuitem"><span>移除</span></button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-hasWatchBtn" role="menuitem">${k}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-hasDownBtn" role="menuitem">${y}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-favoriteBtn" role="menuitem">${v}</button>
                                    <button type="button" class="jhs-btn jhs-btn--ghost history-filterBtn" role="menuitem">${m}</button>
                                </div>
                            </div>
                        </div>`;
                }
            } ],
            initialSort: [ {
                column: "updateDate",
                dir: "desc"
            } ]
        }), this.tableObj.on("dataProcessed", (() => {
            this.isHistoryAllFiltered() ? this.syncHistoryPageSelection() : this.updateHistorySelectionUi();
        })), this.tableObj.on("rowSelected", ((/** @type {TableHandle} */ row) => {
            this.updateHistoryRowSelection(row, !0);
        })), this.tableObj.on("rowDeselected", ((/** @type {TableHandle} */ row) => {
            this.updateHistoryRowSelection(row, !1);
        })), this.tableObj.on("rowSelectionChanged", (() => {
            this.updateHistorySelectionUi();
        })), this.tableObj.on("rowDblClick", (function(/** @type {any} */ e, /** @type {TableHandle} */ t) {
            t.toggleSelect();
        }));
    }
    /** @param {any} e @param {string} t */
    handleDelete(e, t) {
        utils.q(e, `是否移除${t}?`, (async () => {
            await this.historyRepository.remove(t), this.getOptionalDependency("ListPagePlugin")?.showCarNumBox?.(t),
            await this.reloadTable();
        }));
    }
    /** @param {any} e @param {HistoryRecord} t */
    async handleClickDetail(e, t) {
        if (t.carNum.includes("FC2-")) {
            const plugin = this.getOptionalDependency("Fc2Plugin");
            if (!plugin) return t.url ? void utils.openPage(t.url, t.carNum, !1, e) : void show.info("FC2 详情功能已禁用");
            const source = await plugin.resolveFc2Source(t), movieId = await plugin.resolveMovieIdForRecord(t.carNum, t.url);
            if (r) plugin.openFc2Dialog(movieId, t.carNum, t.url, { source });
            else if (l) await plugin.openFc2Page(movieId, t.carNum, t.url, { newTab: !0 }, { source });
            return;
        }
        if (r) {
            if (!t.url) return void window.open("/search?q=" + t.carNum, "_blank");
            utils.openPage(t.url, t.carNum, !1, e);
        }
        if (l) {
            const url = t.url || "";
            url.includes("javdb") ? window.open(url, "_blank") : utils.openPage(url, t.carNum, !1, e);
        }
    }
    /** @param {HistoryRecord} e */
    async editRecord(e) {
        const t = e.carNum, n = e.names || "", a = e.url || "", flags = normalizeStateFlags(e.stateFlags), s = e.remark || "";
        let editRoot = $();
        const c = `\n            <div class="jhs-layout-8cddc29a">\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">番号:</label>\n                    <input type="text" id="edit-carNum" value="${t}" class="jhs-field jhs-history-edit-field" readonly>\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">演员 (用空格隔开):</label>\n                    <textarea id="edit-names" class="jhs-textarea jhs-history-edit-field">${n}</textarea>\n                </div>\n                <fieldset class="jhs-layout-da303dcf"><legend class="jhs-layout-27f87d75">状态:</legend>\n                    <label class="jhs-option-row">收藏 <input type="checkbox" id="edit-favorite" class="mini-switch" ${flags.favorite ? "checked" : ""}></label>\n                    <label class="jhs-option-row">已下载 <input type="checkbox" id="edit-downloaded" class="mini-switch" ${flags.downloaded ? "checked" : ""}></label>\n                    <label class="jhs-option-row">已观看 <input type="checkbox" id="edit-watched" class="mini-switch" ${flags.watched ? "checked" : ""}></label>\n                    <label class="jhs-option-row">屏蔽 <input type="checkbox" id="edit-blocked" class="mini-switch" ${flags.blocked ? "checked" : ""}></label>\n                </fieldset>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">链接:</label>\n                    <input type="text" id="edit-url" value="${a}" class="jhs-field jhs-history-edit-field">\n                </div>\n                <div class="jhs-layout-da303dcf">\n                    <label class="jhs-layout-27f87d75">备注:</label>\n                    <textarea id="edit-remark" class="jhs-textarea jhs-history-edit-field">${s}</textarea>\n                </div>\n            </div>\n        `;
        const dialog = this.getRuntimeService("dialog");
        dialog.open({
            type: 1,
            title: `编辑记录: ${t}`,
            area: utils.getDialogArea("sm"),
            content: c,
            btn: [ "保存", "取消" ],
            success: (/** @type {any} */ e, /** @type {number} */ t) => {
                editRoot = $(e);
                const n = (/** @type {JQueryHandle} */ e) => {
                    e.css("height", "auto"), e.css("height", e[0].scrollHeight + 15 + "px");
                }, a = editRoot.find("#edit-names");
                a.on("input", ((/** @type {any} */ event) => n($(event.currentTarget)))), n(a);
                const i = editRoot.find("#edit-remark");
                i.on("input", ((/** @type {any} */ event) => n($(event.currentTarget)))), n(i);
            },
            yes: async (/** @type {number} */ t) => {
                const n = String(editRoot.find("#edit-names").val() || "").trim(), i = String(editRoot.find("#edit-url").val() || "").trim(), s = String(editRoot.find("#edit-remark").val() || "").trim(), nextFlags = {
                    favorite: editRoot.find("#edit-favorite").prop("checked"), downloaded: editRoot.find("#edit-downloaded").prop("checked"), watched: editRoot.find("#edit-watched").prop("checked"), blocked: editRoot.find("#edit-blocked").prop("checked")
                };
                const save = async () => {
                    await this.historyRepository.patch(e.carNum, nextFlags, { type: "history-edit", replaceMetadata: !0, record: { ...e, names: n, url: i, remark: s } }), this.tableObj.setData(), dialog.close(t);
                };
                if (!flags.blocked && nextFlags.blocked) return utils.q(null, `是否屏蔽${e.carNum}?`, (() => void save())), !1;
                await save();
            }
        });
    }
}
