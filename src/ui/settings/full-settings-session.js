// @ts-check

/** @param {any} value */
const copy = value => structuredClone(value);
/** @param {any} left @param {any} right */
const equal = (left, right) => JSON.stringify(left) === JSON.stringify(right);

/** An instance-local settings adapter; persistence belongs to the save coordinator. */
export class FullSettingsSession extends EventTarget {
    /** @param {any} settings @param {Record<string,any>} [defaults] @param {Record<string,any[]>} [resourceDefaults] */
    constructor(settings, defaults = {}, resourceDefaults = {}) {
        super();
        this.settings = settings;
        this.defaults = copy(defaults);
        /** @type {Record<string,any[]>} */ this.resourceDefaults = copy(resourceDefaults);
        this.disposed = false;
        /** Protect a submission even when a newer edit returns to its original value. */
        this.submitting = new Set();
        this.base = this.applied();
        this.values = copy(this.base);
        this.listener = () => {
            const next = this.applied(), changed = [];
            for (const key of new Set([...Object.keys(this.base), ...Object.keys(next)])) {
                if (this.submitting.has(key) || !this.equivalent(key, this.values[key], this.base[key])) continue;
                if (!equal(next[key], this.values[key])) changed.push(key);
                if (Object.hasOwn(next, key)) {
                    this.values[key] = copy(next[key]); this.base[key] = copy(next[key]);
                } else {
                    delete this.values[key]; delete this.base[key];
                }
            }
            this.emit(changed, true);
        };
        settings.addEventListener("settings.changed", this.listener);
    }

    applied() { return copy({ ...this.defaults, ...this.settings.snapshot() }); }
    snapshot() { return copy(this.values); }

    /** Ignore redundant overrides when a built-in source returns to its default. @param {string} key @param {any} left @param {any} right */
    equivalent(key, left, right) {
        const catalog = this.resourceDefaults[key];
        if (!catalog) return equal(left, right);
        const canonical = (/** @type {any} */ value) => {
            try {
                const list = typeof value === "string" ? JSON.parse(value) : value;
                if (!Array.isArray(list)) return value;
                return list.map(item => {
                    const defaults = catalog.find(source => source.id === item.id) || {};
                    return Object.fromEntries(Object.entries(item).filter(([field, entry]) => field === "id" || !equal(entry, defaults[field])));
                }).filter(item => Object.keys(item).length > 1);
            } catch { return value; }
        };
        return equal(canonical(left), canonical(right));
    }
    dirtyKeys() { return Object.keys(this.values).filter(key => !this.equivalent(key, this.values[key], this.base[key])); }
    capture() {
        const keys = this.dirtyKeys();
        keys.forEach(key => this.submitting.add(key));
        return Object.fromEntries(keys.map(key => [key, copy(this.values[key])]));
    }
    release() { this.submitting.clear(); }

    /** @param {string} key @param {any} value */
    async set(key, value) { return this.update(draft => { draft[key] = value; }); }
    /** @param {(draft:Record<string,any>)=>any} mutator */
    async update(mutator) {
        if (this.disposed) return this.snapshot();
        const draft = this.snapshot();
        mutator(draft);
        this.values = copy(draft);
        this.emit();
        return this.snapshot();
    }
    async waitForIdle() {}

    /** @param {string[]} [names] @param {boolean} [external] */
    emit(names = Object.keys(this.values), external = false) {
        if (!this.disposed) this.dispatchEvent(new CustomEvent("settings.changed", { detail: { names, external, snapshot: this.snapshot() } }));
    }
    /** Advance only the captured values; later edits remain dirty. @param {Record<string,any>} submitted */
    commit(submitted) {
        if (this.disposed) return;
        for (const [key, value] of Object.entries(submitted)) {
            this.base[key] = copy(value);
            this.submitting.delete(key);
        }
        this.emit();
    }
    dispose() {
        this.disposed = true;
        this.settings.removeEventListener("settings.changed", this.listener);
        this.values = {}; this.base = {}; this.submitting.clear();
    }
}
