// @ts-check

/** Compatibility shell for callers that still resolve ListPagePlugin by name. */
export class ListPagePluginAdapter {
    constructor() {
        /** @type {any} */ this.delegate = null;
        this.managedByFeature = true;
        this.runtimeStatus = "managed-feature";
        const shellOwned = new Set(["handle", "initCss", "getName", "ensureDelegate", "attachFeatureDelegate", "detachFeatureDelegate"]);
        return new Proxy(this, {
            get: (target, property, receiver) => {
                const delegate = /** @type {any} */ (target.delegate);
                if (!shellOwned.has(String(property)) && delegate && property in delegate) {
                    const value = delegate[property];
                    return typeof value === "function" ? value.bind(delegate) : value;
                }
                if (property in target) return Reflect.get(target, property, receiver);
                return undefined;
            },
            set: (target, property, value, receiver) => {
                const delegate = /** @type {any} */ (target.delegate);
                if (!shellOwned.has(String(property)) && delegate && property in delegate) {
                    return Reflect.set(delegate, property, value, delegate);
                }
                return Reflect.set(target, property, value, receiver);
            },
        });
    }

    getName() { return "ListPagePlugin"; }

    initCss() { return ""; }

    handle() {}

    /** @param {any} delegate */
    attachFeatureDelegate(delegate) {
        if (!delegate || delegate.managedByFeature !== true) throw new TypeError("ListPagePlugin delegate must be owned by the List Feature");
        if (this.delegate && this.delegate !== delegate) throw new Error("ListPagePlugin already has an active Feature delegate");
        this.delegate = delegate;
    }

    /** @param {any} delegate */
    detachFeatureDelegate(delegate) {
        if (this.delegate !== delegate) return false;
        this.delegate = null;
        return true;
    }

    ensureDelegate() {
        if (!this.delegate) throw new Error("List Feature compatibility service is not active");
        return this.delegate;
    }
}

ListPagePluginAdapter.legacyPluginId = "ListPagePlugin";
