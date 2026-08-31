// @ts-check

import { requestHostPage } from "../../core/host-page-request.js";
import { readCardNames, readListItem } from "../../core/list-item-reader.js";
import { endBatchRun, isActiveBatchRun, isBatchRunCancelled, requestCancelBatchRun, tryBeginBatchRun } from "../../core/batch-coordinator.js";
import { legacyActionToFlag } from "../../core/state-model.js";
import { isHitShowPage } from "../../core/site-context.js";
import { QUICK_FILTER_LABELS, normalizeQuickFilterKey } from "./list-filters.js";
import { evaluateListItem } from "./list-evaluator.js";
import { scanAllPages } from "./batch-scanner.js";

/** Own list-wide batch scanning, progress UI, and state writes. */
export class ListBatchService {
    /** @param {{scope: any, document?: Document, window?: any, location?: Location | URL | string, hostAdapter?: any, selectors: Record<string, string>, stateService: any, http: any, getEvaluationContext: () => Promise<any> | any, ui?: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.window = /** @type {any} */ (options.window ?? this.document?.defaultView ?? globalThis.window ?? null);
        this.location = options.location ?? this.window?.location ?? null;
        this.hostAdapter = options.hostAdapter ?? null;
        this.selectors = Object.freeze({ ...options.selectors });
        this.stateService = options.stateService;
        this.http = options.http;
        this.getEvaluationContext = options.getEvaluationContext;
        this.ui = options.ui ?? null;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** @param {{kind?: "actor" | "search", displayName?: string, recordName?: string}} batchScope @param {string} flag @param {{filter?: unknown, confirm?: boolean, root?: any}} [options] */
    async batchSaveAllVideos(batchScope, flag, { filter = "waitCheck", confirm = true, root = null } = {}) {
        this.scope.assertActive();
        if (this.disposed) return { cancelled: true };
        const stateFlag = legacyActionToFlag(flag);
        if (!stateFlag) throw new TypeError(`不支持的状态操作: ${flag}`);
        const normalized = normalizeQuickFilterKey(filter), filterLabel = QUICK_FILTER_LABELS[normalized];
        const actorScope = batchScope?.kind === "actor", recordName = actorScope ? String(batchScope.recordName || "") : "";
        const locationSearch = "string" === typeof this.location ? new URL(this.location).search : this.location?.search ?? "";
        const ownedRankingPage = this.location ? isHitShowPage(this.location) || locationSearch.includes("handleTop=1") : false;
        const confirmText = ownedRankingPage
            ? (normalized === "all" ? "将处理当前榜单页内的所有作品，包括屏蔽项。" : `将处理当前榜单页内符合「${filterLabel}」筛选的作品。`)
            : (normalized === "all" ? "将处理当前搜索全部分页的所有作品，包括屏蔽项。" : `将处理当前搜索全部分页中符合「${filterLabel}」的作品。`);
        if (confirm) {
            if (typeof this.ui?.confirm !== "function") throw new TypeError("列表批量服务需要确认器");
            const proceed = await new Promise((resolve) => this.ui.confirm(null, confirmText, () => resolve(true), () => resolve(false)));
            if (!proceed) return { cancelled: true };
        }
        const run = tryBeginBatchRun();
        if (!run) {
            this.ui?.show?.error?.("已有批量任务正在执行");
            return { cancelled: true, busy: true };
        }
        /** @type {any} */
        let progressElement = null;
        const isCancelled = () => isBatchRunCancelled(run) || this.scope.disposed;
        const setProgress = (/** @type {string} */ text) => {
            const label = progressElement?.find?.(".jhs-batch-progress__label");
            label?.length ? label.text(text) : this.ui?.getClog?.().debug?.(text);
        };
        const onProgress = (/** @type {{page: number, scanned: number, matched: number}} */ progress) => {
            setProgress(`已扫描 ${progress.page} 页 · 匹配 ${progress.matched} 项`);
            this.ui?.getClog?.().debug?.(`批量扫描第 ${progress.page} 页 · 已扫描 ${progress.scanned} · 匹配 ${progress.matched}`);
        };
        try {
            const context = await this.getEvaluationContext();
            progressElement = this.showBatchProgress(run);
            this.setBatchButtonsDisabled(true);
            const jq = this.getJQuery(), records = await scanAllPages({
                startDom: root ? jq(root) : jq(this.document),
                currentUrl: ownedRankingPage ? null : (root ? null : this.location?.href ?? this.window?.location?.href ?? null),
                firstPageUrl: ownedRankingPage || root ? null : (this.hostAdapter?.resolveFirstPageUrl?.(this.location?.href ?? this.window?.location?.href) ?? this.location?.href ?? this.window?.location?.href),
                itemSelector: this.selectors.requestDomItemSelector,
                nextPageSelector: this.selectors.nextPageSelector,
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
                progressElement?.remove?.();
                return { cancelled: true };
            }
            progressElement?.find?.("#jhs-batch-cancel")?.prop?.("disabled", true).attr?.("title", "正在写入，无法取消");
            setProgress("正在写入，无法取消…");
            let updated = 0;
            for (let index = 0; index < records.length; index += 75) {
                if (isCancelled()) break;
                const chunk = records.slice(index, index + 75);
                await this.stateService.patch(chunk.map((item) => item.carNum), { [stateFlag]: true }, {
                    type: "actor-page-batch-state",
                    records: chunk.map((item) => ({ carNum: item.carNum, url: item.url || "", names: item.names ?? recordName, publishTime: item.publishTime || "", fc2Source: item.fc2Source })),
                });
                updated += chunk.length;
                setProgress(`已更新 ${updated}/${records.length} 项`);
            }
            setProgress(`批量完成：匹配 ${records.length} 项 · 已更新 ${updated} 项`);
            this.scheduleRemoval(progressElement, 1800);
            return { matched: records.length, updated };
        } catch (error) {
            this.ui?.getClog?.().error?.("批量操作失败:", error);
            setProgress("批量操作失败");
            progressElement?.addClass?.("jhs-batch-progress--error");
            this.scheduleRemoval(progressElement, 2500);
            throw error;
        } finally {
            if (isActiveBatchRun(run)) endBatchRun(run);
            this.setBatchButtonsDisabled(false);
        }
    }

    getJQuery() {
        const jq = this.ui?.getJQuery?.();
        if ("function" !== typeof jq) throw new TypeError("列表批量服务需要 jQuery");
        return jq;
    }

    /** @param {any} run */
    showBatchProgress(run) {
        const jq = this.getJQuery();
        let element = jq("#jhs-batch-progress");
        if (!element.length) {
            element = jq('<div id="jhs-batch-progress" class="jhs-ui jhs-batch-progress" role="status"></div>').appendTo("body");
            element.append('<button type="button" class="jhs-btn jhs-btn--secondary jhs-btn--sm" id="jhs-batch-cancel">取消</button>');
        }
        element.find("#jhs-batch-cancel").off("click").on("click", () => requestCancelBatchRun(run));
        element.find(".jhs-batch-progress__label").remove().end().prepend(jq('<span class="jhs-batch-progress__label"></span>').text("正在扫描…"));
        return element;
    }

    /** @param {boolean} disabled */
    setBatchButtonsDisabled(disabled) {
        this.getJQuery()("#favoriteAllVideo, #hasDownAllVideo, #filterAllVideo").attr("aria-disabled", String(disabled)).toggleClass("jhs-batch-busy", disabled);
    }

    /** @param {any} element @param {number} delay */
    scheduleRemoval(element, delay) {
        const timer = setTimeout(() => element?.remove?.(), delay);
        this.scope.ownTimeout(timer);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
    }
}
