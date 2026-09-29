// @ts-check

import { _, d, g, h } from "../../core/constants.js";
import { hasAnyState, normalizeStateFlags } from "../../core/state-model.js";
import { isHardHidden } from "./list-filters.js";

/** @typedef {import("../../core/lifecycle-scope.js").LifecycleScope} LifecycleScope */
/** @typedef {{ starId?: string }} BlacklistRecord */

/** List-page actions with explicit Feature capabilities and a legacy mobile-bar facade. */
export class ListActionsController {
    /** @param {{hostAdapter: any, list: any, batchController?: any, settings: any, storage: any, ui: any, notifications: any, scope: LifecycleScope, sortController: any, blacklist?: any, newVideo?: any, openNewVideo?: () => unknown, diagnostics?: any, document?: Document, window?: Window & typeof globalThis}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.list = options.list;
        this.batchController = options.batchController ?? null;
        this.settings = options.settings;
        this.storage = options.storage;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.scope = options.scope;
        this.sortController = options.sortController ?? null;
        this.blacklist = options.blacklist ?? null;
        this.newVideo = options.newVideo ?? null;
        this.openNewVideo = options.openNewVideo ?? null;
        this.diagnostics = options.diagnostics ?? null;
        this.document = options.document ?? globalThis.document;
        this.window = options.window ?? globalThis.window;
        this.$ = this.ui.jquery;
        this.started = false;
        this.disposed = false;
        this.managedByFeature = true;
        this.compatibilityRelease = null;
        /** @type {Set<any>} */
        this.activeLoadings = new Set();
    }

    async start() {
        if (this.started || this.hostAdapter.detectRoute?.() !== "list") return false;
        this.scope.assertActive();
        this.started = true;
        await this.createMenuBtn(this.scope);
        this.scope.assertActive();
        this.bindEvent();
        const onSettingsChanged = (/** @type {any} */ event) => {
            if (!event.detail?.names?.includes("autoPage")) return;
            void this.syncSortUi().catch((error) => this.recordError("排序状态同步失败", error));
        };
        this.scope.listen(this.settings, "settings.changed", onSettingsChanged);
        this.scope.addCleanup(() => this.dispose());
        await this.syncSortUi();
        return true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        const $ = this.$;
        $("#waitCheckBtn, #newVideoBtn, #blacklistBtn, #addBlacklistBtn, #filterAllVideo, #favoriteAllVideo, #hasDownAllVideo").off(".jhsListActions").remove();
        $(".jhs-sort-control").off(".jhsListActions").remove();
        const rows = $(".jhs-list-btn-row");
        rows.find("*").addBack().off(".jhsListActions");
        rows.each((/** @type {number} */ _index, /** @type {Element} */ element) => {
            if (!element.querySelector("#top-right-box") && !element.children.length) element.remove();
        });
        for (const handle of [...this.activeLoadings]) this.closeLoading(handle);
        this.compatibilityRelease?.();
        this.compatibilityRelease = null;
        this.sortController = null;
        this.started = false;
        if (!this.scope.disposed) this.scope.dispose();
    }

    /** @param {string} message @param {unknown} error */
    recordError(message, error) {
        this.diagnostics?.recordError?.({
            source: "list-actions", featureId: "list", contributionId: "list.actions",
            message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
        });
    }

    /** @param {() => void} release */
    setCompatibilityRelease(release) { this.compatibilityRelease = release; }

    beginLoading() {
        const handle = this.ui.loading();
        this.activeLoadings.add(handle);
        return handle;
    }

    /** @param {any} handle */
    closeLoading(handle) {
        if (!this.activeLoadings.delete(handle)) return;
        handle?.close?.();
    }

    /** Sync the sort menu with the current setting and live-sort capability. */
    async syncSortUi() {
        const $ = this.$, autoPage = this.settings.snapshot().autoPage ?? _;
        const live = this.sortController?.supportsLiveSorting?.() ?? false;
        const toggle = $("#sort-toggle-btn");
        if (!toggle.length) return;
        const menu = $(".jhs-sort-menu");
        if (autoPage === _ && !live) {
            toggle.prop("disabled", true).attr("title", "瀑布流模式仅支持默认排序");
            $("#jhs-sort-current").text("默认（瀑布流）");
            menu.find(".jhs-sort-option").attr("aria-checked", "false");
            menu.find('[data-sort-method="default"]').attr("aria-checked", "true");
            await this.sortController?.sortItems?.("default");
            return;
        }
        const requestedMethod = this.activeSortMethod();
        const labels = { default: "默认", rateCount: "评价人数", date: "时间" };
        const method = Object.prototype.hasOwnProperty.call(labels, requestedMethod) ? requestedMethod : "default";
        const current = /** @type {Record<string, string>} */ (labels)[method];
        toggle.prop("disabled", false).attr("title", "选择列表排序方式");
        $("#jhs-sort-current").text(current);
        menu.find(".jhs-sort-option").attr("aria-checked", "false");
        menu.find(`[data-sort-method="${method}"]`).attr("aria-checked", "true");
        await this.sortController?.sortItems?.();
    }

    /** @param {LifecycleScope} scope @param {any} [target] */
    async createMenuBtn(scope, target = null) {
        const $ = this.$, pageUrl = new URL(this.hostAdapter.location.href), isJavDb = this.hostAdapter.site === "javdb";
        const isActorPage = isJavDb ? pageUrl.pathname.includes("/actors/") : pageUrl.pathname.includes("/star/");
        const isTagPage = isJavDb && pageUrl.pathname.includes("/tags");
        const hasNewVideo = Boolean(this.newVideo), hasBlacklist = Boolean(this.blacklist), hasList = Boolean(this.list);
        const actorInfo = () => this.blacklist?.getActressPageInfo?.() ?? this.list?.getActressPageInfo?.() ?? {};
        let blacklistLabel = "加入黑名单", blacklistClass = "jhs-btn--filter";
        if (isActorPage && hasBlacklist) {
            const info = actorInfo();
            if (await this.isBlacklisted(info.starId)) {
                blacklistLabel = "已加入黑名单";
                blacklistClass = "jhs-btn--muted";
            }
            scope.assertActive();
        }

        if (isJavDb) {
            let mount = $(".main-tabs, .tabs").first();
            if (isActorPage) mount = $(".toolbar, .section-addition").filter(":last");
            if (pageUrl.pathname.includes("advanced_search")) mount = target?.length ? target : $("h2.section-title");
            const initialSort = this.activeSortMethod();
            const sortTitle = `当前排序方式: ${initialSort === "rateCount" ? "评价人数" : initialSort === "date" ? "时间" : "默认"}`;
            const suppressSort = this.sortController?.isRestrictedContext?.() ?? (pageUrl.href.includes("/search?q") || pageUrl.pathname.includes("/search/") || pageUrl.pathname.includes("/users/"));
            const actorActions = isActorPage && hasBlacklist
                ? `<button type="button" id="addBlacklistBtn" class="jhs-btn ${blacklistClass}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${blacklistLabel}</span></button><button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>批量屏蔽</span></button>`
                : "";
            const batchActions = hasList
                ? `<button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="${this.getBatchActionTip("favorite")}"><span>批量收藏</span></button><button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="${this.getBatchActionTip("download")}"><span>批量标记已下载</span></button>`
                : "";
            const tagAction = isTagPage && hasBlacklist ? '<button type="button" id="addBlacklistBtn" class="jhs-btn jhs-btn--filter"><span>加入黑名单</span></button>' : "";
            const newVideoAction = hasNewVideo ? '<button type="button" id="newVideoBtn" class="jhs-btn jhs-btn--secondary"><span>新作品检测 (<span id="newVideoCount">0</span>)</span></button>' : "";
            const blacklistAction = hasBlacklist ? '<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>' : "";
            const sortAction = suppressSort || !this.supportsSorting() ? "" : this.sortMenuHtml(initialSort, sortTitle);
            mount.append(`<div class="jhs-list-btn-row"><button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>${actorActions}${batchActions}${tagAction}</div><div class="jhs-list-btn-row">${newVideoAction}${blacklistAction}${sortAction}</div>`);
            if (isTagPage && hasBlacklist) this.bindTagBlacklistState(scope);
        } else {
            const initialSort = this.activeSortMethod();
            const actorActions = isActorPage && hasBlacklist
                ? `<button type="button" id="addBlacklistBtn" class="jhs-btn ${blacklistClass}" data-tip="将演员加入黑名单, 后续有作品更新也会纳入屏蔽中"><span>${blacklistLabel}</span></button><button type="button" id="filterAllVideo" class="jhs-btn jhs-btn--watch" data-tip="一键屏蔽已选分类的视频列表至鉴定记录中"><span>批量屏蔽</span></button>`
                : "";
            const batchActions = hasList
                ? `<button type="button" id="favoriteAllVideo" class="jhs-btn jhs-btn--fav" data-tip="${this.getBatchActionTip("favorite")}"><span>批量收藏</span></button><button type="button" id="hasDownAllVideo" class="jhs-btn jhs-btn--down" data-tip="${this.getBatchActionTip("download")}"><span>批量标记已下载</span></button>`
                : "";
            const blacklistAction = !isActorPage && hasBlacklist ? '<button type="button" id="blacklistBtn" class="jhs-btn jhs-btn--secondary"><span>演员黑名单</span></button>' : "";
            const sortAction = this.supportsSorting() ? this.sortMenuHtml(initialSort) : "";
            $(".masonry").parent().prepend(`<div class="jhs-list-btn-row"><button type="button" id="waitCheckBtn" class="jhs-btn jhs-btn--secondary"><span>打开待鉴定</span></button>${actorActions}${batchActions}${blacklistAction}${sortAction}</div>`);
        }

        $("#waitCheckBtn > span").text("开始鉴定");
        const newVideoCount = $("#newVideoCount").detach(), newVideoLabel = $("#newVideoBtn > span");
        if (newVideoLabel.length) newVideoLabel.empty().append(this.document.createTextNode("新作品 ("), newVideoCount, this.document.createTextNode(")"));
    }

    async readBlacklist() {
        const value = await this.storage.get("blacklist");
        return Array.isArray(value) ? value : [];
    }

    /** @param {unknown} starId */
    async isBlacklisted(starId) {
        return (await this.readBlacklist()).some((/** @type {BlacklistRecord} */ item) => item.starId === starId);
    }

    /** @param {LifecycleScope} scope */
    bindTagBlacklistState(scope) {
        const button = this.$("#addBlacklistBtn"), MutationObserverType = this.window.MutationObserver;
        if (!this.document.body || !this.document.querySelector("#jhs-check-tag") || !MutationObserverType) return;
        const update = async () => {
            const tag = this.$("#jhs-check-tag").text().trim();
            if (!tag || scope.disposed) return false;
            button.attr("data-tip", "将当前分类标签加入到黑名单, 后续有作品更新也会纳入屏蔽中");
            const blacklisted = await this.isBlacklisted(`no-${tag}`);
            if (scope.disposed || this.$("#jhs-check-tag").text().trim() !== tag) return false;
            if (blacklisted) button.addClass("jhs-btn--muted").removeClass("jhs-btn--filter").find("span").text("已加入黑名单");
            return true;
        };
        const observer = new MutationObserverType(() => {
            void update().then((ready) => ready && scope.releaseObserver(observer)).catch((error) => this.recordError("分类黑名单状态读取失败", error));
        });
        observer.observe(this.document.body, { childList: true, characterData: true, subtree: true });
        scope.ownObserver(observer);
        void update().then((ready) => ready && scope.releaseObserver(observer)).catch((error) => this.recordError("分类黑名单状态读取失败", error));
    }

    /** @param {unknown} method @param {string} [title] */
    sortMenuHtml(method, title = "选择列表排序方式") {
        const labels = { default: "默认", rateCount: "评价人数", date: "时间" };
        const key = typeof method === "string" && method in labels ? /** @type {keyof typeof labels} */ (method) : "default";
        const current = labels[key];
        return `<div class="jhs-sort-control"><button type="button" id="sort-toggle-btn" class="jhs-btn jhs-btn--secondary" aria-haspopup="menu" aria-expanded="false" title="${title}"><span id="jhs-sort-current">${current}</span></button><div class="jhs-popover jhs-sort-menu" role="menu" aria-label="排序方式">${Object.entries(labels).map(([value, label]) => `<button type="button" class="jhs-btn jhs-btn--ghost jhs-sort-option" role="menuitemradio" aria-checked="${value === method}" data-sort-method="${value}" tabindex="-1">${label}</button>`).join("")}</div></div>`;
    }

    bindEvent() {
        const $ = this.$;
        $("#waitCheckBtn").on("click.jhsListActions", () => {
            void this.openWaitCheck().catch((error) => this.recordError("待鉴定列表打开失败", error));
        });
        $("#newVideoBtn").on("click.jhsListActions", () => {
            const opening = this.openNewVideo ? this.openNewVideo() : this.newVideo?.openDialog?.();
            void Promise.resolve(opening).catch((error) => this.recordError("新作品工作区打开失败", error));
        });
        $("#blacklistBtn").on("click.jhsListActions", () => this.blacklist?.openBlacklistDialog?.());
        this.bindSortMenu();
        $("#addBlacklistBtn").on("click.jhsListActions", (/** @type {any} */ event) => {
            void Promise.resolve(this.blacklist?.addBlacklist?.(event)).catch((error) => this.recordError("加入黑名单失败", error));
        });
        $("#filterAllVideo").on("click.jhsListActions", async () => {
            const name = this.getActorName();
            if (!name) return this.notifications.error("获取演员名称失败");
            /** @type {{kind: "actor", displayName: string, recordName: string}} */
            const batchScope = { kind: "actor", displayName: String(name), recordName: String(name) };
            await this.runBatch(d, "批量屏蔽失败", batchScope);
        });
        $("#favoriteAllVideo").on("click.jhsListActions", () => { void this.runBatch(h); });
        $("#hasDownAllVideo").on("click.jhsListActions", () => { void this.runBatch(g); });
    }

    /** @param {string} flag @param {string} [errorMessage] @param {{kind?: "actor" | "search", displayName?: string, recordName?: string}} [batchScope] */
    async runBatch(flag, errorMessage = "批量列表操作失败", batchScope = /** @type {{kind?: "actor" | "search", displayName?: string, recordName?: string}} */ (this.buildBatchScope())) {
        try {
            if (this.batchController) await this.batchController.run(batchScope, flag);
            else await this.list?.batchSaveAllVideos?.(batchScope, flag);
        }
        catch (error) { this.recordError(errorMessage, error); }
    }

    /** Bind the sort popover's pointer and keyboard controls. */
    bindSortMenu() {
        const $ = this.$, control = $(".jhs-sort-control");
        if (!control.length) return;
        const toggle = control.find("#sort-toggle-btn"), menu = control.find(".jhs-sort-menu");
        const close = (focus = false) => {
            menu.removeClass("is-open");
            toggle.attr("aria-expanded", "false");
            if (focus) toggle.trigger("focus");
        };
        toggle.on("click.jhsListActions", (/** @type {any} */ event) => {
            event.preventDefault();
            event.stopPropagation();
            const open = !menu.hasClass("is-open");
            menu.toggleClass("is-open", open);
            toggle.attr("aria-expanded", String(open));
            if (open) menu.find('[aria-checked="true"]').trigger("focus");
        });
        menu.on("click.jhsListActions", ".jhs-sort-option", async (/** @type {any} */ event) => {
            const item = $(event.currentTarget), method = item.data("sort-method");
            const previousItem = menu.find('.jhs-sort-option[aria-checked="true"]').first();
            const previousLabel = $("#jhs-sort-current").text();
            menu.find(".jhs-sort-option").attr("aria-checked", "false");
            item.attr("aria-checked", "true");
            $("#jhs-sort-current").text(item.text());
            close(true);
            try { await this.selectSortMethod(method); }
            catch (error) {
                menu.find(".jhs-sort-option").attr("aria-checked", "false");
                previousItem.attr("aria-checked", "true");
                $("#jhs-sort-current").text(previousLabel);
                this.recordError("排序设置保存失败，已恢复", error);
                this.notifications.error("排序设置保存失败，已恢复原设置");
            }
        }).on("keydown.jhsListActions", ".jhs-sort-option", (/** @type {any} */ event) => {
            const items = menu.find(".jhs-sort-option"), index = items.index(event.currentTarget);
            if (event.key === "Escape") { event.preventDefault(); close(true); return; }
            if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : event.key === "ArrowDown" ? (index + 1) % items.length : (index - 1 + items.length) % items.length;
            items.eq(next).trigger("focus");
        });
        const onDocumentClick = (/** @type {Event} */ event) => {
            if (!$(/** @type {any} */ (event.target)).closest(control).length) close();
        };
        this.scope.listen(this.document, "click", onDocumentClick);
    }

    /** @param {string} [methodOverride] */
    sortItems(methodOverride) { return this.sortController?.sortItems?.(methodOverride); }
    isHitShowPage() { return this.hostAdapter.getPageContext?.()?.kind === "playback-ranking"; }
    isOwnedRankingPage() { return this.sortController?.isOwnedRankingPage?.() ?? false; }
    isExternalFc2CatalogPage() { return this.sortController?.isExternalFc2CatalogPage?.() ?? false; }

    /** @param {"favorite" | "download"} action */
    getBatchActionTip(action) {
        const page = this.isOwnedRankingPage() ? "当前榜单页面" : this.isExternalFc2CatalogPage() ? "当前片库页面" : "当前搜索全部分页";
        return action === "favorite" ? `收藏${page}中符合当前筛选的作品` : `标记${page}中符合当前筛选的作品为已下载`;
    }

    activeSortMethod() { return this.sortController?.activeSortMethod?.() ?? "default"; }
    /** @param {string} method */
    async selectSortMethod(method) { return this.sortController?.selectSortMethod?.(method); }
    isFc2ListPage() { return this.sortController?.isFc2ListPage?.() ?? false; }
    supportsSorting() { return this.sortController?.supportsSorting?.() ?? true; }
    supportsLiveSorting() { return this.sortController?.supportsLiveSorting?.() ?? false; }

    getActorName() {
        const selector = this.hostAdapter.site === "javdb" ? ".actor-section-name" : ".avatar-box .photo-info .pb10";
        return this.$(selector).text().trim().split(",")[0].replace("(無碼)", "");
    }

    buildBatchScope() {
        const path = this.hostAdapter.location.pathname;
        const isActorPage = this.hostAdapter.site === "javdb" ? path.includes("/actors/") : path.includes("/star/");
        if (!isActorPage) {
            const displayName = this.isOwnedRankingPage() ? "当前榜单页面" : this.isExternalFc2CatalogPage() ? "当前片库页面" : "当前搜索条件";
            return { kind: "search", displayName, recordName: "" };
        }
        const info = this.blacklist?.getActressPageInfo?.() ?? this.list?.getActressPageInfo?.() ?? {};
        return { kind: "actor", displayName: info.name || "", recordName: info.name || "" };
    }

    async openWaitCheck() {
        const selectors = this.hostAdapter.getListSelectors?.() ?? this.list?.getSelector?.();
        if (!this.list || !selectors?.itemSelector) return this.notifications.info("列表功能已禁用");
        const requestedCount = Number(this.settings.snapshot().waitCheckCount ?? 5);
        const limit = Number.isFinite(requestedCount) && requestedCount > 0 ? Math.floor(requestedCount) : 5;
        let opened = 0;
        for (const element of this.$(selectors.itemSelector).toArray()) {
            this.scope.assertActive();
            if (opened >= limit) break;
            const item = this.$(element);
            let flags, visibilityReasons;
            try {
                flags = normalizeStateFlags(JSON.parse(item.attr("data-jhs-flags") || "{}"));
                visibilityReasons = JSON.parse(item.attr("data-jhs-visibility") || "{}");
            } catch (error) {
                this.recordError("跳过状态数据无效的列表项", error);
                continue;
            }
            if (hasAnyState(flags) || isHardHidden(flags, visibilityReasons)) continue;
            await this.list.openMovieDetail(item, { autoplay: true, newTab: false });
            opened += 1;
        }
        if (!opened) this.notifications.info("没有需鉴定的视频");
    }
}
