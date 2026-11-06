// @ts-check

/** The build embeds the worker in the same userscript. */
export function createSyncWorker() {
    if (typeof __JHS_SYNC_WORKER_SOURCE__ !== "string" || !__JHS_SYNC_WORKER_SOURCE__) throw new Error("同步计算线程构建缺失");
    const url = URL.createObjectURL(new Blob([__JHS_SYNC_WORKER_SOURCE__], { type: "text/javascript" }));
    try { return new Worker(url); }
    finally { URL.revokeObjectURL(url); }
}
