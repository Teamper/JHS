// @ts-check
import { newVideoPagination } from "./new-video-pagination.js";

import { OwnedPopover } from "../../core/owned-popover.js";
import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { getIcon } from "../../core/icons.js";
import { createBodyFilterMatcher, hasActiveBodyFilter } from "../../core/actress-measurements.js";
import { _, escapeHtml, normalizeCarNum } from "../../core/constants.js";
import { mapLimit } from "../../core/feature-helpers.js";
import { hasAnyState } from "../../core/state-model.js";
import { JhsSelect, renderStateView } from "../../core/ui-primitives.js";

/** @typedef {import("./new-video-workspace-service.js").NewVideoWorkspaceService} NewVideoWorkspaceService */
/** @typedef {import("./new-video-workspace-service.js").MovieCover} MovieCover */
/** @typedef {import("./new-video-workspace-service.js").StateRecord} StateRecord */
/** @typedef {import("./new-video-workspace-service.js").JQueryEvent} JQueryEvent */
/** @typedef {import("./new-video-workspace-service.js").JQueryInputEvent} JQueryInputEvent */
/** @typedef {import("./new-video-workspace-service.js").MovieRow} MovieRow */

/** @param {NewVideoWorkspaceService} owner */
export async function applyNewVideoRemovals(owner, /** @type {Set<string>} */ carNums) {
    if (owner.nvWorkspaceFullReloadRequested) return;
    const generation = owner.nvRenderGeneration, container = owner.jquery("#new-video-list-container"), root = container[0];
    const cards = container.find(".nv-card").filter((/** @type {number} */ _, /** @type {HTMLElement} */ card) => carNums.has(normalizeCarNum(owner.jquery(card).attr("data-car")) ?? ""));
    carNums.forEach(carNum => { owner.nvAllItemsMap.delete(carNum); owner.nvSelected.delete(carNum); });
    // Pagination can interrupt the animation; its data must already reflect the committed removal.
    owner.nvFlatListCache = owner.nvFlatListCache.filter(item => !carNums.has(normalizeCarNum(item.carNum) ?? ''));
    owner.nvCurrentPageItems = (owner.nvCurrentPageItems || []).filter(item => !carNums.has(normalizeCarNum(item.carNum) ?? ''));
    owner.nvActressesCache = owner.nvActressesCache.map(actress => Array.isArray(actress.newVideoList) ? {
        ...actress, newVideoList: actress.newVideoList.filter(item => !carNums.has(normalizeCarNum(typeof item === "string" ? item : item?.carNum) ?? ""))
    } : actress);
    const previewTarget = owner.nvCoverPreview?.currentTarget;
    if (previewTarget && Array.from(cards).some(card => (/** @type {HTMLElement} */ (card)).contains(previewTarget))) owner.nvCoverPreview?.hidePreview();
    const duration = owner.window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ? 0 : 180;
    cards.each((/** @type {number} */ _, /** @type {HTMLElement} */ card) => owner.nvRemovingCards.add(card));
    try {
        // Only fade opacity: keep the grid height stable until the replacement cards are ready.
        await Promise.all(cards.toArray().map((/** @type {HTMLElement} */ card) => new Promise(resolve => {
            owner.jquery(card).animate({ opacity: 0 }, duration, resolve);
        })));
    } finally {
        cards.each((/** @type {number} */ _, /** @type {HTMLElement} */ card) => owner.nvRemovingCards.delete(card));
    }
    if (!owner.isWorkspaceMounted() || generation !== owner.nvRenderGeneration || root !== owner.jquery("#new-video-list-container")[0] || owner.nvWorkspaceFullReloadRequested) return;
    /** @type {Array<{element: HTMLElement, top: number, left: number}>} */
    const positions = container.add(container.parentsUntil(owner.nvWorkspaceRoot || ".newVideoToolBox")).add(owner.nvWorkspaceRoot || container.closest(".newVideoToolBox"))
        .map((/** @type {number} */ _, /** @type {HTMLElement} */ element) => ({ element, top: element.scrollTop, left: element.scrollLeft })).get();
    await owner.renderNewVideoList({ incremental: !0 });
    if (owner.isWorkspaceMounted() && generation === owner.nvRenderGeneration && root === owner.jquery("#new-video-list-container")[0]) {
        positions.forEach(({ element, top, left }) => { element.scrollTop = top; element.scrollLeft = left; });
    }
}

/** @param {NewVideoWorkspaceService} owner */
export async function getNewVideoFlatList(owner) {
    const category = owner.jquery("#nvCategoryFilter").val() || "all", stateFilter = owner.jquery("#nvStateFilter").val() || "pending", decisionFilter = owner.jquery("#nvDecisionFilter").val() || "pending", query = String(owner.jquery("#nvSearch").val() || "").trim().toUpperCase();
    const bodyFilter = owner.readBodyFilter(), bodyActive = hasActiveBodyFilter(bodyFilter), bodyMatcher = createBodyFilterMatcher(bodyFilter);
    return [ ...owner.nvAllItemsMap.values() ].filter((item => {
        const categoryMatch = "all" === category || "vr" === category ? "all" === category || item.isVr : "unknown" === category ? 0 === item.categories.length : item.categories.includes(category);
        const stateMatch = "all" === stateFilter || "pending" === stateFilter ? "all" === stateFilter || !hasAnyState(item.flags) : !!item.flags[/** @type {keyof MovieRow["flags"]} */ (stateFilter)];
        const decisionMatch = "all" === decisionFilter || item.decisionState === decisionFilter;
        const searchMatch = !query || `${item.carNum} ${item.title} ${item.actressName}`.toUpperCase().includes(query);
        const bodyMatch = !bodyActive || owner.matchesNewVideoBodyFilter(item, bodyMatcher);
        return categoryMatch && stateMatch && decisionMatch && searchMatch && bodyMatch;
    })).sort(((left, right) => (right.publishTime || "").localeCompare(left.publishTime || "")));
}

/** @param {NewVideoWorkspaceService} owner */
export function getActorCoverRequest(owner, /** @type {string} */ starId, /** @type {Map<string, Promise<Map<string, MovieCover>>>} */ requestMap) {
    const existing = requestMap.get(starId);
    if (existing) return existing;
    /** @type {Promise<Map<string, MovieCover>>} */
    const request = owner.getRuntimeService("scope")().then(((/** @type {LifecycleScope} */ scope) => owner.getRuntimeService("actressInfo").movies("javdb", { actorId: starId, baseUrl: owner.nvJavDbUrl }, { scope }))).then(((/** @type {StateRecord[]} */ movies) => {
        /** @type {Map<string, MovieCover>} */ const covers = new Map();
        movies.forEach(((/** @type {StateRecord} */ movie) => { const carNum = normalizeCarNum(movie.carNum); if (carNum && movie.coverUrl) covers.set(carNum, { coverUrl: movie.coverUrl, title: movie.title }); }));
        return covers;
    })).finally((() => {
        requestMap.get(starId) === request && requestMap.delete(starId);
    }));
    return requestMap.set(starId, request), request;
}

/** @param {NewVideoWorkspaceService} owner */
export async function loadCoverForItems(owner, /** @type {MovieRow[]} */ items, generation = owner.nvRenderGeneration) {
    return owner.hydrateVisibleCovers(items, generation);
}

/** @param {NewVideoWorkspaceService} owner */
export async function hydrateVisibleCovers(owner, /** @type {MovieRow[]} */ items, /** @type {number} */ generation) {
    const coverCache = owner.nvCoverCache, requestMap = owner.nvActorCoverRequests, starIds = [ ...new Set(items.filter(((/** @type {StateRecord} */ item) => !item.coverUrl && !coverCache.has(normalizeCarNum(item.carNum) ?? '') && item.starId)).map(((/** @type {StateRecord} */ item) => item.starId))) ];
    await mapLimit(starIds, 3, (async starId => {
        try {
            const covers = await owner.getActorCoverRequest(starId, requestMap);
            if (generation !== owner.nvRenderGeneration || coverCache !== owner.nvCoverCache || !owner.isWorkspaceMounted()) return;
            covers.forEach(((value, carNum) => {
                coverCache.set(carNum, value.coverUrl);
                const card = owner.jquery(".nv-card").filter(((/** @type {number} */ _, /** @type {HTMLElement} */ element) => normalizeCarNum(owner.jquery(element).attr("data-car")) === normalizeCarNum(carNum)));
                if (!card.length) return;
                const image = owner.jquery('<img class="nv-cover-img" loading="lazy">').attr({ src: value.coverUrl, "data-full": value.coverUrl }).on("error", ((/** @type {JQueryEvent} */ event) => {
                    owner.jquery(event.currentTarget).addClass("jhs-is-hidden").siblings('[data-jhs-role="cover-fallback"]').removeClass("jhs-is-hidden");
                }));
                card.find(".nv-placeholder").before(image).removeClass("nv-placeholder").text("暂无封面"), card.find(".nv-card__empty").addClass("jhs-is-hidden"), value.title && card.attr("title", value.title);
            }));
        } catch (error) {
            owner.logger.warn(`获取演员封面失败: ${starId}`, error);
        }
    })).finally(() => {
        if (generation !== owner.nvRenderGeneration || coverCache !== owner.nvCoverCache || !owner.isWorkspaceMounted()) return;
        for (const item of items) {
            const card = owner.jquery(".nv-card").filter(((/** @type {number} */ _, /** @type {HTMLElement} */ element) => normalizeCarNum(owner.jquery(element).attr("data-car")) === normalizeCarNum(item.carNum)));
            card.find(".nv-placeholder").text("暂无封面");
        }
    });
}

/** @param {NewVideoWorkspaceService} owner */
export function pruneNewVideoSelection(owner) {
    for (const carNum of [ ...owner.nvSelected ]) owner.nvAllItemsMap.has(carNum) || owner.nvSelected.delete(carNum);
}

/** @param {NewVideoWorkspaceService} owner */
export async function renderNewVideoList(owner, { incremental = !1 } = {}) {
    const jquery = owner.jquery;
    const container = owner.jquery("#new-video-list-container"), generation = owner.nvRenderGeneration;
    if (!container.length || owner.renderWorkspaceLoading(container)) return;
    container.attr("aria-busy", "false");
    const items = await owner.getNewVideoFlatList();
    if (generation !== owner.nvRenderGeneration || !owner.isWorkspaceMounted()) return;
    owner.pruneNewVideoSelection();
    incremental || owner.jquery("#nv-pagination-bar").remove();
    owner.nvFlatListCache = items, owner.nvSortBy = owner.jquery("#nvSortBy").val() || owner.nvSortBy;
    const totalPages = Math.ceil(items.length / owner.nvPageSize);
    owner.nvCurrentPage = totalPages ? Math.min(owner.nvCurrentPage, totalPages) : 1;
    if (!items.length) {
        owner.nvCurrentPageItems = [], owner.jquery("#nv-pagination-bar").remove();
        const bodyFilter = owner.readBodyFilter();
        const query = String(owner.jquery("#nvSearch").val() || "").trim(), filtered = [ "nvCategoryFilter", "nvStateFilter", "nvDecisionFilter" ].some((id => owner.jquery("#" + id).val() !== ("nvCategoryFilter" === id ? "all" : "pending"))) || hasActiveBodyFilter(bodyFilter);
        if (!owner.nvAllItemsMap.size) renderStateView(container, { type: "empty", title: "暂无新作品记录" }); else if (query) renderStateView(container, { type: "empty", title: `未找到「${query}」的影片`, actionLabel: "清除搜索", onAction: () => {
            owner.jquery("#nvSearch").val(""), void owner.refreshCurrentView({ resetPage: true });
        } }); else if (filtered) renderStateView(container, { type: "empty", title: "暂无符合筛选的影片", actionLabel: "清除筛选", onAction: () => {
            JhsSelect.setValue("#nvCategoryFilter", "all", !1), JhsSelect.setValue("#nvStateFilter", "pending", !1), JhsSelect.setValue("#nvDecisionFilter", "pending", !1), owner.resetBodyFilter(), void owner.refreshCurrentView({ resetPage: true });
        } }); else renderStateView(container, { type: "empty", title: "暂无待处理的新作品" });
        return void owner.renderBatchBar();
    }
    owner.nvRenderPage(generation, { incremental }), owner.renderBatchBar();
}

/** @param {NewVideoWorkspaceService} owner */
export function selectedItems(owner) {
    return [...owner.nvSelected].map(carNum => owner.nvAllItemsMap.get(carNum)).filter(item => item !== undefined);
}

/** @param {NewVideoWorkspaceService} owner */
export function applyProcessedSelection(owner, /** @type {{changed?: unknown[]} | undefined} */ result) {
    (result?.changed ?? []).map(normalizeCarNum).forEach(carNum => { if (carNum) owner.nvSelected.delete(carNum); });
    owner.renderBatchBar();
}

/** @param {NewVideoWorkspaceService} owner */
export async function runBatchMutation(owner, /** @type {string} */ action, /** @type {(items: MovieRow[]) => Promise<any>} */ mutate, /** @type {string} */ successLabel) {
    const items = owner.selectedItems();
    if (!items.length) return void owner.notifications.info("请选择影片");
    try {
        const result = await (owner.featureNewVideoBatchController?.run ? owner.featureNewVideoBatchController.run(action, items) : mutate(items));
        owner.applyProcessedSelection(result), result?.changed?.length ? owner.notifications.ok(`${successLabel} ${result.changed.length} 个番号`) : owner.notifications.info("没有需要更新的项目");
    } catch (error) {
        owner.logger.error("批量操作失败", error), owner.notifications.error("批量更新失败，请重试");
    }
}

/** @param {NewVideoWorkspaceService} owner */
export function bindBatchActions(owner) {
    const footer = owner.jquery("#new-video-list-footer");
    footer.off(".jhsNvBatch").on("click.jhsNvBatch", "#nvSelectPage,#nvSelectFiltered", (/** @type {JQueryEvent} */ event) => {
        (event.currentTarget.id === "nvSelectFiltered" ? owner.nvFlatListCache : owner.nvCurrentPageItems || []).forEach(item => owner.nvSelected.add(normalizeCarNum(item.carNum) ?? item.carNum));
        owner.jquery("#new-video-list-container .nv-select").prop("checked", true); owner.renderBatchBar();
    }).on("click.jhsNvBatch", "#nvClearSelection", () => {
        owner.nvSelected.clear(); owner.jquery("#new-video-list-container .nv-select").prop("checked", false); owner.renderBatchBar();
    }).on("click.jhsNvBatch", "[data-nv-batch]", (/** @type {JQueryEvent} */ event) => owner.executeBatchAction(event.currentTarget.id, event));
}

/** @param {NewVideoWorkspaceService} owner */
export function executeBatchAction(owner, /** @type {string} */ id, /** @type {JQueryEvent} */ event) {
    /** @type {Record<string, string>} */
    const flags = { batchMarkFavorite: "favorite", batchMarkWatched: "watched", batchMarkDownloaded: "downloaded", batchMarkBlocked: "blocked" };
    const flag = flags[id];
    if (flag) return void owner.runBatchMutation(flag, items => owner.getRuntimeService("state").patch(items.map(item => item.carNum), { [flag]: true }, { type: "new-video-batch-state", records: items.map(item => ({ carNum: item.carNum, url: item.url || `/search?q=${encodeURIComponent(item.carNum)}`, names: item.actressName, publishTime: item.publishTime })) }), "已处理");
    if (id === "batchIgnore") return void owner.runBatchMutation("ignore", items => owner.getRuntimeService("state").setNewVideoDecision(items.map(item => item.carNum), "ignored"), "已忽略");
    if (id === "batchSnooze") return void owner.runBatchMutation("snooze", items => owner.getRuntimeService("state").setNewVideoDecision(items.map(item => item.carNum), "snoozed", new Date(Date.now() + 7 * 864e5).toISOString()), "已暂缓");
    if (id === "batchRestore") return void owner.runBatchMutation("restore", items => owner.getRuntimeService("state").setNewVideoDecision(items.map(item => item.carNum), null), "已恢复");
    const items = owner.selectedItems();
    if (id === "batchRemoveFromNewVideo" && items.length) owner.utils.q(event, `从新作品列表移除 ${items.length} 部影片？<br>保留影片状态记录`, () => void owner.runBatchMutation("remove", selected => owner.getRuntimeService("state").removeFromNewVideoList(selected.map(item => item.carNum), "manual"), "已移除"), undefined, { confirmText: "移除", tone: "danger" });
}

/** @param {NewVideoWorkspaceService} owner */
export function renderBatchBar(owner) {
    const active = owner.document.activeElement, restoreFocus = owner.batchPopover?.opened && owner.batchPopover.menu.contains(active);
    owner.batchPopover?.close(); owner.batchPopover = null;
    const footer = owner.jquery("#new-video-list-footer");
    if (!footer.length) return;
    const actresses = new Set(owner.nvFlatListCache.flatMap(item => item.actresses || [item.actressName]).filter(Boolean)), selected = owner.nvSelected.size;
    const visibleSelected = owner.nvFlatListCache.filter(item => owner.nvSelected.has(normalizeCarNum(item.carNum) ?? '')).length;
    const summary = selected ? `<span class="jhs-new-video-selection" title="${visibleSelected !== selected ? `当前结果中 ${visibleSelected} 项` : ''}">已选 <b>${selected}</b> 项</span>` : `<span>共 <b>${owner.nvFlatListCache.length}</b> 个番号，涉及 <b>${actresses.size}</b> 位演员</span>`;
    const primary = [["batchMarkFavorite", "收藏"], ["batchMarkWatched", "已观看"], ["batchMarkDownloaded", "已下载"]];
    const secondary = [["batchMarkBlocked", "屏蔽"], ["batchIgnore", "忽略"], ["batchSnooze", "暂缓 7 天"], ["batchRestore", "恢复"], ["batchRemoveFromNewVideo", "从新作品列表移除"]];
    const action = (/** @type {string[]} */ [id, label], menu = false) => `<button type="button" id="${id}" data-nv-batch class="jhs-btn ${id === "batchRemoveFromNewVideo" ? "jhs-btn--danger" : menu ? "jhs-btn--ghost" : "jhs-btn--secondary"}"${menu ? ' role="menuitem"' : ''}>${label}</button>`;
    const commands = owner.nvCompact ? [...primary, ...secondary] : secondary;
    const controls = selected ? `${owner.nvCompact ? "" : primary.map(item => action(item)).join("")}<details class="jhs-new-video-batch__more"><summary class="jhs-btn jhs-btn--secondary" aria-haspopup="menu" aria-expanded="false">${owner.nvCompact ? "批量操作" : "更多"}${getIcon("chevron-down")}</summary><div class="jhs-popover jhs-new-video-batch__menu" role="menu" aria-label="批量操作">${commands.map(item => action(item, true)).join("")}</div></details><button type="button" class="jhs-btn jhs-btn--ghost" id="nvClearSelection">取消选择</button>` : "";
    footer.html(`<div class="jhs-new-video-batch">${summary}<div class="jhs-new-video-batch__actions"><button type="button" class="jhs-btn jhs-btn--secondary" id="nvSelectPage">全选当前页</button><button type="button" class="jhs-btn jhs-btn--ghost" id="nvSelectFiltered">全选筛选结果</button>${controls}</div></div>`);
    owner.bindBatchPopover(footer);
    const focus = restoreFocus ? ".jhs-new-video-batch__more summary" : ["nvSelectPage", "nvSelectFiltered", "nvClearSelection"].includes(active?.id ?? '') ? selected ? `#${active?.id}` : "#nvSelectPage" : null;
    if (focus) footer.find(focus).trigger("focus");
}

/** @param {NewVideoWorkspaceService} owner */
export function bindBatchPopover(owner, /** @type {any} */ footer) {
    const details = footer.find(".jhs-new-video-batch__more"), anchor = details.find("summary"), menu = details.find("[role=menu]");
    if (!anchor.length || !menu.length) return;
    const popover = owner.batchPopover = new OwnedPopover(anchor[0], menu[0]);
    anchor.on("click", (/** @type {JQueryEvent} */ event) => { event.preventDefault(); popover.opened ? popover.close(true) : popover.open(); });
    menu.on("click", "button", (/** @type {JQueryEvent} */ event) => {
        event.preventDefault(); event.stopPropagation(); const id = event.currentTarget.id;
        popover.close(); owner.executeBatchAction(id, event);
    });
}

/** @param {NewVideoWorkspaceService} owner */
export function nvSortList(owner, /** @type {MovieRow[]} */ e) {
    const t = owner.nvSortBy || "publishTime_desc", [n, a] = t.split("_");
    return e.slice().sort(((e, t) => {
        let i = 0;
        switch (n) {
          case "publishTime":
            i = (e.publishTime || "").localeCompare(t.publishTime || "");
            break;
          case "actress":
            i = (e.actressName || "").localeCompare(t.actressName || "");
            break;
          case "carNum":
            i = (e.carNum || "").localeCompare(t.carNum || "");
            break;
          case "score":
            i = (e.score || 0) - (t.score || 0);
            break;
          case "voteCount":
            i = (e.voteCount || 0) - (t.voteCount || 0);
            break;
        }
        return "desc" === a ? -i : i;
    }));
}

/** @param {NewVideoWorkspaceService} owner */
export function nvCardHtml(owner, /** @type {MovieRow} */ n) {
    const r = owner.nvJavDbUrl;
    let c = "";
    const key = normalizeCarNum(n.carNum) ?? n.carNum, e = escapeHtml(key), t = escapeHtml(n.title || key), cachedCover = owner.nvCoverCache.get(key), a = escapeHtml((cachedCover || n.coverUrl || "").replace("thumbs", "covers")), i = escapeHtml(n.url || `${r}/search?q=${encodeURIComponent(key)}`), voteCount = escapeHtml(String(n.voteCount || ""));
    let o = `番号：${e}\n演员：${escapeHtml(n.actressName)}\n发行：${escapeHtml(String(n.publishTime || "未知"))}`;
    n.voteCount && (o += `\n评价人数：${voteCount}`);
    const score = Number(n.score);
    const l = score > 0 ? `<span class="jhs-badge jhs-badge--neutral nv-card__rating">${score.toFixed(1)} 分${n.voteCount ? " · " + voteCount + " 人评价" : ""}</span>` : n.voteCount ? `<span class="jhs-badge jhs-badge--neutral nv-card__rating">${voteCount} 人评价</span>` : "";
    c += `<div class="nv-card jhs-media-card" data-car="${e}" title="${o}"><header class="jhs-media-card__header"><strong class="nv-card__title">${e}</strong><label class="jhs-choice"><input type="checkbox" class="nv-select" aria-label="选择影片 ${e}" value="${e}" ${owner.nvSelected.has(key) ? "checked" : ""}></label></header>`;
    c += `<a class="nv-card__link" href="${i}" target="_blank" rel="noopener noreferrer">`;
    c += `<div class="nv-card__cover">`;
    a ? c += `<img class="nv-cover-img" src="${a}" data-full="${a}" loading="lazy" onerror="this.classList.add('jhs-is-hidden');this.closest('.nv-card__cover').querySelector('[data-jhs-role=cover-fallback]').classList.remove('jhs-is-hidden');">${l}<div class="nv-card__empty jhs-is-hidden" data-jhs-role="cover-fallback">暂无封面</div>` : c += `<div class="nv-placeholder nv-card__empty" data-jhs-role="cover-fallback">加载中…</div>`;
    c += `</div>`;
    c += `<div class="nv-card__body">`;

    c += `<div class="nv-card__actress" title="${escapeHtml(n.actressName)}">${escapeHtml(n.actressName)}</div>`;
    n.publishTime && (c += `<div class="nv-card__date">${escapeHtml(String(n.publishTime))}</div>`);
    n.decisionState && "pending" !== n.decisionState && (c += `<span class="jhs-badge jhs-badge--neutral">${"ignored" === n.decisionState ? "已忽略" : "dismissed" === n.decisionState ? "已移除" : "已暂缓"}</span>`), c += `</div></a></div>`;
    return c;
}

/** @param {NewVideoWorkspaceService} owner */
export function nvRenderPage(owner, generation = owner.nvRenderGeneration, { incremental = !1 } = {}) {
    if (generation !== owner.nvRenderGeneration) return;
    owner.pruneNewVideoSelection();
    const e = owner.nvFlatListCache;
    if (!e || 0 === e.length) return void owner.renderNewVideoList();
    const t = owner.nvSortList(e), n = owner.nvPageSize, o = Math.ceil(t.length / n);
    owner.nvCurrentPage = Math.max(1, Math.min(owner.nvCurrentPage, o));
    const a = (owner.nvCurrentPage - 1) * n, i = a + n, s = t.slice(a, i);
    owner.nvCurrentPageItems = s;
    owner.jquery("#nv-pagination-bar").remove();
    const l = owner.jquery("#new-video-list-container"), grid = l.find("#nv-grid");
    incremental = incremental && grid.length > 0;
    const existingCards = incremental ? new Map(grid.children(".nv-card").toArray().map((/** @type {HTMLElement} */ card) => [ normalizeCarNum(owner.jquery(card).attr("data-car")), card ])) : new Map;
    const focusedCard = owner.jquery(owner.document.activeElement).closest(".nv-card")[0], focusIndex = grid.children(".nv-card").index(focusedCard);
    let c = "";
    c += '<div id="nv-grid" class="jhs-new-video-grid">';
    for (const item of s) {
        if (!incremental || !existingCards.has(normalizeCarNum(item.carNum))) c += owner.nvCardHtml(item);
    }
    c += "</div>";
    if (o > 1) {
        c += `<div id="nv-pagination-bar" class="jhs-new-video-pagination">${newVideoPagination({page:owner.nvCurrentPage, pages:o, total:t.length, attribute:"data-nvpage"})}</div>`;
    }
    let createdCards;
    if (incremental) {
        const content = owner.jquery(c), additions = content.filter("#nv-grid").children(".nv-card");
        const wanted = new Set(s.map((/** @type {MovieRow} */ item) => normalizeCarNum(item.carNum))), added = new Map(additions.toArray().map((/** @type {HTMLElement} */ card) => [ normalizeCarNum(owner.jquery(card).attr("data-car")), card ]));
        grid.children(".nv-card").filter((/** @type {number} */ _, /** @type {HTMLElement} */ card) => !wanted.has(normalizeCarNum(owner.jquery(card).attr("data-car")))).remove();
        let cursor = grid[0].firstElementChild;
        for (const item of s) {
            const key = normalizeCarNum(item.carNum), card = existingCards.get(key) || added.get(key);
            if (card === cursor) cursor = cursor.nextElementSibling;
            else grid[0].insertBefore(card, cursor);
            owner.jquery(card).find(".nv-select").prop("checked", owner.nvSelected.has(key ?? ""));
        }
        l.append(content.filter("#nv-pagination-bar"));
        createdCards = additions;
        if (focusIndex >= 0 && !wanted.has(normalizeCarNum(owner.jquery(focusedCard).attr("data-car")))) {
            grid.children(".nv-card").eq(Math.min(focusIndex, s.length - 1)).find(".nv-card__link")[0]?.focus({ preventScroll: !0 });
        }
    } else {
        l.html(c), createdCards = l.find(".nv-card");
    }
    createdCards.find(".nv-cover-img").on("error", ((/** @type {JQueryEvent} */ event) => { owner.jquery(event.currentTarget).addClass("jhs-is-hidden").siblings(".nv-card__empty").removeClass("jhs-is-hidden"); })), createdCards.find(".nv-select").on("change", ((/** @type {JQueryInputEvent} */ event) => { const carNum = normalizeCarNum(event.currentTarget.value); if (!carNum) return; event.currentTarget.checked ? owner.nvSelected.add(carNum) : owner.nvSelected.delete(carNum), owner.renderBatchBar(); })), l.find(".pagination-btn").off("click").on("click", ((/** @type {JQueryEvent} */ e) => {
        const n = parseInt(owner.jquery(e.currentTarget).data("nvpage"));
        n >= 1 && n <= o && n !== owner.nvCurrentPage && (owner.nvCurrentPage = n, owner.nvRenderGeneration++, owner.nvRenderPage(owner.nvRenderGeneration), owner.renderBatchBar(), l.scrollTop(0));
    })), l.find("#nv-pagination-bar").insertAfter(l), owner.nvCoverPreview ??= owner.createImageHoverPreview({ selector: ".nv-cover-img", dataAttribute: "data-full", owner: owner.nvWorkspaceRoot, resolveOwner: () => owner.nvWorkspaceRoot, zIndexStrategy: "owner" }), void owner.hydrateVisibleCovers(s, generation);
}
