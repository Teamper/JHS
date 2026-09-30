// @ts-check

import { readListItem } from "../../core/list-item-reader.js";

const FC2_PRIMARY_SELECTOR = '.item a[data-jhs-fc2-primary="true"]';
const FC2_NAVIGATION_EVENTS = "click.jhsFc2Navigation auxclick.jhsFc2Navigation";

/** List-owned FC2 card navigation with an injected capability for FC2 lookup and opening. */
export class Fc2NavigationController {
    /** @param {{hostAdapter: any, fc2: any, eventBus: any, ui: {jquery: (value: any) => any}, scope: import("../../core/lifecycle-scope.js").LifecycleScope, logger?: Pick<Console, "warn" | "error">, document?: Document}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.fc2 = options.fc2;
        this.eventBus = options.eventBus;
        this.ui = options.ui;
        this.scope = options.scope;
        this.logger = options.logger ?? console;
        this.document = options.document ?? options.hostAdapter?.document ?? globalThis.document;
        this.boundRoot = null;
        this.reprotectTimer = null;
        this.attachPromise = null;
        this.unsubscribeItems = null;
        this.disposed = false;
        this.started = false;
    }

    async start() {
        this.scope.assertActive();
        if (this.started || !this.fc2) return false;
        this.started = true;
        this.scope.addCleanup(() => this.dispose());
        this.unsubscribeItems = this.eventBus?.on?.("list-items-added", (/** @type {any} */ payload) => {
            if (payload?.items?.length) this.scheduleReprotect();
        }) ?? null;
        if (this.unsubscribeItems) this.scope.addCleanup(this.unsubscribeItems);

        const initialRoot = this.hostAdapter?.locateListRoot?.() ?? null;
        if (initialRoot) {
            this.scope.observe(initialRoot, (records) => {
                if (records.some((record) => record.addedNodes.length)) this.scheduleReprotect();
            }, { childList: true, subtree: false });
        }
        const documentRoot = this.document?.documentElement;
        if (documentRoot) {
            this.scope.observe(documentRoot, () => {
                if (this.hostAdapter?.locateListRoot?.() !== this.boundRoot) this.scheduleReprotect();
            }, { childList: true, subtree: true });
        }

        await this.ensureAttached();
        return !this.disposed && !this.scope.disposed;
    }

    scheduleReprotect() {
        if (this.disposed || this.scope.disposed || this.reprotectTimer != null) return;
        this.reprotectTimer = setTimeout(() => {
            this.reprotectTimer = null;
            void this.ensureAttached().catch((/** @type {unknown} */ error) => this.logger.warn("FC2 动态导航保护失败", error));
        }, 80);
    }

    ensureAttached() {
        if (this.disposed || this.scope.disposed) return Promise.resolve(false);
        if (this.attachPromise) return this.attachPromise;
        this.attachPromise = (async () => {
            const current = this.hostAdapter?.locateListRoot?.();
            if (!current) return false;
            const root = this.ui.jquery(current).first();
            if (!root.length) return false;
            await this.protectFc2Navigation(root);
            if (this.disposed || this.scope.disposed || !current.isConnected) return false;
            if (this.boundRoot !== current) {
                this.releaseBoundRoot();
                this.boundRoot = current;
            }
            this.bindFc2Navigation(root);
            return true;
        })().finally(() => { this.attachPromise = null; });
        return this.attachPromise;
    }

    /** @param {any} root */
    async protectFc2Navigation(root) {
        for (const element of root.find(".item").toArray()) {
            const item = this.ui.jquery(element);
            if (item.attr("data-jhs-fc2-protected") === "true") continue;
            try {
                const { carNum, aHref, fc2Source } = readListItem(item);
                if (!carNum?.includes("FC2-") || !aHref) continue;
                const source = fc2Source || (await this.fc2.resolveFc2Source({ url: aHref })) || "";
                if (this.disposed || this.scope.disposed || !element.isConnected || !root[0]?.contains(element)) continue;
                const primaryAnchor = item.find("a").first();
                if (!primaryAnchor.length) continue;
                item.attr({
                    "data-jhs-original-url": aHref,
                    "data-jhs-fc2-source": source,
                    "data-jhs-fc2-protected": "true",
                });
                primaryAnchor.attr("data-jhs-fc2-primary", "true");
            } catch (error) {
                this.logger.warn("FC2 导航保护初始化失败", error);
            }
        }
    }

    /** @param {any} root */
    bindFc2Navigation(root) {
        root.off(FC2_NAVIGATION_EVENTS, FC2_PRIMARY_SELECTOR);
        root.find(FC2_PRIMARY_SELECTOR).each((/** @type {number} */ _index, /** @type {Element} */ element) => {
            this.ui.jquery(element).off(FC2_NAVIGATION_EVENTS).on(FC2_NAVIGATION_EVENTS, (/** @type {any} */ event) => this.handleNavigation(event));
        });
    }

    /** @param {any} event */
    async handleNavigation(event) {
        if ("auxclick" === event.type && 1 !== event.button || "click" === event.type && event.button && 0 !== event.button) return;
        const $ = this.ui.jquery;
        if (event.shiftKey || event.altKey || $(event.target).closest("button,input,select,textarea,[role='button'],[role='menu'],[role='menuitem'],[contenteditable='true'],a[href]:not([data-jhs-fc2-primary]),.jhs-cover-tools,.tool-box,.jhs-card-menu,.jhs-toolbar,div.meta-buttons,[class^='jhs-match-']").length) return;
        const item = $(event.currentTarget).closest(".item");
        const shouldOpenTab = Boolean(event.ctrlKey || event.metaKey || 1 === event.button);
        const fallbackToNative = (/** @type {string} */ href, /** @type {string} */ carNum, /** @type {unknown} */ error) => {
            try { this.logger.error("打开 FC2 详情失败，回退原始链接", error); } catch { /* logging must not block native navigation */ }
            this.fc2.openNativeFallback?.(href, carNum, { event, newTab: shouldOpenTab });
        };

        let carNum;
        let aHref;
        let fc2Source;
        try {
            const record = readListItem(item);
            carNum = record.carNum;
            aHref = item.attr("data-jhs-original-url") || record.aHref;
            fc2Source = record.fc2Source;
        } catch (error) {
            aHref = item.attr("data-jhs-original-url") || item.find("a").first().attr("href");
            carNum = item.find(".video-title strong").first().text().trim();
            if (!aHref) return;
            event.preventDefault();
            event.stopPropagation();
            fallbackToNative(aHref, carNum, error);
            return;
        }
        if (!carNum?.includes("FC2-") || !aHref) return;
        event.preventDefault();
        event.stopPropagation();
        try {
            const movieId = await this.fc2.resolveMovieIdForRecord(carNum, aHref);
            if (this.disposed || this.scope.disposed || !item[0]?.isConnected) return;
            const source = fc2Source || (await this.fc2.resolveFc2Source({ url: aHref })) || "";
            if (this.disposed || this.scope.disposed || !item[0]?.isConnected) return;
            if (shouldOpenTab) {
                await this.fc2.openFc2Page(movieId, carNum, aHref, { event, newTab: true }, { source });
            } else {
                this.fc2.openFc2Dialog(movieId, carNum, aHref, { source });
            }
        } catch (error) { fallbackToNative(aHref, carNum, error); }
    }

    releaseBoundRoot() {
        if (!this.boundRoot) return;
        const root = this.ui.jquery(this.boundRoot);
        root.off(FC2_NAVIGATION_EVENTS, FC2_PRIMARY_SELECTOR);
        root.find(FC2_PRIMARY_SELECTOR).off(FC2_NAVIGATION_EVENTS);
        this.boundRoot = null;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.reprotectTimer != null) clearTimeout(this.reprotectTimer);
        this.reprotectTimer = null;
        this.releaseBoundRoot();
        this.unsubscribeItems?.();
        this.unsubscribeItems = null;
    }
}
