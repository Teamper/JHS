// @ts-check

/** Own JavBus native detail and actress-page affordances for one Feature lifetime. */
export class JavBusNativeController {
    /** @param {{document: Document, location: Pick<Location, "href" | "pathname">, isDetailPage: boolean, clipboard: {copyText: (label: string, value: unknown) => Promise<boolean>}}} options */
    constructor(options) {
        this.document = options.document;
        this.location = options.location;
        this.isDetailPage = options.isDetailPage;
        this.clipboard = options.clipboard;
        /** @type {Array<{anchor: HTMLAnchorElement, previous: string | null}>} */ this.changedTargets = [];
        /** @type {Array<{element: HTMLElement, value: string, priority: string}>} */ this.hiddenHeadings = [];
        /** @type {HTMLButtonElement | null} */ this.copyButton = null;
        /** @type {HTMLElement | null} */ this.avatarWrapper = null;
        /** @type {HTMLElement | null} */ this.avatarParent = null;
        /** @type {Node | null} */ this.avatarNextSibling = null;
        this.avatarPosition = "";
        this.avatarPositionPriority = "";
        /** @type {number | null} */ this.copyLabelTimer = null;
        this.disposed = false;
    }

    /** @param {import("../../core/lifecycle-scope.js").LifecycleScope} scope */
    start(scope) {
        scope.assertActive();
        if (this.disposed) return false;
        if (this.location.pathname.includes("/star/")) this.moveAvatarWrapper();
        if (this.isDetailPage) this.hideRecommendedHeading();
        this.openGenreLinksInNewTabs();
        this.mountCopyCarNumberButton();
        scope.addCleanup(() => this.dispose());
        return true;
    }

    hideRecommendedHeading() {
        for (const candidate of this.document.querySelectorAll("h4")) {
            if (!candidate.textContent?.includes("推薦")) continue;
            const heading = /** @type {HTMLElement} */ (candidate);
            this.hiddenHeadings.push({ element: heading, value: heading.style.getPropertyValue("display"), priority: heading.style.getPropertyPriority("display") });
            heading.style.setProperty("display", "none");
        }
    }

    moveAvatarWrapper() {
        const wrapper = this.document.querySelector(".avatar-box")?.parentElement;
        const parent = wrapper?.parentElement;
        const destination = parent?.parentElement;
        if (!wrapper || !parent || !destination) return;
        this.avatarWrapper = wrapper;
        this.avatarParent = parent;
        this.avatarNextSibling = wrapper.nextSibling;
        this.avatarPosition = wrapper.style.getPropertyValue("position");
        this.avatarPositionPriority = wrapper.style.getPropertyPriority("position");
        wrapper.style.setProperty("position", "initial");
        destination.insertBefore(wrapper, parent);
    }

    openGenreLinksInNewTabs() {
        for (const element of this.document.querySelectorAll(".genre a[href]")) {
            const anchor = /** @type {HTMLAnchorElement} */ (element);
            try {
                const protocol = new URL(anchor.getAttribute("href") || "", this.location.href).protocol;
                if (!["http:", "https:"].includes(protocol) || anchor.getAttribute("target") === "_blank") continue;
                this.changedTargets.push({ anchor, previous: anchor.getAttribute("target") });
                anchor.setAttribute("target", "_blank");
            } catch { /* Keep malformed host URLs unchanged. */ }
        }
    }

    mountCopyCarNumberButton() {
        const label = [...this.document.querySelectorAll("span.header")]
            .find((element) => element.textContent?.trim() === "識別碼:");
        const value = label?.nextElementSibling;
        if (!value || value.tagName !== "SPAN") return;
        const carNumber = value.textContent?.trim() || "";
        if (!carNumber) return;
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--secondary jhs-copy-car-number";
        button.textContent = "复制";
        button.addEventListener("click", this.copyCarNumber);
        value.parentNode?.insertBefore(button, value.nextSibling);
        this.copyButton = button;
    }

    /** @param {MouseEvent} event */
    copyCarNumber = async (event) => {
        event.preventDefault();
        if (this.disposed || !this.copyButton) return;
        const value = [...this.document.querySelectorAll("span.header")]
            .find((element) => element.textContent?.trim() === "識別碼:")?.nextElementSibling?.textContent?.trim();
        if (!value || !await this.clipboard.copyText("番号", value) || this.disposed || !this.copyButton) return;
        this.copyButton.textContent = "已复制";
        if (this.copyLabelTimer != null) clearTimeout(this.copyLabelTimer);
        this.copyLabelTimer = setTimeout(() => {
            this.copyLabelTimer = null;
            if (!this.disposed && this.copyButton) this.copyButton.textContent = "复制";
        }, 1500);
    };

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.copyLabelTimer != null) clearTimeout(this.copyLabelTimer);
        this.copyLabelTimer = null;
        if (this.copyButton) {
            this.copyButton.removeEventListener("click", this.copyCarNumber);
            this.copyButton.remove();
            this.copyButton = null;
        }
        for (const { anchor, previous } of this.changedTargets) {
            if (anchor.getAttribute("target") !== "_blank") continue;
            if (previous == null) anchor.removeAttribute("target");
            else anchor.setAttribute("target", previous);
        }
        this.changedTargets = [];
        for (const { element, value, priority } of this.hiddenHeadings) {
            if (element.style.getPropertyValue("display") !== "none") continue;
            if (value) element.style.setProperty("display", value, priority);
            else element.style.removeProperty("display");
        }
        this.hiddenHeadings = [];
        if (this.avatarWrapper && this.avatarParent?.isConnected) {
            this.avatarParent.insertBefore(this.avatarWrapper, this.avatarNextSibling?.parentNode === this.avatarParent ? this.avatarNextSibling : null);
            if (this.avatarPosition) this.avatarWrapper.style.setProperty("position", this.avatarPosition, this.avatarPositionPriority);
            else this.avatarWrapper.style.removeProperty("position");
        }
        this.avatarWrapper = null;
        this.avatarParent = null;
        this.avatarNextSibling = null;
    }
}
