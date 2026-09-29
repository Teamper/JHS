// @ts-check

/** Mark the native playback ranking root without replacing its cards or controls. */
export class HitShowController {
    /** @param {{hostAdapter: any, scope: import("../../core/lifecycle-scope.js").LifecycleScope}} options */
    constructor(options) {
        this.hostAdapter = options.hostAdapter;
        this.scope = options.scope;
        /** @type {{root: Element, previous: Map<string, string | null>, applied: Map<string, string>} | null} */
        this.ownedAttributes = null;
        this.disposed = false;
        this.scope.addCleanup(() => this.dispose());
    }

    /** @returns {boolean} */
    start() {
        this.scope.assertActive();
        if (this.disposed) return false;
        const page = this.hostAdapter.getPageContext?.();
        if (page?.kind !== "playback-ranking") return false;
        const root = this.hostAdapter.locateListRoot?.();
        if (!root) return false;

        const values = new Map([
            ["data-jhs-ranking", "playback"],
            ["data-jhs-ranking-period", String(page.period)],
            ["data-jhs-ranking-filter", String(page.filter)],
        ]);
        const previous = new Map([...values.keys()].map((name) => [name, root.getAttribute(name)]));
        for (const [name, value] of values) root.setAttribute(name, value);
        this.ownedAttributes = { root, previous, applied: values };
        return true;
    }

    dispose() {
        if (this.disposed) return;
        this.disposed = true;
        const owned = this.ownedAttributes;
        this.ownedAttributes = null;
        if (!owned) return;
        for (const [name, applied] of owned.applied) {
            if (owned.root.getAttribute(name) !== applied) continue;
            const previous = owned.previous.get(name);
            if (previous === null || previous === undefined) owned.root.removeAttribute(name);
            else owned.root.setAttribute(name, previous);
        }
    }
}
