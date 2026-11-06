/** Measure retained heaps after a timed round, including dedicated workers. */
export async function retainedMemory(page, context, { collect = true } = {}) {
    const main = await context.newCDPSession(page);
    const browser = await context.browser().newBrowserCDPSession();
    try {
        if (collect) await main.send("HeapProfiler.collectGarbage");
        const mainHeap = await main.send("Runtime.getHeapUsage");
        const { targetInfos } = await browser.send("Target.getTargets");
        const workers = targetInfos.filter(target => target.type === "worker");
        let workerHeapBytes = 0;
        for (const target of workers) {
            const { sessionId } = await browser.send("Target.attachToTarget", { targetId: target.targetId, flatten: false });
            let nextId = 0;
            const command = method => new Promise((resolve, reject) => {
                const id = ++nextId;
                const timer = setTimeout(() => { browser.off("Target.receivedMessageFromTarget", receive); reject(new Error("Worker memory measurement timed out")); }, collect ? 3000 : 15000);
                const receive = event => {
                    if (event.sessionId !== sessionId) return;
                    const message = JSON.parse(event.message);
                    if (message.id !== id) return;
                    clearTimeout(timer); browser.off("Target.receivedMessageFromTarget", receive);
                    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
                };
                browser.on("Target.receivedMessageFromTarget", receive);
                browser.send("Target.sendMessageToTarget", { sessionId, message: JSON.stringify({ id, method }) }).catch(error => {
                    clearTimeout(timer); browser.off("Target.receivedMessageFromTarget", receive); reject(error);
                });
            });
            try {
                if (collect) await command("HeapProfiler.collectGarbage");
                workerHeapBytes += (await command("Runtime.getHeapUsage")).usedSize;
            } finally { await browser.send("Target.detachFromTarget", { sessionId }); }
        }
        return { mainHeapBytes: mainHeap.usedSize, workerHeapBytes, workers: workers.length, totalHeapBytes: mainHeap.usedSize + workerHeapBytes };
    } finally { await main.detach(); await browser.detach(); }
}

/** Profiling-only sampler. Timed performance runs leave this disabled. */
export function sampleMemory(page, context) {
    let stopped = false;
    const samples = [];
    const started = performance.now();
    const pump = (async () => {
        while (!stopped) {
            const sample = await retainedMemory(page, context, { collect: false });
            samples.push({ milliseconds: performance.now() - started, ...sample });
            if (!stopped) await new Promise(resolve => setTimeout(resolve, 200));
        }
    })();
    // Keep early measurement failures attached until the owning test stops it.
    void pump.catch(() => {});
    return { async stop() {
        stopped = true; await pump;
        return { requestedIntervalMilliseconds: 200, samples,
            mainPeakBytes: Math.max(0, ...samples.map(sample => sample.mainHeapBytes)),
            workerPeakBytes: Math.max(0, ...samples.map(sample => sample.workerHeapBytes)),
            totalPeakBytes: Math.max(0, ...samples.map(sample => sample.totalHeapBytes)) };
    } };
}
