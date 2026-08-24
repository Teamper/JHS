// @ts-check

export class OwnedDetailSurface {
    /** @param {Document} [documentRuntime] */
    constructor(documentRuntime = document) { this.document = documentRuntime; this.root = null; this.slots = new Map(); }
    /** @param {Element} container */
    mount(container) {
        const root = this.document.createElement("section");
        root.className = "jhs-ui jhs-owned-detail";
        for (const name of ["summary", "gallery", "resources", "reviews", "related"]) {
            const slot = this.document.createElement("section");
            slot.dataset.jhsSection = name;
            root.append(slot);
            this.slots.set(name, slot);
        }
        container.replaceChildren(root);
        this.root = root;
        return this;
    }
    /** @param {string} name */
    slot(name) { return this.slots.get(name) ?? null; }
    dispose() { this.root?.remove(); this.root = null; this.slots.clear(); }
}
