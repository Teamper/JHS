// @ts-check

/** Own JavDB native detail link behavior and restore only attributes it changed. */
export class DetailNativeController {
    /** @param {{hostAdapter: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.document = options.hostAdapter?.document ?? null;
        this.scope = options.scope;
        /** @type {Map<HTMLAnchorElement, {hadTarget: boolean, target: string | null}>} */
        this.changedTargets = new Map();
        this.started = false;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    start() {
        this.scope.assertActive();
        if (this.started || this.disposed || this.hostAdapter?.site !== "javdb" || !this.document) return;
        this.started = true;
        const baseUrl = this.hostAdapter.location?.href ?? this.document.location?.href ?? "";
        this.document.querySelectorAll(".video-meta-panel a").forEach((/** @type {Element} */ element) => {
            const anchor = /** @type {HTMLAnchorElement} */ (element);
            const href = anchor.getAttribute("href");
            if (!href) return;
            try {
                if (!["http:", "https:"].includes(new URL(href, baseUrl).protocol)) return;
            } catch {
                return;
            }
            this.changedTargets.set(anchor, { hadTarget: anchor.hasAttribute("target"), target: anchor.getAttribute("target") });
            anchor.target = "_blank";
        });
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        for (const [anchor, previous] of this.changedTargets) {
            if (previous.hadTarget) anchor.setAttribute("target", previous.target ?? "");
            else anchor.removeAttribute("target");
        }
        this.changedTargets.clear();
    }
}
