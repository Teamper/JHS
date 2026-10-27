/** In-memory implementation of the optional atomic port for business-domain tests. */
export function memoryAtomicStorage(values, { beforeWrite = async () => {} } = {}) {
    return {
        async readAtomicSnapshot(keys) {
            return Object.fromEntries(keys.map(key => [key, values.has(key) ? { exists: true, value: structuredClone(values.get(key)) } : { exists: false }]));
        },
        async commitAtomicBatch({ expected, puts, deletes, signal }) {
            if (signal?.aborted) throw new DOMException("cancelled", "AbortError");
            for (const [key, entry] of Object.entries(expected)) {
                if (values.has(key) !== entry.exists || entry.exists && JSON.stringify(values.get(key)) !== JSON.stringify(entry.value)) throw new Error("ATOMIC_IMPORT_CONFLICT");
            }
            const staged = new Map();
            for (const [key, value] of Object.entries(puts)) { await beforeWrite(key, value); staged.set(key, structuredClone(value)); }
            for (const key of deletes) await beforeWrite(key, undefined);
            for (const [key, value] of staged) values.set(key, value);
            for (const key of deletes) values.delete(key);
        },
    };
}
