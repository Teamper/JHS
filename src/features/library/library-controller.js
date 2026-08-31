// @ts-check

import { requestHostPage } from "../../core/host-page-request.js";

/**
 * Own the library contributions while their legacy implementations are being
 * migrated away from direct plugin-to-plugin calls.
 */
export class LibraryController {
    /** @param {{historyPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any, historyRepository?: any}, blacklistPlugin?: Record<string, any>, favoritePlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, keywordFilterEnabled?: boolean, stateImportEnabled?: boolean, hostAdapter?: any, storage?: any, settings?: any, eventBus?: any, storageMutation?: any, state?: any, http?: any, route?: string, scope: any}} options */
    constructor(options) {
        this.historyPlugin = options.historyPlugin ?? null;
        this.blacklistPlugin = options.blacklistPlugin ?? null;
        this.favoritePlugin = options.favoritePlugin ?? null;
        this.keywordFilterEnabled = options.keywordFilterEnabled !== false;
        this.stateImportEnabled = options.stateImportEnabled !== false;
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.storage = options.storage;
        this.settings = options.settings;
        this.eventBus = options.eventBus;
        this.storageMutation = options.storageMutation;
        this.state = options.state;
        this.http = options.http;
        this.route = options.route ?? "unknown";
        this.keywordFilterBindings = new WeakMap();
        this.scope = options.scope;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        return Promise.resolve().then(async () => {
            await this.historyPlugin?.handle({ scope: this.scope });
            await this.favoritePlugin?.handle({ scope: this.scope });
            if (this.route === "detail") this.bindDetailKeywordFilter(this.document);
            this.mountStateImportAction();
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    /** Expose the stable library capability surface for later migrations. */
    getApi() {
        const historyCall = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => /** @type {any} */ (this.historyPlugin)?.[name]?.(...args);
        const blacklistCall = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => this.blacklistPlugin?.[name]?.(...args);
        return Object.freeze({
            getHistoryRepository: () => this.historyPlugin?.historyRepository ?? null,
            hasHistory: Boolean(this.historyPlugin),
            openHistory: historyCall("openHistory"),
            reloadHistoryTable: historyCall("reloadTable"),
            hasKeywordFilter: this.keywordFilterEnabled,
            bindDetailKeywordFilter: (/** @type {any[]} */ ...args) => this.bindDetailKeywordFilter(...args),
            hasBlacklist: Boolean(this.blacklistPlugin),
            addBlacklist: blacklistCall("addBlacklist"),
            openBlacklistDialog: blacklistCall("openBlacklistDialog"),
            filterAllVideo: blacklistCall("filterAllVideo"),
            parseAndSaveFilterInfo: blacklistCall("parseAndSaveFilterInfo"),
            resetBtnTip: blacklistCall("resetBtnTip"),
            reloadTable: blacklistCall("reloadTable"),
        });
    }

    /** @param {ParentNode & {addEventListener?: Function, removeEventListener?: Function, contains?: Function}} root @param {{layerIndex?: number | null}} [options] */
    bindDetailKeywordFilter(root = this.document, { layerIndex = null } = {}) {
        if (!this.keywordFilterEnabled || !root || !this.isTitleFilterEnabled()) return false;
        const selector = this.getTitleSelector(), previous = this.keywordFilterBindings.get(root);
        if (previous) root.removeEventListener?.("contextmenu", previous);
        const onContextMenu = async (/** @type {Event} */ rawEvent) => {
            const event = /** @type {MouseEvent} */ (rawEvent);
            const target = /** @type {Element | null} */ (event.target)?.closest?.(selector);
            if (!target || !root.contains?.(target)) return;
            const selected = this.document?.defaultView?.getSelection?.()?.toString() || "";
            if (!selected) return;
            event.preventDefault();
            const confirm = /** @type {any} */ (globalThis).utils?.q;
            const save = async () => {
                const keyword = selected.replace(/\r?\n+/g, " ").replace(/\s{2,}/g, " ").trim().slice(0, 120);
                if (!keyword) return;
                try {
                    await this.saveTitleFilterKeyword(keyword);
                    await this.eventBus?.emit?.("filter-rules-changed", { scope: "title-keyword" });
                    await /** @type {any} */ (globalThis).utils?.closePage?.({ root, layerIndex });
                } catch (error) {
                    /** @type {any} */ (globalThis).clog?.error?.("标题关键词保存失败", error);
                    /** @type {any} */ (globalThis).show?.error?.(`标题关键词保存失败：${error instanceof Error ? error.message : String(error)}`);
                }
            };
            if (confirm) confirm({ clientX: event.clientX, clientY: event.clientY + 80 }, `是否屏蔽标题关键词 ${selected}?`, save);
            else await save();
        };
        root.addEventListener?.("contextmenu", onContextMenu);
        this.keywordFilterBindings.set(root, onContextMenu);
        this.scope.addCleanup?.(() => {
            if (this.keywordFilterBindings.get(root) === onContextMenu) this.keywordFilterBindings.delete(root);
            root.removeEventListener?.("contextmenu", onContextMenu);
        });
        return true;
    }

    isTitleFilterEnabled() {
        const value = this.settings?.snapshot?.().enableTitleSelectFilter;
        return value == null || value === true || value === "yes";
    }

    getTitleSelector() {
        if (this.hostAdapter?.site === "javdb") return ".title strong, .current-title";
        if (this.hostAdapter?.site === "javbus") return "h3";
        return ".current-title, .origin-title, .jhs-detail-title";
    }

    async saveTitleFilterKeyword(/** @type {string} */ keyword) {
        const write = async () => {
            const current = await this.storage?.get?.("filter_keyword_title");
            const list = Array.isArray(current) ? [ ...current ] : [];
            if (list.includes(keyword)) throw new Error(`${keyword} 标题关键词已存在`);
            list.push(keyword);
            await this.storage.set("filter_keyword_title", list);
        };
        if (this.storageMutation?.runExclusive) return this.storageMutation.runExclusive(write);
        return write();
    }

    mountStateImportAction() {
        if (!this.stateImportEnabled) return;
        const href = this.hostAdapter?.location?.href ?? this.document?.defaultView?.location?.href ?? "";
        const flag = href.includes("/want_watch_videos") ? "favorite" : href.includes("/watched_videos") ? "watched" : null;
        const heading = flag && this.document?.querySelector?.("h3");
        if (!flag || !heading || this.document.querySelector("#wantWatchBtn")) return;
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--primary jhs-layout-481ed7e7";
        button.id = "wantWatchBtn";
        button.textContent = "导入至 JHS";
        const onClick = (/** @type {Event} */ rawEvent) => {
            const event = /** @type {MouseEvent} */ (rawEvent);
            const message = flag === "favorite" ? "是否将想看的影片导入到 JHS 收藏？" : "是否将看过的影片导入到 JHS 已观看？";
            const confirm = /** @type {any} */ (globalThis).utils?.q;
            const run = async () => {
                const overlay = /** @type {any} */ (globalThis).loading?.();
                try {
                    const result = await this.parseMovieList();
                    /** @type {any} */ (globalThis).show?.ok?.(`导入完成：成功 ${result.imported}，失败 ${result.failed}，共 ${result.pages} 页`);
                } catch (error) {
                    /** @type {any} */ (globalThis).clog?.error?.(error);
                    /** @type {any} */ (globalThis).show?.error?.(`导入失败：${error instanceof Error ? error.message : String(error)}`);
                } finally {
                    overlay?.close?.();
                }
            };
            if (confirm) confirm(event, `${message} <br/> <span class="jhs-task-emphasis">执行此功能前请记得备份数据</span>`, run);
            else void run();
        };
        button.addEventListener("click", onClick);
        heading.append(button);
        this.scope.addCleanup?.(() => button.remove());
    }

    /** @param {Document | null} [page] @param {{imported: number, failed: number, pages: number}} [result] @returns {Promise<{imported: number, failed: number, pages: number}>} */
    async parseMovieList(page = this.document, result = { imported: 0, failed: 0, pages: 0 }) {
        if (!page) return result;
        const selectors = this.hostAdapter?.getListSelectors?.();
        if (!selectors?.itemSelector) return result;
        const items = page.querySelectorAll(selectors.itemSelector), next = page.querySelector(".pagination-next")?.getAttribute("href");
        result.pages++;
        /** @type {any} */ (globalThis).show?.info?.(`正在导入第 ${result.pages} 页`);
        const locationHref = this.hostAdapter?.location?.href ?? this.document?.defaultView?.location?.href;
        for (const item of items) {
            const href = item.querySelector("a")?.getAttribute("href"), carNum = item.querySelector(".video-title strong")?.textContent?.trim(), publishTime = item.querySelector(".meta")?.textContent?.trim() ?? "";
            if (!href || !carNum) continue;
            try {
                await this.state.patch(carNum, { [this.getStateImportFlag()]: true }, { type: "javdb-list-import", record: { carNum, url: href, names: "", publishTime } });
                result.imported++;
            } catch (error) {
                result.failed++;
                /** @type {any} */ (globalThis).clog?.error?.(`保存失败 [${carNum}]:`, error);
            }
        }
        if (!next || !locationHref) return result;
        await /** @type {any} */ (globalThis).utils?.sleep?.(1000);
        const html = await requestHostPage(this.http, new URL(next, locationHref), this.scope);
        return this.parseMovieList(new DOMParser().parseFromString(html, "text/html"), result);
    }

    getStateImportFlag() {
        const href = this.hostAdapter?.location?.href ?? this.document?.defaultView?.location?.href ?? "";
        return href.includes("/watched_videos") ? "watched" : "favorite";
    }

    dispose() {
        this.started = false;
    }
}
