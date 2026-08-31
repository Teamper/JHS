// @ts-check

import { normalizeQuickFilterKey } from "./list-filters.js";

/**
 * Own the list filter state and its DOM commit generation.
 *
 * Filtering itself remains in the migration adapter for now, but every view
 * update must go through this controller so an older async result cannot
 * commit after a newer filter or DOM generation.
 */
export class ListStateController {
    /** @param {{scope: any, view?: any, defaultFilter?: () => unknown, onPhase?: (phase: string, itemCount?: number | null) => void}} options */
    constructor(options) {
        this.scope = options.scope;
        this.view = options.view ?? null;
        this.defaultFilter = options.defaultFilter ?? (() => "waitCheck");
        this.onPhase = options.onPhase ?? (() => {});
        this.activeQuickFilter = "waitCheck";
        this.listGeneration = 0;
        this.filterRevision = 0;
        this.disposed = false;
    }

    /** @param {any} view */
    setView(view) {
        this.scope.assertActive();
        this.view = view;
    }

    /** @returns {string} */
    advanceListGeneration() {
        this.scope.assertActive();
        this.listGeneration += 1;
        return this.captureListRevision();
    }

    /** @returns {string} */
    captureListRevision() {
        return `${this.listGeneration}:${this.filterRevision}`;
    }

    /** @param {string} revision */
    isCurrentListGeneration(revision) {
        return !this.disposed && revision === this.captureListRevision();
    }

    /** @param {Element[] | null} items @param {string} revision */
    reconcileListItems(items, revision) {
        if (!this.isCurrentListGeneration(revision)) return false;
        this.applyVisibility(items);
        return true;
    }

    /** @param {Element[] | null} [items] */
    applyVisibility(items = null) {
        if (this.disposed) return;
        this.onPhase("applyVisibility", items?.length ?? null);
        return this.view?.applyVisibility(items, this.activeQuickFilter);
    }

    /** @param {unknown} filter @param {{syncUi?: boolean}} [options] */
    setQuickFilter(filter, { syncUi = true } = {}) {
        if (this.disposed) return;
        this.scope.assertActive();
        this.filterRevision += 1;
        this.activeQuickFilter = normalizeQuickFilterKey(filter);
        this.advanceListGeneration();
        this.onPhase("setQuickFilter");
        this.reconcileListItems(null, this.captureListRevision());
        if (syncUi) this.syncQuickFilterUi();
    }

    syncQuickFilterUi() {
        if (this.disposed) return;
        return this.view?.syncQuickFilterUi(this.activeQuickFilter);
    }

    /** @param {unknown} [initialFilter] */
    async createQuickFilter(initialFilter = this.defaultFilter()) {
        this.scope.assertActive();
        if (this.disposed) return;
        return this.view?.createQuickFilter(initialFilter);
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.view = null;
    }
}
