// @ts-check

/**
 * Own the library contributions while their legacy implementations are being
 * migrated away from direct plugin-to-plugin calls.
 */
export class LibraryController {
    /** @param {{historyPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any, historyRepository?: any}, statePlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, keywordFilterPlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, blacklistPlugin?: Record<string, any>, favoritePlugin?: {handle: (options?: {scope: any}) => Promise<any> | any}, scope: any}} options */
    constructor(options) {
        this.historyPlugin = options.historyPlugin ?? null;
        this.statePlugin = options.statePlugin ?? null;
        this.keywordFilterPlugin = options.keywordFilterPlugin ?? null;
        this.blacklistPlugin = options.blacklistPlugin ?? null;
        this.favoritePlugin = options.favoritePlugin ?? null;
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
            await this.keywordFilterPlugin?.handle({ scope: this.scope });
            await this.favoritePlugin?.handle({ scope: this.scope });
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    /** Expose the stable library capability surface for later migrations. */
    getApi() {
        const historyCall = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => /** @type {any} */ (this.historyPlugin)?.[name]?.(...args);
        const keywordFilterCall = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => /** @type {any} */ (this.keywordFilterPlugin)?.[name]?.(...args);
        const blacklistCall = (/** @type {string} */ name) => (/** @type {any[]} */ ...args) => this.blacklistPlugin?.[name]?.(...args);
        return Object.freeze({
            getHistoryRepository: () => this.historyPlugin?.historyRepository ?? null,
            hasHistory: Boolean(this.historyPlugin),
            openHistory: historyCall("openHistory"),
            reloadHistoryTable: historyCall("reloadTable"),
            hasKeywordFilter: Boolean(this.keywordFilterPlugin),
            bindDetailKeywordFilter: keywordFilterCall("bindDetailRoot"),
            hasBlacklist: Boolean(this.blacklistPlugin),
            addBlacklist: blacklistCall("addBlacklist"),
            openBlacklistDialog: blacklistCall("openBlacklistDialog"),
            filterAllVideo: blacklistCall("filterAllVideo"),
            parseAndSaveFilterInfo: blacklistCall("parseAndSaveFilterInfo"),
            resetBtnTip: blacklistCall("resetBtnTip"),
            reloadTable: blacklistCall("reloadTable"),
        });
    }

    dispose() {
        this.started = false;
    }
}
