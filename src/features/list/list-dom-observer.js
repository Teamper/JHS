// @ts-check

/** Own debounced discovery of list cards added by host-page navigation. */
export class ListDomObserver {
    /** @param {{root: Element | null, itemSelector: string, scope: any, getRevision: () => string, isProcessed: (item: Element) => boolean, onRemoved: (nodes: NodeList | Node[]) => void, onAddedNodes: (count: number) => void, onAdded: (items: Element[], revision: string) => Promise<any> | any, onError?: (error: unknown) => void, onMissingRoot?: () => void, delay?: number}} options */
    constructor(options) {
        this.root = options.root;
        this.itemSelector = options.itemSelector;
        this.scope = options.scope;
        this.getRevision = options.getRevision;
        this.isProcessed = options.isProcessed;
        this.onRemoved = options.onRemoved;
        this.onAddedNodes = options.onAddedNodes;
        this.onAdded = options.onAdded;
        this.onError = options.onError ?? (() => {});
        this.onMissingRoot = options.onMissingRoot ?? (() => {});
        this.delay = options.delay ?? 100;
        /** @type {Set<Element>} */ this.pendingItems = new Set();
        /** @type {MutationObserver | null} */ this.observer = null;
        /** @type {ReturnType<typeof setTimeout> | null} */ this.timer = null;
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        if (this.disposed) throw new Error("List DOM observer is disposed");
        if (this.observer) return this.observer;
        if (!this.root) {
            this.onMissingRoot();
            return null;
        }
        this.observer = this.scope.observe(this.root, ((/** @type {MutationRecord[]} */ records) => this.handleMutations(records)), { childList: true, subtree: false });
        this.scope.addCleanup(() => this.dispose());
        return this.observer;
    }

    /** @param {MutationRecord[]} records */
    handleMutations(records) {
        if (this.disposed) return;
        for (const record of records) {
            this.onRemoved(record.removedNodes);
            if (record.addedNodes.length) this.onAddedNodes(record.addedNodes.length);
            for (const node of record.addedNodes) {
                if (node.nodeType !== 1) continue;
                const element = /** @type {Element} */ (node);
                element.matches(this.itemSelector) && !this.isProcessed(element) && this.pendingItems.add(element);
                element.querySelectorAll(this.itemSelector).forEach((/** @type {Element} */ item) => {
                    if (!this.isProcessed(item)) this.pendingItems.add(item);
                });
            }
        }
        if (!this.pendingItems.size) return;
        if (this.timer) clearTimeout(this.timer);
        this.timer = setTimeout(() => {
            this.timer = null;
            if (this.disposed) return;
            const items = [ ...this.pendingItems ].filter((item) => item.isConnected && !this.isProcessed(item));
            this.pendingItems.clear();
            if (items.length) void Promise.resolve(this.onAdded(items, this.getRevision())).catch(this.onError);
        }, this.delay);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.timer) clearTimeout(this.timer);
        this.timer = null;
        this.pendingItems.clear();
        if (this.observer) this.scope.releaseObserver(this.observer);
        this.observer = null;
    }
}
