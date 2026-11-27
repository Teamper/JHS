// @ts-check

import { RelatedPanel } from "../../ui/detail/related-panel.js";

/** Mounts the JavDB related-list panel under the Detail Feature lifetime. */
export class RelatedController {
    /** @param {{document: Document, hostAdapter: any, route: string, related: any, movie?: any, settings: any, ui: any, notifications: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.related = options.related;
        this.movie = options.movie;
        this.settings = options.settings;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.started = false;
    }

    async start() {
        this.scope.assertActive();
        if (this.started || this.route !== "detail") return false;
        const target = this.hostAdapter.locateDetailSlots().related;
        if (!target) return false;
        const javbus = this.hostAdapter.site === "javbus";
        const href = this.hostAdapter.location?.href ?? this.document.location.href;
        const key = javbus ? this.hostAdapter.readMovieRef()?.carNum : new URL(href).pathname.split("/").filter(Boolean).pop();
        if (!key) return false;
        this.started = true;
        let movieId = "";
        // A collapsed panel does not need to resolve a JavBus movie during startup.
        const related = javbus ? {
            list: async (/** @type {unknown} */ _ref, /** @type {{scope: import("../../core/lifecycle-scope.js").LifecycleScope}} */ options) => {
                if (!movieId) {
                    const movie = await this.movie.resolve({ carNum: key, providerId: "javdb" }, options);
                    options.scope.assertActive();
                    if (!movie?.movieId) throw new Error("JavDB 未找到对应作品");
                    movieId = movie.movieId;
                }
                return this.related.list({ movieId }, options);
            },
        } : this.related;
        const panel = new RelatedPanel({
            related, settings: this.settings, scope: async () => this.scope,
            jquery: this.ui.jquery, formatDate: this.ui.formatDate, document: this.document,
            notifications: this.notifications, diagnostics: this.diagnostics,
        });
        await panel.show(this.ui.jquery(target), key, { isActive: () => !this.scope.disposed, awaitInitialLoad: false, listOrigin: javbus ? "https://javdb.com" : "" });
        return !this.scope.disposed;
    }
}
