// @ts-check

/**
 * Own compatibility-only page decorations and their page-lifetime listeners.
 */
export class CompatibilityController {
    /** @param {{hostAdapter: any, storage: any, state: any, features: any, styles: any, scope: any, route?: string, enabled?: boolean}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.storage = options.storage;
        this.state = options.state;
        this.features = options.features;
        this.styles = options.styles;
        this.scope = options.scope;
        this.route = options.route ?? "unknown";
        this.enabled = options.enabled !== false;
        this.started = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return Promise.resolve();
        this.started = true;
        if (!this.enabled) return Promise.resolve();
        return Promise.resolve().then(async () => {
            if (this.hostAdapter?.site === "javdb") {
                const removeStyle = this.styles?.register?.("jhs-compatibility", ".sda-content { display:none!important; }");
                typeof removeStyle === "function" && this.scope.addCleanup?.(removeStyle);
            }
            await this.decorateActresses();
            const actressStateChanged = () => {
                this.document?.querySelectorAll?.(".jhs-actress-state-container").forEach((/** @type {Element} */ element) => element.remove());
                void this.decorateActresses();
            };
            this.document?.addEventListener?.("actress-state-changed", actressStateChanged);
            this.scope.addCleanup?.(() => this.document?.removeEventListener?.("actress-state-changed", actressStateChanged));
            if (this.route === "detail") await this.addRemoveRecord();
            this.linkCommentImages();
        }).catch((error) => {
            this.dispose();
            throw error;
        });
    }

    getApi() { return Object.freeze({ hasEnhancements: this.enabled }); }

    /** @param {string} key */
    async readArray(key) {
        const value = await this.storage?.get?.(key);
        return Array.isArray(value) ? value : [];
    }

    async addRemoveRecord() {
        const carNum = this.hostAdapter?.readMovieRef?.()?.carNum;
        if (!carNum || !(await this.readArray("car_list")).some((item) => item.carNum === carNum)) return;
        const host = this.document?.querySelector?.(".jhs-detail-btn-row,.movie-info-container,.container .info");
        if (!host || this.document.querySelector(".jhs-remove-car")) return;
        const button = this.document.createElement("button");
        button.type = "button";
        button.className = "jhs-btn jhs-btn--danger jhs-remove-car";
        button.textContent = "移除记录";
        const removeRecord = async () => {
            await this.state.remove(carNum);
            button.remove();
            const list = await this.features?.getFeatureApi?.("list");
            list?.showCarNumBox?.(carNum);
            (/** @type {any} */ (globalThis)).show?.ok?.("鉴定记录已移除");
        };
        button.addEventListener("click", (/** @type {Event} */ event) => {
            const confirm = /** @type {any} */ (globalThis).utils?.q;
            if (confirm) confirm(event, `确定移除 ${carNum} 的鉴定记录？`, removeRecord);
            else void removeRecord();
        });
        host.append(button);
        this.scope.addCleanup?.(() => button.remove());
    }

    async decorateActresses() {
        const favorites = new Set((await this.readArray("favorite_actresses")).map((item) => String(item.starId || "")).filter(Boolean));
        const blacklist = new Set((await this.readArray("blacklist")).map((item) => String(item.starId || item.id || "")).filter(Boolean));
        this.decorateCurrentActressProfile(favorites, blacklist);
        this.decorateActressCards(favorites, blacklist);
    }

    /** @param {Set<string>} favorites @param {Set<string>} blacklist */
    decorateCurrentActressProfile(favorites, blacklist) {
        const pathname = this.hostAdapter?.location?.pathname ?? this.document?.defaultView?.location?.pathname ?? "";
        const match = pathname.match(/^\/(?:actors|star)\/([^/?#]+)\/?$/);
        if (!match) return;
        const host = this.document?.querySelector?.(".actor-section-name,.star-name,h1.title");
        if (host) this.renderActressState(host, decodeURIComponent(match[1]), favorites, blacklist, "jhs-actress-profile-state");
    }

    /** @param {Set<string>} favorites @param {Set<string>} blacklist */
    decorateActressCards(favorites, blacklist) {
        for (const link of this.document?.querySelectorAll?.(".actor-box a[href], .actress-card a[href], [data-actress-card] a[href]") ?? []) {
            const identity = this.getActressIdentityFromLink(link);
            const card = identity && link.closest(".actor-box,.actress-card,[data-actress-card]");
            if (identity && card) this.renderActressState(card, identity.starId, favorites, blacklist, "jhs-actress-card-state");
        }
    }

    /** @param {Element} element @returns {{starId: string, url: string} | null} */
    getActressIdentityFromLink(element) {
        if (element.closest('.toolbar,.tabs,.buttons,.pagination,.filter,.filters,nav,header,[role="tablist"]')) return null;
        try {
            const url = new URL(element.getAttribute("href") || "", this.hostAdapter?.location?.href ?? this.document?.defaultView?.location?.href);
            if (url.search || url.hash) return null;
            const match = url.pathname.match(/^\/(?:actors|star)\/([^/]+)\/?$/);
            return match ? { starId: decodeURIComponent(match[1]), url: url.href } : null;
        } catch { return null; }
    }

    /** @param {Element} host @param {string} starId @param {Set<string>} favorites @param {Set<string>} blacklist @param {string} className */
    renderActressState(host, starId, favorites, blacklist, className) {
        if (host.querySelector(".jhs-actress-state-container")) return;
        const container = this.document.createElement("span");
        container.className = `jhs-actress-state-container ${className}`;
        if (favorites.has(starId)) {
            const badge = this.document.createElement("span");
            badge.className = "jhs-badge jhs-badge--fav";
            badge.textContent = "已关注";
            container.append(badge);
        }
        if (blacklist.has(starId)) {
            const badge = this.document.createElement("span");
            badge.className = "jhs-badge jhs-badge--danger";
            badge.textContent = "已拉黑";
            container.append(badge);
        }
        if (container.childElementCount) host.append(container);
    }

    linkCommentImages() {
        const images = [...this.document?.querySelectorAll?.(".preview-images img,#sample-waterfall img,.movie-gallery img") ?? []];
        if (!images.length) return;
        for (const element of this.document.querySelectorAll(".review-content")) this.linkCommentImageTextNodes(element, images.length);
        const commentImageClick = (/** @type {MouseEvent} */ event) => {
            const target = /** @type {Element | null} */ (event.target)?.closest?.(".jhs-comment-image-link");
            if (!target) return;
            event.preventDefault();
            const image = images[Number(target.getAttribute("data-image-index"))];
            image && (/** @type {any} */ (globalThis)).showImageViewer?.(image);
        };
        this.document?.addEventListener?.("click", commentImageClick);
        this.scope.addCleanup?.(() => this.document.removeEventListener("click", commentImageClick));
    }

    /** @param {Element} element @param {number} imageCount */
    linkCommentImageTextNodes(element, imageCount) {
        const nodeFilter = this.document.defaultView?.NodeFilter?.SHOW_TEXT ?? 4;
        const walker = this.document.createTreeWalker(element, nodeFilter), nodes = [];
        while (walker.nextNode()) {
            const textNode = /** @type {Text} */ (walker.currentNode);
            if (!textNode.parentElement?.closest("a,button,code,pre,textarea,.jhs-comment-image-link") && /(?:图|圖片|图片)\s*[一二三四五六七八九十\d]+/i.test(textNode.nodeValue || "")) nodes.push(textNode);
        }
        nodes.forEach((textNode) => {
            const text = textNode.nodeValue || "", pattern = /(?:图|圖片|图片)\s*([一二三四五六七八九十\d]+)/gi, fragment = this.document.createDocumentFragment();
            let cursor = 0, match;
            while ((match = pattern.exec(text))) {
                match.index > cursor && fragment.append(this.document.createTextNode(text.slice(cursor, match.index)));
                const chinese = /** @type {Record<string, number>} */ ({ 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 }), index = (chinese[match[1]] || Number(match[1])) - 1;
                if (index >= 0 && index < imageCount) {
                    const link = this.document.createElement("a");
                    link.href = "#";
                    link.className = "jhs-comment-image-link";
                    link.dataset.imageIndex = String(index);
                    link.textContent = match[0];
                    fragment.append(link);
                } else fragment.append(this.document.createTextNode(match[0]));
                cursor = match.index + match[0].length;
            }
            cursor < text.length && fragment.append(this.document.createTextNode(text.slice(cursor)));
            textNode.replaceWith(fragment);
        });
    }

    dispose() { this.started = false; }
}
