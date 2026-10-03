// @ts-check

/** Owns the JavDB collection-codes FC2 workspace page and its late-response cleanup. */
export class Fc2OwnedPageController {
    /** @param {{document: Document, window: Window & typeof globalThis, location: Location, scope: import("../../core/lifecycle-scope.js").LifecycleScope, adapter: any, onError: (error: unknown) => void}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.location = options.location;
        this.scope = options.scope;
        this.adapter = options.adapter;
        this.onError = options.onError;
        /** @type {HTMLElement | null} */ this.host = null;
        /** @type {any | null} */ this.context = null;
        /** @type {ChildNode[]} */ this.originalNodes = [];
        this.generation = 0;
        this.started = false;
        this.disposed = false;
    }

    async start() {
        if (this.started || this.disposed || this.scope.disposed) return false;
        const pageUrl = new URL(this.location.href);
        if (pageUrl.pathname !== "/users/collection_codes" || !pageUrl.searchParams.has("movieId")) return false;
        const hosts = this.document.querySelectorAll("body > section.section > .container");
        if (hosts.length !== 1) {
            this.onError(new Error(`FC2 详情正文容器匹配异常：预期 1 个，实际 ${hosts.length} 个`));
            return false;
        }
        this.host = /** @type {HTMLElement} */ (hosts[0]);

        this.started = true;
        this.originalNodes = [...this.host.childNodes];
        this.host.replaceChildren();
        this.scope.addCleanup(() => this.dispose());
        this.scope.listen(this.window, "pagehide", () => this.dispose(), { once: true });

        const generation = ++this.generation;
        const params = pageUrl.searchParams;
        const requestedMovieId = params.get("movieId");
        const carNum = params.get("carNum") || "";
        const url = params.get("url") || "";
        const explicitSource = params.get("source");
        if (!carNum || !url) {
            this.renderError("FC2 详情参数不完整");
            return true;
        }

        try {
            const movieId = requestedMovieId && requestedMovieId !== "search"
                ? requestedMovieId
                : await this.adapter.resolveMovieIdForRecord(carNum, url);
            if (!this.canCommit(generation)) return false;
            const source = ["fc2", "123av"].includes(explicitSource || "")
                ? explicitSource
                : await this.adapter.resolveFc2Source({ url });
            if (!this.canCommit(generation)) return false;
            this.context = this.adapter.mountFc2Detail(this.host, { movieId, carNum, url, source, mode: "page" });
            return true;
        } catch (error) {
            if (!this.canCommit(generation)) return false;
            this.renderError("FC2 详情加载失败");
            this.onError(error);
            return true;
        }
    }

    /** @param {number} generation */
    canCommit(generation) { return !this.disposed && !this.scope.disposed && generation === this.generation; }

    /** @param {string} message */
    renderError(message) {
        if (!this.host || this.disposed) return;
        const state = this.document.createElement("div");
        state.className = "jhs-fc2-state is-error";
        state.textContent = message;
        this.host.replaceChildren(state);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.generation += 1;
        try { this.context?.destroy?.(); } catch (error) { this.onError(error); }
        this.context = null;
        if (this.host?.isConnected) this.host.replaceChildren(...this.originalNodes);
        this.originalNodes = [];
        this.host = null;
    }
}
