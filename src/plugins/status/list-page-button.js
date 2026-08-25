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
    getName() {
        return "ListPageButtonPlugin";
    }
    async handle() {
        if (!window.isListPage) return;
        const scope = await this.getRuntimeService("scope")();
        await this.createMenuBtn(scope), this.bindEvent();
        const e = await storageManager.getSetting("autoPage"), t = this.supportsLiveSorting();
        $("#sort-toggle-btn").prop("disabled", e === _ && !t).attr("title", e === _ && !t ? "瀑布流模式仅支持默认排序" : "选择列表排序方式"),
        (e !== _ || t) && await this.sortItems();
    }
    /** @param {LifecycleScope} scope */
    async createMenuBtn(scope) {
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
            r && (t = $("h2.section-title"));
            const l = this.getRuntimeService("settings").snapshot().sortMethod || "default", d = "当前排序方式: " + ("rateCount" === l ? "评价人数" : "date" === l ? "时间" : "默认");
            t.append(`\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>\n                    ${e ? `\n${hasBlacklist ? `<button type="button" id="addBlacklistBtn" class="jhs-btn ${a}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></button>` : ""}\n${hasBlacklist ? `<button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></button>` : ""}\n${hasListPage ? `<button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="收藏当前搜索全部分页中符合当前筛选的作品"><span>一键收藏所有作品</span></button>` : ""}\n${hasListPage ? `<button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="标记当前搜索全部分页中符合当前筛选的作品为已下载"><span>一键已下载所有作品</span></button>` : ""}\n                    ` : ""}\n                    ${o.includes("/tags") ? `\n ${hasBlacklist ? `<button type="button" id="addBlacklistBtn" class="jhs-btn ${a}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${n}</span></button>` : ""}\n                    ` : ""}\n                </div>\n                <div class="jhs-list-btn-row">\n                    ${hasNewVideo ? `<button type="button" id="newVideoBtn" class="jhs-btn jhs-btn--secondary"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></button>` : ""}\n                    ${hasBlacklist ? `<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>` : ""}\n                    ${c ? "" : this.sortMenuHtml(l || "default", d)}\n                </div>\n            `);
        }
        if (l) {
            const e = o.includes("/star/");
            let t = "加入黑名单", n = "jhs-btn--filter";
            if (e) {
                const e = await storageManager.getBlacklist(), a = this.getActressPageInfo();
                e.find((/** @type {BlacklistRecord} */ e) => e.starId === a.starId) && (t = "已加入黑名单", n = "jhs-btn--muted");
            }
            const a = this.getRuntimeService("settings").snapshot().sortMethod || "default";
            $(".masonry").parent().prepend(`\n                <div class="jhs-list-btn-row">\n                    <button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>\n                    ${e && hasBlacklist ? `    \n                        <button type="button" id="addBlacklistBtn" class="jhs-btn ${n}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${t}</span></button>\n                        <button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>一键屏蔽所有作品</span></button>\n                    ` : ""}${e && hasListPage ? `    \n                        <button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="收藏当前搜索全部分页中符合当前筛选的作品"><span>一键收藏所有作品</span></button>\n                        <button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="标记当前搜索全部分页中符合当前筛选的作品为已下载"><span>一键已下载所有作品</span></button>\n                    ` : ""}${!e && hasBlacklist ? `<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>` : ""}\n                    ${this.sortMenuHtml(a)}\n                </div>\n            `);
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
            let n = {
                clientX: t.clientX,
                clientY: t.clientY + 80
            }, a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            utils.q(n, "一键屏蔽视频列表?", (async () => {
                this.loadObj = loading();
                try {
                    await blacklist?.filterAllVideo?.(i);
                } catch (t) {
                    clog.error(t);
                } finally { this.loadObj.close(); }
            }));
        })), $("#favoriteAllVideo").on("click", (async (/** @type {any} */ t) => {
            let a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            this.loadObj = loading();
            try { await listPage?.batchSaveAllVideos?.(i, h); } catch (t) { clog.error(t); } finally { this.loadObj.close(); }
        })), $("#hasDownAllVideo").on("click", (async (/** @type {any} */ t) => {
            let a = r ? $(".actor-section-name") : $(".avatar-box .photo-info .pb10");
            if (0 === a.length) return void show.error("获取演员名称失败");
            let i = a.text().trim().split(",")[0];
            this.loadObj = loading();
            try { await listPage?.batchSaveAllVideos?.(i, g); } catch (t) { clog.error(t); } finally { this.loadObj.close(); }
        }));
    }
    /** 绑定排序 popover 的选择与键盘交互。 */
    bindSortMenu() {
        const control = $(".jhs-sort-control"), toggle = control.find("#sort-toggle-btn"), menu = control.find(".jhs-sort-menu"), close = (focus = !1) => {
            menu.removeClass("is-open"), toggle.attr("aria-expanded", "false"), focus && toggle.trigger("focus");
        };
        toggle.on("click", ((/** @type {any} */ event) => {
            event.preventDefault(), event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open), toggle.attr("aria-expanded", String(open)), open && menu.find('[aria-checked="true"]').trigger("focus");
        }));
        menu.on("click", ".jhs-sort-option", (async (/** @type {any} */ event) => {
            const item = $(event.currentTarget), method = item.data("sort-method");
            await this.getRuntimeService("settings").set("sortMethod", method), menu.find(".jhs-sort-option").attr("aria-checked", "false"), item.attr("aria-checked", "true"),
            $("#jhs-sort-current").text(item.text()), close(!0), await this.sortItems().catch((error => clog.error("列表排序失败", error)));
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
    async sortItems() {
        const e = this.supportsLiveSorting();
        if (!e && (o.includes("handle") || o.includes("advanced_search"))) return;
        const s = await storageManager.getSetting("autoPage");
        if (c || s === _ && !e) return;
        const t = this.getRuntimeService("settings").snapshot().sortMethod;
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
    isFc2ListPage() {
        return r && "/advanced_search" === window.location.pathname && "3" === new URLSearchParams(window.location.search).get("type");
    }
    supportsLiveSorting() {
        return this.isHitShowPage() || this.isFc2ListPage();
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
