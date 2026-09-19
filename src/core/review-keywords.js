// @ts-check
const REVIEW_KEY = "filter_keyword_review", LEGACY_KEY = "review_filter_keyword";
let writeChain = Promise.resolve();

/** Merge mistaken 6.5 writes with the canonical portable list under its write lock. */
/** @param {{get: (key: string) => Promise<unknown>, set: (key: string, value: unknown) => Promise<unknown>, remove?: (key: string) => Promise<unknown>}} storage @param {string} [keyword] */
export function readReviewKeywords(storage, keyword) {
    const write = async () => {
        const current = await storage.get(REVIEW_KEY), legacy = await storage.get(LEGACY_KEY);
        const values = [...new Set([...(Array.isArray(current) ? current.map(String) : []), ...(Array.isArray(legacy) ? legacy.map(String) : []), ...(keyword == null ? [] : [keyword])])];
        if (JSON.stringify(current ?? []) !== JSON.stringify(values)) {
            await storage.set(REVIEW_KEY, values);
            if (JSON.stringify(await storage.get(REVIEW_KEY)) !== JSON.stringify(values)) throw new Error("评论关键词回读失败");
        }
        if (Array.isArray(legacy) && JSON.stringify(await storage.get(LEGACY_KEY)) === JSON.stringify(legacy)) await storage.remove?.(LEGACY_KEY);
        return values;
    };
    const operation = writeChain.then(async () => {
        const locks = globalThis.navigator?.locks;
        return locks?.request ? await locks.request("jhs_keyword_lock", write) : await write();
    });
    writeChain = operation.then(() => {}, () => {});
    return operation;
}
