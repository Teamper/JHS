// @ts-check

export class SelectionModel extends EventTarget {
    /** @param {(item: any) => string} keyOf */
    constructor(keyOf) { super(); this.keyOf = keyOf; this.mode = "explicit"; this.selected = new Set(); this.excluded = new Set(); }
    /** @param {any} item @param {boolean} selected */
    set(item, selected) {
        const key = this.keyOf(item), target = this.mode === "all-filtered" ? this.excluded : this.selected;
        this.mode === "all-filtered" ? selected ? target.delete(key) : target.add(key) : selected ? target.add(key) : target.delete(key);
        this.emit();
    }
    selectAllFiltered() { this.mode = "all-filtered"; this.selected.clear(); this.excluded.clear(); this.emit(); }
    clear() { this.mode = "explicit"; this.selected.clear(); this.excluded.clear(); this.emit(); }
    /** @param {any} item */
    has(item) { const key = this.keyOf(item); return this.mode === "all-filtered" ? !this.excluded.has(key) : this.selected.has(key); }
    /** @param {any[]} filteredItems */
    values(filteredItems) { return this.mode === "all-filtered" ? filteredItems.filter((item) => !this.excluded.has(this.keyOf(item))) : filteredItems.filter((item) => this.selected.has(this.keyOf(item))); }
    snapshot() { return Object.freeze({ mode: this.mode, selected: [...this.selected], excluded: [...this.excluded] }); }
    emit() { this.dispatchEvent(new CustomEvent("selection.changed", { detail: this.snapshot() })); }
}
