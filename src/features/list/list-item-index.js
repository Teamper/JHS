// @ts-check

import { normalizeCarNum } from "../../core/constants.js";

/** Index rendered list cards by the release car-number identity. */
export class ListItemIndex {
    /** @param {{readCarNum: (item: Element) => unknown, onReadError?: (error: unknown, item: Element) => void}} options */
    constructor(options) {
        this.readCarNum = options.readCarNum;
        this.onReadError = options.onReadError ?? (() => {});
        /** @type {Map<string, Set<Element>>} */ this.itemsByCarNum = new Map();
        /** @type {WeakMap<Element, string>} */ this.carNumByItem = new WeakMap();
    }

    /** @param {Element[]} items */
    rebuild(items) {
        this.clear();
        this.add(items);
    }

    /** @param {Element[]} items */
    add(items) {
        for (const item of items) {
            let key;
            try {
                key = normalizeCarNum(this.readCarNum(item));
            } catch (error) {
                this.onReadError(error, item);
                continue;
            }
            if (!key) continue;
            this.remove(item);
            const indexedItems = this.itemsByCarNum.get(key) ?? new Set();
            indexedItems.add(item);
            this.itemsByCarNum.set(key, indexedItems);
            this.carNumByItem.set(item, key);
        }
    }

    /** @param {NodeList | Node[]} nodes @param {string} itemSelector */
    removeNodes(nodes, itemSelector) {
        const removed = new Set();
        for (const node of Array.from(nodes || [])) {
            if (node.nodeType !== 1) continue;
            const element = /** @type {Element} */ (node);
            element.matches(itemSelector) && removed.add(element);
            element.querySelectorAll(itemSelector).forEach((/** @type {Element} */ item) => removed.add(item));
        }
        for (const item of removed) this.remove(item);
    }

    /** @param {unknown[]} carNums @returns {Element[]} */
    get(carNums) {
        const result = new Set();
        for (const value of carNums) {
            const key = normalizeCarNum(value);
            if (!key) continue;
            const indexedItems = this.itemsByCarNum.get(key);
            if (!indexedItems) continue;
            for (const item of indexedItems) {
                if (item.isConnected) result.add(item);
                else this.remove(item);
            }
        }
        return [ ...result ];
    }

    /** @param {Element} item */
    remove(item) {
        const key = this.carNumByItem.get(item);
        if (!key) return;
        const indexedItems = this.itemsByCarNum.get(key);
        indexedItems?.delete(item);
        if (indexedItems && !indexedItems.size) this.itemsByCarNum.delete(key);
        this.carNumByItem.delete(item);
    }

    clear() {
        this.itemsByCarNum.clear();
        this.carNumByItem = new WeakMap();
    }
}
