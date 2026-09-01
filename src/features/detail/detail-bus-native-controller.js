// @ts-check

/** Own JavBus detail-page enhancements and restore the DOM it changes. */
export class DetailBusNativeController {
    /** @param {{hostAdapter: any, ui?: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? null;
        this.ui = options.ui ?? null;
        this.scope = options.scope;
        /** @type {Map<HTMLElement, string>} */
        this.hiddenHeadings = new Map();
        /** @type {Map<HTMLAnchorElement, {hadTarget: boolean, target: string | null}>} */
        this.changedTargets = new Map();
        /** @type {{node: HTMLElement, parent: Node, nextSibling: Node | null, position: string} | null} */
        this.movedAvatar = null;
        /** @type {HTMLButtonElement | null} */
        this.copyButton = null;
        this.copyResetTimer = null;
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || this.hostAdapter?.site !== "javbus" || !this.document) return;
        this.started = true;
        this.hideRecommendations();
        this.repositionStarAvatar();
        this.openGenreLinks();
        this.addCopyCarNumButton();
    }

    hideRecommendations() {
        this.document.querySelectorAll("h4").forEach((/** @type {Element} */ element) => {
            if (!element.textContent?.includes("推薦")) return;
            const heading = /** @type {HTMLElement} */ (element);
            this.hiddenHeadings.set(heading, heading.style.display);
            heading.style.display = "none";
        });
    }

    repositionStarAvatar() {
        if (!this.hostAdapter.location?.href?.includes("/star/")) return;
        const avatar = this.document.querySelector(".avatar-box"), wrapper = avatar?.parentElement;
        if (!wrapper?.parentElement?.parentElement) return;
        const parent = wrapper.parentElement, nextSibling = wrapper.nextSibling;
        this.movedAvatar = { node: wrapper, parent, nextSibling, position: wrapper.style.position };
        wrapper.style.position = "initial";
        parent.parentElement.insertBefore(wrapper, parent);
    }

    openGenreLinks() {
        const baseUrl = this.hostAdapter.location?.href ?? this.document.location?.href ?? "";
        this.document.querySelectorAll(".genre a").forEach((/** @type {Element} */ element) => {
            const anchor = /** @type {HTMLAnchorElement} */ (element), href = anchor.getAttribute("href");
            if (!href) return;
            try {
                if (!["http:", "https:"].includes(new URL(href, baseUrl).protocol)) return;
            } catch {
                return;
            }
            this.changedTargets.set(anchor, { hadTarget: anchor.hasAttribute("target"), target: anchor.getAttribute("target") });
            anchor.target = "_blank";
        });
    }

    addCopyCarNumButton() {
        const header = [...this.document.querySelectorAll("span.header")].find((/** @type {Element} */ element) => element.textContent?.trim() === "識別碼:");
        const value = header?.nextElementSibling;
        if (!header || !value || value.tagName !== "SPAN") return;
        if (value.nextElementSibling?.matches(".jhs-copy-car-number")) return;
        const carNum = value.textContent?.trim() ?? "";
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--secondary jhs-copy-car-number";
        button.textContent = "复制";
        this.scope.listen(button, "click", (/** @type {Event} */ event) => {
            event.preventDefault();
            void this.copyCarNum(button, carNum);
        });
        value.parentNode?.insertBefore(button, value.nextSibling);
        this.copyButton = button;
        this.scope.addCleanup(() => button.remove());
    }

    /** @param {HTMLButtonElement} button @param {string} carNum */
    async copyCarNum(button, carNum) {
        const copyToClipboard = this.ui?.getUtils?.()?.copyToClipboard;
        if (typeof copyToClipboard !== "function") return;
        if (!await copyToClipboard.call(this.ui.getUtils(), "番号", carNum) || this.disposed) return;
        button.textContent = "已复制";
        if (this.copyResetTimer !== null) clearTimeout(this.copyResetTimer);
        this.copyResetTimer = setTimeout(() => {
            this.copyResetTimer = null;
            if (!this.disposed) button.textContent = "复制";
        }, 1500);
        this.scope.ownTimeout(this.copyResetTimer);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.copyResetTimer !== null) clearTimeout(this.copyResetTimer);
        this.copyResetTimer = null;
        for (const [heading, display] of this.hiddenHeadings) heading.style.display = display;
        for (const [anchor, previous] of this.changedTargets) {
            if (previous.hadTarget) anchor.setAttribute("target", previous.target ?? "");
            else anchor.removeAttribute("target");
        }
        if (this.movedAvatar) {
            const { node, parent, nextSibling, position } = this.movedAvatar;
            node.style.position = position;
            parent.insertBefore(node, nextSibling);
        }
        this.copyButton?.remove();
        this.hiddenHeadings.clear();
        this.changedTargets.clear();
        this.movedAvatar = null;
        this.copyButton = null;
    }
}
