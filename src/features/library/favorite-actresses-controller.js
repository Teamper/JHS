// @ts-check

import { _ } from "../../core/constants.js";

const CONFIRM_SELECTOR = 'a[href*="/actors/"][href*="/uncollect"]';
const ACTOR_ACTION = /\/actors\/(\w+)\/(collect|uncollect)/u;
const HIGHLIGHT_TITLE = "高亮已收藏演员, 可在设置-基础配置中关闭";

/** Own JavDB actress decoration and collection events while preserving the 6.5.1 storage contract. */
export class FavoriteActressesController {
    /** @param {{document: Document, location: {href: string, pathname: string}, jquery: any, state: any, settings: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope, diagnostics: any, isDetailPage: boolean}} options */
    constructor(options) {
        this.document = options.document;
        this.location = options.location;
        this.$ = options.jquery;
        this.state = options.state;
        this.settings = options.settings;
        this.scope = options.scope;
        this.diagnostics = options.diagnostics;
        this.isDetailPage = options.isDetailPage;
        this.highlightedAnchors = new Map();
        this.avatarStyles = new Map();
        this.createdAvatar = null;
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        this.bindConfirmationEvent();
        this.bindActorButtons();
        this.scope.listen(this.settings, "settings.changed", this.handleSettingsChanged);
        this.scheduleDecoration();
        this.scope.addCleanup(() => this.dispose());
    }

    bindConfirmationEvent() {
        if (typeof this.$ !== "function") return;
        const target = this.$(this.document);
        target.on("confirm:complete.jhsFavoriteActresses", CONFIRM_SELECTOR, (/** @type {any} */ event) => {
            const detail = event.detail ?? event.originalEvent?.detail;
            if (!detail?.[0]) return;
            const actorId = event.currentTarget?.getAttribute("href")?.match(ACTOR_ACTION)?.[1];
            if (actorId) void this.removeActorFromStorage(actorId).catch((error) => this.reportError(error));
        });
        this.scope.addCleanup(() => target.off(".jhsFavoriteActresses"));
    }

    bindActorButtons() {
        const collect = this.document.querySelector("#button-collect-actor");
        const uncollect = this.document.querySelector("#button-uncollect-actor");
        if (collect) this.scope.listen(collect, "click", () => { void this.collectActor(collect).catch((error) => this.reportError(error)); });
        if (uncollect) this.scope.listen(uncollect, "click", () => {
            const actorId = uncollect.getAttribute("href")?.match(ACTOR_ACTION)?.[1];
            if (!actorId) return this.logError("无法获取演员ID进行取消收藏操作。");
            void this.removeActorFromStorage(actorId).catch((error) => this.reportError(error));
        });
    }

    scheduleDecoration() {
        let active = true;
        const run = () => {
            if (!active || this.scope.disposed) return;
            void this.refreshDecoration().catch((error) => this.reportError(error));
        };
        const cancel = typeof globalThis.requestIdleCallback === "function"
            ? (() => { const id = globalThis.requestIdleCallback(run, { timeout: 1500 }); return () => globalThis.cancelIdleCallback?.(id); })()
            : (() => { const id = setTimeout(run, 100); return () => clearTimeout(id); })();
        this.scope.addCleanup(() => { active = false; cancel(); });
    }

    async refreshDecoration() {
        this.scope.assertActive();
        await this.highlightActress();
        if (!this.scope.disposed) await this.replaceActressAvatar();
    }

    async highlightActress() {
        if (!this.isDetailPage) return;
        const enabled = this.settings.snapshot().enableFavoriteActresses ?? _;
        if (enabled !== _) return this.clearHighlights();
        const actresses = await this.state.getFavoriteActressList();
        if (this.scope.disposed) return;
        const starIds = new Set(actresses.map((/** @type {{starId?: unknown}} */ actress) => String(actress.starId || "").trim()).filter(Boolean));
        const view = this.document.defaultView;
        if (!view) return;
        for (const icon of this.document.querySelectorAll(".female")) {
            const anchor = icon.previousElementSibling;
            if (!(anchor instanceof view.HTMLAnchorElement)) continue;
            const parts = (anchor.getAttribute("href") || "").replace(/\/$/u, "").split("/");
            const starId = parts.at(-1)?.trim();
            if (!starId || !starIds.has(starId)) continue;
            if (!this.highlightedAnchors.has(anchor)) this.highlightedAnchors.set(anchor, anchor.getAttribute("title"));
            anchor.classList.add("highlighted");
            anchor.setAttribute("title", HIGHLIGHT_TITLE);
        }
    }

    clearHighlights() {
        for (const [anchor, previousTitle] of this.highlightedAnchors) {
            anchor.classList.remove("highlighted");
            if (anchor.getAttribute("title") === HIGHLIGHT_TITLE) {
                if (previousTitle === null) anchor.removeAttribute("title");
                else anchor.setAttribute("title", previousTitle);
            }
        }
        this.highlightedAnchors.clear();
    }

    async replaceActressAvatar() {
        const actorId = this.getActressId();
        if (!actorId) return;
        const actress = (await this.state.getFavoriteActressList()).find((/** @type {{starId?: string}} */ item) => item.starId === actorId);
        if (this.scope.disposed || !actress?.avatar) return;
        const avatarUrl = this.normalizeAvatarUrl(actress.avatar);
        if (!avatarUrl) return;
        /** @type {HTMLElement | null} */ let avatar = this.document.querySelector(".avatar");
        if (!avatar) {
            const columns = this.document.querySelector(".section-columns");
            if (!columns) return;
            const wrapper = this.document.createElement("div");
            wrapper.className = "column actor-avatar jhs-favorite-actress-avatar";
            const image = this.document.createElement("div");
            image.className = "image";
            avatar = this.document.createElement("span");
            avatar.className = "avatar";
            image.append(avatar);
            wrapper.append(image);
            columns.prepend(wrapper);
            this.createdAvatar = wrapper;
        }
        const view = this.document.defaultView;
        if (!view) return;
        if (!this.avatarStyles.has(avatar)) {
            this.avatarStyles.set(avatar, {
                backgroundImage: avatar.style.backgroundImage,
                backgroundSize: avatar.style.backgroundSize,
                backgroundPosition: avatar.style.backgroundPosition,
                backgroundRepeat: avatar.style.backgroundRepeat,
            });
        }
        const nextBackground = `url("${avatarUrl}")`;
        if (view.getComputedStyle(avatar).backgroundImage.trim().toLowerCase() === nextBackground.trim().toLowerCase()) return;
        avatar.style.backgroundImage = nextBackground;
        avatar.style.backgroundSize = "cover";
        avatar.style.backgroundPosition = "top center";
        avatar.style.backgroundRepeat = "no-repeat";
    }

    /** @param {string} value */
    normalizeAvatarUrl(value) {
        try {
            const url = new URL(value, this.location.href);
            return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
        } catch {
            return null;
        }
    }

    getActressId() {
        return this.location.pathname.match(/\/actors\/([^/?]+)/u)?.[1] || null;
    }

    /** @param {Element} button */
    async collectActor(button) {
        const actorId = button.getAttribute("href")?.match(ACTOR_ACTION)?.[1];
        const names = [];
        const actorName = this.document.querySelector(".actor-section-name");
        if (actorName) names.push(...(actorName.textContent || "").trim().split(",").map((name) => name.trim()));
        for (const element of this.document.querySelectorAll(".section-meta")) {
            const text = (element.textContent || "").trim();
            if (text && !text.includes("影片")) names.push(...text.split(",").map((name) => name.trim()));
        }
        const allName = names.filter(Boolean);
        if (!allName.length) return this.logError("获取演员名称失败");
        if (!actorId) return this.logError("无法获取演员ID进行收藏操作。");
        const view = this.document.defaultView;
        if (!view) return;
        const backgroundImage = view.getComputedStyle(this.document.querySelector(".avatar") || this.document.body).backgroundImage;
        const avatar = backgroundImage.match(/^url\(["']?(.*?)["']?\)$/u)?.[1] || "";
        const name = allName[0];
        const result = await this.state.addFavoriteActressList([{ starId: actorId, name, allName, avatar }]);
        if (result === 1) {
            this.log("log", `收藏演员成功: ${name} (ID: ${actorId})`);
            this.dispatchActressStateChanged(actorId);
            if (!this.scope.disposed) await this.refreshDecoration();
        } else this.log("log", `收藏演员失败: ${name} (ID: ${actorId})`);
    }

    /** @param {string} actorId */
    async removeActorFromStorage(actorId) {
        const removed = await this.state.removeFavoriteActress(actorId);
        if (!removed) return;
        this.log("log", "移除演员成功");
        this.dispatchActressStateChanged(actorId);
        if (!this.scope.disposed) await this.refreshDecoration();
    }

    /** @param {string} actorId */
    dispatchActressStateChanged(actorId) {
        if (this.scope.disposed) return;
        const CustomEventConstructor = this.document.defaultView?.CustomEvent;
        if (!CustomEventConstructor) return;
        this.document.dispatchEvent(new CustomEventConstructor("actress-state-changed", { detail: { starId: String(actorId) } }));
    }

    /** @param {any} event */
    handleSettingsChanged = (event) => {
        if (!event.detail?.names?.includes("enableFavoriteActresses")) return;
        void this.highlightActress().catch((error) => this.reportError(error));
    };

    /** @param {unknown} error */
    reportError(error) {
        this.diagnostics?.recordError?.({ source: "favorite-actresses-feature", featureId: "library", contributionId: "library.favorite-actresses", message: error instanceof Error ? error.message : String(error) });
    }

    /** @param {string} message */
    logError(message) { this.log("error", message); }

    /** @param {"log"|"error"} level @param {string} message */
    log(level, message) {
        try { /** @type {any} */ (globalThis).clog?.[level]?.(message); }
        catch { /* Logging cannot change a committed actress mutation. */ }
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.clearHighlights();
        for (const [avatar, styles] of this.avatarStyles) {
            avatar.style.backgroundImage = styles.backgroundImage;
            avatar.style.backgroundSize = styles.backgroundSize;
            avatar.style.backgroundPosition = styles.backgroundPosition;
            avatar.style.backgroundRepeat = styles.backgroundRepeat;
        }
        this.avatarStyles.clear();
        this.createdAvatar?.remove();
        this.createdAvatar = null;
    }
}
