// @ts-check

import { readCardNames, readListItem } from "../../core/list-item-reader.js";
import { requestHostPage } from "../../core/host-page-request.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { classifyJavDbPage } from "../../core/site-context.js";
import { isBatchRunCancelled, isActiveBatchRun, requestCancelBatchRun, tryBeginBatchRun, endBatchRun } from "./batch-coordinator.js";
import { scanAllPages } from "./batch-scanner.js";
import { evaluateListItem } from "./list-evaluator.js";
import { QUICK_FILTER_LABELS, normalizeQuickFilterKey } from "./list-filters.js";

/** Feature-owned cross-page batch operations over injected evaluation and presentation capabilities. */
export class ListBatchController {
    /** @param {{hostAdapter: any, state: any, http: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, ui: any, getEvaluationContext: () => Promise<any>, getActiveFilter?: () => unknown, document?: Document, location?: Location}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.state = options.state;
        this.http = options.http;
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document;
        this.location = options.location ?? globalThis.location;
        this.ui = options.ui ?? null;
        this.getEvaluationContext = options.getEvaluationContext;
        this.getActiveFilter = options.getActiveFilter ?? (() => "waitCheck");
        /** @type {any} */ this.activeRun = null;
        /** @type {any} */ this.activeProgress = null;
        this.disposed = false;
    }

    /**
     * Batch-mark matches from every search page, while keeping ranking and imported catalogs page-scoped.
     * @param {{kind?: "actor" | "search", displayName?: string, recordName?: string}} batchScope
     * @param {string} action
     * @param {{filter?: unknown, confirm?: boolean, root?: any}} [options]
     */
    async run(batchScope, action, options = {}) {
        if (this.disposed || this.scope.disposed) throw new DOMException("List batch feature is disposed", "AbortError");
        const { filter = this.getActiveFilter(), confirm = true, root = null } = options;
        const stateFlag = legacyActionToFlag(action);
        if (!stateFlag) throw new TypeError(`不支持的状态操作: ${action}`);
        if (!this.ui) throw new Error("List batch presentation adapter is unavailable");

        const normalized = normalizeQuickFilterKey(filter), filterLabel = QUICK_FILTER_LABELS[normalized];
        const actorScope = batchScope?.kind === "actor", recordName = actorScope ? String(batchScope.recordName || "") : "";
        const pageContext = this.hostAdapter?.getPageContext?.() ?? classifyJavDbPage(this.location);
        const pageKind = pageContext?.kind ?? "unknown";
        const isRankingPage = ["movie-ranking", "playback-ranking", "top250-ranking"].includes(pageKind);
        const isExternalCatalog = pageKind === "external-fc2-catalog";
        const isPageScopedList = isRankingPage || isExternalCatalog;
        const pageName = isExternalCatalog ? "当前片库页" : "当前榜单页";
        const subtitleFilter = pageKind === "top250-ranking" ? new URLSearchParams(this.location?.search ?? "").get("jhs_subtitle") : null;
        const subtitleWarning = subtitleFilter === "with" || subtitleFilter === "without"
            ? " 当前字幕筛选只影响显示，不限制批量处理范围。" : "";
        const confirmText = (isPageScopedList
            ? (normalized === "all" ? `将处理${pageName}内的所有作品，包括屏蔽项。` : `将处理${pageName}内符合「${filterLabel}」筛选的作品。`)
            : (normalized === "all" ? "将处理当前搜索全部分页的所有作品，包括屏蔽项。" : `将处理当前搜索全部分页中符合「${filterLabel}」筛选的作品。`)) + subtitleWarning;
        if (confirm && !await this.ui.confirm(confirmText)) return { cancelled: true };
        if (this.disposed || this.scope.disposed) return { cancelled: true };

        const run = tryBeginBatchRun();
        if (!run) {
            this.ui.error("已有批量任务正在执行");
            return { cancelled: true, busy: true };
        }
        this.activeRun = run;
        /** @type {any} */ let progress = null;
        const setProgress = (/** @type {string} */ text) => this.ui.setProgress(progress, text);
        const onProgress = (/** @type {{page: number, scanned: number, matched: number}} */ value) => {
            setProgress(`已扫描 ${value.page} 页 · 匹配 ${value.matched} 项`);
            this.ui.debug(`批量扫描第 ${value.page} 页 · 已扫描 ${value.scanned} · 匹配 ${value.matched}`);
        };
        try {
            const context = await this.getEvaluationContext();
            const selectors = this.hostAdapter?.getListSelectors?.();
            if (!selectors?.requestDomItemSelector || !selectors?.nextPageSelector) throw new Error("List batch host selectors are unavailable");
            const isCancelled = () => isBatchRunCancelled(run) || this.disposed || this.scope.disposed;
            if (isCancelled()) return { cancelled: true };

            progress = this.ui.beginProgress(run);
            this.activeProgress = progress;
            this.ui.setButtonsDisabled(true);
            const pageUrl = this.location?.href ?? globalThis.window?.location?.href ?? "";
            const firstPageUrl = isPageScopedList || root ? null : (this.hostAdapter?.resolveFirstPageUrl?.(pageUrl) ?? pageUrl);
            const records = await scanAllPages({
                startDom: root ? $(root) : $(this.document),
                currentUrl: isPageScopedList || root ? null : pageUrl,
                firstPageUrl,
                itemSelector: selectors.requestDomItemSelector,
                nextPageSelector: selectors.nextPageSelector,
                maxPages: isPageScopedList ? 1 : 200,
                fetchHtml: (/** @type {string} */ url) => requestHostPage(this.http, url, this.scope),
                parseItem: (/** @type {any} */ item) => {
                    const parsed = readListItem(item);
                    return actorScope ? parsed : { ...parsed, names: readCardNames(item) };
                },
                evaluate: (/** @type {any} */ item) => evaluateListItem({ carNum: item.carNum, title: item.title || "" }, context, { filter: normalized }),
                isCancelled,
                onProgress,
            });
            if (isCancelled()) {
                this.ui.removeProgress(progress);
                return { cancelled: true };
            }

            // Once writes start the cancel button is disabled, matching the 6.5.1 interaction contract.
            this.ui.markWriting(progress);
            setProgress("正在写入，无法取消…");
            let updated = 0;
            for (let index = 0; index < records.length; index += 75) {
                const chunk = records.slice(index, index + 75);
                await this.state.patch(chunk.map((item) => item.carNum), { [stateFlag]: true }, {
                    type: stateFlag === "blocked" ? "actor-page-block" : "actor-page-batch-state",
                    records: chunk.map((item) => ({ carNum: item.carNum, url: item.url || "", names: item.names ?? recordName, publishTime: item.publishTime || "", fc2Source: item.fc2Source })),
                });
                updated += chunk.length;
                setProgress(`已更新 ${updated}/${records.length} 项`);
            }
            setProgress(`批量完成：匹配 ${records.length} 项 · 已更新 ${updated} 项`);
            this.ui.completeProgress(progress);
            return { matched: records.length, updated };
        } catch (error) {
            if (this.disposed || this.scope.disposed) {
                this.ui.removeProgress(progress);
                return { cancelled: true };
            }
            this.ui.reportError(error);
            this.ui.failProgress(progress);
            throw error;
        } finally {
            if (isActiveBatchRun(run)) endBatchRun(run);
            if (this.activeRun === run) this.activeRun = null;
            if (this.activeProgress === progress) this.activeProgress = null;
            this.ui.setButtonsDisabled(false);
        }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        requestCancelBatchRun(this.activeRun);
        this.ui?.removeProgress(this.activeProgress);
        this.activeProgress = null;
        this.ui?.setButtonsDisabled(false);
    }
}
