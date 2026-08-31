// @ts-check

/**
 * Own the library contributions while their legacy implementations are being
 * migrated away from direct plugin-to-plugin calls.
 */
export class LibraryController {
    /** @param {{historyPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any, historyRepository?: any}, statePlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, blacklistPlugin?: Record<string, any>, favoritePlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, keywordFilterEnabled?: boolean, hostAdapter?: any, storage?: any, settings?: any, eventBus?: any, storageMutation?: any, route?: string, scope: any}} options */
    constructor(options) {
        this.historyPlugin = options.historyPlugin ?? null;
        this.statePlugin = options.statePlugin ?? null;
        this.blacklistPlugin = options.blacklistPlugin ?? null;
        this.favoritePlugin = options.favoritePlugin ?? null;
        this.keywordFilterEnabled = options.keywordFilterEnabled !== false;
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.storage = options.storage;
        this.settings = options.settings;
        this.eventBus = options.eventBus;
        this.storageMutation = options.storageMutation;
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
            await this.statePlugin?.handle({ scope: this.scope });
            await this.favoritePlugin?.handle({ scope: this.scope });
            if (this.route === "detail") this.bindDetailKeywordFilter(this.document);
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
        if (!root || !this.isTitleFilterEnabled()) return false;
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

    dispose() {
        this.started = false;
    }
}
