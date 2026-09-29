// @ts-check

const ACTRESS_LINK_SELECTOR = ".actor-box a[href], .actress-card a[href], [data-actress-card] a[href]";
const COMMENT_IMAGE_SELECTOR = ".preview-images img,#sample-waterfall img,.movie-gallery img";
const PROFILE_STATE_CLASS = "jhs-actress-profile-state";
const CARD_STATE_CLASS = "jhs-actress-card-state";

/** Keep small cross-page compatibility behavior out of the legacy plugin runtime. */
export class CompatibilityController {
    /** @param {{document: Document, window: Window, location: Location, site: string, route: string, host: any, style: any, state: any, notifications: any, ui: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, diagnostics: any}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.location = options.location;
        this.site = options.site;
        this.route = options.route;
        this.host = options.host;
        this.style = options.style;
        this.state = options.state;
        this.notifications = options.notifications;
        this.ui = options.ui;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics;
        this.releaseStyle = null;
        this.removeRecordButton = null;
        this.commentLinks = new Set();
        this.stateContainers = new Set();
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        if (this.site === "javdb") this.releaseStyle = this.style.register("feature-compatibility-ad-container", ".sda-content { display:none!important; }");
        this.scope.listen(this.document, "actress-state-changed", () => {
            for (const node of this.document.querySelectorAll(".jhs-actress-state-container")) node.remove();
            this.stateContainers.clear();
            void this.decorateActresses().catch((error) => this.reportError(error));
        });
        this.scheduleInitialWork();
        this.scope.addCleanup(() => this.dispose());
        return true;
    }

    scheduleInitialWork() {
        let active = true;
        const run = () => {
            if (!active || this.scope.disposed) return;
            void this.initializePage().catch((error) => this.reportError(error));
        };
        let cancel = () => {};
        if (typeof this.window.requestIdleCallback === "function") {
            const id = this.window.requestIdleCallback(run, { timeout: 1500 });
            cancel = () => this.window.cancelIdleCallback?.(id);
        } else {
            const id = this.window.setTimeout(run, 100);
            cancel = () => this.window.clearTimeout(id);
        }
        this.scope.addCleanup(() => { active = false; cancel(); });
    }

    async initializePage() {
        await this.decorateActresses();
        if (this.scope.disposed) return;
        if (this.route === "detail") await this.addRemoveRecord();
        if (!this.scope.disposed) this.linkCommentImages();
    }

    async decorateActresses() {
        const [favorites, blacklist] = await Promise.all([
            this.state.getFavoriteActressList(),
            this.state.getBlacklist(),
        ]);
        if (this.scope.disposed) return;
        const favoriteIds = new Set(favorites.map((/** @type {{starId?: unknown}} */ item) => String(item.starId)));
        const blacklistIds = new Set(blacklist.map((/** @type {{starId?: unknown, id?: unknown}} */ item) => String(item.starId || item.id)));
        this.decorateCurrentActressProfile(favoriteIds, blacklistIds);
        this.decorateActressCards(favoriteIds, blacklistIds);
    }

    /** @param {Set<string>} favorites @param {Set<string>} blacklist */
    decorateCurrentActressProfile(favorites, blacklist) {
        const match = this.location.pathname.match(/^\/(?:actors|star)\/([^/?#]+)\/?$/u);
        if (!match) return;
        const host = this.document.querySelector(".actor-section-name,.star-name,h1.title");
        if (!host) return;
        let starId;
        try { starId = decodeURIComponent(match[1]); }
        catch { return; }
        this.renderActressState(host, starId, favorites, blacklist, PROFILE_STATE_CLASS);
    }

    /** @param {Set<string>} favorites @param {Set<string>} blacklist */
    decorateActressCards(favorites, blacklist) {
        for (const anchor of this.document.querySelectorAll(ACTRESS_LINK_SELECTOR)) {
            const identity = this.getActressIdentity(anchor);
            if (!identity) continue;
            const card = anchor.closest(".actor-box,.actress-card,[data-actress-card]");
            if (card) this.renderActressState(card, identity, favorites, blacklist, CARD_STATE_CLASS);
        }
    }

    /** @param {Element} anchor */
    getActressIdentity(anchor) {
        if (anchor.closest('.toolbar,.tabs,.buttons,.pagination,.filter,.filters,nav,header,[role="tablist"]')) return null;
        try {
            const url = new URL(anchor.getAttribute("href") || "", this.location.href);
            if (url.search || url.hash) return null;
            const match = url.pathname.match(/^\/(?:actors|star)\/([^/]+)\/?$/u);
            return match ? decodeURIComponent(match[1]) : null;
        } catch { return null; }
    }

    /** @param {Element} host @param {string} starId @param {Set<string>} favorites @param {Set<string>} blacklist @param {string} className */
    renderActressState(host, starId, favorites, blacklist, className) {
        if (host.querySelector(":scope > .jhs-actress-state-container")) return;
        const container = this.document.createElement("span");
        container.className = `jhs-actress-state-container ${className}`;
        if (favorites.has(starId)) container.append(this.createBadge("jhs-badge--fav", "已关注"));
        if (blacklist.has(starId)) container.append(this.createBadge("jhs-badge--danger", "已拉黑"));
        if (container.childElementCount) host.append(container);
        if (container.isConnected) this.stateContainers.add(container);
    }

    /** @param {string} variant @param {string} label */
    createBadge(variant, label) {
        const badge = this.document.createElement("span");
        badge.className = `jhs-badge ${variant}`;
        badge.textContent = label;
        return badge;
    }

    async addRemoveRecord() {
        const carNum = this.host.readMovieRef()?.carNum;
        if (!carNum || !(await this.state.getState(carNum)) || this.scope.disposed) return;
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--danger jhs-remove-car";
        button.textContent = "移除记录";
        const slot = this.document.querySelector(".jhs-detail-btn-row,.movie-info-container,.container .info");
        if (!slot) return;
        slot.append(button);
        this.removeRecordButton = button;
        this.scope.listen(button, "click", (event) => {
            const escapedCarNum = this.document.createElement("span");
            escapedCarNum.textContent = carNum;
            const message = `确定移除 ${escapedCarNum.innerHTML} 的鉴定记录？`;
            this.ui.confirm(event, message, () => { void this.removeRecord(carNum, button); });
        });
    }

    /** @param {string} carNum @param {HTMLButtonElement} button */
    async removeRecord(carNum, button) {
        try {
            await this.state.remove(carNum);
            button.remove();
            for (const item of this.host.locateListItems?.() ?? []) {
                if (item.querySelector(".video-title strong")?.textContent?.trim() !== carNum) continue;
                if (item.getAttribute("data-hide") === "yes") {
                    item.removeAttribute("data-hide");
                    /** @type {HTMLElement} */ (item).style.removeProperty("display");
                }
            }
            this.notifications.ok("鉴定记录已移除");
        } catch (error) {
            this.reportError(error);
            this.notifications.error("移除鉴定记录失败");
        }
    }

    linkCommentImages() {
        const images = this.document.querySelectorAll(COMMENT_IMAGE_SELECTOR);
        if (!images.length) return;
        for (const review of this.document.querySelectorAll(".review-content")) this.linkCommentImageTextNodes(review, images.length);
        this.scope.listen(this.document, "click", (event) => {
            const target = event.target;
            const ElementConstructor = this.document.defaultView?.Element;
            if (!ElementConstructor || !(target instanceof ElementConstructor)) return;
            const link = target.closest(".jhs-comment-image-link");
            if (!link) return;
            event.preventDefault();
            const index = Number(link.getAttribute("data-image-index"));
            const image = this.document.querySelectorAll(COMMENT_IMAGE_SELECTOR).item(index);
            if (image) this.ui.openImageViewer(image);
        });
    }

    /** @param {Element} element @param {number} imageCount */
    linkCommentImageTextNodes(element, imageCount) {
        const walker = this.document.createTreeWalker(element, this.document.defaultView?.NodeFilter.SHOW_TEXT ?? 4);
        /** @type {Text[]} */ const nodes = [];
        while (walker.nextNode()) {
            const textNode = /** @type {Text} */ (walker.currentNode);
            if (!textNode.parentElement?.closest("a,button,code,pre,textarea,.jhs-comment-image-link") && /(?:图|圖片|图片)\s*[一二三四五六七八九十\d]+/iu.test(textNode.nodeValue || "")) nodes.push(textNode);
        }
        for (const textNode of nodes) {
            const text = textNode.nodeValue || "", pattern = /(?:图|圖片|图片)\s*([一二三四五六七八九十\d]+)/giu, fragment = this.document.createDocumentFragment();
            let cursor = 0, match;
            while ((match = pattern.exec(text))) {
                if (match.index > cursor) fragment.append(this.document.createTextNode(text.slice(cursor, match.index)));
                const chinese = /** @type {Record<string, number>} */ ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }), index = (chinese[match[1]] || Number(match[1])) - 1;
                if (index >= 0 && index < imageCount) {
                    const link = this.document.createElement("a");
                    link.href = "#";
                    link.className = "jhs-comment-image-link";
                    link.dataset.imageIndex = String(index);
                    link.textContent = match[0];
                    fragment.append(link);
                    this.commentLinks.add(link);
                } else fragment.append(this.document.createTextNode(match[0]));
                cursor = match.index + match[0].length;
            }
            if (cursor < text.length) fragment.append(this.document.createTextNode(text.slice(cursor)));
            textNode.replaceWith(fragment);
        }
    }

    /** @param {unknown} error */
    reportError(error) {
        this.diagnostics?.recordError?.({ source: "compatibility-feature", featureId: "compatibility", contributionId: "compatibility.enhancements", message: error instanceof Error ? error.message : String(error) });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.releaseStyle?.();
        this.releaseStyle = null;
        this.removeRecordButton?.remove();
        this.removeRecordButton = null;
        for (const link of this.commentLinks) if (link.isConnected) link.replaceWith(this.document.createTextNode(link.textContent || ""));
        this.commentLinks.clear();
        for (const node of this.stateContainers) node.remove();
        this.stateContainers.clear();
    }
}
