// @ts-check

import { normalizeCarNum } from "../../core/constants.js";

/** Own the live list-card index used by state-change refreshes. */
export class ListIndexController {
    /** @param {{scope: any, selectors: Record<string, string>, document?: Document, readItem: (item: Element) => {carNum?: unknown} | null | undefined, ui?: any}} options */
    constructor(options) {
        this.scope = options.scope;
        this.selectors = Object.freeze({ ...options.selectors });
        this.document = options.document ?? globalThis.document ?? null;
        this.readItem = options.readItem;
        this.ui = options.ui ?? null;
        /** @type {Map<string, Set<Element>>} */
        this.items = new Map();
        this.disposed = false;
    }

    /** @param {Element[]} items */
    indexItems(items) {
        if (this.disposed) return;
        for (const item of items) {
            try {
                const key = normalizeCarNum(this.readItem(item)?.carNum);
                if (!key) continue;
                const indexed = this.items.get(key) ?? new Set();
                indexed.add(item);
                this.items.set(key, indexed);
            } catch (error) {
                this.ui?.getClog?.().debug?.("列表项索引跳过无效卡片", error);
            }
        }
    }

    rebuildItemIndex() {
        this.scope.assertActive();
        this.items.clear();
        const items = this.document ? [...this.document.querySelectorAll(this.selectors.itemSelector)] : [];
        this.indexItems(items);
        return items;
    }

    /** @param {NodeList | Node[]} nodes */
    removeIndexedItems(nodes) {
        if (this.disposed) return;
        const removed = new Set();
        for (const node of Array.from(nodes ?? [])) {
            if (node.nodeType !== 1) continue;
            const element = /** @type {Element} */ (node);
            removed.add(element);
            element.querySelectorAll(this.selectors.itemSelector).forEach((item) => removed.add(item));
        }
        if (!removed.size) return;
        for (const [key, items] of this.items) {
            for (const item of items) if (removed.has(item)) items.delete(item);
            if (!items.size) this.items.delete(key);
        }
    }

    /** @param {unknown[]} carNums */
    getIndexedItems(carNums) {
        if (this.disposed) return [];
        const result = new Set();
        for (const value of carNums.map(normalizeCarNum)) {
            if (!value) continue;
            const items = this.items.get(value);
            for (const item of items ?? []) {
                if (item.isConnected) result.add(item);
                else items?.delete(item);
            }
            if (items && !items.size) this.items.delete(value);
        }
        return [...result];
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.items.clear();
    }
}
