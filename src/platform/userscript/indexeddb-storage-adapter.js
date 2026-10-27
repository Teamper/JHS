// @ts-check

export class IndexedDbStorageAdapter {
    /** @type {((key: string) => Promise<void>) | null} */
    beforeSet = null;
    /** @param {{getItem: (key: string) => Promise<unknown>, setItem: (key: string, value: unknown) => Promise<unknown>, removeItem: (key: string) => Promise<unknown>, keys: () => Promise<string[]>}} forage @param {Storage} localStore @param {(key: string, fallback?: unknown) => unknown} gmGetValue @param {(key: string, value: unknown) => void} gmSetValue @param {(key: string) => void} [gmDeleteValue] */
    constructor(forage, localStore, gmGetValue, gmSetValue, gmDeleteValue = () => {}) { this.forage = forage; this.localStore = localStore; this.gmGetValue = gmGetValue; this.gmSetValue = gmSetValue; this.gmDeleteValue = gmDeleteValue; }
    /** @param {string} key */
    get(key) { return this.forage.getItem(key); }
    /** @param {string} key @param {unknown} value */
    async set(key, value) { await this.beforeSet?.(key); await this.forage.setItem(key, value); }
    /** @param {string} key */
    async remove(key) { await this.forage.removeItem(key); }
    keys() { return this.forage.keys(); }
    /** @param {string[]} keys */
    readAtomicSnapshot(keys) { return readAtomicSnapshot(this.forage, keys); }
    /** @param {Parameters<typeof commitAtomicBatch>[1]} batch */
    commitAtomicBatch(batch) { return commitAtomicBatch(this.forage, batch); }
    /** @param {string} key */
    getLocal(key) { return this.localStore.getItem(key); }
    /** @param {string} key @param {string} value */
    setLocal(key, value) { this.localStore.setItem(key, value); }
    /** @param {string} key */
    removeLocal(key) { this.localStore.removeItem(key); }
    /** @param {string} key @param {unknown} [fallback] */
    getValue(key, fallback) { return this.gmGetValue(key, fallback); }
    /** @param {string} key @param {unknown} value */
    setValue(key, value) { return this.gmSetValue(key, value); }
    /** @type {any} */ gmListValues = null;
    /** @type {any} */ gmListenValue = null;
    /** @type {any} */ gmUnlistenValue = null;
    listValues() { return this.gmListValues?.() ?? []; }
    /** @param {string} key @param {() => void} callback */
    listenValue(key, callback) { return this.gmListenValue?.(key, callback); }
    /** @param {any} listener */
    unlistenValue(listener) { this.gmUnlistenValue?.(listener); }
    /** @param {string} key */
    removeValue(key) { return this.gmDeleteValue(key); }
}


/** @typedef {{exists: boolean, value?: any}} Entry */
/** @typedef {Record<string, Entry>} Snapshot */

function atomicImportUnavailable() {
    return Object.assign(new Error("当前存储不支持安全导入，数据未修改；仍可导出备份"), { code: "ATOMIC_IMPORT_UNAVAILABLE" });
}

/** Open the existing localforage store without creating or upgrading a database. @param {any} forage */
async function openExisting(forage) {
    await forage.ready?.();
    if (!globalThis.indexedDB || forage.driver?.() !== "asyncStorage") throw atomicImportUnavailable();
    const name = forage.config?.("name"), storeName = forage.config?.("storeName");
    if (name !== "JAV-JHS" || storeName !== "appData") throw atomicImportUnavailable();
    const db = await new Promise((/** @type {(db: IDBDatabase) => void} */ resolve, reject) => {
        const request = indexedDB.open(name);
        let settled = false;
        const timer = setTimeout(() => fail(atomicImportUnavailable()), 5000);
        /** @param {unknown} error */
        const fail = error => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
        request.onupgradeneeded = () => { request.transaction?.abort(); fail(atomicImportUnavailable()); };
        request.onblocked = () => fail(atomicImportUnavailable());
        request.onerror = () => fail(request.error ?? atomicImportUnavailable());
        request.onsuccess = () => {
            if (settled) return request.result.close();
            settled = true; clearTimeout(timer);
            const db = request.result;
            db.onversionchange = () => db.close();
            if (!db.objectStoreNames.contains(storeName)) { db.close(); reject(atomicImportUnavailable()); }
            else resolve(db);
        };
    });
    return { db, storeName };
}

/** @param {any} forage @param {string[]} keys @returns {Promise<Snapshot>} */
async function readAtomicSnapshot(forage, keys) {
    const { db, storeName } = await openExisting(forage);
    try {
        return await new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readonly"), store = tx.objectStore(storeName);
            /** @type {Snapshot} */ const entries = Object.create(null);
            tx.oncomplete = () => resolve(entries);
            tx.onabort = () => reject(tx.error ?? new Error("读取导入基线失败"));
            tx.onerror = () => { /* onabort owns the result */ };
            for (const key of new Set(keys)) {
                const request = store.openCursor(key);
                request.onsuccess = () => { entries[key] = request.result ? { exists: true, value: request.result.value } : { exists: false }; };
            }
        });
    } finally { db.close(); }
}

/** Values at this boundary are the existing JSON business domains, not arbitrary binary caches. @param {any} value @returns {string} */
function signature(value) {
    if (!value || typeof value !== "object") return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(signature).join(",")}]`;
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${signature(value[key])}`).join(",")}}`;
}

/** @param {any} forage @param {{expected: Snapshot, puts: Record<string, any>, deletes: string[], signal?: AbortSignal}} batch */
async function commitAtomicBatch(forage, { expected, puts, deletes, signal }) {
    const { db, storeName } = await openExisting(forage);
    try {
        await new Promise((resolve, reject) => {
            const tx = db.transaction(storeName, "readwrite"), store = tx.objectStore(storeName);
            const keys = Object.keys(expected);
            let remaining = keys.length, failure = /** @type {unknown} */ (null);
            /** @param {unknown} error */
            const abort = error => { failure ??= error; try { tx.abort(); } catch { /* terminal transaction */ } };
            const onAbort = () => abort(new DOMException("导入已取消", "AbortError"));
            signal?.addEventListener("abort", onAbort, { once: true });
            const cleanup = () => signal?.removeEventListener("abort", onAbort);
            tx.oncomplete = () => { cleanup(); resolve(undefined); };
            tx.onabort = () => { cleanup(); reject(failure ?? tx.error ?? new Error("导入事务已中止，原数据保持不变")); };
            tx.onerror = () => { /* request errors abort the whole transaction */ };
            // All writes are queued synchronously in an active request callback.
            // Awaiting localforage, migration or network work here would auto-commit.
            const write = () => {
                if (failure) return;
                try {
                    for (const [key, value] of Object.entries(puts)) store.put(value, key);
                    for (const key of deletes) store.delete(key);
                } catch (error) { abort(error); }
            };
            if (signal?.aborted) { onAbort(); return; }
            if (!remaining) { write(); return; }
            for (const key of keys) {
                const request = store.openCursor(key);
                request.onsuccess = () => {
                    if (failure) return;
                    const entry = expected[key], cursor = request.result;
                    if (Boolean(cursor) !== entry.exists || cursor && signature(cursor.value) !== signature(entry.value)) {
                        abort(Object.assign(new Error("数据已被其他页面修改，请重新预览后导入"), { code: "ATOMIC_IMPORT_CONFLICT" }));
                        return;
                    }
                    if (--remaining === 0) write();
                };
            }
        });
    } finally { db.close(); }
}
