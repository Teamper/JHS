// @ts-check
import { LifecycleScope } from "../../core/lifecycle-scope.js";

import { requestHostPage } from "../../core/host-page-request.js";
import { readListItem } from "../../core/list-item-reader.js";
import { getMovieStateEligibility } from "../../core/movie-identity.js";

const PAGE_DELAY_MS = 1000;

/** Mount and run the JavDB want/watch import without the legacy plugin executor. */
export class WantWatchImportController {
    /** @param {{document: Document, window: Window, href: string, hostAdapter: any, http: any, state: any, ui: any, notifications: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, sleep?: (ms: number, signal: AbortSignal) => Promise<void>}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.href = options.href;
        this.hostAdapter = options.hostAdapter;
        this.http = options.http;
        this.state = options.state;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.sleep = options.sleep ?? waitForDelay;
        this.button = null;
        this.running = false;
    }

    start() {
        this.scope.assertActive();
        const route = new URL(this.href, this.window.location.href).pathname;
        const flag = route.includes("/want_watch_videos") ? "favorite" : route.includes("/watched_videos") ? "watched" : null;
        const heading = this.document.querySelector("h3");
        if (!flag || !heading || this.document.getElementById("wantWatchBtn")) return false;

        const button = this.document.createElement("button");
        button.type = "button";
        button.id = "wantWatchBtn";
        button.className = "jhs-btn jhs-btn--primary";
        button.textContent = "导入至 JHS";
        this.scope.listen(button, "click", (/** @type {Event} */ rawEvent) => {
            const event = /** @type {MouseEvent} */ (rawEvent);
            const prompt = flag === "favorite" ? "将想看的影片导入 JHS 收藏？" : "将看过的影片导入 JHS 已观看？";
            this.ui.confirm(event, `${prompt}<br/><span class="jhs-task-emphasis">请先备份数据</span>`, () => {
                void this.importMovies(flag);
            }, { confirmText: "导入" });
        });
        heading.append(button);
        this.button = button;
        this.scope.addCleanup(() => {
            button.remove();
            if (this.button === button) this.button = null;
        });
        return true;
    }

    /** @param {"favorite" | "watched"} flag */
    async importMovies(flag) {
        if (this.running || this.scope.disposed) return;
        this.running = true;
        const button = this.button;
        if (button) {
            button.disabled = true;
            button.setAttribute("aria-busy", "true");
        }
        const scope = new LifecycleScope("want-watch-import"), release = this.scope.addCleanup(() => scope.dispose());
        const stop = this.document.createElement("button");
        stop.type = "button";
        stop.className = "jhs-btn jhs-btn--secondary";
        stop.textContent = "停止导入";
        button?.after(stop);
        scope.listen(stop, "click", () => scope.dispose());
        try {
            const result = await this.readAndImport(flag, scope);
            if (!this.scope.disposed) this.notifications.ok(`${scope.disposed ? "导入已停止" : "导入完成"}：成功 ${result.imported}，跳过 ${result.skipped}，失败 ${result.failed}，共 ${result.pages} 页`);
        } catch (error) {
            if (!this.scope.disposed && !isAbortError(error)) {
                this.report(error);
                this.notifications.error("影片导入失败，请重试");
            }
        } finally {
            stop.remove();
            release();
            scope.dispose();
            this.running = false;
            if (button?.isConnected) {
                button.disabled = false;
                button.removeAttribute("aria-busy");
            }
        }
    }

    /** @param {"favorite" | "watched"} flag @param {LifecycleScope} [scope] @returns {Promise<{imported: number, failed: number, skipped: number, pages: number}>} */
    async readAndImport(flag, scope = this.scope) {
        const selectors = this.hostAdapter.getListSelectors();
        if (!selectors?.itemSelector) throw new Error("无法读取 JavDB 影片列表结构");
        const parser = new DOMParser();
        const result = { imported: 0, failed: 0, skipped: 0, pages: 0 };
        const visited = new Set(), seen = new Set();
        const importBatchId = crypto.randomUUID();
        /** @type {any[]} */ const pending = [];
        const flush = async () => {
            if (!pending.length || scope.disposed) return;
            const records = pending.splice(0);
            try {
                const saved = await this.state.patch(records.map(record => record.carNum), { [flag]: true }, { type: "javdb-list-import", importBatchId, records });
                const count = saved?.changed?.length ?? records.length;
                result.imported += count;
                result.skipped += records.length - count;
            } catch (error) { result.failed += records.length; this.report(error, "影片批次保存失败"); }
        };
        let pageRoot = this.document;
        let pageUrl = this.window.location.href;

        while (pageRoot && !scope.disposed) {
            if (visited.has(pageUrl)) break;
            visited.add(pageUrl);
            result.pages += 1;
            this.notifications.info(`正在导入第 ${result.pages} 页`);
            const boundary = this.hostAdapter.resolveListBoundary?.(pageRoot);
            if (this.hostAdapter.resolveListBoundary && !boundary) throw new Error("\u65e0\u6cd5\u552f\u4e00\u786e\u5b9a\u6b63\u5f0f\u5f71\u7247\u5217\u8868");
            const items = boundary ? [...boundary.root.querySelectorAll(":scope > .item")] : [...pageRoot.querySelectorAll(selectors.itemSelector)];
            for (const item of items) {
                if (scope.disposed) break;
                try {
                    const movie = readListItem(item, this.ui.jquery);
                    if (!getMovieStateEligibility(movie).eligible || !movie.url || seen.has(movie.carNum)) { result.skipped++; continue; }
                    seen.add(movie.carNum);
                    pending.push({ carNum: movie.carNum, stateEligibility: movie.stateEligibility, url: movie.url, publishTime: movie.publishTime || "" });
                    if (pending.length === 75) await flush();
                } catch (error) { result.skipped++; this.report(error, "跳过无法读取的影片"); }
            }
            if (scope.disposed) break;
            const nextHref = boundary ? boundary.nextLink?.getAttribute("href") : pageRoot.querySelector(".pagination-next")?.getAttribute("href");
            if (!nextHref) break;
            const nextUrl = new URL(nextHref, pageUrl).href;
            if (visited.has(nextUrl)) break;
            let html;
            try {
                await this.sleep(PAGE_DELAY_MS, scope.signal);
                scope.assertActive();
                html = await requestHostPage(this.http, nextUrl, scope);
            } catch (error) {
                if (!scope.disposed || !isAbortError(error)) throw error;
                break;
            }
            pageRoot = parser.parseFromString(html, "text/html");
            pageUrl = nextUrl;
        }
        await flush();
        return result;
    }

    /** @param {unknown} error @param {string} [message] */
    report(error, message = "want-watch-import") {
        this.diagnostics?.recordError?.({
            source: "want-watch-import",
            featureId: "library",
            contributionId: "library.state-actions",
            message: `${message}: ${error instanceof Error ? error.message : String(error)}`,
        });
    }
}

/** @param {number} delay @param {AbortSignal} signal */
function waitForDelay(delay, signal) {
    if (signal.aborted) return Promise.reject(createAbortError());
    return new Promise((resolve, reject) => {
        const timer = setTimeout(finish, delay);
        function finish() {
            signal.removeEventListener("abort", abort);
            resolve(undefined);
        }
        function abort() {
            clearTimeout(timer);
            signal.removeEventListener("abort", abort);
            reject(createAbortError());
        }
        signal.addEventListener("abort", abort, { once: true });
    });
}

function createAbortError() {
    return new DOMException("The operation was aborted", "AbortError");
}

/** @param {unknown} error */
function isAbortError(error) {
    return error instanceof Error && error.name === "AbortError";
}
