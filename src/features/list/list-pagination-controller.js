// @ts-check

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
            const observer = new MutationObserverType((/** @type {MutationRecord[]} */ records) => {
                const changed = records.some((/** @type {MutationRecord} */ record) => touchesPagination(record.target) || [...record.addedNodes, ...record.removedNodes].some(touchesPagination));
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
        if (!document || this.root?.isConnected || document.getElementById("gemini-jump-page-control") || !document.querySelector(".pagination-link.is-current")) return false;
        const pagination = document.querySelector(".pagination-list");
        if (!pagination) return false;

        const currentUrl = new URL(this.hostAdapter.location.href);
        const input = document.createElement("input");
        input.type = "number";
        input.className = "jhs-field jhs-jump-page-input";
        input.id = "jumpPageInput";
        input.placeholder = "页码";
        input.min = "1";
        input.value = String(Number(currentUrl.searchParams.get("page") || "1") + 1);
        const button = document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--secondary jhs-jump-page-btn";
        button.textContent = "跳转";
        const root = document.createElement("li");
        root.id = "gemini-jump-page-control";
        root.append(input, button);

        const submit = () => {
            const page = Number.parseInt(input.value, 10);
            if (!Number.isInteger(page) || page < 1) {
                input.focus();
                return;
            }
            const target = new URL(this.hostAdapter.location.href);
            target.searchParams.set("page", String(page));
            this.navigation.assign(target.href);
        };
        const onKeypress = (/** @type {KeyboardEvent} */ event) => {
            if (event.key !== "Enter") return;
            submit();
            event.preventDefault();
        };
        button.addEventListener("click", submit);
        input.addEventListener("keypress", onKeypress);
        pagination.append(root);
        this.root = root;
        this.scope.addCleanup(() => {
            button.removeEventListener("click", submit);
            input.removeEventListener("keypress", onKeypress);
            root.remove();
            if (this.root === root) this.root = null;
        });
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

export const LIST_PAGINATION_STYLES = `.jhs-jump-page-input{width:60px;margin-left:10px}.jhs-jump-page-btn{margin-left:5px}`;
