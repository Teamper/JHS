// @ts-check

import { requestHostPage } from "../../core/host-page-request.js";

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
        button.className = "jhs-btn jhs-btn--primary jhs-layout-481ed7e7";
        button.textContent = "导入至 JHS";
        this.scope.listen(button, "click", (/** @type {Event} */ rawEvent) => {
            const event = /** @type {MouseEvent} */ (rawEvent);
            const prompt = flag === "favorite" ? "是否将想看的影片导入到 JHS 收藏？" : "是否将看过的影片导入到 JHS 已观看？";
            this.ui.confirm(event, `${prompt} <br/> <span class="jhs-task-emphasis">执行此功能前请记得备份数据</span>`, () => {
                void this.importMovies(flag);
            });
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
        let loadingHandle;
        try {
            loadingHandle = this.ui.loading();
            const result = await this.readAndImport(flag);
            if (!this.scope.disposed) this.notifications.ok(`导入完成：成功 ${result.imported}，失败 ${result.failed}，共 ${result.pages} 页`);
        } catch (error) {
            if (!this.scope.disposed && !isAbortError(error)) {
                this.report(error);
                this.notifications.error(`导入失败：${error instanceof Error ? error.message : String(error)}`);
            }
        } finally {
            loadingHandle?.close?.();
            this.running = false;
            if (button?.isConnected) {
                button.disabled = false;
                button.removeAttribute("aria-busy");
            }
        }
    }

    /** @param {"favorite" | "watched"} flag @returns {Promise<{imported: number, failed: number, pages: number}>} */
    async readAndImport(flag) {
        const selectors = this.hostAdapter.getListSelectors();
        if (!selectors?.itemSelector) throw new Error("无法读取 JavDB 影片列表结构");
        const parser = new DOMParser();
        const result = { imported: 0, failed: 0, pages: 0 };
        const visited = new Set();
        let pageRoot = this.document;
        let pageUrl = this.window.location.href;

        while (pageRoot && !this.scope.disposed) {
            if (visited.has(pageUrl)) break;
            visited.add(pageUrl);
            result.pages += 1;
            this.notifications.info(`正在导入第 ${result.pages} 页`);
            const items = [...pageRoot.querySelectorAll(selectors.itemSelector)];
            for (const item of items) {
                if (this.scope.disposed) break;
                const anchor = item.querySelector("a");
                const carNum = item.querySelector(".video-title strong")?.textContent?.trim() ?? "";
                if (!anchor?.getAttribute("href") || !carNum) continue;
                try {
                    await this.state.patch(carNum, { [flag]: true }, {
                        type: "javdb-list-import",
                        record: {
                            carNum,
                            url: anchor.getAttribute("href") ?? "",
                            names: "",
                            publishTime: item.querySelector(".meta")?.textContent?.trim() ?? "",
                        },
                    });
                    result.imported += 1;
                } catch (error) {
                    if (this.scope.disposed || isAbortError(error)) break;
                    result.failed += 1;
                    this.report(error, `保存失败 [${carNum}]`);
                }
            }
            if (this.scope.disposed) break;
            const nextHref = pageRoot.querySelector(".pagination-next")?.getAttribute("href");
            if (!nextHref) break;
            const nextUrl = new URL(nextHref, pageUrl).href;
            if (visited.has(nextUrl)) break;
            await this.sleep(PAGE_DELAY_MS, this.scope.signal);
            this.scope.assertActive();
            const html = await requestHostPage(this.http, nextUrl, this.scope);
            pageRoot = parser.parseFromString(html, "text/html");
            pageUrl = nextUrl;
        }
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
