// @ts-check

/** Preserve JavBus host markup repairs at the List Feature boundary. */
export class ListHostMarkupController {
    /** @param {{hostAdapter: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? null;
        this.isJavBus = options.hostAdapter?.site === "javbus";
    }

    /** Restore the single JavBus list root before the Feature resolves its selectors. */
    normalizeInitialMarkup() {
        if (!this.isJavBus || !this.document) return false;
        const header = this.document.querySelector("#waterfall_h");
        if (header) header.id = "no-page";
        for (const wrapper of this.document.querySelectorAll('[id="waterfall"]')) {
            if (wrapper.classList.contains("masonry") || !wrapper.parentNode) continue;
            wrapper.replaceWith(...wrapper.children);
        }
        return true;
    }

    /** Apply the legacy title presentation without interpreting host-provided text as markup. @param {Element[]} items */
    normalizeCards(items) {
        if (!this.isJavBus) return 0;
        let normalized = 0;
        for (const item of items) {
            if (item.matches(".avatar-box") || item.querySelector(".avatar-box")) continue;
            const target = item.querySelector(".photo-info span");
            if (target && !target.classList.contains("video-title") && !target.querySelector(".video-title") && target.firstChild) {
                const image = item.querySelector("img");
                const title = (image?.getAttribute("title") || image?.getAttribute("data-title") || "").trim();
                const wrapper = this.document.createElement("span");
                wrapper.className = "video-title";
                wrapper.setAttribute("title", title);
                const hostTitle = title ? [...target.childNodes].find((node) => node.nodeType === 3 && node.textContent?.trim() === title) : null;
                if (hostTitle) {
                    target.removeChild(hostTitle);
                    wrapper.textContent = title;
                    target.insertBefore(wrapper, target.firstChild);
                } else {
                    const firstChild = target.firstChild;
                    target.replaceChild(wrapper, firstChild);
                    wrapper.append(this.document.createTextNode(title), firstChild);
                }
                normalized++;
            }
            item.querySelectorAll("br").forEach((element) => element.remove());
        }
        return normalized;
    }
}
