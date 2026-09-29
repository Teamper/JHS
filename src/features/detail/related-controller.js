// @ts-check

import { RelatedPanel } from "../../ui/detail/related-panel.js";

/** Mounts the JavDB related-list panel under the Detail Feature lifetime. */
export class RelatedController {
    /** @param {{document: Document, hostAdapter: any, route: string, related: any, settings: any, ui: any, notifications: any, diagnostics: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.document = options.document;
        this.hostAdapter = options.hostAdapter;
        this.route = options.route;
        this.related = options.related;
        this.settings = options.settings;
        this.ui = options.ui;
        this.notifications = options.notifications;
        this.diagnostics = options.diagnostics;
        this.scope = options.scope;
        this.started = false;
    }

    async start() {
        this.scope.assertActive();
        if (this.started || this.route !== "detail" || this.hostAdapter.site !== "javdb") return false;
        const href = this.hostAdapter.location?.href ?? this.document.location.href;
        const movieId = new URL(href).pathname.split("/").filter(Boolean).pop();
        const target = this.hostAdapter.locateDetailSlots?.().related;
        if (!movieId || !target) return false;
        this.started = true;
        const panel = new RelatedPanel({
            related: this.related, settings: this.settings, scope: async () => this.scope,
            jquery: this.ui.jquery, formatDate: this.ui.formatDate, document: this.document,
            notifications: this.notifications, diagnostics: this.diagnostics,
        });
        await panel.show(this.ui.jquery(target), movieId, { isActive: () => !this.scope.disposed, awaitInitialLoad: false });
        return !this.scope.disposed;
    }
}
