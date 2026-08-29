// @ts-check

import { _, c, g, h, l, o, r } from "../../core/constants.js";
import { BasePlugin } from "../../core/plugin-manager.js";
import { isHitShowPage } from "../../core/site-context.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { isHardHidden } from "../../features/list/list-filters.js";

/** @typedef {import("../../core/lifecycle-scope.js").LifecycleScope} LifecycleScope */
/** @typedef {{ starId?: string }} BlacklistRecord */
/** @typedef {{ element: Element, key: number, originalIndex: number, index: number }} SortItem */

export class ListPageButtonPlugin extends BasePlugin {
    constructor() {
        super();
        /** @type {string | null} 页内排序覆盖：仅自有榜单页使用，初始固定“默认”，不写全局设置。 */
        this.ownedRankingSortOverride = null;
    }
    getName() {
        return "ListPageButtonPlugin";
    }
    async handle() {
        // 热播/Top250 自渲染榜单由渲染方调用 mountHitShowControls 延迟挂载，启动期不注入页面 h2
        if (!window.isListPage || isHitShowPage() || window.location.search.includes("handleTop=1")) return;
        const scope = await this.getRuntimeService("scope")();
        const settings = this.getRuntimeService("settings");
        await this.createMenuBtn(scope), this.bindEvent();
        const onSettingsChanged = (/** @type {any} */ event) => {
            const names = /** @type {string[] | undefined} */ (event.detail?.names);
            if (!names?.includes("autoPage")) return;
            void this.syncSortUi().catch((/** @type {unknown} */ error) => clog.error("排序状态同步失败", error));
        };
        settings.addEventListener("settings.changed", onSettingsChanged);
        scope.addCleanup((() => settings.removeEventListener("settings.changed", onSettingsChanged)));
        await this.syncSortUi();
    }
    /** 自渲染榜单页由渲染方在自有标题/筛选容器就绪后调用：按钮行挂进传入容器（缺省为热播标题），排序/批量能力与普通列表页一致。 @param {any} [target] */
    async mountOwnedRankingControls(target = null) {
        const heading = target?.length ? target : $(".jhs-hitshow-heading");
        if (!heading.length || $("#waitCheckBtn").length) return;
        const scope = await this.getRuntimeService("scope")();
        await this.createMenuBtn(scope, heading);
        this.bindEvent();
        await this.syncSortUi();
    }
    /** 根据 autoPage 与当前站点能力同步排序控件；AutoPage ON 且不支持 live sorting 时明确进入“默认（瀑布流）”。 */
    async syncSortUi() {
        const settings = this.getRuntimeService("settings");
        const autoPage = settings.snapshot().autoPage ?? _;
        const live = this.supportsLiveSorting();
        const toggle = $("#sort-toggle-btn");
        if (!toggle.length) return;
        const menu = $(".jhs-sort-menu");
        if (autoPage === _ && !live) {
            toggle.prop("disabled", true).attr("title", "瀑布流模式仅支持默认排序");
            $("#jhs-sort-current").text("默认（瀑布流）");
            menu.find(".jhs-sort-option").attr("aria-checked", "false");
            menu.find('[data-sort-method="default"]').attr("aria-checked", "true");
            await this.sortItems("default");
            return;
        }
        const method = this.activeSortMethod();
        const labels = { default: "默认", rateCount: "评价人数", date: "时间" };
        const current = Object.prototype.hasOwnProperty.call(labels, method) ? /** @type {Record<string, string>} */ (labels)[/** @type {string} */ (method)] : labels.default;
        toggle.prop("disabled", false).attr("title", "选择列表排序方式");
        $("#jhs-sort-current").text(current);
        menu.find(".jhs-sort-option").attr("aria-checked", "false");
        menu.find(`[data-sort-method="${method}"]`).attr("aria-checked", "true");
        await this.sortItems();
    }
    /** @param {LifecycleScope} scope @param {any} [target] 自渲染榜单传入自有标题容器，避免注入页面 h2。 */
    async createMenuBtn(scope, target = null) {
        // 6.5 capability：功能被禁用时不渲染按钮，不留 disabled 死按钮。
        const hasNewVideo = Boolean(this.getOptionalDependency("NewVideoPlugin")), hasBlacklist = Boolean(this.getOptionalDependency("BlacklistPlugin")), hasListPage = Boolean(this.getOptionalDependency("ListPagePlugin"));
        if (r) {
            const e = o.includes("/actors/");
            let t = $(".main-tabs, .tabs"), n = "加入黑名单", a = "jhs-btn--filter", s = null;
            if (e) {
                t = $(".toolbar, .section-addition").filter(":last");
                const e = await storageManager.getBlacklist(), i = this.getActressPageInfo();
                e.find((/** @type {BlacklistRecord} */ e) => e.starId === i.starId) && (n = "已加入黑名单", a = "jhs-btn--muted");
            } else o.includes("/tags") && utils.loopDetector((() => $("#jhs-check-tag").text().trim()), (async () => {
                const e = $("#addBlacklistBtn");
                e.attr("data-tip", "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中");
                const t = $("#jhs-check-tag").text().trim();
                if (!t) return;
                const n = "no-" + t, a = await storageManager.getBlacklist();
                s = a.find((/** @type {BlacklistRecord} */ e) => e.starId === n), s && (e.addClass("jhs-btn--muted").removeClass("jhs-btn--filter"), $("#addBlacklistBtn span").text("已加入黑名单"));
            }), 20, 1e4, !0, scope);
            const r = o.includes("advanced_search");
            r && (t = target?.length ? target : $("h2.section-title"));
            const initialSort = this.activeSortMethod(), d = "当前排序方式: " + ("rateCount" === initialSort ? "评价人数" : "date" === initialSort ? "时间" : "默认");
            t.append(`\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>\n                    ${e && hasBlacklist ? `\n<button type="button" id="addBlacklistBtn" class="jhs-btn ${a}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></button>\n<button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>批量屏蔽</span></button>\n` : ""}\n                    ${hasListPage ? `\n<button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="收藏当前搜索全部分页中符合当前筛选的作品"><span>批量收藏</span></button>\n<button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="标记当前搜索全部分页中符合当前筛选的作品为已下载"><span>批量标记已下载</span></button>\n` : ""}\n                    ${o.includes("/tags") && hasBlacklist ? `\n<button type="button" id="addBlacklistBtn" class="jhs-btn ${a}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></button>\n` : ""}\n                </div>\n                <div class="jhs-list-btn-row">\n                    ${hasNewVideo ? `<button type="button" id="newVideoBtn" class="jhs-btn jhs-btn--secondary"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></button>` : ""}\n                    ${hasBlacklist ? `<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>` : ""}\n                    ${c || !this.supportsSorting() ? "" : this.sortMenuHtml(initialSort, d)}\n                </div>\n            `);
        }
        if (l) {
            const e = o.includes("/star/");
            let t = "加入黑名单", n = "jhs-btn--filter";
            if (e) {
                const e = await storageManager.getBlacklist(), a = this.getActressPageInfo();
                e.find((/** @type {BlacklistRecord} */ e) => e.starId === a.starId) && (t = "已加入黑名单", n = "jhs-btn--muted");
            }
            const a = this.activeSortMethod();
            $(".masonry").parent().prepend(`\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>\n                    ${e && hasBlacklist ? `    \n                        <button type="button" id="addBlacklistBtn" class="jhs-btn ${n}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t}</span></button>\n                        <button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>批量屏蔽</span></button>\n                    ` : ""}${hasListPage ? `    \n                        <button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="收藏当前搜索全部分页中符合当前筛选的作品"><span>批量收藏</span></button>\n                        <button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="标记当前搜索全部分页中符合当前筛选的作品为已下载"><span>批量标记已下载</span></button>\n                    ` : ""}${!e && hasBlacklist ? `<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>` : ""}\n                    ${this.supportsSorting() ? this.sortMenuHtml(a) : ""}\n                </div>\n            `);
        }
        $("#waitCheckBtn > span").text("开始鉴定");
        const newVideoCount = $("#newVideoCount").detach(), newVideoLabel = $("#newVideoBtn > span");
        newVideoLabel.length && newVideoLabel.empty().append(document.createTextNode("新作品 ("), newVideoCount, document.createTextNode(")"));
    }
    /** @param {unknown} method @param {string} [title] 构建与原排序值兼容的 JHS 菜单。 */
    sortMenuHtml(method, title = "选择列表排序方式") {
        const labels = { default: "默认", rateCount: "评价人数", date: "时间" }, key = "string" === typeof method && method in labels ? /** @type {keyof typeof labels} */ (method) : "default", current = labels[key];
        return `<div class="jhs-sort-control"><button type="button" id="sort-toggle-btn" class="jhs-btn jhs-btn--secondary" aria-haspopup="menu" aria-expanded="false" title="${title}"><span id="jhs-sort-current">${current}</span></button><div class="jhs-popover jhs-sort-menu" role="menu" aria-label="排序方式">${Object.entries(labels).map((([value, label]) => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-sort-option" role="menuitemradio" aria-checked="${value === method ? "true" : "false"}" data-sort-method="${value}" tabindex="-1">${label}</button>`)).join("")}</div></div>`;
    }
    bindEvent() {
        $("#waitCheckBtn").on("click", ((/** @type {any} */ e) => {
            void this.openWaitCheck().catch((error => clog.error("待鉴定列表打开失败", error)));
        })), $("#newVideoBtn").on("click", ((/** @type {any} */ e) => {
            this.getOptionalDependency("NewVideoPlugin")?.openDialog?.();
        })), $("#blacklistBtn").on("click", ((/** @type {any} */ e) => {
            this.getOptionalDependency("BlacklistPlugin")?.openBlacklistDialog?.();
        })), this.bindSortMenu();
        // 6.5: capability 渲染在 createMenuBtn 完成，功能禁用时不渲染按钮；此处仅保留业务引用。
        const blacklist = this.getOptionalDependency("BlacklistPlugin"), listPage = this.getOptionalDependency("ListPagePlugin");
        $("#addBlacklistBtn").on("click", (async (/** @type {any} */ t) => {
            await blacklist?.addBlacklist?.(t);
        })), $("#filterAllVideo").on("click", (async (/** @type {any} */ t) => {
            const a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            const i = a.text().trim().split(",")[0];
            this.loadObj = loading();
            try {
                await blacklist?.filterAllVideo?.(i);
            } catch (t) {
                clog.error(t);
            } finally { this.loadObj.close(); }
        })), $("#favoriteAllVideo").on("click", (async (/** @type {any} */ t) => {
            const scope = this.buildBatchScope();
            this.loadObj = loading();
            try { await listPage?.batchSaveAllVideos?.(scope, h); } catch (t) { clog.error(t); } finally { this.loadObj.close(); }
        })), $("#hasDownAllVideo").on("click", (async (/** @type {any} */ t) => {
            const scope = this.buildBatchScope();
            this.loadObj = loading();
            try { await listPage?.batchSaveAllVideos?.(scope, g); } catch (t) { clog.error(t); } finally { this.loadObj.close(); }
        }));
    }
    /** 绑定排序 popover 的选择与键盘交互。 */
    bindSortMenu() {
        const control = $(".jhs-sort-control");
        if (!control.length) return;
        const toggle = control.find("#sort-toggle-btn"), menu = control.find(".jhs-sort-menu"), close = (focus = !1) => {
            menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), focus && toggle.trigger("focus");
        };
        toggle.on("click", ((/** @type {any} */ event) => {
            event.preventDefault(), event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && menu.find('[aria-checked="true"]').trigger("focus");
        }));
        menu.on("click", ".jhs-sort-option", (async (/** @type {any} */ event) => {
            const item = $(event.currentTarget), method = item.data("sort-method");
            const previousItem = menu.find('.jhs-sort-option[aria-checked="true"]').first();
            const previousLabel = $("#jhs-sort-current").text();
            menu.find(".jhs-sort-option").attr("aria-checked", "false"), item.attr("aria-checked", "true"),
            $("#jhs-sort-current").text(item.text()), close(!0);
            try {
                await this.selectSortMethod(method);
            } catch (error) {
                menu.find(".jhs-sort-option").attr("aria-checked", "false"), previousItem.attr("aria-checked", "true"), $("#jhs-sort-current").text(previousLabel);
                clog.error("排序设置保存失败，已恢复", error), show.error("排序设置保存失败，已恢复原设置");
            }
        })).on("keydown", ".jhs-sort-option", ((/** @type {any} */ event) => {
            const items = menu.find(".jhs-sort-option"), index = items.index(event.currentTarget);
            if ("Escape" === event.key) return event.preventDefault(), close(!0);
            if (![ "ArrowDown", "ArrowUp", "Home", "End" ].includes(event.key)) return;
            event.preventDefault();
            const next = "Home" === event.key ? 0 : "End" === event.key ? items.length - 1 : "ArrowDown" === event.key ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        }));
        $(document).off("click.jhsSortMenu").on("click.jhsSortMenu", ((/** @type {any} */ event) => {
            $(event.target).closest(control).length || close();
        }));
    }
    /** @param {string} [methodOverride] */
    async sortItems(methodOverride) {
        const e = this.supportsLiveSorting();
        if (!this.supportsSorting()) return;
        const s = this.getRuntimeService("settings").snapshot().autoPage ?? _;
        if (c || (s === _ && !e && methodOverride !== "default")) return;
        const t = methodOverride || this.activeSortMethod();
        if (!t) return;
        const i = this.getSelector(), d = $(i.boxSelector), h = $(i.itemSelector);
        h.each(((/** @type {number} */ e, /** @type {Element} */ element) => {
            $(element).attr("data-original-index") || $(element).attr("data-original-index", e);
        }));
        /** @type {SortItem[]} */
        const items = h.get().map(((/** @type {Element} */ element, /** @type {number} */ index) => {
            const card = $(element), originalIndex = Number(card.attr("data-original-index")) || 0;
            if ("default" === t) return { element, key: originalIndex, originalIndex, index };
            if ("rateCount" === t) {
                const explicit = Number(card.attr("data-jhs-rate-count")), match = card.find(".score").text().replaceAll(",", "").match(/(?:由\s*)?(\d+)\s*人(?:评价)?/);
                return { element, key: Number.isFinite(explicit) ? explicit : match ? Number(match[1]) : 0, originalIndex, index };
            }
            const value = card.attr("data-jhs-publish-time") || card.find(".meta").text().trim() || card.find("date").filter(((/** @type {number} */ index, /** @type {Element} */ element) => /^\d{4}-\d{1,2}-\d{1,2}$/.test($(element).text().trim()))).first().text().trim(), timestamp = Date.parse(value);
            return { element, key: Number.isFinite(timestamp) ? timestamp : 0, originalIndex, index };
        }));
        items.sort(((/** @type {SortItem} */ e, /** @type {SortItem} */ n) => "default" === t ? e.key - n.key : n.key - e.key || e.originalIndex - n.originalIndex || e.index - n.index));
        const sortedElements = items.map((/** @type {SortItem} */ item) => item.element);
        "default" === t ? $(sortedElements).appendTo(d) : d.empty().append(sortedElements);
    }
    isHitShowPage() {
        return isHitShowPage(window.location);
    }
    /** 自渲染榜单页（热播/Top250）：排序为页内状态，初始固定“默认”，与全局 sortMethod 解耦。 */
    isOwnedRankingPage() {
        return this.isHitShowPage() || window.location.search.includes("handleTop=1");
    }
    /** 当前生效的排序方式：自有榜单页取页内覆盖（缺省默认），普通列表页取全局设置。 */
    activeSortMethod() {
        if (this.isOwnedRankingPage()) return this.ownedRankingSortOverride || "default";
        return this.getRuntimeService("settings").snapshot().sortMethod || "default";
    }
    /** 应用一次排序选择：自有榜单页只改页内覆盖，普通列表页写全局设置。 */
    /** @param {string} method */
    async selectSortMethod(method) {
        if (this.isOwnedRankingPage()) {
            this.ownedRankingSortOverride = method;
            await this.sortItems(method);
            return;
        }
        await this.getRuntimeService("settings").set("sortMethod", method);
        await this.sortItems();
    }
    isFc2ListPage() {
        return r && "/advanced_search" === window.location.pathname && "3" === new URLSearchParams(window.location.search).get("type");
    }
    supportsSorting() {
        if (this.supportsLiveSorting()) return true;
        if (r && (o.includes("handle") || o.includes("advanced_search"))) return false;
        return true;
    }
    supportsLiveSorting() {
        return this.isHitShowPage() || this.isFc2ListPage();
    }
    /** 构造批量任务范围：actor 页携带演员名，搜索/列表页不要求演员名且不写入搜索关键词。 */
    buildBatchScope() {
        const isActorPage = r ? o.includes("/actors/") : o.includes("/star/");
        if (!isActorPage) return { kind: "search", displayName: "当前搜索条件", recordName: "" };
        const info = this.getActressPageInfo();
        return { kind: "actor", displayName: info?.name || "", recordName: info?.name || "" };
    }
    async openWaitCheck() {
        let e = this.getSelector();
        const t = await storageManager.getSetting("waitCheckCount", 5);
        let a = 0;
        const listPage = this.getOptionalDependency("ListPagePlugin");
        if (!listPage) return void show.info("列表功能已禁用");
        for (const element of $(e.itemSelector).toArray()) {
            if (a >= t) break;
            const item = $(element), flags = normalizeStateFlags(JSON.parse(item.attr("data-jhs-flags") || "{}")), visibilityReasons = JSON.parse(item.attr("data-jhs-visibility") || "{}");
            if (hasAnyState(flags) || isHardHidden(flags, visibilityReasons)) continue;
            await listPage.openMovieDetail(item, { autoplay: !0, newTab: !1 }), a++;
        }
        0 === a && show.info("没有需鉴定的视频");
    }
}