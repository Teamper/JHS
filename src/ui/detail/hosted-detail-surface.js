// @ts-check

export class HostedDetailSurface {
    /** @param {{locateDetailRoot: () => Element | null, locateDetailSlots: () => Record<string, Element | null>}} hostAdapter */
    constructor(hostAdapter) {
        this.hostAdapter = hostAdapter;
        this.root = null;
        /** @type {Readonly<Record<string, Element | null>>} */
        this.slots = Object.freeze({});
        this.mounted = new Map();
        this.created = new Set();
    }
    mount() {
        this.root = this.hostAdapter.locateDetailRoot();
        if (this.root) this.ensureOwnedSlots();
        this.slots = Object.freeze({ ...this.hostAdapter.locateDetailSlots() });
        return this;
    }
    ensureOwnedSlots() {
        if (!this.root) return;
        const documentRuntime = this.root.ownerDocument;
        let summary = this.root.querySelector(':scope > [data-jhs-slot="summary-actions"]');
        if (!summary) {
            summary = documentRuntime.createElement("div");
            summary.className = "jhs-detail-owned-slot jhs-detail-owned-slot--summary-actions";
            summary.setAttribute("data-jhs-slot", "summary-actions");
            this.root.append(summary);
            this.created.add(summary);
        }
        let group = this.root.querySelector(':scope > [data-jhs-slot-group="post-resource"]');
        if (!group) {
            group = documentRuntime.createElement("div");
            group.className = "jhs-detail-post-resource";
            group.setAttribute("data-jhs-slot-group", "post-resource");
            this.root.append(group);
            this.created.add(group);
        }
        for (const name of ["reviews", "related"]) {
            if (group.querySelector(`[data-jhs-slot="${name}"]`)) continue;
            const slot = documentRuntime.createElement("section");
            slot.className = `jhs-detail-owned-slot jhs-detail-owned-slot--${name}`;
            slot.setAttribute("data-jhs-slot", name);
            group.append(slot);
            this.created.add(slot);
        }
    }
    /** @param {string} slot @param {Element} element */
    mountPanel(slot, element) {
        const target = this.slots[slot];
        if (!target) return false;
        target.append(element);
        this.mounted.set(slot, element);
        return true;
    }
    dispose() {
        for (const element of this.mounted.values()) element.remove();
        for (const element of this.created) element.remove();
        this.mounted.clear();
        this.created.clear();
        this.root = null;
        this.slots = Object.freeze({});
    }
}
