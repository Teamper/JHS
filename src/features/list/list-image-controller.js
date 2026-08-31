// @ts-check

/** Own list image upgrade and hover-preview lifecycle. */
export class ListImageController {
    /** @param {{scope: any, document?: Document, window?: Window & {imageHoverPreviewObj?: any, ImageHoverPreview?: any}, site?: string, selector: string}} options */
    constructor(options) {
        this.scope = options.scope;
        this.document = options.document ?? globalThis.document ?? null;
        this.window = /** @type {any} */ (options.window ?? this.document?.defaultView ?? globalThis.window ?? null);
        this.site = options.site ?? "unknown";
        this.selector = options.selector;
        /** @type {IntersectionObserver | null} */ this.hdImageObserver = null;
        /** @type {Map<HTMLImageElement, () => void>} */ this.hdPendingCleanups = new Map();
        /** @type {string | null} */ this.hoverPreviewState = null;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** @param {HTMLImageElement} image */
    replaceSingleHdImg(image) {
        if (image.dataset.hdReplaced === "true") return;
        const originalSrc = image.currentSrc || image.src;
        let upgradedSrc = image.dataset.full || originalSrc;
        if (this.site === "javdb") {
            if (!/jdbstatic\.com|javdb\.com/i.test(originalSrc)) return;
            upgradedSrc = upgradedSrc.replace("thumbs", "covers");
            image.dataset.full = upgradedSrc;
            image.dataset.hdReplaced = "true";
            image.title = "";
        } else if (this.site === "javbus") {
            const directoryPattern = /\/(imgs|pics)\/(thumb|thumbs)\//;
            const extensionPattern = /(\.jpg|\.jpeg|\.png)$/i;
            if (directoryPattern.test(originalSrc)) {
                upgradedSrc = upgradedSrc.replace(directoryPattern, "/$1/cover/").replace(extensionPattern, "_b$1");
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
        image.onerror = () => {
            if (image.src !== originalSrc) image.src = originalSrc;
            image.onerror = null;
        };
    }

    /** @param {HTMLImageElement} image */
    scheduleHdUpgrade(image) {
        if (image.dataset.hdReplaced === "true" || image.dataset.jhsHdPending === "true") return;
        if (image.complete) return void this.replaceSingleHdImg(image);
        image.dataset.jhsHdPending = "true";
        const finish = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            delete image.dataset.jhsHdPending;
            this.hdPendingCleanups.delete(image);
            this.replaceSingleHdImg(image);
        };
        const cleanup = () => {
            image.removeEventListener("load", finish);
            image.removeEventListener("error", finish);
            delete image.dataset.jhsHdPending;
        };
        this.hdPendingCleanups.set(image, cleanup);
        image.addEventListener("load", finish, { once: true });
        image.addEventListener("error", finish, { once: true });
    }

    /** @param {any} [images] */
    replaceHdImg(images) {
        if (this.disposed) return;
        const elements = images && "string" === typeof images.jquery
            ? images.toArray()
            : images ?? this.document?.querySelectorAll(this.selector) ?? [];
        if (!elements.length) return;
        const pending = Array.from(elements).filter((/** @type {HTMLImageElement} */ image) => image.dataset.hdReplaced !== "true" && image.dataset.jhsHdObserved !== "true");
        const IntersectionObserverRuntime = this.window?.IntersectionObserver;
        if (typeof IntersectionObserverRuntime === "function" && !this.hdImageObserver) {
            this.hdImageObserver = new IntersectionObserverRuntime((/** @type {IntersectionObserverEntry[]} */ entries) => {
                for (const entry of entries) {
                    const image = /** @type {HTMLImageElement} */ (entry.target);
                    if (!entry.isIntersecting) continue;
                    this.hdImageObserver?.unobserve(image);
                    delete image.dataset.jhsHdObserved;
                    this.scheduleHdUpgrade(image);
                }
            }, { rootMargin: "200px" });
            this.scope.ownObserver(this.hdImageObserver);
        }
        for (const image of pending) {
            image.decoding = "async";
            if (this.hdImageObserver) {
                image.dataset.jhsHdObserved = "true";
                this.hdImageObserver.observe(image);
            } else this.scheduleHdUpgrade(image);
        }
    }

    /** @param {string} enabled */
    configureHoverPreview(enabled) {
        if (this.disposed) return;
        const runtimeWindow = this.window;
        if (this.hoverPreviewState === enabled && (enabled === "no" || runtimeWindow?.imageHoverPreviewObj)) return;
        runtimeWindow?.imageHoverPreviewObj?.destroy?.();
        if (runtimeWindow) runtimeWindow.imageHoverPreviewObj = null;
        if (enabled === "yes" && runtimeWindow?.ImageHoverPreview) runtimeWindow.imageHoverPreviewObj = new runtimeWindow.ImageHoverPreview({ selector: this.selector });
        this.hoverPreviewState = enabled;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        this.hdImageObserver && this.scope.releaseObserver(this.hdImageObserver);
        this.hdImageObserver = null;
        this.hdPendingCleanups.forEach((cleanup) => cleanup());
        this.hdPendingCleanups.clear();
        const runtimeWindow = this.window;
        runtimeWindow?.imageHoverPreviewObj?.destroy?.();
        if (runtimeWindow) runtimeWindow.imageHoverPreviewObj = null;
        this.hoverPreviewState = null;
    }
}
