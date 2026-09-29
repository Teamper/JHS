// @ts-check

/** Owns the responsive History entry points while the dialog stays behind its compatibility service. */
export class HistoryEntryController {
    /** @param {{document: Document, window: Window & typeof globalThis, jquery: (selector: any) => any, profile: EventTarget, site: string, openHistory: () => void, scope: import("../../core/lifecycle-scope.js").LifecycleScope, onError: (error: unknown) => void}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.jquery = options.jquery;
        this.profile = options.profile;
        this.site = options.site;
        this.openHistory = options.openHistory;
        this.scope = options.scope;
        this.onError = options.onError;
        this.disposed = false;
        this.desktopEntry = null;
        this.compactEntry = null;
        this.busEntry = null;
        this.searchMargins = /** @type {Array<[HTMLElement, string]>} */ ([]);
        this.waitInterval = null;
        this.waitTimeout = null;
        this.resolveWait = /** @type {((ready: boolean) => void) | null} */ (null);
        /** @type {Promise<void> | null} */ this.mountPromise = null;
    }

    start() {
        if (this.disposed || this.scope.disposed) return;
        this.scope.addCleanup(() => this.dispose());
        if (this.site === "javdb") this.mountJavDbEntries();
        if (this.site === "javbus") {
            this.scope.listen(this.profile, "profile.changed", (event) => {
                if (/** @type {CustomEvent<{profile: string}>} */ (event).detail?.profile === "compact" || !this.window.isListPage) return;
                void this.mountJavBusEntry();
            });
            void this.mountJavBusEntry();
        }
    }

    mountJavDbEntries() {
        const navEnd = this.document.querySelector(".navbar-end");
        const search = /** @type {HTMLElement | null} */ (this.document.querySelector(".navbar-search"));
        if (navEnd && !this.document.querySelector("#historyBtn")) {
            const wrapper = this.document.createElement("div"), button = this.document.createElement("button");
            wrapper.className = "navbar-item has-sub-btns is-hoverable historyBtnBox";
            button.type = "button";
            button.id = "historyBtn";
            button.className = "jhs-btn navbar-link nav-btn jhs-nav-btn";
            button.textContent = "鉴定记录";
            button.addEventListener("click", this.openHistory);
            wrapper.append(button);
            navEnd.prepend(wrapper);
            this.desktopEntry = wrapper;
        }
        if (search && !this.document.querySelector("#miniHistoryBtn")) {
            const wrapper = this.document.createElement("div"), button = this.document.createElement("button");
            wrapper.className = "navbar-item miniHistoryBtnBox";
            button.type = "button";
            button.id = "miniHistoryBtn";
            button.className = "jhs-btn navbar-link nav-btn jhs-nav-btn";
            button.textContent = "鉴定记录";
            button.addEventListener("click", this.openHistory);
            wrapper.append(button);
            search.before(wrapper);
            this.compactEntry = wrapper;
            this.searchMargins.push([search, search.style.marginLeft]);
            search.style.marginLeft = "0";
        }
        this.updateJavDbLayout();
        this.scope.listen(this.window, "resize", () => this.updateJavDbLayout());
    }

    updateJavDbLayout() {
        const searchHidden = this.jquery(".navbar-search").is(":hidden");
        if (this.desktopEntry) this.desktopEntry.style.display = searchHidden ? "" : "none";
        if (this.compactEntry) this.compactEntry.style.display = searchHidden ? "none" : "";
    }

    /** Wait briefly for the host toolbar, with all timers owned by this Feature scope. */
    async waitForJavBusToolbar() {
        if (this.document.querySelector("#setting-btn") && this.document.querySelector("#top-right-box")) return true;
        return new Promise((/** @type {(ready: boolean) => void} */ resolve) => {
            /** @type {(ready: boolean) => void} */ const finish = (ready) => {
                if (this.waitInterval !== null) this.window.clearInterval(this.waitInterval);
                if (this.waitTimeout !== null) this.window.clearTimeout(this.waitTimeout);
                this.waitInterval = null;
                this.waitTimeout = null;
                this.resolveWait = null;
                resolve(ready);
            };
            this.resolveWait = finish;
            this.waitInterval = this.window.setInterval(() => {
                if (this.disposed) return finish(false);
                if (this.document.querySelector("#setting-btn") && this.document.querySelector("#top-right-box")) finish(true);
            }, 25);
            this.waitTimeout = this.window.setTimeout(() => finish(false), 2500);
        });
    }

    mountJavBusEntry() {
        if (this.disposed || this.busEntry?.isConnected || this.document.querySelector("#historyBtn")) return Promise.resolve();
        if (this.mountPromise) return this.mountPromise;
        this.mountPromise = (async () => {
            try {
                if (!await this.waitForJavBusToolbar() || this.disposed) return;
                const host = this.document.querySelector("#top-right-box");
                if (!host || this.document.querySelector("#historyBtn")) return;
                const button = this.document.createElement("button");
                button.type = "button";
                button.id = "historyBtn";
                button.className = "jhs-btn jhs-btn--secondary";
                button.textContent = "鉴定记录";
                button.addEventListener("click", this.openHistory);
                host.append(button);
                this.busEntry = button;
            } catch (error) {
                this.onError(error);
            } finally {
                this.mountPromise = null;
            }
        })();
        return this.mountPromise;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        if (this.waitInterval !== null) this.window.clearInterval(this.waitInterval);
        if (this.waitTimeout !== null) this.window.clearTimeout(this.waitTimeout);
        this.waitInterval = null;
        this.waitTimeout = null;
        this.resolveWait?.(false);
        this.resolveWait = null;
        this.desktopEntry?.remove();
        this.compactEntry?.remove();
        this.busEntry?.remove();
        for (const [element, marginLeft] of this.searchMargins) element.style.marginLeft = marginLeft;
        this.searchMargins.length = 0;
        this.desktopEntry = null;
        this.compactEntry = null;
        this.busEntry = null;
    }
}
