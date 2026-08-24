// @ts-check

export class IndexedDbStorageAdapter {
    /** @param {{getItem: (key: string) => Promise<unknown>, setItem: (key: string, value: unknown) => Promise<unknown>, removeItem: (key: string) => Promise<unknown>}} forage */
    constructor(forage) { this.forage = forage; }
    /** @param {string} key */
    get(key) { return this.forage.getItem(key); }
    /** @param {string} key @param {unknown} value */
    async set(key, value) { await this.forage.setItem(key, value); }
    /** @param {string} key */
    async remove(key) { await this.forage.removeItem(key); }
}
