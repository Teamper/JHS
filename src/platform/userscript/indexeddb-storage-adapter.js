// @ts-check

export class IndexedDbStorageAdapter {
    /** @param {{getItem: (key: string) => Promise<unknown>, setItem: (key: string, value: unknown) => Promise<unknown>, removeItem: (key: string) => Promise<unknown>}} forage @param {Storage} localStore @param {(key: string, fallback?: unknown) => unknown} gmGetValue @param {(key: string, value: unknown) => void} gmSetValue */
    constructor(forage, localStore, gmGetValue, gmSetValue) { this.forage = forage; this.localStore = localStore; this.gmGetValue = gmGetValue; this.gmSetValue = gmSetValue; }
    /** @param {string} key */
    get(key) { return this.forage.getItem(key); }
    /** @param {string} key @param {unknown} value */
    async set(key, value) { await this.forage.setItem(key, value); }
    /** @param {string} key */
    async remove(key) { await this.forage.removeItem(key); }
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
}
