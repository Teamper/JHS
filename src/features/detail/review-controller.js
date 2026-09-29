// @ts-check

import { LifecycleScope } from "../../core/lifecycle-scope.js";
import { ReviewPanel } from "../../ui/detail/review-panel.js";

/** Owns review-panel mounting and movie identity lookup for detail pages. */
export class ReviewController {
    /** @param {{document: Document, window: Window, hostAdapter: any, route: string, review: any, movie: any, settings: any, storage: any, ui: any, clipboard: any, notifications: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.window = options.window;
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.review = options.review;
        this.movie = options.movie;
        this.settings = options.settings;
        this.storage = options.storage;
        this.ui = options.ui;
        this.clipboard = options.clipboard;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.target = null;
        this.panel = null;
        this.requestScope = null;
        this.releaseRequestScope = null;
        this.generation = 0;
        this.mounting = false;
        this.started = false;
    }

    async start() {
        this.scope.assertActive();
        if (this.started || this.route !== "detail") return false;
        this.target = this.hostAdapter.locateDetailSlots?.().reviews ?? null;
        if (!this.target) return false;
        this.started = true;
        this.scope.addCleanup(() => this.cancelMovieLookup());

        if (this.hostAdapter.site === "javdb") {
            const href = this.hostAdapter.location?.href ?? this.document.location.href;
            const movieId = new URL(href).pathname.split("/").filter(Boolean).pop();
            if (!movieId) return false;
            await this.mount(movieId);
            return !this.scope.disposed;
        }

        if (this.hostAdapter.site !== "javbus") return false;
        const carNum = this.hostAdapter.readMovieRef?.()?.carNum;
        if (!carNum) {
            this.diagnostics?.recordError?.({ source: "detail-review", message: "跳过 JavBus 评论解析：番号不可用" });
            return false;
        }
        this.scope.listen(this.settings, "settings.changed", (/** @type {any} */ event) => {
            if (!event.detail?.names?.includes("enableLoadReview")) return;
            if (!this.isReviewEnabled()) this.cancelIdentityLookup();
            else void this.resolveAndMount(carNum);
        });
        if (this.isReviewEnabled()) void this.resolveAndMount(carNum);
        return true;
    }

    isReviewEnabled() { return (this.settings.snapshot().enableLoadReview ?? "yes") === "yes"; }

    /** @param {string} carNum */
    async resolveAndMount(carNum) {
        if (this.mounting || this.scope.disposed || !this.isReviewEnabled()) return;
        if (this.panel?.[0]?.isConnected) return;
        this.mounting = true;
        const generation = ++this.generation;
        const requestScope = new LifecycleScope(`detail-review-identity:${generation}`);
        const releaseRequestScope = this.scope.addCleanup(() => requestScope.dispose());
        this.requestScope = requestScope;
        this.releaseRequestScope = releaseRequestScope;
        try {
            const movieRef = await this.movie.resolve({ carNum }, { scope: requestScope });
            if (!this.isCurrent(requestScope, generation) || !this.isReviewEnabled() || !movieRef?.movieId) return;
            await this.mount(movieRef.movieId);
        } catch (error) {
            if (this.isCurrent(requestScope, generation)) this.reportError("解析 JavBus 评论番号失败", error);
        } finally {
            const isLatestLookup = this.requestScope === requestScope;
            releaseRequestScope();
            requestScope.dispose();
            if (isLatestLookup) {
                this.requestScope = null;
                this.releaseRequestScope = null;
                this.mounting = false;
            }
        }
    }

    /** @param {LifecycleScope} scope @param {number} generation */
    isCurrent(scope, generation) { return !this.scope.disposed && !scope.signal.aborted && generation === this.generation; }

    /** @param {string} movieId */
    async mount(movieId) {
        if (!this.target || this.scope.disposed) return null;
        const panel = new ReviewPanel({
            review: this.review, settings: this.settings, storage: this.storage, scope: async () => this.scope,
            jquery: this.ui.jquery, document: this.document, window: this.window,
            ui: this.ui, clipboard: this.clipboard, notifications: this.notifications, diagnostics: this.diagnostics,
        });
        const mounted = await panel.show(movieId, this.ui.jquery(this.target), { isActive: () => !this.scope.disposed, awaitInitialLoad: false });
        if (this.scope.disposed) return null;
        this.panel = mounted;
        return mounted;
    }

    cancelMovieLookup() {
        this.cancelIdentityLookup();
        this.panel = null;
    }

    cancelIdentityLookup() {
        this.generation += 1;
        this.requestScope?.dispose();
        this.releaseRequestScope?.();
        this.requestScope = null;
        this.releaseRequestScope = null;
        this.mounting = false;
    }

    /** @param {string} message @param {unknown} error */
    reportError(message, error) {
        this.diagnostics?.recordError?.({ source: "detail-review", message, cause: error instanceof Error ? error.message : String(error) });
        if (!this.diagnostics) /** @type {any} */ (globalThis).clog?.error(message, error);
    }
}
