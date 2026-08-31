// @ts-check

import { C, _, escapeHtml } from "../../core/constants.js";
import { createListEvaluationContext, evaluateListItem, findMatchedTitleKeyword } from "./list-evaluator.js";

const STATUS_DEFINITIONS = Object.freeze({
    blocked: { text: "已屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
    favorite: { text: "已收藏", color: "var(--jhs-status-fav)", on: "var(--jhs-status-fav-on)" },
    downloaded: { text: "已下载", color: "var(--jhs-status-down)", on: "var(--jhs-status-down-on)" },
    watched: { text: "已观看", color: "var(--jhs-status-watch)", on: "var(--jhs-status-watch-on)" },
    keyword: { text: "关键词屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
    actorBlacklist: { text: "男演员屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
    actressBlacklist: { text: "女演员屏蔽", color: "var(--jhs-status-filter)", on: "var(--jhs-status-filter-on)" },
});

/** Own asynchronous list evaluation and card-state rendering. */
export class ListFilterService {
    /** @param {{scope: any, window?: Window & {isListPage?: boolean}, document?: Document, selectors: Record<string, string>, site?: string, getActiveFilter: () => unknown, captureRevision: () => string, isCurrentRevision: (revision: string) => boolean, getEvaluationContext: () => Promise<any> | any, readItem: (item: Element) => {carNum?: unknown, title?: unknown} | null, recordPhase?: (phase: string, itemCount?: number | null) => void, scheduleRecount?: () => void, translateItems?: (items: Element[]) => Promise<void> | void, onJavBusFiltered?: () => Promise<void> | void, time?: (label: string) => unknown, logTiming?: (timing: {readDuration: unknown, assembleDuration: unknown, processDuration: unknown, totalDuration: unknown}) => void, ui?: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.window = options.window ?? globalThis.window ?? null;
        this.document = options.document ?? globalThis.document ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        this.site = options.site ?? "";
        this.getActiveFilter = options.getActiveFilter;
        this.captureRevision = options.captureRevision;
        this.isCurrentRevision = options.isCurrentRevision;
        this.getEvaluationContext = options.getEvaluationContext;
        this.readItem = options.readItem;
        this.recordPhase = options.recordPhase ?? (() => {});
        this.scheduleRecount = options.scheduleRecount ?? (() => {});
        this.translateItems = options.translateItems ?? (() => {});
        this.onJavBusFiltered = options.onJavBusFiltered ?? (() => {});
        this.ui = options.ui ?? null;
        this.time = options.time ?? ((label) => this.ui?.time?.(label));
        this.logTiming = options.logTiming ?? ((timing) => this.reportTiming(timing));
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** Filter the current list while preserving the supplied async revision. */
    async doFilter(revision = this.captureRevision()) {
        return this.doFilterItems(null, revision);
    }

    /** Filter a subset of cards, or all current list cards when omitted. @param {Element[] | null} [items] @param {string} [revision] */
    async doFilterItems(items = null, revision = this.captureRevision()) {
        this.scope.assertActive();
        if (this.disposed || (this.window && !this.window.isListPage)) return false;
        const elements = items ? [ ...items ] : this.document ? [ ...this.document.querySelectorAll(this.selectors.itemSelector) ] : [];
        if (!elements.length) return true;
        const filtered = await this.filterMovieList(elements, revision);
        if (filtered && this.site === "javbus" && !this.disposed) {
            const timer = setTimeout(() => {
                if (this.disposed) return;
                void Promise.resolve(this.onJavBusFiltered()).catch((error) => this.ui?.getClog?.().error?.("JavBus图片高度修正失败", error));
            });
            this.scope.ownTimeout(timer);
        }
        return filtered;
    }

    /** Evaluate cards, commit state metadata, and refresh status badges. @param {Element[]} items @param {string} [revision] @returns {Promise<boolean>} */
    async filterMovieList(items, revision = this.captureRevision()) {
        this.scope.assertActive();
        this.recordPhase("doFilter-start", items.length);
        if (!this.isCurrentRevision(revision)) return false;
        const activeFilter = this.getActiveFilter() || "waitCheck";
        this.time("累计耗费时间");
        this.time("读取数据耗时");
        const rawContext = await this.getEvaluationContext();
        this.scope.assertActive();
        if (!this.isCurrentRevision(revision)) return false;
        const evaluationContext = rawContext ?? createListEvaluationContext();
        const readDuration = this.time("读取数据耗时");
        this.time("组装数据耗时");
        const assembleDuration = this.time("组装数据耗时");
        const tagPosition = evaluationContext.settings?.tagPosition || "rightTop";
        this.time("处理页面耗时");
        const translatedItems = [];
        for (let index = 0; index < items.length; index += 1) {
            if (!this.isCurrentRevision(revision)) return false;
            if (index > 0 && index % 12 === 0) await this.yieldListFrame();
            const item = items[index];
            if (this.site === "javbus" && item.querySelector(".avatar-box")) continue;
            const record = this.readItem(item) ?? {}, carNum = String(record.carNum ?? ""), title = String(record.title ?? "");
            const evaluation = evaluateListItem({ carNum, title }, evaluationContext, { filter: activeFilter });
            const keyword = evaluation.visibilityReasons.keyword ? findMatchedTitleKeyword(evaluationContext.titleKeywords, title, carNum) : null;
            const $item = this.getJQuery()(item);
            $item.attr("data-jhs-flags", JSON.stringify(evaluation.flags))
                .attr("data-jhs-visibility", JSON.stringify(evaluation.visibilityReasons))
                .attr("data-jhs-recent", evaluation.recent ? _ : C)
                .attr("data-jhs-tag-position", tagPosition);
            const signature = JSON.stringify({ flags: evaluation.flags, visibilityReasons: evaluation.visibilityReasons, tagPosition });
            if ($item.attr("data-jhs-state-signature") !== signature) {
                $item.attr("data-jhs-state-signature", signature);
                $item.find(".jhs-status-tags").remove();
                this.renderStatusTags($item, evaluation, keyword, tagPosition, carNum, evaluationContext);
            }
            if (!evaluation.hardHidden) translatedItems.push(item);
        }
        this.scheduleRecount();
        void Promise.resolve(this.translateItems(translatedItems)).catch((error) => this.ui?.getClog?.().error?.("列表页翻译任务失败", error));
        this.recordPhase("doFilter-end", items.length);
        const processDuration = this.time("处理页面耗时"), totalDuration = this.time("累计耗费时间");
        this.logTiming({ readDuration, assembleDuration, processDuration, totalDuration });
        return true;
    }

    /** @param {any} $item @param {any} evaluation @param {string | null} keyword @param {string} tagPosition @param {string} carNum @param {any} evaluationContext */
    renderStatusTags($item, evaluation, keyword, tagPosition, carNum, evaluationContext) {
        const badgeDefs = [
            [ evaluation.flags.blocked, STATUS_DEFINITIONS.blocked, "单番号屏蔽" ],
            [ evaluation.flags.favorite, STATUS_DEFINITIONS.favorite, "" ],
            [ evaluation.flags.downloaded, STATUS_DEFINITIONS.downloaded, "" ],
            [ evaluation.flags.watched, STATUS_DEFINITIONS.watched, "" ],
            [ evaluation.visibilityReasons.keyword, STATUS_DEFINITIONS.keyword, keyword || "未知" ],
            [ evaluation.visibilityReasons.actorBlacklist, STATUS_DEFINITIONS.actorBlacklist, evaluationContext.actorCarNumToNameMap?.get?.(carNum) || "" ],
            [ evaluation.visibilityReasons.actressBlacklist, STATUS_DEFINITIONS.actressBlacklist, evaluationContext.actressCarNumToNameMap?.get?.(carNum) || "" ],
        ].filter((item) => item[0]);
        if (!badgeDefs.length) return;
        const $ = this.getJQuery();
        const box = $(`<span class="jhs-status-tags ${tagPosition === "rightTop" ? "jhs-status-tags--right" : "jhs-status-tags--left"}"></span>`);
        badgeDefs.forEach((([, definition, tip]) => {
            const badge = $(`<span class="jhs-badge ${this.site === "javdb" ? "jhs-badge--success" : "jhs-badge--neutral"} status-tag" data-tip="${escapeHtml(String(tip || ""))}" title="">${escapeHtml(definition.text)}</span>`);
            badge.css({ color: definition.on, backgroundColor: definition.color });
            box.append(badge);
        }));
        if (this.site === "javdb") $item.find(".tags").append(box);
        else if (this.site === "javbus") {
            const host = $item.find(".item-tag");
            host.length ? host.append(box) : $item.find(".photo-info > span > div").append(box);
        }
    }

    async yieldListFrame() {
        await new Promise((resolve) => {
            if (this.window?.requestAnimationFrame) this.window.requestAnimationFrame(() => setTimeout(resolve));
            else setTimeout(resolve, 0);
        });
    }

    /** @param {{readDuration: unknown, assembleDuration: unknown, processDuration: unknown, totalDuration: unknown}} timing */
    reportTiming(timing) {
        const logger = this.ui?.getClog?.() ?? {};
        if (typeof logger?.html !== "function") return;
        logger.html(`
            <table class="countTable jhs-layout-b12542a5">
                <tr><td colspan="2" class="jhs-count-table__cell">${timing.readDuration}</td><td colspan="2" class="jhs-count-table__cell">${timing.assembleDuration}</td></tr>
                <tr><td colspan="2" class="jhs-count-table__cell">${timing.processDuration}</td><td colspan="2" class="jhs-count-table__cell">${timing.totalDuration}</td></tr>
            </table>
        `);
    }

    getJQuery() {
        const jq = this.ui?.getJQuery?.();
        if (typeof jq !== "function") throw new TypeError("列表筛选服务需要 jQuery");
        return jq;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
    }
}
