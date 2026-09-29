// @ts-check

/** Upgrade visible list covers while preserving the host's initial thumbnail request. */
export class ListCoverImageController {
    /** @param {{hostAdapter: any, scope?: any, window?: any}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? globalThis.document;
        this.window = options.window ?? globalThis.window;
        this.scope = options.scope ?? null;
        this.site = options.hostAdapter?.site;
        /** @type {IntersectionObserver | null} */ this.observer = null;
        this.releaseObserver = null;
        /** @type {Set<HTMLImageElement>} */ this.observedImages = new Set();
        /** @type {Map<HTMLImageElement, () => void>} */ this.pendingCleanups = new Map();
        this.disposed = false;
    }

    /** Observe a collection of host cover images or resolve the current list covers. @param {any} [images] */
    replace(images = null) {
        if (this.disposed || !this.document) return 0;
        const selector = this.hostAdapter?.getListSelectors?.()?.coverImgSelector;
        const candidates = images?.jquery && typeof images.toArray === "function"
            ? images.toArray()
            : images ? Array.from(images) : selector ? [...this.document.querySelectorAll(selector)] : [];
        const targets = candidates.filter((/** @type {HTMLImageElement} */ image) => image?.tagName === "IMG" && image.dataset.hdReplaced !== "true" && image.dataset.jhsHdObserved !== "true");
        if (!targets.length) return 0;
        this.ensureObserver();
        for (const image of targets) {
            image.decoding = "async";
            if (this.observer) {
                image.dataset.jhsHdObserved = "true";
                this.observedImages.add(image);
                this.observer.observe(image);
            } else this.scheduleUpgrade(image);
        }
        return targets.length;
    }

    ensureObserver() {
        if (this.observer || typeof this.window?.IntersectionObserver !== "function") return;
        const Observer = this.window.IntersectionObserver;
        this.observer = new Observer((/** @type {IntersectionObserverEntry[]} */ entries) => {
            for (const entry of entries) {
                if (!entry.isIntersecting) continue;
                const image = /** @type {HTMLImageElement} */ (entry.target);
                this.observer?.unobserve(image);
                this.observedImages.delete(image);
                delete image.dataset.jhsHdObserved;
                this.scheduleUpgrade(image);
            }
        }, { rootMargin: "200px" });
        this.releaseObserver = this.scope?.ownObserver?.(this.observer) ?? (() => this.observer?.disconnect());
    }

    /** Upgrade an image once its thumbnail request has completed. @param {HTMLImageElement} image */
    scheduleUpgrade(image) {
        if (this.disposed || image.dataset.hdReplaced === "true" || image.dataset.jhsHdPending === "true") return;
        if (image.complete) return this.replaceOne(image);
        image.dataset.jhsHdPending = "true";
        const finish = () => {
            cleanup();
            this.pendingCleanups.delete(image);
            if (!this.disposed && image.isConnected) this.replaceOne(image);
        };
        const cleanup = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            delete image.dataset.jhsHdPending;
        };
        this.pendingCleanups.set(image, cleanup);
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
    }

    /** @param {HTMLImageElement} image */
    replaceOne(image) {
        if (image.dataset.hdReplaced === "true") return;
        const originalSrc = image.currentSrc || image.src;
        let upgradedSrc = image.dataset.full || originalSrc;
        if (this.site === "javdb") {
            if (/jdbstatic\.com|javdb\.com/i.test(originalSrc)) {
                upgradedSrc = upgradedSrc.replace("thumbs", "covers");
                image.dataset.full = upgradedSrc;
                image.dataset.hdReplaced = "true";
                image.title = "";
            }
        } else if (this.site === "javbus") {
            const thumbnailPath = /\/(imgs|pics)\/(thumb|thumbs)\//;
            const extension = /(\.jpg|\.jpeg|\.png)$/i;
            if (thumbnailPath.test(originalSrc)) {
                upgradedSrc = upgradedSrc.replace(thumbnailPath, "/$1/cover/").replace(extension, "_b$1");
                image.dataset.full = upgradedSrc;
                image.dataset.hdReplaced = "true";
                image.dataset.title = image.title;
                image.title = "";
            } else if (/ps(\.jpg|\.jpeg|\.png)$/i.test(originalSrc)) {
                upgradedSrc = upgradedSrc.replace(/ps(\.jpg|\.jpeg|\.png)$/i, "pl$1");
                image.dataset.full = upgradedSrc;
                image.dataset.hdReplaced = "true";
                image.dataset.title = image.title;
                image.title = "";
            }
        }
        if (image.dataset.hdReplaced !== "true" || upgradedSrc === originalSrc) return;
        image.src = upgradedSrc;
        image.onerror = function () {
            if (this.src !== originalSrc) this.src = originalSrc;
            this.onerror = null;
        };
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.releaseObserver?.();
        this.releaseObserver = null;
        this.observer = null;
        for (const image of this.observedImages) delete image.dataset.jhsHdObserved;
        this.observedImages.clear();
        this.pendingCleanups.forEach((cleanup) => cleanup());
        this.pendingCleanups.clear();
    }
}
