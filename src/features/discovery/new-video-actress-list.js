// @ts-check

import { genericSort } from "../../core/collection-sort.js";
import { OwnedPopover } from "../../core/owned-popover.js";
import { formatUiDateTime } from "../../core/ui-date-time.js";
import { getIcon } from "../../core/icons.js";
import { cleanActressName, createBodyFilterMatcher, formatBodyMeasurements, hasActiveBodyFilter, readStoredActressMeasurements } from "../../core/actress-measurements.js";
import { A, D, _, escapeHtml } from "../../core/constants.js";
import { normalizeHttpUrl, shouldSkipStopped } from "../../core/feature-helpers.js";
import { JhsSelect, renderStateView } from "../../core/ui-primitives.js";
import { isMissingActorSource } from "./actor-source-health.js";

/** @typedef {import("./new-video-workspace-service.js").NewVideoWorkspaceService} NewVideoWorkspaceService */
/** @typedef {import("./new-video-workspace-service.js").JQueryEvent} JQueryEvent */
/** @typedef {import("./new-video-workspace-service.js").ActorRecord} ActorRecord */
/** @typedef {import("./new-video-workspace-service.js").MovieRow} MovieRow */
/** @typedef {import("./new-video-workspace-service.js").Measurements} Measurements */

/** @param {NewVideoWorkspaceService} owner */
export function syncMeasurementsCaches(owner, /** @type {ActorRecord[]} */ actresses, /** @type {Map<string, Measurements | null> | null} */ measurementsByStarId = null) {
    const byStarId = new Map();
    const byName = new Map();
    for (const actress of Array.isArray(actresses) ? actresses : []) {
        const starId = String(actress?.starId || "").trim();
        const parsed = measurementsByStarId instanceof Map && starId && measurementsByStarId.has(starId)
            ? measurementsByStarId.get(starId)
            : readStoredActressMeasurements(actress);
        if (starId) byStarId.set(starId, parsed ?? null);
        const names = [actress?.name, ...(Array.isArray(actress?.allName) ? actress.allName : [])];
        for (const raw of names) {
            const cleaned = cleanActressName(raw, { stripBrackets: true });
            if (!cleaned) continue;
            if (!byName.has(cleaned) || (!byName.get(cleaned) && parsed)) byName.set(cleaned, parsed ?? null);
        }
    }
    owner.nvMeasurementsByStarId = byStarId;
    owner.nvMeasurementsByName = byName;
}

/** @param {NewVideoWorkspaceService} owner */
export function getActressMeasurements(owner, /** @type {ActorRecord} */ actress) {
    const starId = String(actress?.starId || "").trim();
    if (starId && owner.nvMeasurementsByStarId.has(starId)) return owner.nvMeasurementsByStarId.get(starId);
    return readStoredActressMeasurements(actress);
}

/** @param {NewVideoWorkspaceService} owner */
export function matchesNewVideoBodyFilter(owner, /** @type {MovieRow} */ item, /** @type {ReturnType<typeof createBodyFilterMatcher>} */ bodyMatcher) {
    const starIds = Array.isArray(item?.starIds) && item.starIds.length ? item.starIds : item?.starId ? [item.starId] : [];
    if (starIds.length) {
        return starIds.some((/** @type {string} */ starId) => bodyMatcher(owner.nvMeasurementsByStarId.get(String(starId || "").trim()) ?? null));
    }
    const names = Array.isArray(item?.actresses) && item.actresses.length
        ? item.actresses
        : String(item?.actressName || "").split(/[、,，]/u);
    return names.some((/** @type {string} */ name) => {
        const cleaned = cleanActressName(name, { stripBrackets: true });
        return cleaned ? bodyMatcher(owner.nvMeasurementsByName.get(cleaned) ?? null) : false;
    });
}

/** @param {NewVideoWorkspaceService} owner */
export async function renderActressCards(owner) {
    const e = owner.jquery("#actress-card-container");
    if (!e.length || owner.renderWorkspaceLoading(e)) return;
    e.attr("aria-busy", "false");
    let t = [ ...owner.nvActressesCache ];
    const n = owner.jquery("#paramActressType").val() ?? "all";
    "all" !== n && (t = t.filter((e => e.actressType === n)));
    const bodyFilter = owner.readBodyFilter(), bodyActive = hasActiveBodyFilter(bodyFilter), bodyMatcher = createBodyFilterMatcher(bodyFilter);
    if (bodyActive) t = t.filter((actress => bodyMatcher(owner.getActressMeasurements(actress))));
    const _carSet = owner.nvCarMapCache;
    const _newVideoCount = (/** @type {ActorRecord} */ e) => owner.getPendingNewVideoCount(e, _carSet);
    const sortBy = owner.jquery("#paramSortBy").val();
    const sortMap = {
        "lastPublishTime_desc": [{ key: "lastPublishTime", order: "desc" }],
        "lastPublishTime_asc":  [{ key: "lastPublishTime", order: "asc" }],
        "lastCheckTime_desc":   [{ key: "lastCheckTime", order: "desc" }],
        "lastCheckTime_asc":    [{ key: "lastCheckTime", order: "asc" }],
        "newVideoCount_desc":   [{ key: _newVideoCount, order: "desc" }],
        "newVideoCount_asc":    [{ key: _newVideoCount, order: "asc" }]
    };
    const defaultSort = [{
        key: _newVideoCount,
        order: "desc"
    }, {
        key: "lastPublishTime",
        order: "desc"
    }];
    const sortedActresses = genericSort(t, sortMap[/** @type {keyof typeof sortMap} */ (sortBy)] || defaultSort);
    const totalCount = sortedActresses.length, totalPages = Math.ceil(totalCount / owner.pageSize), pageStart = (owner.currentPage - 1) * owner.pageSize, pageEnd = pageStart + owner.pageSize;
    totalPages > 0 && owner.currentPage > totalPages && (owner.currentPage = totalPages);
    const safePageStart = (owner.currentPage - 1) * owner.pageSize, pageActresses = sortedActresses.slice(safePageStart, safePageStart + owner.pageSize), javDbUrl = owner.nvJavDbUrl, ruleTime = owner.nvRuleTime;
    if (0 === pageActresses.length) {
        const hasActressFilter = owner.nvActressesCache.length > 0 && (n !== "all" || bodyActive);
        renderStateView(e, {
            type: "empty",
            title: owner.nvActressesCache.length ? "暂无符合筛选的演员" : "暂无收藏演员",
            ...(hasActressFilter ? {
                actionLabel: "清除筛选",
                onAction: () => {
                    JhsSelect.setValue("#paramActressType", "all", !1);
                    owner.resetBodyFilter();
                    void owner.refreshCurrentView({ resetPage: true });
                },
            } : {}),
        });
        return void owner.renderPagination(totalCount, totalPages);
    }
    const sourceHealth = owner.getRuntimeService("sourceHealth"), unavailableStarIds = new Set((javDbUrl && sourceHealth ? sourceHealth.list(javDbUrl) : []).map((/** @type {{starId?: string}} */ item) => String(item.starId || "")));
    const cards = pageActresses.map((actress => {
        const allNames = Array.isArray(actress.allName) ? actress.allName.join("，") : "";
        const name = String(actress.name || ""), remark = String(actress.remark || ""), starId = String(actress.starId || "");
        const newVideoCount = owner.getPendingNewVideoCount(actress, _carSet), latestPublishTime = actress.lastPublishTime || "";
        const profileUrl = normalizeHttpUrl(`/actors/${encodeURIComponent(starId)}?t=d`, javDbUrl), avatarUrl = normalizeHttpUrl(actress.avatar, javDbUrl) || owner.getRuntimeService("actressInfo").placeholderUrl("javdb");
        const isPaused = shouldSkipStopped(latestPublishTime, ruleTime);
        let typeLabel = "未知", typeClass = "is-unknown";
        actress.actressType === A ? (typeLabel = "无码", typeClass = "is-uncensored") : actress.actressType === D && (typeLabel = "有码", typeClass = "is-censored");
        const publishText = String(latestPublishTime || "暂无记录"), noteText = isPaused ? `停更 ${ruleTime / 24 / 365} 年以上，下轮任务不再检测` : remark || "暂无备注";
        const bodyText = formatBodyMeasurements(actress) || "暂无资料";
        const card = owner.jquery('<article class="actress-card"></article>').toggleClass("is-paused", isPaused).attr("data-starId", starId), badges = owner.jquery('<div class="actress-card__badges"></div>');
        badges.append(owner.jquery("<span class=\"jhs-badge jhs-badge--accent card-new-count-tag\"></span>").attr("data-tip", `新作品数量：${newVideoCount}`).text(`${newVideoCount} 新`), owner.jquery("<span class=\"jhs-badge card-tag\"></span>").addClass(typeClass).text(typeLabel)), unavailableStarIds.has(starId) && badges.append('<span class="jhs-badge jhs-badge--danger">来源不可用</span>'), isPaused && badges.append('<span class="jhs-badge jhs-badge--neutral">停更</span>');
        const profile = owner.jquery('<a class="actress-card__profile" target="_blank" rel="noopener noreferrer"></a>').attr("href", profileUrl || "#"), identity = owner.jquery("<span></span>").append(owner.jquery("<span class=\"actress-card-name\"></span>").text(name), owner.jquery("<span class=\"actress-card-allname\"></span>").attr("title", allNames).text(allNames || "暂无别名"));
        profile.append(owner.jquery("<img class=\"actress-card-avatar\" loading=\"lazy\">").attr({ src: avatarUrl, alt: allNames }), identity);
        const meta = owner.jquery('<dl class="actress-card__meta"></dl>').append(
            owner.jquery("<div class=\"actress-card__meta-row\"><dt>最近影片</dt></div>").append(owner.jquery("<dd></dd>").attr("title", publishText).text(publishText)),
            owner.jquery('<div class="actress-card__meta-row"><dt>上次检测</dt></div>').append(owner.jquery("<dd></dd>").text(formatUiDateTime(actress.lastCheckTime))),
            owner.jquery('<div class="actress-card__meta-row"><dt>身材</dt></div>').append(owner.jquery("<dd></dd>").attr("title", bodyText).text(bodyText)),
        ), actions = owner.jquery('<div class="actress-card__actions"></div>');
        const check = owner.jquery('<button type="button" class="jhs-btn jhs-btn--secondary btn-check-actress"><span>重新检测</span></button>').attr("data-starId", starId).prepend(owner.checkSvg), remove = owner.jquery('<button type="button" class="jhs-btn jhs-icon-btn jhs-btn--ghost btn-delete-actress" title="取消收藏"></button>').attr({ "aria-label": `取消收藏 ${name}`, "data-starId": starId }).append(owner.deleteSvg), edit = owner.jquery('<button type="button" class="jhs-btn jhs-btn--ghost btn-edit-actress" role="menuitem"><span>编辑资料</span></button>').attr("data-starId", starId).prepend(owner.editSvg);
        actions.append(check, remove, owner.jquery(`<div class="actress-card__menu"><button type="button" class="jhs-btn jhs-icon-btn jhs-btn--ghost" aria-label="更多操作" title="更多操作" aria-haspopup="menu" aria-expanded="false">${getIcon("ellipsis")}</button><div class="jhs-popover actress-card__menu-popover" role="menu"></div></div>`).find(".actress-card__menu-popover").append(edit).end());
        return card.append(badges, profile, meta, owner.jquery("<p class=\"actress-card__note\"></p>").attr("title", noteText).text(noteText), actions)[0];
    }));
    e.empty().append(cards), owner.jquery(".btn-delete-actress").off("click").on("click", ((/** @type {JQueryEvent} */ e) => {
        e.preventDefault();
        const t = owner.jquery(e.currentTarget).attr("data-starId"), n = sortedActresses.find((e => e.starId === t));
        if (!n) return;
        owner.utils.q(e, `取消收藏演员「${escapeHtml(n.name)}」？`, (async () => {
            const baseUrl = owner.getRuntimeService("movie").externalSiteOrigin("javDbBtn", owner.getRuntimeService("settings").snapshot()), csrfToken = owner.document.querySelector("meta[name=csrf-token]")?.getAttribute("content") || "";
            if (!csrfToken) {
                owner.notifications.error("缺少站方请求令牌，请刷新 JavDB 页面后重试");
                return;
            }
            try {
                const result = await owner.getRuntimeService("actressInfo").uncollect("javdb", { actorId: t, baseUrl, csrfToken }, { scope: await owner.getRuntimeService("scope")() });
                if (result.success) {
                    await owner.removeFavoriteActressRecord(t, baseUrl);
                } else {
                    owner.notifications.error("取消收藏失败，请重试");
                    owner.logger.error("移除失败,返回值:", result);
                }
            } catch (error) {
                if (isMissingActorSource(error)) {
                    await owner.removeFavoriteActressRecord(t, baseUrl);
                    owner.notifications.ok("站方演员页已不存在，已清理本地收藏");
                } else {
                    owner.notifications.error("取消收藏失败，请重试");
                    owner.logger.error("移除失败:", error);
                }
            }
        }), undefined, { confirmText: "取消收藏", tone: "danger" });
    })), owner.jquery(".btn-edit-actress").off("click").on("click", ((/** @type {JQueryEvent} */ e) => {
        e.preventDefault();
        const t = owner.jquery(e.currentTarget).attr("data-starId"), n = sortedActresses.find((e => e.starId === t));
        n ? owner.editActress(n) : owner.notifications.error("未找到该演员记录");
    })), owner.jquery(".btn-check-actress").off("click").on("click", ((/** @type {JQueryEvent} */ e) => {
        e.preventDefault();
        const button = owner.jquery(e.currentTarget), starId = button.attr("data-starId"), actress = sortedActresses.find((item => item.starId === starId));
        void owner.runManualTask(button, "检测中…", (/** @type {any} */ task) => task.checkOneNewVideo(actress));
    })), owner.jquery(".actress-card__menu").each((/** @type {number} */ _, /** @type {HTMLElement} */ element) => {
        const anchor = element.querySelector("button"), menu = element.querySelector("[role=menu]");
        if (!anchor || !menu) return;
        const popover = new OwnedPopover(anchor, /** @type {HTMLElement} */ (menu));
        owner.jquery(anchor).on("click", (/** @type {JQueryEvent} */ event) => { event.preventDefault(); popover.opened ? popover.close(true) : popover.open(); });
        owner.jquery(menu).on("click", "button", () => popover.close());
    }), owner.renderPagination(totalCount, totalPages);
}

/** @param {NewVideoWorkspaceService} owner */
export function renderPagination(owner, /** @type {number} */ e, /** @type {number} */ t) {
    const n = owner.currentPage;
    let a = "";
    const i = owner.jquery("#actress-pagination");
    if (0 === t) return a = '<span class="jhs-pagination__summary">共 0 条记录</span>', void i.html(a);
    n > 1 && t > 5 && (a += '<button type="button" class="jhs-btn pagination-btn" data-page="1">首页</button>'),
    n > 1 && (a += `<button type="button" class="jhs-btn pagination-btn" data-page="${n - 1}">上一页</button>`);
    let s = Math.max(1, n - Math.floor(2.5)), o = Math.min(t, s + 5 - 1);
    o - s < 4 && (s = Math.max(1, o - 5 + 1));
    for (let r = s; r <= o; r++) {
        a += `<button type="button" class="jhs-btn pagination-btn page-number-btn ${r === n ? "active" : ""}" data-page="${r}" ${r === n ? 'aria-current="page"' : ""}>${r}</button>`;
    }
    n < t && (a += `<button type="button" class="jhs-btn pagination-btn" data-page="${n + 1}">下一页</button>`),
    n < t && t > 5 && (a += `<button type="button" class="jhs-btn pagination-btn" data-page="${t}">尾页</button>`),
    a += `<span class="jhs-pagination__summary">共 ${e} 条记录（第 ${n}/${t} 页）</span>`,
    i.html(a), i.find(".pagination-btn").off("click").on("click", ((/** @type {JQueryEvent} */ e) => {
        if (owner.jquery(e.currentTarget).is("[disabled]")) return;
        const n = parseInt(owner.jquery(e.currentTarget).data("page"));
        n >= 1 && n <= t && n !== owner.currentPage && (owner.currentPage = n, owner.renderActressCards());
    }));
}

/** @param {NewVideoWorkspaceService} owner */
export async function removeFavoriteActressRecord(owner, /** @type {string} */ starId, baseUrl = owner.nvJavDbUrl) {
    const state = owner.runtimeServices.state;
    const removed = await state.removeFavoriteActress(starId);
    if (removed && baseUrl) owner.getRuntimeService("sourceHealth")?.clear?.(baseUrl, starId);
    if (removed) await owner.notifyCommittedNewVideoChange("favorite-actress-removed");
    return removed;
}

/** @param {NewVideoWorkspaceService} owner */
export function removeUnavailableActress(owner, /** @type {JQueryEvent} */ event, /** @type {ActorRecord} */ actress, /** @type {string} */ baseUrl) {
    const starId = String(actress?.starId || ""), name = String(actress?.name || "该演员");
    if (!starId) return;
    owner.utils.q(event, `移除本地失效演员「${escapeHtml(name)}」及其未处理新作品记录？（仅删除本地缓存，不影响站方账号）`, async () => {
        const removed = await owner.removeFavoriteActressRecord(starId, baseUrl);
        if (!removed) {
            owner.getRuntimeService("sourceHealth")?.clear?.(baseUrl, starId);
            await owner.notifyCommittedNewVideoChange("favorite-actress-removed");
        }
        owner.notifications.ok(`已移除「${name}」`);
    }, undefined, { confirmText: "移除记录", tone: "danger" });
}
