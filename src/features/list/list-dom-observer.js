// @ts-check

import { isHitShowPage } from "../../core/site-context.js";

/** Own list DOM mutations and debounce incremental card processing. */
export class ListDomObserver {
    /** @param {{scope: any, selectors: Record<string, string>, document?: Document, window?: Window & {isListPage?: boolean}, location?: Location | URL | string, state: {advanceListGeneration: () => string, captureListRevision: () => string}, index: {indexItems: (items: Element[]) => void, removeIndexedItems: (nodes: NodeList | Node[]) => void}, processAddedItems: (items: Element[], revision: string) => Promise<void> | void, onPhase?: (phase: string, itemCount?: number | null) => void, onError?: (error: unknown) => void, ui?: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.selectors = Object.freeze({ ...options.selectors });
        this.document = options.document ?? globalThis.document ?? null;
        this.window = options.window ?? this.document?.defaultView ?? globalThis.window ?? null;
        this.location = options.location ?? this.window?.location ?? globalThis.location;
        this.state = options.state;
        this.index = options.index;
        this.processAddedItems = options.processAddedItems;
        this.onPhase = options.onPhase ?? (() => {});
        this.ui = options.ui ?? null;
        this.onError = options.onError ?? ((error) => this.ui?.getClog?.().error?.("列表增量处理失败", error));
        /** @type {Set<Element>} */ this.pendingItems = new Set();
        /** @type {ReturnType<typeof setTimeout> | null} */ this.processTimer = null;
        /** @type {(() => void) | null} */ this.timerCleanup = null;
        /** @type {{disconnect: () => void} | null} */ this.observer = null;
        this.started = false;
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return this.observer;
        this.started = true;
        const locationSearch = "string" === typeof this.location ? new URL(this.location).search : this.location?.search ?? "";
        const ownedHitShowPage = this.location ? isHitShowPage(this.location) : false;
        if (this.disposed || !this.window?.isListPage || ownedHitShowPage || locationSearch.includes("handleTop=1")) return null;
        if (!this.document) return null;
        const root = this.document.querySelector(this.selectors.boxSelector);
        if (!root) {
            this.ui?.getClog?.().error?.("没有找到容器节点!");
            return null;
        }
        this.observer = this.scope.observe(root, (/** @type {MutationRecord[]} */ records) => this.handleMutations(records), { childList: true, subtree: false });
        this.scope.addCleanup(() => this.dispose());
        return this.observer;
    }

    /** @param {MutationRecord[]} records */
    handleMutations(records) {
        if (this.disposed) return;
        for (const record of records) {
            this.index.removeIndexedItems(record.removedNodes);
            if (record.removedNodes.length || record.addedNodes.length) this.state.advanceListGeneration();
            if (record.addedNodes.length) this.onPhase("dom-added", record.addedNodes.length);
            for (const node of record.addedNodes) {
                if (node.nodeType !== 1) continue;
                const element = /** @type {Element} */ (node);
                this.addCandidate(element);
                for (const item of element.querySelectorAll?.(this.selectors.itemSelector) ?? []) this.addCandidate(item);
            }
        }
        this.scheduleProcessing();
    }

    /** @param {Element} element */
    addCandidate(element) {
        if (element.matches?.(this.selectors.itemSelector)) this.index.indexItems([element]);
        if (element.matches?.(this.selectors.itemSelector) && /** @type {HTMLElement} */ (element).dataset?.jhsProcessed !== "true") this.pendingItems.add(element);
    }

    scheduleProcessing() {
        if (!this.pendingItems.size || this.disposed) return;
        this.timerCleanup?.();
        this.processTimer = setTimeout(() => {
            this.timerCleanup?.();
            this.timerCleanup = null;
            this.processTimer = null;
            if (this.disposed) return;
            const items = [...this.pendingItems].filter((item) => item.isConnected && /** @type {HTMLElement} */ (item).dataset?.jhsProcessed !== "true");
            const revision = this.state.captureListRevision();
            this.pendingItems.clear();
            if (!items.length) return;
            void Promise.resolve(this.processAddedItems(items, revision)).catch((error) => this.onError(error));
        }, 100);
        this.timerCleanup = this.scope.ownTimeout(this.processTimer);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.timerCleanup?.();
        this.timerCleanup = null;
        this.processTimer = null;
        this.pendingItems.clear();
        this.observer?.disconnect();
        this.observer = null;
    }
}
