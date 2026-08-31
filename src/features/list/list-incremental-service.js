// @ts-check

/** Own the post-mutation list-card processing pipeline after DOM observation. */
export class ListIncrementalService {
    /** @param {{scope: any, selectors: Record<string, string>, images?: any, captureRevision: () => string, isCurrentRevision: (revision: string) => boolean, filterItems: (items: Element[], revision: string) => Promise<boolean> | boolean, reconcileItems: (items: Element[], revision: string) => boolean, prepareImages?: (items: Element[]) => void, prepareLayout?: (items: Element[]) => void, sortItems?: () => Promise<void> | void, addCardActions?: (items: Element[]) => Promise<void> | void, indexItems?: (items: Element[]) => void, eventBus?: any, autoPage?: () => Promise<void> | void}} options */
    constructor(options) {
        this.scope = options.scope;
        this.selectors = Object.freeze({ ...options.selectors });
        this.images = options.images ?? null;
        this.captureRevision = options.captureRevision;
        this.isCurrentRevision = options.isCurrentRevision;
        this.filterItems = options.filterItems;
        this.reconcileItems = options.reconcileItems;
        this.prepareImages = options.prepareImages ?? (() => {});
        this.prepareLayout = options.prepareLayout ?? (() => {});
        this.sortItems = options.sortItems ?? (() => {});
        this.addCardActions = options.addCardActions ?? (() => {});
        this.indexItems = options.indexItems ?? (() => {});
        this.eventBus = options.eventBus ?? null;
        this.autoPage = options.autoPage ?? (() => {});
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** Process newly inserted cards through the current list revision. @param {Element[]} items @param {string} [revision] @returns {Promise<void>} */
    async processAddedItems(items, revision = this.captureRevision()) {
        this.scope.assertActive();
        if (this.disposed || !items.length) return;
        const covers = this.selectors.coverImgSelector ? items.flatMap((item) => [ ...item.querySelectorAll(this.selectors.coverImgSelector) ]) : [];
        this.images?.replaceHdImg(covers);
        this.prepareImages(items);
        this.prepareLayout(items);
        const filtered = await this.filterItems(items, revision);
        if (this.disposed || this.scope.disposed) return;
        if (!filtered && !this.isCurrentRevision(revision)) {
            const connected = items.filter((item) => item.isConnected && /** @type {HTMLElement} */ (item).dataset.jhsProcessed !== "true");
            if (connected.length) return this.processAddedItems(connected, this.captureRevision());
            return;
        }
        if (!this.reconcileItems(items, revision)) return;
        await this.sortItems();
        await this.addCardActions(items);
        if (this.disposed || this.scope.disposed) return;
        items.forEach((item) => { /** @type {HTMLElement} */ (item).dataset.jhsProcessed = "true"; });
        this.indexItems(items);
        await this.eventBus?.emit?.("list-items-added", { items }, { broadcast: false });
        await this.autoPage();
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
    }
}
