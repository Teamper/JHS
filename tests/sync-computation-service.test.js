import { readFileSync } from "node:fs";
import { afterEach, expect, it, vi } from "vitest";
import { SyncComputation } from "../src/services/sync-computation-service.js";
import { runSyncJob, encodeReconciliation, decodeReconciliation } from "../src/core/sync-computation-jobs.js";
import { ComputationBudget } from "../src/core/cooperative-work.js";

const golden = JSON.parse(readFileSync(new URL("./fixtures/sync-computation-golden.json", import.meta.url), "utf8"));
afterEach(() => vi.useRealTimers());
it("round-trips changed and deleted records through the reconciliation delta", async () => {
    const keep = { fields: { value: "kept" } };
    const base = { model: { records: { keep, old: { fields: {} } }, frontiers: {} }, shadow: { keep: 1, old: 2 } };
    const state = { counter: 2, model: { records: { keep, added: { fields: { value: "new" } } }, frontiers: { activity_log: "floor" } }, shadow: { keep: 1, added: 3 } };
    const result = { changed: true, state };
    const encoded = await encodeReconciliation(base, result, new ComputationBudget());
    expect(encoded.delta.recordPuts.keep).toBeUndefined();
    expect(encoded.delta.recordDeletes).toEqual(["old"]);
    expect(decodeReconciliation(base, structuredClone(encoded))).toEqual(result);
    expect(JSON.stringify(decodeReconciliation(base, structuredClone(encoded)).state.model)).toBe(JSON.stringify(state.model));
    expect(decodeReconciliation(base, { changed: false }).state).toBe(base);
    expect(base.model.records.old).toBeDefined();
});
function workerFactory() {
    const worker = { terminate: vi.fn(), onmessage: null, onerror: null, postMessage: vi.fn(async message => {
        try {
            const value = await runSyncJob(message.job, structuredClone(message.payload), new ComputationBudget());
            worker.onmessage?.({ data: { id: message.id, revision: message.revision, value: structuredClone(value) } });
        } catch (error) { worker.onmessage?.({ data: { id: message.id, revision: message.revision, error: { name: error.name, message: error.message, code: error.code } } }); }
    }) };
    queueMicrotask(() => worker.onmessage?.({ data: { ready: 1 } }));
    return worker;
}
it("uses the same golden computation results in worker and fallback paths", async () => {
    const worker = new SyncComputation({ createWorker: workerFactory }), fallback = new SyncComputation();
    try {
        const jobs = [
            ["project", { data: golden.data, frontiers: {} }],
            ["join", { left: golden.model, right: golden.joined }],
            ["materialize", { model: golden.joined, local: golden.data, undoEligible: [] }],
            ["reconcile", { state: { joined: true, model: golden.model, shadow: golden.projection, counter: 1, layout: {}, dirty: false, localRevision: 0, undoEligible: [] }, data: golden.changed, pruned: {}, touched: null, now: Date.parse("2026-11-05T00:00:00Z") }],
            ["stringify", golden], ["parse", JSON.stringify(golden)],
            ["equal", { left: golden, right: structuredClone(golden) }],
        ];
        for (const [job, payload] of jobs) {
            expect(await worker.run(job, payload)).toEqual(await fallback.run(job, payload));
        }
        await expect(worker.run("parse", "invalid json")).rejects.toHaveProperty("name", "SyntaxError");
    } finally { worker.dispose(); fallback.dispose(); }
});
it("falls back after a blocked worker and avoids recreating it", async () => {
    const createWorker = vi.fn(() => { throw new DOMException("blocked", "SecurityError"); });
    const runner = new SyncComputation({ createWorker });
    try {
        expect(await runner.run("parse", "123")).toBe(123);
        expect(await runner.run("parse", "456")).toBe(456);
        expect(createWorker).toHaveBeenCalledOnce();
    } finally { runner.dispose(); }
});
it("rejects a response from a different revision", async () => {
    let worker;
    const runner = new SyncComputation({ createWorker: () => {
        worker = workerFactory();
        worker.postMessage.mockImplementation(message => queueMicrotask(() => worker.onmessage({ data: { id: message.id, revision: "stale", value: 1 } })));
        return worker;
    } });
    try {
        await expect(runner.run("parse", "1", { revision: "current" })).rejects.toHaveProperty("name", "AbortError");
        expect(worker.terminate).toHaveBeenCalledOnce();
    } finally { runner.dispose(); }
});
it("terminates a hung initializer at its deadline and uses cooperative computation", async () => {
    vi.useFakeTimers();
    const worker = { terminate: vi.fn() }, runner = new SyncComputation({ createWorker: () => worker });
    const result = runner.run("parse", "123");
    await vi.advanceTimersByTimeAsync(2000);
    expect(await result).toBe(123); expect(worker.terminate).toHaveBeenCalledOnce(); runner.dispose();
});
it("cancels active and queued work and rejects late replies after disposal", async () => {
    const workers = [], runner = new SyncComputation({ createWorker: () => { const worker = workerFactory(); worker.postMessage.mockImplementation(() => {}); workers.push(worker); return worker; } });
    const controller = new AbortController();
    const result = runner.run("parse", "1", { signal: controller.signal });
    const rejected = expect(result).rejects.toHaveProperty("name", "AbortError");
    const queued = runner.run("parse", "2", { signal: controller.signal });
    const queuedRejected = expect(queued).rejects.toHaveProperty("name", "AbortError");
    await vi.waitFor(() => expect(workers[0]?.postMessage).toHaveBeenCalledOnce());
    controller.abort(); await rejected; await queuedRejected;
    expect(workers[0].terminate).toHaveBeenCalledOnce();
    runner.dispose();
    await expect(runner.run("parse", "2")).rejects.toHaveProperty("name", "AbortError");
});
it("cancels unsignalled active and queued jobs while allowing a fresh generation", async () => {
    let worker;
    const runner = new SyncComputation({ createWorker: () => {
        worker = workerFactory();
        worker.postMessage.mockImplementation(() => {});
        return worker;
    } });
    try {
        const active = expect(runner.run("parse", "1")).rejects.toHaveProperty("name", "AbortError");
        const queued = expect(runner.run("parse", "2")).rejects.toHaveProperty("name", "AbortError");
        await vi.waitFor(() => expect(worker?.postMessage).toHaveBeenCalledOnce());
        runner.cancel(); await active; await queued;
        expect(worker.terminate).toHaveBeenCalledOnce();
        runner.options.createWorker = workerFactory;
        expect(await runner.run("parse", "3")).toBe(3);
    } finally { runner.dispose(); }
});
it("ignores late messages and errors from a terminated worker after restart", async () => {
    const workers = [];
    const runner = new SyncComputation({ createWorker: () => {
        const worker = workerFactory(); workers.push(worker);
        worker.postMessage.mockImplementation(() => {});
        return worker;
    } });
    try {
        const cancelled = expect(runner.run("parse", "1")).rejects.toHaveProperty("name", "AbortError");
        await vi.waitFor(() => expect(workers[0]?.postMessage).toHaveBeenCalledOnce());
        runner.cancel(); await cancelled;
        const result = runner.run("parse", "2");
        await vi.waitFor(() => expect(workers[1]?.postMessage).toHaveBeenCalledOnce());
        workers[0].onerror();
        workers[0].onmessage({ data: { ready: 1 } });
        expect(workers[1].terminate).not.toHaveBeenCalled();
        const request = workers[1].postMessage.mock.calls[0][0];
        workers[1].onmessage({ data: { id: request.id, revision: request.revision, value: 2 } });
        expect(await result).toBe(2);
    } finally { runner.dispose(); }
});
