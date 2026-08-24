// @ts-check

export class HostedDetailSurface {
    /** @param {{locateDetailRoot: () => Element | null, locateDetailSlots: () => Record<string, Element | null>}} hostAdapter */
    constructor(hostAdapter) {
        this.hostAdapter = hostAdapter;
        this.root = null;
        /** @type {Readonly<Record<string, Element | null>>} */
        this.slots = Object.freeze({});
        this.mounted = new Map();
    }
    mount() {
        this.root = this.hostAdapter.locateDetailRoot();
        this.slots = Object.freeze({ ...this.hostAdapter.locateDetailSlots() });
        return this;
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
        this.mounted.clear();
        this.root = null;
        this.slots = Object.freeze({});
    }
}
