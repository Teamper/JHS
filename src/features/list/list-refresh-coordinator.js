// @ts-check

/** Serializes list refresh requests while ensuring stale work is followed by a current full pass. */
export class ListRefreshCoordinator {
    /** @param {{advanceGeneration?: () => unknown, captureRevision: () => string, isCurrent: (revision: string) => boolean, recordPhase?: (phase: string, itemCount?: number | null) => void, invalidateContext?: () => void, filterAll: (revision: string) => Promise<boolean | undefined> | boolean | undefined, filterItems: (items: Element[], revision: string) => Promise<boolean | undefined> | boolean | undefined, reconcile: (items: Element[] | null, revision: string) => boolean | undefined, syncHistory?: () => void}} options */
    constructor(options) {
        this.options = options;
        this.refreshRunning = false;
        this.refreshDirty = false;
        this.refreshAllRequested = false;
        this.refreshVisibilityRequested = false;
        /** @type {Set<Element>} */ this.refreshItems = new Set();
        /** @type {Promise<boolean> | null} */ this.refreshPromise = null;
        this.disposed = false;
    }

    /** @param {{items?: Element[] | null, reason?: string, full?: boolean, visibilityOnly?: boolean}} [request] */
    request(request = {}) {
        if (this.disposed) return Promise.resolve(false);
        const { items = null, reason = "refresh", full = false, visibilityOnly = false } = request;
        (full || items !== null) && this.options.advanceGeneration?.();
        this.refreshDirty = true;
        if (full) this.refreshAllRequested = true;
        else {
            if (visibilityOnly) this.refreshVisibilityRequested = true;
            items?.forEach((item) => this.refreshItems.add(item));
        }
        this.options.recordPhase?.(`refresh-request:${reason}`);
        if (this.refreshRunning) return this.refreshPromise ?? Promise.resolve(false);
        this.refreshRunning = true;
        const run = async () => {
            try {
                while (this.refreshDirty && !this.disposed) {
                    const fullRefresh = this.refreshAllRequested;
                    const visibilityRefresh = this.refreshVisibilityRequested && !fullRefresh;
                    const itemsToRefresh = [ ...this.refreshItems ];
                    this.refreshDirty = false;
                    this.refreshAllRequested = false;
                    this.refreshVisibilityRequested = false;
                    this.refreshItems.clear();
                    const revision = this.options.captureRevision();
                    this.options.recordPhase?.("refresh-start", fullRefresh ? null : itemsToRefresh.length);
                    let filtered;
                    if (fullRefresh) {
                        this.options.invalidateContext?.();
                        filtered = await this.options.filterAll(revision);
                    } else if (visibilityRefresh && !itemsToRefresh.length) {
                        filtered = true;
                    } else {
                        filtered = await this.options.filterItems(itemsToRefresh.filter((item) => item.isConnected), revision);
                    }
                    if (this.disposed) return false;
                    if (!this.options.isCurrent(revision)) {
                        this.refreshDirty = true;
                        this.refreshAllRequested = true;
                        continue;
                    }
                    filtered !== false && this.options.reconcile(fullRefresh || visibilityRefresh ? null : itemsToRefresh, revision);
                    if (fullRefresh) this.options.syncHistory?.();
                    this.options.recordPhase?.("refresh-end");
                }
                return !this.disposed;
            } finally {
                this.refreshRunning = false;
                this.refreshPromise = null;
            }
        };
        return this.refreshPromise = run();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.refreshDirty = false;
        this.refreshAllRequested = false;
        this.refreshVisibilityRequested = false;
        this.refreshItems.clear();
    }
}
