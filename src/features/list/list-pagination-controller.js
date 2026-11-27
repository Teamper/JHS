// @ts-check
import { mountPageJump } from "../../ui/table/page-jump.js";

/** Own the native next-page jump control for list routes. */
export class ListPaginationController {
    /** @param {{hostAdapter: any, navigation: any, scope: any, document?: Document}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.navigation = options.navigation;
        this.scope = options.scope;
        this.document = options.document ?? this.hostAdapter?.document ?? globalThis.document;
        /** @type {HTMLLIElement | null} */ this.root = null;
        /** @type {MutationObserver | null} */ this.observer = null;
        this.started = false;
        this.disposed = false;
    }

    start() {
        if (this.disposed || this.started || this.hostAdapter?.detectRoute?.() !== "list") return false;
        const document = this.document;
        if (!document) return false;
        this.started = true;
        this.mountIfAvailable();
        const MutationObserverType = document.defaultView?.MutationObserver;
        if (document.body && MutationObserverType) {
            const ElementType = document.defaultView?.Element;
            const touchesPagination = (/** @type {Node} */ node) => {
                if (!ElementType || !(node instanceof ElementType)) return false;
                const element = /** @type {Element} */ (node);
                return element.matches(".pagination, .pagination-list, .pagination-link") || Boolean(element.querySelector(".pagination, .pagination-list, .pagination-link"));
            };
            const itemSelector = this.hostAdapter?.getListSelectors?.()?.itemSelector;
            const observer = new MutationObserverType((/** @type {MutationRecord[]} */ records) => {
                const nodes = new Set(records.flatMap(record => [...record.addedNodes, ...record.removedNodes]));
                const changed = records.some(record => ElementType && record.target instanceof ElementType && /** @type {Element} */ (record.target).closest(".pagination, .pagination-list, .pagination-link"))
                    || [...nodes].some(node => !(ElementType && node instanceof ElementType && itemSelector && /** @type {Element} */ (node).matches(itemSelector)) && touchesPagination(node));
                if (!changed) return;
                if (this.root && !this.root.isConnected) this.root = null;
                this.mountIfAvailable();
            });
            this.observer = observer;
            observer.observe(document.body, { childList: true, subtree: true });
            this.scope.ownObserver(observer);
        }
        return true;
    }

    mountIfAvailable() {
        const document = this.document;
        if (this.root?.isConnected || document.getElementById("gemini-jump-page-control")) return false;
        const boundary = this.hostAdapter.getPaginationBoundary?.();
        if (boundary) {
            this.root = mountPageJump(boundary.list, boundary.page, page => this.navigation.assign(boundary.target(page)), this.scope);
            return true;
        }
        if (this.hostAdapter.getPaginationBoundary) return false;
        const region = this.hostAdapter.resolveListBoundary ? this.hostAdapter.resolveListBoundary()?.pagination : document;
        if (!region?.querySelector(".pagination-link.is-current")) return false;
        const pagination = region.matches?.(".pagination-list") ? region : region.querySelector(".pagination-list");
        if (!pagination) return false;
        const currentUrl = new URL(this.hostAdapter.location.href);
        this.root = mountPageJump(pagination, Number(currentUrl.searchParams.get("page")) || 1, page => {
            const target = new URL(this.hostAdapter.location.href);
            target.searchParams.set("page", String(page));
            this.navigation.assign(target.href);
        }, this.scope);
        return true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.observer?.disconnect();
        this.observer = null;
        this.root?.remove();
        this.root = null;
    }
}

export const LIST_PAGINATION_STYLES = `.jhs-jump-page-input{width:84px;margin-inline-start:var(--jhs-space-2)}.jhs-jump-page-btn{margin-inline-start:var(--jhs-space-1)}`;
