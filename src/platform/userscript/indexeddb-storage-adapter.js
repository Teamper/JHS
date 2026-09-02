// @ts-check

export class IndexedDbStorageAdapter {
    /** @param {{getItem: (key: string) => Promise<unknown>, setItem: (key: string, value: unknown) => Promise<unknown>, removeItem: (key: string) => Promise<unknown>, keys: () => Promise<string[]>}} forage @param {Storage} localStore @param {(key: string, fallback?: unknown) => unknown} gmGetValue @param {(key: string, value: unknown) => void} gmSetValue @param {(key: string) => void} [gmDeleteValue] */
    constructor(forage, localStore, gmGetValue, gmSetValue, gmDeleteValue = () => {}) { this.forage = forage; this.localStore = localStore; this.gmGetValue = gmGetValue; this.gmSetValue = gmSetValue; this.gmDeleteValue = gmDeleteValue; }
    /** @param {string} key */
    get(key) { return this.forage.getItem(key); }
    /** @param {string} key @param {unknown} value */
    async set(key, value) { await this.forage.setItem(key, value); }
    /** @param {string} key */
    async remove(key) { await this.forage.removeItem(key); }
    keys() { return this.forage.keys(); }
    /** @param {string} key */
    getLocal(key) { return this.localStore.getItem(key); }
    /** @param {string} key @param {string} value */
    setLocal(key, value) { this.localStore.setItem(key, value); }
    /** @param {string} key */
    removeLocal(key) { this.localStore.removeItem(key); }
    /** @param {string} key @param {unknown} [fallback] */
    getValue(key, fallback) { return this.gmGetValue(key, fallback); }
    /** @param {string} key @param {unknown} value */
    setValue(key, value) { this.gmSetValue(key, value); }
    /** @param {string} key */
    removeValue(key) { this.gmDeleteValue(key); }
}
