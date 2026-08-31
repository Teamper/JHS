// @ts-check

const LIST_EFFECT_KEYS = new Set([ "tagPosition", "defaultQuickFilterTab" ]);

/** Own list-wide refresh subscriptions while delegating the legacy filter work. */
export class ListEventController {
    /** @param {{scope: any, settings?: any, eventBus?: any, storage?: any, state: any, index: any, legacyPlugin?: any, evaluation?: any, filter?: any, onHoverSettingChanged?: (event: any) => void, onReloadHistory?: () => Promise<void> | void}} options */
    constructor(options) {
        this.scope = options.scope;
        this.settings = options.settings ?? null;
        this.eventBus = options.eventBus ?? null;
        this.storage = options.storage ?? null;
        this.state = options.state;
        this.index = options.index;
        this.legacyPlugin = options.legacyPlugin ?? null;
        this.evaluation = options.evaluation ?? null;
        this.filter = options.filter ?? null;
        this.onHoverSettingChanged = options.onHoverSettingChanged ?? (() => {});
        this.onReloadHistory = options.onReloadHistory ?? (() => {});
        /** @type {(() => void)[]} */ this.cleanups = [];
        this.started = false;
        this.disposed = false;
    }

    start() {
        this.scope.assertActive();
        if (this.started) return;
        this.started = true;
        if (this.disposed || !this.settings || !this.eventBus) return;
        const onSettingsChanged = (/** @type {any} */ event) => this.onHoverSettingChanged(event);
        this.cleanups.push(this.scope.listen(this.settings, "settings.changed", onSettingsChanged));
        [ "legacy-refresh", "blacklist-rules-changed", "filter-rules-changed", "settings-changed" ].forEach((type) => {
            this.cleanups.push(this.scope.addCleanup(this.eventBus.on(type, (/** @type {any} */ payload) => this.refreshAll(payload))));
        });
        this.cleanups.push(this.scope.addCleanup(this.eventBus.on("car-state-changed", (/** @type {any} */ payload) => this.refreshCarState(payload))));
    }

    /** @param {any} payload */
    async refreshAll(payload = {}) {
        if (this.disposed) return;
        const changedNames = /** @type {string[] | undefined} */ (payload?.changedNames);
        if (changedNames && !changedNames.some((name) => LIST_EFFECT_KEYS.has(name))) return;
        const revision = this.state.advanceListGeneration();
        this.evaluation?.invalidate();
        this.legacyPlugin.filterContext = null;
        this.storage?._invalidateCache?.(this.storage.car_list_key);
        await (this.filter?.doFilter?.(revision) ?? this.legacyPlugin?.doFilter?.(revision));
        this.state.reconcileListItems(null, revision);
        await this.onReloadHistory();
    }

    /** @param {any} payload */
    async refreshCarState(payload = {}) {
        if (this.disposed) return;
        this.evaluation?.invalidate();
        this.legacyPlugin.filterContext = null;
        this.storage?._invalidateCache?.(this.storage.car_list_key);
        const items = this.index?.getIndexedItems(payload?.carNums || []) ?? [];
        const revision = this.state.captureListRevision();
        if (items.length) {
            await (this.filter?.doFilterItems?.(items, revision) ?? this.legacyPlugin?.doFilterItems?.(items, revision));
            this.state.reconcileListItems(items, revision);
        }
        await this.onReloadHistory();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const cleanup of this.cleanups.splice(0).reverse()) cleanup();
    }
}
