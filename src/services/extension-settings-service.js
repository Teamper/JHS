// @ts-check
export class RemoteSettings extends EventTarget {
    /** @param {import("../platform/extension/client.js").ExtensionClient} client */
    constructor(client) {
        super();
        this.client = client;
        /** @type {Readonly<Record<string, any>>} */
        this.value = Object.freeze({});
        /** @type {Promise<any>} */
        this.writeChain = Promise.resolve();
    }
    snapshot() { return this.value; }
    /** @param {Record<string, any>} value */
    accept(value) {
        const names = [...new Set([...Object.keys(this.value), ...Object.keys(value)])].filter(key => JSON.stringify(this.value[key]) !== JSON.stringify(value[key]));
        this.value = Object.freeze(value);
        if (names.length) this.dispatchEvent(new CustomEvent("settings.changed", { detail: { names, snapshot: this.value } }));
        return this.value;
    }
    async load() { return this.accept(await this.client.call("settings.read")); }
    refresh() { return this.load(); }
    waitForIdle() { return this.writeChain; }
    /** @param {(draft: Record<string, any>) => any} mutator */
    update(mutator) {
        const execute = async () => {
            const base = await this.client.call("settings.read");
            const draft = structuredClone(base);
            if (mutator(draft)?.then) throw new TypeError("Settings update mutator must be synchronous");
            const keys = [...new Set([...Object.keys(base), ...Object.keys(draft)])];
            const changed = keys.filter(key => JSON.stringify(base[key]) !== JSON.stringify(draft[key]));
            return this.accept(await this.client.call("settings.commit", [Object.fromEntries(changed.map(key => [key, { before: base[key], exists: Object.hasOwn(draft, key), value: draft[key] }]))]));
        };
        const operation = this.writeChain.then(execute);
        this.writeChain = operation.catch(() => {});
        return operation;
    }
    /** @param {(draft: Record<string, any>) => any} mutator */
    updateWithoutLock(mutator) { return this.update(mutator); }
    /** @param {() => any} operation */
    runExclusive(operation) { return this.load().then(operation); }
    /** @param {string} name @param {any} value */
    set(name, value) { return this.update(draft => { draft[name] = value; }); }
    /** @param {Record<string, any>} values */
    patch(values) { return this.update(draft => { Object.assign(draft, values); }); }
    /** @param {string|string[]} names */
    unset(names) { return this.update(draft => { for (const name of Array.isArray(names) ? names : [names]) delete draft[name]; }); }
    /** @param {Record<string, any>} values */
    replace(values) { return this.update(draft => { for (const key of Object.keys(draft)) delete draft[key]; Object.assign(draft, values); }); }
}
