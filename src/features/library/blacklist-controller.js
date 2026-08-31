// @ts-check

import { A, B, D, I, P, T, d } from "../../core/constants.js";
import { parseHostListPage } from "../../core/host-list-parser.js";
import { normalizeHttpUrl, parseNumberSetting, selectLatestPublishTime, shouldSkipStopped } from "../../core/feature-helpers.js";
import { requestHostPage } from "../../core/host-page-request.js";
import { readListItem } from "../../core/list-item-reader.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { endBatchRun, isActiveBatchRun, tryBeginBatchRun } from "../../core/batch-coordinator.js";
import { openSettingsUi } from "../../core/settings-ui-owner.js";
import { JhsSelect, renderStateView } from "../../core/ui-primitives.js";
import { createJhsTable } from "../../ui/table/create-jhs-table.js";
import { BlacklistRepository } from "./blacklist-repository.js";

/** @typedef {Record<string, any>} BlacklistRecord */

export class BlacklistController {
    /** @param {{hostAdapter?: any, dialog?: any, storage?: any, settings?: any, state?: any, http?: any, eventBus?: any, mutation?: any, features?: any, styles?: any, ui?: any, scope: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.site = options.hostAdapter?.site ?? "unknown";
        this.isJavDB = this.site === T;
        this.isJavBus = this.site === I;
        this.dialog = options.dialog;
        this.storage = options.storage;
        this.settings = options.settings;
        this.state = options.state;
        this.http = options.http;
        this.eventBus = options.eventBus;
        this.features = options.features;
        this.styles = options.styles;
        this.ui = options.ui ?? null;
        this.scope = options.scope;
        this.repository = new BlacklistRepository({ storage: this.storage, state: this.state, eventBus: this.eventBus, mutation: options.mutation });
        /** @type {any} */ this.blacklistSearchDebounced = null;
        /** @type {null | (() => void)} */ this.taskStatusUnsubscribe = null;
        /** @type {any} */ this.discoveryFeatureApi = null;
        this.blacklistRoot = null;
        this.tableObj = null;
        this.started = false;
        this.checkBlacklist_ruleTime = 8760;
        this.currentCarCount = 0;
        this.blacklistSvg = '<svg class="jhs-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm5.2 15.2L6.8 6.8a7.96 7.96 0 0 1 10.4 10.4ZM5.4 8.2l10.4 10.4A7.96 7.96 0 0 1 5.4 8.2Z"/></svg>';
        this.settingSvg = '<svg class="jhs-icon" viewBox="0 0 24 24" aria-hidden="true"><path d="m19.4 13.5 2-1.5-2-1.5.2-2.5-2.5-.2-1.5-2-1.5 2-2.5.2.2 2.5-2 1.5 2 1.5-.2 2.5 2.5.2 1.5 2 1.5-2 2.5-.2-.2-2.5ZM12 15.5A3.5 3.5 0 1 1 12 8a3.5 3.5 0 0 1 0 7.5Z"/></svg>';
    }

    getJQuery() {
        const jq = this.ui?.getJQuery?.();
        if (typeof jq !== "function") throw new TypeError("黑名单需要 jQuery");
        return jq;
    }
    getUtils() { return this.ui?.getUtils?.() ?? {}; }
    getShow() { return this.ui?.show ?? {}; }
    getLoading() { return this.ui?.getLoading?.() ?? (() => ({ close() {} })); }
    getClog() { return this.ui?.getClog?.() ?? {}; }

    getCurrentUrl() { return this.hostAdapter?.location?.href ?? this.document?.defaultView?.location?.href ?? ""; }

    getSettings() { return this.settings?.snapshot?.() ?? {}; }

    /** @param {string} name @param {unknown} fallback */
    getSetting(name, fallback) { const value = this.getSettings()[name]; return null == value ? fallback : value; }

    getSelector(site = this.site) {
        if (site === this.site) {
            const selectors = this.hostAdapter?.getListSelectors?.();
            if (selectors) return selectors;
        }
        const listClass = "movie" + "-list";
        return site === I
            ? { boxSelector: ".masonry", itemSelector: ".masonry .item", coverImgSelector: ".masonry .movie-box .photo-frame img", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }
            : { boxSelector: `.${listClass}`, itemSelector: `.${listClass} .item`, coverImgSelector: ".cover img", requestDomItemSelector: `.${listClass} .item`, nextPageSelector: ".pagination-next" };
    }

    getActressPageInfo() {
        const href = this.getCurrentUrl();
        if (!href.includes("/actors/") && !href.includes("/star/")) throw new Error("接口调用错误, 非演员详情页");
        const names = /** @type {string[]} */ ([]), nameRoot = this.isJavDB ? this.document.querySelector(".actor-section-name") : this.document.querySelector(".avatar-box .photo-info .pb10");
        nameRoot?.textContent?.trim().split(",").forEach((/** @type {string} */ name) => name.trim() && names.push(name.trim()));
        this.document.querySelectorAll(".section-meta").forEach((/** @type {Element} */ element) => {
            const text = element.textContent?.trim() ?? "";
            !text.includes("影片") && text.split(",").forEach((/** @type {string} */ name) => name.trim() && names.push(name.trim()));
        });
        const role = [ ...this.document.querySelectorAll(".section-meta") ].some((element) => element.textContent?.includes("男優")) ? B : P;
        const movieType = href.includes("uncensored") || names.some((name) => name.includes("無碼")) ? A : D;
        const url = new URL(href);
        let starId = null, blacklistUrl = null;
        if (this.isJavDB) {
            starId = url.pathname.split("/").filter(Boolean).pop() ?? null;
            url.searchParams.delete("sort_type"), url.searchParams.delete("page"), blacklistUrl = url.toString();
        } else if (this.isJavBus) {
            const parts = href.split("/star/");
            if (parts.length < 2) throw new Error("提取演员url失败");
            starId = parts[1].split("/")[0], blacklistUrl = `${parts[0]}/star/${starId}`;
        }
        return { starId, name: names[0] || "", allName: names, role, movieType, blacklistUrl };
    }

    async getListFeatureApi() {
        try { return await this.features?.getFeatureApi("list"); }
        catch (error) { this.getClog().warn?.("List Feature API 不可用，跳过列表筛选", error); return null; }
    }

    /** Resolve discovery-owned task operations without coupling the library feature to TaskPlugin. */
    async getDiscoveryFeatureApi() {
        if (this.discoveryFeatureApi) return this.discoveryFeatureApi;
        try {
            this.discoveryFeatureApi = await this.features?.getFeatureApi("discovery");
        } catch (error) {
            this.getClog().warn?.("Discovery Feature API 不可用，跳过黑名单任务", error);
            this.discoveryFeatureApi = null;
        }
        return this.discoveryFeatureApi;
    }
    async initCss() {
        return `<style>
            .jhs-blacklist-layout { display:flex; flex-direction:column; height:100%; min-height:0; padding:var(--jhs-space-3) var(--jhs-space-4); overflow:hidden; }
            .jhs-blacklist-toolbar { display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:var(--jhs-space-2); margin-bottom:var(--jhs-space-2); }
            .jhs-blacklist-toolbar__group { display:flex; align-items:center; flex-wrap:wrap; gap:var(--jhs-space-2); }
            .jhs-blacklist-layout #table-container { flex:1; min-height:0; }
            .jhs-table-counter-note { margin-left:var(--jhs-space-2); }
            .jhs-blacklist-task-status { margin-bottom:var(--jhs-space-2); padding:var(--jhs-space-2) var(--jhs-space-3); border:1px solid var(--jhs-border); border-radius:var(--jhs-radius-sm); background:var(--jhs-surface-2); }
            .jhs-blacklist-task-status .jhs-task-status__name { color:var(--jhs-text); font-weight:700; }
            .jhs-blacklist-task-status .jhs-task-status__meta { display:block; margin-top:var(--jhs-space-1); color:var(--jhs-text-muted); font-size:var(--jhs-font-size-xs); }
        </style>`;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve().then(async () => {
            const css = (await this.initCss()).replace(/^\s*<style>|<\/style>\s*$/g, "");
            const removeStyle = this.styles?.register?.("jhs-blacklist", css);
            if (typeof removeStyle === "function") this.scope.addCleanup?.(removeStyle);
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }
    /** @param {any} e */
    async addBlacklist(e) {
        const $ = this.getJQuery(), utils = this.getUtils(), show = this.getShow(), clog = this.getClog(), loading = this.getLoading();
        let t = {
            clientX: e.clientX,
            clientY: e.clientY + 80
        };
        const n = $("#addBlacklistBtn span").text().includes("已加入");
        let a, i;
        const currentUrl = this.getCurrentUrl();
        if (currentUrl.includes("/tags")) {
            const e = new URL(currentUrl);
            e.searchParams.delete("page");
            const t = $("#jhs-check-tag").text().trim();
            a = {
                starId: "no-" + t,
                name: "虚拟演员-" + t,
                allName: [ "虚拟演员" ],
                role: "虚拟演员",
                movieType: t,
                blacklistUrl: e.toString()
            }, i = `是否将分类 <span class="jhs-task-emphasis">${t}</span> 加入到黑名单中?`, n && (i = `分类 <span class="jhs-task-emphasis">${t}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
        } else a = this.getActressPageInfo(), i = `是否将该演员 <span class="jhs-task-emphasis">${a.name}</span> 加入到黑名单中?`,
        n && (i = `演员 <span class="jhs-task-emphasis">${a.name}</span> 已在黑名单中, 是否从当前页开始追加屏蔽?`);
        const {starId: s, name: r, allName: c, role: d, movieType: h, blacklistUrl: g} = a;
        if (currentUrl.includes("page") && !currentUrl.includes("page=1") && (i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始"),
        this.isJavBus) {
            const e = currentUrl.split("/star/")[1].split("/");
            if (e.length > 1) {
                parseInt(e[1]) > 1 && (i += "<br/> 注意: 当前页面非第一页, 屏蔽数据将从此页面开始");
            }
        }
        utils.q(t, i, (async () => {
            const e = await this.getDiscoveryFeatureApi();
            if (!e) return void show.error("后台任务功能已禁用，无法执行黑名单抓取");
            navigator.locks.request(e.singleTaskKey, {
                ifAvailable: !0
            }, (async (/** @type {any} */ e) => {
                if (clog.debug("获取锁", e), e) {
                    this.loadObj = loading();
                    try {
                        await this.repository.add({
                            starId: s,
                            name: r,
                            allName: c,
                            role: d,
                            movieType: h,
                            url: g
                        }), await this.filterActorVideo(r, s, null, this.isJavBus ? I : T);
                        const e = show.ok(`屏蔽结束,是否跳转到最后一页: ${this.lastPageLink}`, {
                            duration: -1,
                            close: !0,
                            onClick: () => {
                                e.closeShow(), this.hostAdapter?.location && (this.hostAdapter.location.href = this.lastPageLink);
                            }
                        });
                    } catch (t) {
                        clog.error(t);
                        const e = show.error("发生错误, 是否填转到解析失败的那一页? (点击并跳转)", {
                            duration: -1,
                            close: !0,
                            onClick: () => {
                                e.closeShow(), this.hostAdapter?.location && (this.hostAdapter.location.href = this.nextPageLink);
                            }
                        });
                    } finally {
                        this.loadObj.close();
                    }
                } else show.error("当前有定时任务在后台执行中, 无法发起此操作");
            })).catch((e => {
                clog.error("锁任务出现错误:", e);
            }));
        }));
    }
    async resetBtnTip() {
        const $ = this.getJQuery();
        const e = await this.getDiscoveryFeatureApi(), t = e?.getTaskSchedule ? this.storage?.getLocal?.(e.getTaskSchedule("blacklist").completedKey) || "无" : "任务已禁用", n = this.getSetting("checkBlacklist_intervalTime", 12);
        this.checkBlacklist_ruleTime = this.getSetting("checkBlacklist_ruleTime", 8760),
        (this.blacklistRoot || $()).find("#checkBlacklistBtn").attr("data-tip", `上次整批检测: ${t}; 检测间隔时间: ${n}小时`);
    }
    async openBlacklistDialog() {
        const $ = this.getJQuery(), utils = this.getUtils(), show = this.getShow(), clog = this.getClog();
        const r = this.isJavDB;
        const e = await this.getDiscoveryFeatureApi(), t = this.getSettings(), lastCheck = e?.getTaskSchedule ? this.storage?.getLocal?.(e.getTaskSchedule("blacklist").completedKey) || "无" : "任务已禁用";
        let n = `\n            <div class="jhs-layout-7cb3f981"> \n                 <div class="jhs-layout-da5a4919">\n                    <div class="jhs-layout-31a824a2">\n                        <button type="button" id="checkBlacklistBtn" class="jhs-btn jhs-btn--secondary" data-tip="上次整批检测: ${lastCheck}; 检测间隔时间: ${t.checkBlacklist_intervalTime}小时">${this.blacklistSvg}<span>手动检测黑名单</span></button>\n                        <button type="button" class="jhs-btn jhs-btn--ghost" id="toSetting">${this.settingSvg}<span>配置</span></button>\n                    </div>\n                    <div class="jhs-layout-31a824a2">\n                        <select id="dataType" class="jhs-select-source">\n                            <option value="" selected>所有</option>\n                            <option value="actor">男演员</option>\n                            <option value="actress">女演员</option>\n                        </select>\n                        <select id="statusType" class="jhs-select-source">\n                            <option value="" selected>全部状态</option>\n                            <option value="normal">继续检测</option>\n                            <option value="stop">停更跳过</option>\n                        </select>\n                        <select id="urlType" data-tip="在演员页屏蔽时,是否选择了分类" class="jhs-select-source${r ? "" : " jhs-is-hidden"}">\n                            <option value="" selected>--屏蔽类型--</option>\n                            <option value="hasT">按所选分类屏蔽</option>\n                            <option value="noT">未筛选分类</option>\n                        </select>\n                        <input id="searchValue" type="search" placeholder="搜索名称、别名或 ID" class="jhs-field">\n                        <button type="button" id="cleanQueryBtn" class="jhs-btn jhs-btn--secondary jhs-layout-21a4fe43">重置</button>\n                    </div>\n\n                </div>\n                <div id="table-container" class="jhs-layout-d44e70c7"></div>\n            </div>\n        `;
        this.dialog.open({
            type: 1,
            title: "演员黑名单",
            content: n,
            scrollbar: !1,
            area: utils.getDialogArea("xl"),
            anim: -1,
            success: async (/** @type {any} */ t) => {
                const dialog = $(t).find(".layui-layer-content > div").first().addClass("jhs-blacklist-layout").removeAttr("style");
                this.blacklistRoot = dialog;
                const toolbar = dialog.children("div").first().addClass("jhs-blacklist-toolbar").removeAttr("style");
                toolbar.children("div").addClass("jhs-blacklist-toolbar__group").removeAttr("style"), toolbar.find("select,input,a").removeAttr("style"), dialog.find("#table-container").removeAttr("style");
                dialog.find("#table-container").before('<div id="blacklist-task-status" class="jhs-task-status jhs-blacklist-task-status" aria-live="polite"></div>'), JhsSelect.enhance(t);
                e || dialog.find("#checkBlacklistBtn").prop("disabled", !0).attr("title", "后台任务功能已禁用");
                this.renderTaskStatus(), this.taskStatusUnsubscribe?.(), this.taskStatusUnsubscribe = this.eventBus?.on?.("task-status-changed", (() => this.renderTaskStatus()));
                await this.loadTableData();
                const content = $(t).find(".layui-layer-content"), search = content.find("#searchValue");
                this.blacklistSearchDebounced = utils.debounce((() => void this.reloadTable()), 200), content.on("click", "#cleanQueryBtn", (async () => {
                    search.val(""), JhsSelect.setValue(this.blacklistRoot.find("#dataType"), "", !1), JhsSelect.setValue(this.blacklistRoot.find("#statusType"), "", !1), JhsSelect.setValue(this.blacklistRoot.find("#urlType"), "", !1), await this.reloadTable();
                })).on("input", "#searchValue", this.blacklistSearchDebounced).on("change", "#dataType,#statusType,#urlType", (async () => {
                    await this.reloadTable();
                })).on("click", "#toSetting", (() => {
                    try {
                        void Promise.resolve(openSettingsUi("task-panel", (() => {
                            $("#setting-blacklist").css({
                                border: "1px solid var(--jhs-status-filter)"
                            });
                        }))).catch((error) => {
                            clog.warn("设置中心打开失败，无法定位黑名单配置", error);
                        });
                    } catch (error) {
                        clog.warn("设置中心未就绪，无法打开黑名单配置", error);
                    }
                })).on("click", ".open-url", ((/** @type {any} */ e) => {
                    e.preventDefault();
                    const t = $(e.currentTarget), n = t.attr("data-url"), a = t.attr("data-name");
                    utils.openPage(n, a, !0, e);
                })).on("click", "#checkBlacklistBtn", ((/** @type {any} */ event) => {
                    const button = $(event.currentTarget), label = button.find("span").last(), previous = label.text();
                    if (!e || button.attr("aria-busy") === "true") return;
                    button.attr("aria-busy", "true").prop("disabled", !0), label.text("检测中…"), navigator.locks.request(e.singleTaskKey, { ifAvailable: !0 }, (async lock => {
                        lock ? await e.checkBlacklist(!0) : show.error("后台任务正在运行，请稍后再试");
                    })).catch((error => {
                        clog.error("锁任务出现错误:", error), e.isNetworkBlocked(error) && show.error(error.message || "任务执行失败");
                    })).finally((() => {
                        button.removeAttr("aria-busy").prop("disabled", !1), label.text(previous);
                    }));
                }));
            },
            end: async () => {
                this.blacklistRoot = null, this.blacklistSearchDebounced?.cancel?.(), this.blacklistSearchDebounced = null, this.taskStatusUnsubscribe?.(), this.taskStatusUnsubscribe = null, this.tableObj && (this.tableObj.destroy(), this.tableObj = null), await this.repository.emitChanged();
            }
        });
    }
    renderTaskStatus() {
        const $ = this.getJQuery();
        const container = (this.blacklistRoot || $()).find("#blacklist-task-status");
        if (!container.length) return;
        const task = this.discoveryFeatureApi;
        if (!task) return void container.empty().text("后台任务功能已禁用");
        const snapshot = task.getTaskStatusSnapshot("blacklist"), labels = { idle: "正常", running: "运行中", pending: "等待下一次任务检查", due: "待运行" }, format = (/** @type {unknown} */ value) => value ? new Date(/** @type {string | number | Date} */ (value)).toLocaleString() : "无", state = /** @type {keyof typeof labels} */ (snapshot.state);
        container.empty().append($("<span class=\"jhs-task-status__name\"></span>").text(`黑名单：${labels[state] || labels.idle}`), $("<span class=\"jhs-task-status__meta\"></span>").text(`上次完成 ${format(snapshot.completedAt)}；下次检查 ${snapshot.nextAt ? format(snapshot.nextAt) : "立即"}`));
    }
    async reloadTable() {
        if (!this.tableObj) return;
        const e = await this.getTableData();
        this.tableObj.setData(e);
    }
    async getTableData() {
        const $ = this.getJQuery();
        const root = this.blacklistRoot || $(), t = await this.repository.list(), n = await this.repository.listCars(), a = String(root.find("#searchValue").val() || "").trim().toLocaleLowerCase(), i = root.find("#statusType").val(), s = root.find("#dataType"), o = s.val(), r = root.find("#urlType").val(), l = t.length;
        let c = 0, d = 0;
        const h = t.map((/** @type {BlacklistRecord} */ t) => {
            t.role === B ? c++ : t.role === P && d++;
            let n = !1;
            return n = shouldSkipStopped(t.lastPublishTime, this.checkBlacklist_ruleTime),
            {
                ...t,
                isUnCheck: n
            };
        }).filter((/** @type {BlacklistRecord} */ item) => {
            const aliases = Array.isArray(item.allName) ? item.allName.join(" ") : item.allName || "", searchable = `${item.name || ""} ${aliases} ${item.starId || ""}`.toLocaleLowerCase(), searchMatch = !a || searchable.includes(a), statusMatch = !i || "normal" === i && !item.isUnCheck || "stop" === i && item.isUnCheck, roleMatch = !o || item.role === o, hasCategory = item.url.includes("t="), urlMatch = !r || "hasT" === r && hasCategory || "noT" === r && !hasCategory;
            return searchMatch && statusMatch && roleMatch && urlMatch;
        });
        s.html(`\n            <option value="">所有 (${l})</option>\n            <option value="actor">男演员 (${c})</option>\n            <option value="actress">女演员 (${d})</option>\n        `),
        JhsSelect.setValue(s, o, !1);
        const g = new Map;
        for (const m of n) {
            const e = m.starId;
            g.has(e) || g.set(e, []), g.get(e).push(m);
        }
        const p = h.map((/** @type {BlacklistRecord} */ e) => {
            const t = e.starId, n = g.get(t) || [];
            return {
                ...e,
                carList: n,
                count: n.length
            };
        });
        return this.currentCarCount = p.reduce(((/** @type {number} */ e, /** @type {BlacklistRecord} */ t) => e + (t.count || 0)), 0), p;
    }
    async loadTableData() {
        const $ = this.getJQuery(), utils = this.getUtils(), show = this.getShow(), clog = this.getClog();
        this.checkBlacklist_ruleTime = parseNumberSetting(this.getSetting("checkBlacklist_ruleTime", 8760), 8760, { min: 0 });
        const e = await this.getTableData(), placeholder = this.document.createElement("div");
        renderStateView(placeholder, { type: "empty", title: "没有符合当前筛选条件的黑名单记录" });
        const tableRoot = (this.blacklistRoot || $()).find("#table-container").get(0);
        this.tableObj = createJhsTable((/** @type {any} */ (globalThis)).Tabulator, tableRoot, {
            layout: "fitColumns",
            placeholder,
            virtualDom: !0,
            data: e,
            pagination: !0,
            paginationMode: "local",
            paginationSize: 20,
            paginationSizeSelector: [ 20, 50, 100, 1e3 ],
            paginationCounter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n, /** @type {number} */ a, /** @type {any} */ i) => `演员: ${a} &nbsp;&nbsp;&nbsp;番号总数: ${this.currentCarCount}  <span id="checkBlacklistMsg" class="jhs-table-counter-note"></span>`,
            responsiveLayout: "collapse",
            responsiveLayoutCollapse: !0,
            columnDefaults: {
                headerHozAlign: "center",
                hozAlign: "center"
            },
            index: "starId",
            columns: [ {
                title: "演员",
                field: "name",
                sorter: "string",
                minWidth: 100,
                responsive: 0,
                headerSort: !1,
                formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    const a = e.getData(), url = normalizeHttpUrl(a.url), link = this.document.createElement("a");
                    link.className = "open-url", link.textContent = String(a.name || ""), link.dataset.name = String(a.name || "");
                    return url ? (link.href = url, link.dataset.url = url, link.target = "_blank", link.rel = "noopener noreferrer") : (link.href = "#", link.setAttribute("aria-disabled", "true")), link;
                }
            }, {
                title: "性别角色",
                field: "role",
                sorter: "string",
                width: 120,
                responsive: 5,
                formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    const a = e.getData().role;
                    let i = a;
                    return a === B ? i = "男演员" : a === P && (i = "女演员"), i;
                }
            }, {
                title: "影视类别",
                field: "movieType",
                sorter: "string",
                width: 120,
                responsive: 5,
                formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    const a = e.getData().movieType;
                    let i = a;
                    return a === D ? i = "有码" : a === A && (i = "无码"), i;
                }
            }, {
                title: "屏蔽类型",
                field: "url",
                sorter: "string",
                minWidth: 120,
                responsive: 4,
                visible: this.isJavDB,
                formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    let a = e.getData().url.includes("t=");
                    return `<span class="jhs-badge ${a ? "jhs-badge--filter" : "jhs-badge--neutral"}">${a ? "按所选分类屏蔽" : "未筛选分类"}</span>`;
                }
            }, {
                title: "番号数量",
                field: "count",
                sorter: "number",
                width: 170,
                responsive: 1
            }, {
                title: "创建时间",
                field: "createTime",
                sorter: "string",
                width: 170,
                responsive: 5
            }, {
                title: "最后发行时间",
                field: "lastPublishTime",
                sorter: "string",
                width: 170,
                responsive: 1
            }, {
                title: "状态",
                field: "isUnCheck",
                sorter: "string",
                width: 120,
                responsive: 1,
                formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {any} */ n) => {
                    let a = "", i = "继续检测";
                    return e.getData().isUnCheck && (a = `停更${this.checkBlacklist_ruleTime / 24 / 365}年以上, 下轮任务不再进行检测`,
                    i = "停更跳过"), `<span class="jhs-badge ${a ? "jhs-badge--filter" : "jhs-badge--neutral"}" data-tip="${a}">${i}</span>`;
                }
            }, {
                title: "操作",
                sorter: "string",
                cssClass: "action-cell-dropdown",
                minWidth: 150,
                responsive: 0,
                headerSort: !1,
                formatter: (/** @type {any} */ e, /** @type {any} */ t, /** @type {(callback: () => void) => void} */ n) => {
                    const a = e.getData();
                    return n((() => {
                        var t, n;
                        null == (t = e.getElement().querySelector(".delete-btn")) || t.addEventListener("click", ((/** @type {Event} */ e) => {
                            const t = a.name, n = a.starId;
                            t ? n ? utils.q(e, `是否移除对 ${t} 的屏蔽?`, (async () => {
                                await this.repository.remove(n),
                                show.info("操作成功"), await this.reloadTable();
                            })) : show.error("获取starId失败") : show.error("获取名称失败");
                        })), null == (n = e.getElement().querySelector(".keyword-btn")) || n.addEventListener("click", ((/** @type {Event} */ e) => {
                            const t = a.carList.reduce(((/** @type {Record<string, number>} */ e, /** @type {BlacklistRecord} */ t) => {
                                const n = t.carNum.split("-")[0] + "-";
                                return e[n] = (e[n] || 0) + 1, e;
                            }), /** @type {Record<string, number>} */ ({})), n = Object.entries(t).map((([e, t]) => ({
                                prefix: e,
                                count: t
                            }))).sort(((/** @type {{ count: number }} */ e, /** @type {{ count: number }} */ t) => t.count - e.count));
                            clog.debug(n);
                        }));
                    })), '<button type="button" class="jhs-btn jhs-btn--danger delete-btn"><span>删除</span></button>';
                }
            } ],
            initialSort: [ {
                column: "createTime",
                dir: "desc"
            } ]
        });
    }
    /** @param {string} e @param {any} [t] @param {number} [page] @param {number} [processed] */
    /**
     * 一键屏蔽：跨全部分页扫描，仅处理符合当前筛选的记录（"全部"包含屏蔽项）。
     * @param {string} actressName @param {{ filter?: unknown, confirm?: boolean, root?: any }} [options]
     */
    async filterAllVideo(actressName, { filter, confirm = true, root = null } = {}) {
        const $ = this.getJQuery(), utils = this.getUtils(), show = this.getShow(), clog = this.getClog();
        const listFeature = await this.getListFeatureApi();
        if (!listFeature?.scanAllPages || !listFeature.evaluateListItem) return { cancelled: true, unavailable: true };
        const requestedFilter = String(filter ?? listFeature.getActiveQuickFilter?.() ?? "waitCheck"), normalized = [ "all", "waitCheck", "filter", "favorite", "hasDown", "hasWatch" ].includes(requestedFilter) ? requestedFilter : "waitCheck", filterLabel = { all: "全部", waitCheck: "待鉴定", filter: "已屏蔽", favorite: "已收藏", hasDown: "已下载", hasWatch: "已观看" }[normalized];
        const confirmText = "all" === normalized
            ? "将处理当前搜索全部分页的所有作品（包括屏蔽项）并加入黑名单。"
            : `将处理当前搜索全部分页中符合「${filterLabel}」筛选的作品并加入黑名单。`;
        if (confirm) {
            const proceed = await new Promise((resolve) => utils.q(null, confirmText, () => resolve(true), () => resolve(false)));
            if (!proceed) return { cancelled: true };
        }
        // Single Flight：与列表批量收藏/已下载共用同一协调器，避免互相打断。
        const run = tryBeginBatchRun();
        if (!run) {
            show.error("已有批量任务正在执行");
            return { cancelled: true, busy: true };
        }
        $("#favoriteAllVideo, #hasDownAllVideo, #filterAllVideo").attr("aria-disabled", "true").addClass("jhs-batch-busy");
        const scope = this.scope;
        const context = "function" === typeof listFeature?.createEvaluationContext ? await listFeature.createEvaluationContext() : {};
        const isCancelled = () => !isActiveBatchRun(run) || Boolean(scope?.disposed);
        const statusHost = () => (this.blacklistRoot || $()).find("#checkBlacklistMsg");
        try {
            const records = await listFeature.scanAllPages({
                startDom: root ? $(root) : $(this.document),
                currentUrl: root ? null : this.getCurrentUrl(),
                firstPageUrl: root ? null : (this.hostAdapter?.resolveFirstPageUrl?.(this.getCurrentUrl()) ?? this.getCurrentUrl()),
                itemSelector: (this.hostAdapter?.getListSelectors?.() ?? this.getSelector()).requestDomItemSelector,
                nextPageSelector: (this.hostAdapter?.getListSelectors?.() ?? this.getSelector()).nextPageSelector,
                fetchHtml: async (/** @type {string} */ url) => requestHostPage(this.http, url, scope),
                parseItem: (/** @type {any} */ item) => readListItem(item),
                evaluate: (/** @type {any} */ item) => listFeature.evaluateListItem({ carNum: item.carNum, title: item.title || "" }, context, { filter: normalized }),
                isCancelled,
                onProgress: (/** @type {{ page: number, scanned: number, matched: number }} */ {page, scanned, matched}) => {
                    const host = statusHost(); host.length && host.text(`正在扫描第 ${page} 页 · 已扫描 ${scanned} · 匹配 ${matched} 个番号`);
                },
            });
            if (isCancelled()) return { cancelled: true };
            let updated = 0;
            for (let index = 0; index < records.length; index += 75) {
                const chunk = records.slice(index, index + 75);
                await this.state.patch(chunk.map((/** @type {BlacklistRecord} */ item) => item.carNum), { blocked: !0 }, {
                    type: "actor-page-block",
                    records: chunk.map((/** @type {BlacklistRecord} */ item) => ({ carNum: item.carNum, url: item.url || "", names: actressName, publishTime: item.publishTime || "", fc2Source: item.fc2Source })),
                });
                updated += chunk.length;
                clog.log("一键屏蔽进度", `已屏蔽 ${updated}/${records.length} 个番号`);
            }
            const host = statusHost(); host.length && host.text(`处理完成 · 共屏蔽 ${updated} 个番号`);
            return { matched: records.length, updated };
        } finally {
            if (isActiveBatchRun(run)) endBatchRun(run);
            $("#favoriteAllVideo, #hasDownAllVideo, #filterAllVideo").removeAttr("aria-disabled").removeClass("jhs-batch-busy");
        }
    }
    /** @param {string} e @param {string} t @param {any} n @param {string} [site] @param {number} [page] @param {number} [processed] @param {Set<string>} [visited] */
    async filterActorVideo(e, t, n, site = this.isJavBus ? I : T, page = 1, processed = 0, visited = new Set()) {
        const $ = this.getJQuery(), utils = this.getUtils(), clog = this.getClog();
        let {nextPageLink: a, recordCount} = await this.parseAndSaveFilterInfo(n, e, t, site);
        processed += recordCount, (this.blacklistRoot || $()).find("#checkBlacklistMsg").text(`正在处理第 ${page} 页 · 已屏蔽 ${processed} 个番号`);
        // 页数上限 + 已访问集合：宿主分页异常自指时不再无限递归
        if (this.nextPageLink = a, a && page < 200 && !visited.has(a)) {
            visited.add(a);
            let n;
            this.lastPageLink = a;
            clog.log("正在请求下一页内容:", a);
            const scope = this.scope, i = await requestHostPage(this.http, a, scope);
            n = utils.htmlTo$dom(i);
            await this.filterActorVideo(e, t, n, site, page + 1, processed, visited);
        } else page >= 200 ? ((this.blacklistRoot || $()).find("#checkBlacklistMsg").text(`已达到页数上限（200 页），已停止 · 已屏蔽 ${processed} 个番号`), clog.warn("演员视频分页扫描已达上限，已停止")) : (this.blacklistRoot || $()).find("#checkBlacklistMsg").text(`处理完成 · ${page} 页 · 新增 ${processed} 个番号`);
    }
    /** @param {any} e @param {string} t @param {string} n @param {string} site */
    async parseAndSaveFilterInfo(e, t, n, site) {
        const $ = this.getJQuery();
        if (![ T, I ].includes(site)) throw new Error(`未知黑名单来源站点: ${site}`);
        const page = e || $(this.document), selector = this.getSelector(site);
        site === I && page.find(".avatar-box").length > 0 && page.find(".avatar-box").parent().remove();
        const pageState = parseHostListPage(page, {
            boxSelector: site === I ? `${selector.boxSelector}, #waterfall` : selector.boxSelector,
            requestDomItemSelector: e ? selector.requestDomItemSelector : selector.itemSelector
        }), nextPageLink = page.find(selector.nextPageSelector).attr("href");
        if ("valid" !== pageState.state) throw new Error(`黑名单作品页面无效: ${pageState.state}`);
        if (pageState.isEmpty && nextPageLink) throw new Error("黑名单作品空页面包含下一页");
        const records = [], publishTimes = [];
        for (const item of pageState.items) {
            const element = $(item), {carNum, url, publishTime} = readListItem(element);
            publishTime && publishTimes.push(publishTime), url && carNum && records.push({
                carNum,
                url,
                names: t,
                actionType: d,
                starId: n,
                publishTime
            });
        }
        await this.repository.saveCars(records);
        return {
            nextPageLink,
            lastPublishTime: selectLatestPublishTime(publishTimes),
            recordCount: records.length
        };
    }

    dispose() {
        this.blacklistSearchDebounced?.cancel?.();
        this.blacklistSearchDebounced = null;
        this.taskStatusUnsubscribe?.();
        this.taskStatusUnsubscribe = null;
        this.tableObj?.destroy?.();
        this.tableObj = null;
        this.blacklistRoot = null;
        this.started = false;
    }
}
