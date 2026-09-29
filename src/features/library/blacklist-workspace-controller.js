// @ts-check

import { A, B, D, P, escapeHtml } from "../../core/constants.js";
import { normalizeHttpUrl, parseNumberSetting, shouldSkipStopped } from "../../core/feature-helpers.js";
import { FEATURE_ICONS } from "../../core/feature-icons.js";
import { renderStateView } from "../../core/ui-primitives.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";

/** @typedef {{starId: string, name?: string, allName?: string | string[], role: string, url?: string, movieType?: string, createTime?: string, lastPublishTime?: string | number, isUnCheck?: boolean, count?: number}} BlacklistRecord */
/** @typedef {{getData: () => BlacklistRecord, getElement: () => HTMLElement}} TableCell */

/** Owns the blacklist table and its dialog lifetime inside the Library Feature. */
export class BlacklistWorkspaceController {
    /** @param {{document: Document, window: Window, jquery: (value: any) => any, site: string, state: any, settings: any, storage: any, events: any, dialog: any, ui: any, notifications: any, logger: any, scope: any, task: any, openSettings: () => unknown}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.$ = options.jquery;
        this.site = options.site;
        this.state = options.state;
        this.settings = options.settings;
        this.storage = options.storage;
        this.events = options.events;
        this.dialog = options.dialog;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.logger = options.logger;
        this.scope = options.scope;
        this.task = options.task;
        this.openSettings = options.openSettings;
        this.blacklistRoot = null;
        this.tableObj = null;
        this.dialogId = null;
        this.dialogGeneration = 0;
        this.blacklistSearchDebounced = null;
        this.taskStatusUnsubscribe = null;
        this.checkBlacklistRuleTime = 8760;
        this.currentCarCount = 0;
        /** @type {AbortController | null} */ this.manualScanAbortController = null;
        this.disposed = false;
    }

    /** @param {string} name @param {unknown} fallback */
    getSetting(name, fallback) {
        const snapshot = this.settings.snapshot();
        return Object.prototype.hasOwnProperty.call(snapshot, name) ? snapshot[name] : fallback;
    }

    async resetBtnTip() {
        const completedKey = this.task?.lastCheckBlacklistTimeKey;
        const lastCheck = completedKey ? this.storage.getLocal(completedKey) || "无" : "任务已禁用";
        const interval = this.getSetting("checkBlacklist_intervalTime", 12);
        this.checkBlacklistRuleTime = parseNumberSetting(this.getSetting("checkBlacklist_ruleTime", 8760), 8760, { min: 0 });
        this.blacklistRoot?.find("#checkBlacklistBtn").attr("data-tip", `上次整批检测: ${lastCheck}; 检测间隔时间: ${interval}小时`);
    }

    openBlacklistDialog() {
        if (this.disposed || this.scope?.disposed) return null;
        if (this.dialogId != null) return this.dialogId;
        const settings = this.settings.snapshot();
        const lastCheck = this.task?.lastCheckBlacklistTimeKey
            ? this.storage.getLocal(this.task.lastCheckBlacklistTimeKey) || "无"
            : "任务已禁用";
        const interval = escapeHtml(String(settings.checkBlacklist_intervalTime ?? 12));
        const safeLastCheck = escapeHtml(String(lastCheck));
        const content = `
            <div class="jhs-layout-7cb3f981">
                <div class="jhs-layout-da5a4919">
                    <div class="jhs-layout-31a824a2">
                        <button type="button" id="checkBlacklistBtn" class="jhs-btn jhs-btn--secondary" data-tip="上次整批检测: ${safeLastCheck}; 检测间隔时间: ${interval}小时">${FEATURE_ICONS.blacklistSvg}<span>手动检测黑名单</span></button>
                        <button type="button" class="jhs-btn jhs-btn--ghost" id="toSetting">${FEATURE_ICONS.settingSvg}<span>配置</span></button>
                    </div>
                    <div class="jhs-layout-31a824a2">
                        <select id="dataType" class="jhs-select-source"><option value="" selected>所有</option><option value="actor">男演员</option><option value="actress">女演员</option></select>
                        <select id="statusType" class="jhs-select-source"><option value="" selected>全部状态</option><option value="normal">继续检测</option><option value="stop">停更跳过</option></select>
                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" class="jhs-select-source${this.site === "javdb" ? "" : " jhs-is-hidden"}"><option value="" selected>--屏蔽类型--</option><option value="hasT">按所选分类屏蔽</option><option value="noT">未筛选分类</option></select>
                        <input id="searchValue" type="search" placeholder="搜索名称、别名或 ID" class="jhs-field">
                        <button type="button" id="cleanQueryBtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>
                    </div>
                </div>
                <div id="table-container" class="jhs-layout-d44e70c7"></div>
            </div>`;
        const generation = ++this.dialogGeneration;
        const id = this.dialog.open({
            type: 1, title: "演员黑名单", ui: { body: "table" }, content, scrollbar: false,
            area: this.ui.getDialogArea("xl"), anim: -1,
            success: (/** @type {any} */ layer) => { void this.mountDialog(layer, generation); },
            end: () => { void this.finishDialog(generation, true); },
        });
        this.dialogId = id;
        return id;
    }

    /** @param {any} layer @param {number} generation */
    async mountDialog(layer, generation) {
        if (!this.isGenerationCurrent(generation)) return;
        const $ = this.$, dialogRoot = $(layer).find(".layui-layer-content > div").first().addClass("jhs-blacklist-layout").removeAttr("style");
        this.blacklistRoot = dialogRoot;
        const toolbar = dialogRoot.children("div").first().addClass("jhs-blacklist-toolbar").removeAttr("style");
        toolbar.children("div").addClass("jhs-blacklist-toolbar__group").removeAttr("style");
        toolbar.find("select,input,a").removeAttr("style");
        dialogRoot.find("#table-container").removeAttr("style");
        dialogRoot.find("#table-container").before('<div id="blacklist-task-status" class="jhs-task-status jhs-blacklist-task-status" aria-live="polite"></div>');
        this.ui.enhanceSelect(layer);
        if (!this.task) dialogRoot.find("#checkBlacklistBtn").prop("disabled", true).attr("title", "后台任务功能已禁用");
        this.renderTaskStatus();
        this.taskStatusUnsubscribe = this.events?.on?.("task-status-changed", () => this.renderTaskStatus()) ?? null;
        await this.loadTableData(generation);
        if (!this.isCurrent(generation)) return;
        const content = $(layer).find(".layui-layer-content"), search = content.find("#searchValue");
        const debounce = /** @type {any} */ (globalThis).utils?.debounce;
        this.blacklistSearchDebounced = typeof debounce === "function" ? debounce(() => void this.reloadTable(generation), 200) : () => void this.reloadTable(generation);
        content.on("click.jhsBlacklist", "#cleanQueryBtn", async () => {
            if (!this.isCurrent(generation)) return;
            search.val("");
            for (const selector of ["#dataType", "#statusType", "#urlType"]) this.ui.setSelectValue(this.blacklistRoot.find(selector), "", false);
            await this.reloadTable(generation);
        }).on("input.jhsBlacklist", "#searchValue", this.blacklistSearchDebounced)
            .on("change.jhsBlacklist", "#dataType,#statusType,#urlType", () => void this.reloadTable(generation))
            .on("click.jhsBlacklist", "#toSetting", () => {
                Promise.resolve(this.openSettings()).then(() => {
                    if (this.isCurrent(generation)) this.$("#setting-blacklist").css({ border: "1px solid var(--jhs-status-filter)" });
                }).catch((error) => this.logger?.warn?.("黑名单设置入口打开失败", error));
            }).on("click.jhsBlacklist", ".open-url", (/** @type {any} */ event) => {
                event.preventDefault();
                const target = this.$(event.currentTarget);
                this.ui.openPage(target.attr("data-url"), target.attr("data-name"), true, event);
            }).on("click.jhsBlacklist", "#checkBlacklistBtn", (/** @type {any} */ event) => void this.runManualScan(event, generation));
    }

    /** @param {any} event @param {number} generation */
    async runManualScan(event, generation) {
        const button = this.$(event.currentTarget), label = button.find("span").last(), previous = label.text();
        if (!this.task || button.attr("aria-busy") === "true" || !this.isCurrent(generation)) return;
        const locks = this.window.navigator?.locks;
        if (!locks?.request) {
            this.notifications.error("当前浏览器不支持后台任务互斥");
            return;
        }
        button.attr("aria-busy", "true").prop("disabled", true);
        label.text("检测中…");
        const readyAbort = new AbortController();
        this.manualScanAbortController = readyAbort;
        try {
            await this.task.waitForService?.(10_000, readyAbort.signal);
            if (!this.isCurrent(generation)) return;
            await locks.request(this.task.singleTaskKey, { ifAvailable: true }, async (lock) => {
                if (!this.isCurrent(generation)) return;
                if (lock) await this.task.checkBlacklist(true);
                else this.notifications.error("后台任务正在运行，请稍后再试");
            });
        } catch (error) {
            if (this.isCurrent(generation)) {
                this.logger?.error?.("黑名单任务执行失败", error);
                this.notifications.error(error instanceof Error ? error.message : "黑名单任务执行失败");
            }
        } finally {
            if (this.manualScanAbortController === readyAbort) this.manualScanAbortController = null;
            if (this.isCurrent(generation)) {
                button.removeAttr("aria-busy").prop("disabled", false);
                label.text(previous);
            }
        }
    }

    renderTaskStatus() {
        const container = this.blacklistRoot?.find("#blacklist-task-status");
        if (!container?.length) return;
        if (!this.task) return void container.empty().text("后台任务功能已禁用");
        const snapshot = /** @type {{state: string, completedAt?: string | number, nextAt?: string | number}} */ (this.task.getTaskStatusSnapshot("blacklist"));
        const labels = { idle: "正常", running: "运行中", pending: "等待下一次任务检查", due: "待运行" };
        /** @param {unknown} value */
        const format = (value) => value ? new Date(/** @type {string | number | Date} */ (value)).toLocaleString() : "无";
        const state = labels[/** @type {keyof typeof labels} */ (snapshot.state)] || labels.idle;
        container.empty().append(
            this.$("<span class=\"jhs-task-status__name\"></span>").text(`黑名单：${state}`),
            this.$("<span class=\"jhs-task-status__meta\"></span>").text(`上次完成 ${format(snapshot.completedAt)}；下次检查 ${snapshot.nextAt ? format(snapshot.nextAt) : "立即"}`),
        );
    }

    async reloadTable(generation = this.dialogGeneration) {
        const table = this.tableObj;
        if (!table || !this.isCurrent(generation)) return;
        const rows = await this.getTableData();
        if (this.isCurrent(generation) && this.tableObj === table) table.setData(rows);
    }

    async getTableData() {
        const root = this.blacklistRoot || this.$(this.document.body);
        const actors = /** @type {BlacklistRecord[]} */ (await this.state.getBlacklist());
        const cars = /** @type {Array<{starId: string}>} */ (await this.state.getBlacklistCarList());
        const search = String(root.find("#searchValue").val() || "").trim().toLocaleLowerCase();
        const status = root.find("#statusType").val(), role = root.find("#dataType"), roleValue = role.val(), category = root.find("#urlType").val();
        let actorCount = 0, actressCount = 0;
        const rows = actors.map((/** @type {BlacklistRecord} */ item) => {
            if (item.role === B) actorCount++;
            if (item.role === P) actressCount++;
            return { ...item, isUnCheck: shouldSkipStopped(item.lastPublishTime, this.checkBlacklistRuleTime) };
        }).filter((/** @type {BlacklistRecord} */ item) => {
            const aliases = Array.isArray(item.allName) ? item.allName.join(" ") : item.allName || "";
            const queryMatch = !search || `${item.name || ""} ${aliases} ${item.starId || ""}`.toLocaleLowerCase().includes(search);
            const statusMatch = !status || status === "normal" && !item.isUnCheck || status === "stop" && item.isUnCheck;
            const roleMatch = !roleValue || item.role === roleValue;
            const hasCategory = String(item.url || "").includes("t=");
            const categoryMatch = !category || category === "hasT" && hasCategory || category === "noT" && !hasCategory;
            return queryMatch && statusMatch && roleMatch && categoryMatch;
        });
        const options = [["", `所有 (${actors.length})`], [B, `男演员 (${actorCount})`], [P, `女演员 (${actressCount})`]];
        role.empty();
        for (const [value, label] of options) {
            const option = this.document.createElement("option");
            option.value = value;
            option.textContent = label;
            role.append(option);
        }
        this.ui.setSelectValue(role, roleValue, false);
        const carsByActor = new Map();
        for (const car of cars) {
            const list = carsByActor.get(car.starId) ?? [];
            list.push(car);
            carsByActor.set(car.starId, list);
        }
        const result = rows.map((/** @type {BlacklistRecord} */ item) => ({ ...item, carList: carsByActor.get(item.starId) ?? [], count: (carsByActor.get(item.starId) ?? []).length }));
        this.currentCarCount = result.reduce((/** @type {number} */ total, /** @type {BlacklistRecord} */ item) => total + (item.count || 0), 0);
        return result;
    }

    async loadTableData(generation = this.dialogGeneration) {
        this.checkBlacklistRuleTime = parseNumberSetting(this.getSetting("checkBlacklist_ruleTime", 8760), 8760, { min: 0 });
        const data = await this.getTableData();
        if (!this.isCurrent(generation)) return;
        const placeholder = this.document.createElement("div");
        renderStateView(placeholder, { type: "empty", title: "没有符合当前筛选条件的黑名单记录" });
        const tableRoot = this.blacklistRoot?.find("#table-container").get(0);
        if (!tableRoot) return;
        this.tableObj = createJhsTable(/** @type {any} */ (this.window).Tabulator, tableRoot, {
            layout: "fitColumns", placeholder, virtualDom: true, data,
            pagination: true, paginationMode: "local", paginationSize: 20, paginationSizeSelector: [20, 50, 100, 1000],
            paginationCounter: (/** @type {any} */ _pageSize, /** @type {any} */ _currentRow, /** @type {any} */ _totalRows, /** @type {number} */ pageTotal) => `演员: ${pageTotal} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" class="jhs-table-counter-note"></span>`,
            responsiveLayout: "collapse", responsiveLayoutCollapse: true,
            columnDefaults: { headerHozAlign: "center", hozAlign: "center" }, index: "starId",
            columns: this.getColumns(), initialSort: [{ column: "createTime", dir: "desc" }],
        });
    }

    getColumns() {
        return [
            { title: "演员", field: "name", sorter: "string", minWidth: 100, responsive: 0, headerSort: false, formatter: (/** @type {TableCell} */ cell) => {
                const actor = cell.getData(), url = normalizeHttpUrl(actor.url, this.window.location.href), link = this.document.createElement("a");
                link.className = "open-url"; link.textContent = String(actor.name || ""); link.dataset.name = String(actor.name || "");
                if (url) { link.href = url; link.dataset.url = url; link.target = "_blank"; link.rel = "noopener noreferrer"; }
                else { link.href = "#"; link.setAttribute("aria-disabled", "true"); }
                return link;
            } },
            { title: "性别角色", field: "role", sorter: "string", width: 120, responsive: 5, formatter: (/** @type {TableCell} */ cell) => {
                const labels = /** @type {Record<string, string>} */ ({ [B]: "男演员", [P]: "女演员" });
                return labels[cell.getData().role] ?? cell.getData().role;
            } },
            { title: "影视类别", field: "movieType", sorter: "string", width: 120, responsive: 5, formatter: (/** @type {TableCell} */ cell) => {
                const labels = /** @type {Record<string, string>} */ ({ [D]: "有码", [A]: "无码" });
                const value = cell.getData().movieType || "";
                return labels[value] ?? value;
            } },
            { title: "屏蔽类型", field: "url", sorter: "string", minWidth: 120, responsive: 4, visible: this.site === "javdb", formatter: (/** @type {TableCell} */ cell) => {
                const hasCategory = String(cell.getData().url || "").includes("t=");
                const badge = this.document.createElement("span");
                badge.className = `jhs-badge ${hasCategory ? "jhs-badge--filter" : "jhs-badge--neutral"}`;
                badge.textContent = hasCategory ? "按所选分类屏蔽" : "未筛选分类";
                return badge;
            } },
            { title: "番号数量", field: "count", sorter: "number", width: 170, responsive: 1 },
            { title: "创建时间", field: "createTime", sorter: "string", width: 170, responsive: 5 },
            { title: "最后发行时间", field: "lastPublishTime", sorter: "string", width: 170, responsive: 1 },
            { title: "状态", field: "isUnCheck", sorter: "string", width: 120, responsive: 1, formatter: (/** @type {TableCell} */ cell) => {
                const stopped = cell.getData().isUnCheck, badge = this.document.createElement("span");
                badge.className = `jhs-badge ${stopped ? "jhs-badge--filter" : "jhs-badge--neutral"}`;
                if (stopped) badge.dataset.tip = `停更${this.checkBlacklistRuleTime / 24 / 365}年以上, 下轮任务不再进行检测`;
                badge.textContent = stopped ? "停更跳过" : "继续检测";
                return badge;
            } },
            { title: "操作", sorter: "string", cssClass: "action-cell-dropdown", minWidth: 150, responsive: 0, headerSort: false, formatter: (/** @type {TableCell} */ cell, /** @type {any} */ _formatterParams, /** @type {(callback: () => void) => void} */ onRendered) => {
                const actor = cell.getData();
                onRendered(() => {
                    const button = cell.getElement().querySelector(".delete-btn");
                    button?.addEventListener("click", (/** @type {Event} */ event) => {
                        if (!actor.name) return void this.notifications.error("获取名称失败");
                        if (!actor.starId) return void this.notifications.error("获取starId失败");
                        this.ui.confirm(event, `是否移除对 ${escapeHtml(actor.name)} 的屏蔽?`, async () => {
                            await this.state.removeBlacklistActor(actor.starId);
                            this.notifications.info("操作成功");
                            await this.reloadTable();
                        });
                    });
                });
                return '<button type="button" class="jhs-btn jhs-btn--danger delete-btn"><span>删除</span></button>';
            } },
        ];
    }

    /** @param {number} generation */
    isCurrent(generation) { return !this.disposed && !this.scope?.disposed && this.dialogGeneration === generation && Boolean(this.blacklistRoot); }

    /** @param {number} generation */
    isGenerationCurrent(generation) { return !this.disposed && !this.scope?.disposed && this.dialogGeneration === generation; }

    /** @param {number} generation @param {boolean} emit */
    async finishDialog(generation, emit) {
        if (generation !== this.dialogGeneration) return;
        this.manualScanAbortController?.abort();
        this.manualScanAbortController = null;
        this.blacklistRoot = null;
        this.dialogId = null;
        this.blacklistSearchDebounced?.cancel?.();
        this.blacklistSearchDebounced = null;
        this.taskStatusUnsubscribe?.();
        this.taskStatusUnsubscribe = null;
        const table = this.tableObj;
        this.tableObj = null;
        table?.destroy?.();
        if (emit) {
            try { await this.events?.emit?.("blacklist-rules-changed"); }
            catch (error) { this.logger?.error?.("黑名单缓存失效通知失败", error); }
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        const id = this.dialogId;
        if (id != null) this.dialog.close(id);
        void this.finishDialog(this.dialogGeneration, false);
    }
}
