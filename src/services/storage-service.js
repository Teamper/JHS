// @ts-check

export class StorageService {
    /** @type {import("./personal-preferences-service.js").PersonalPreferencesService | null} */ preferences = null;
    /** @type {((key: string) => Promise<void>) | undefined} */ beforeWrite;
    carListRevision = 0;
    /** @param {import("../contracts/ports.js").StoragePort & Partial<import("../contracts/ports.js").LockedBatchStoragePort & import("../contracts/ports.js").AtomicStoragePort>} storagePort */
    constructor(storagePort) { this.port = storagePort; }
    /** @param {string} key @returns {Promise<any>} */
    get(key) { return this.port.get(key); }
    /** @param {string} key @param {unknown} value */
    async set(key, value) {
        await this.beforeWrite?.(key);
        await this.setRecovered(key, value);
    }
    /** Replays a synchronized value whose write intent already exists.
     * @param {string} key @param {unknown} value */
    async setRecovered(key, value) {
        await this.port.set(key, value);
        if (key === "car_list") this.carListRevision++;
    }
    /** @param {string} key */
    async remove(key) {
        await this.port.remove(key);
        if (key === "car_list") this.carListRevision++;
    }
    keys() { return this.port.keys(); }
    /** @param {string[]} keys */
    readAtomicSnapshot(keys) {
        if (!this.port.readAtomicSnapshot) throw Object.assign(new Error("当前存储不支持安全导入，数据未修改"), { code: "ATOMIC_IMPORT_UNAVAILABLE" });
        return this.port.readAtomicSnapshot(keys);
    }
    /** @param {any} batch */
    async commitAtomicBatch(batch) {
        if (!this.port.commitAtomicBatch) throw Object.assign(new Error("当前存储不支持安全导入，数据未修改"), { code: "ATOMIC_IMPORT_UNAVAILABLE" });
        await this.port.commitAtomicBatch(batch);
        if (Object.hasOwn(batch.puts, "car_list") || batch.deletes.includes("car_list")) this.carListRevision++;
    }
    /** Optional native transaction, called while the shared mutation lock is held. @param {any} batch */
    async commitLockedBatch(batch) {
        const committed = await this.port.commitLockedBatch?.(batch);
        if (committed && (Object.hasOwn(batch.puts, "car_list") || batch.deletes?.includes("car_list"))) this.carListRevision++;
        return committed ?? false;
    }
    get canCommitLockedBatch() { return Boolean(this.port.commitLockedBatch); }
    /** @param {string} key */
    getLocal(key) { return this.preferences?.owns(key) ? this.preferences.get(key) : this.port.getLocal(key); }
    /** @param {string} key @param {string} value */
    setLocal(key, value) { if (this.preferences?.owns(key)) this.preferences.set(key, value); else return this.port.setLocal(key, value); }
    /** @param {string} key */
    removeLocal(key) { return this.port.removeLocal(key); }
    /** @param {string} key @param {unknown} [fallback] */
    getValue(key, fallback) { return this.port.getValue(key, fallback); }
    /** @param {string} key @param {unknown} value */
    setValue(key, value) { return this.port.setValue(key, value); }
    /** @param {string} key */
    removeValue(key) { return this.port.removeValue(key); }
    listValues() { return this.port.listValues?.() ?? []; }
    /** @param {string} key @param {() => void} callback */
    listenValue(key, callback) { return this.port.listenValue?.(key, callback); }
    /** @param {any} listener */
    unlistenValue(listener) { this.port.unlistenValue?.(listener); }
}
