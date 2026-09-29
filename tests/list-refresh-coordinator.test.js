import { describe, expect, it, vi } from "vitest";
import { ListRefreshCoordinator } from "../src/features/list/list-refresh-coordinator.js";

function setup() {
    let generation = 0;
    const calls = [];
    const options = {
        advanceGeneration: vi.fn(() => ++generation),
        captureRevision: vi.fn(() => String(generation)),
        isCurrent: vi.fn((revision) => revision === String(generation)),
        recordPhase: vi.fn((phase) => calls.push(["phase", phase])),
        invalidateContext: vi.fn(() => calls.push(["invalidate"])),
        filterAll: vi.fn(async (revision) => { calls.push(["all", revision]); return true; }),
        filterItems: vi.fn(async (items, revision) => { calls.push(["items", items, revision]); return true; }),
        reconcile: vi.fn((items, revision) => { calls.push(["reconcile", items, revision]); return true; }),
        syncHistory: vi.fn(() => calls.push(["history"])),
    };
    return { coordinator: new ListRefreshCoordinator(options), options, calls };
}

describe("ListRefreshCoordinator", () => {
    it("coalesces an in-flight stale pass into one current full refresh", async () => {
        const { coordinator, options } = setup();
        let release;
        options.filterAll.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

        const first = coordinator.request({ reason: "first", full: true });
        await vi.waitFor(() => expect(options.filterAll).toHaveBeenCalledOnce());
        const second = coordinator.request({ reason: "latest", full: true });
        release(true);

        await expect(first).resolves.toBe(true);
        await expect(second).resolves.toBe(true);
        expect(options.filterAll).toHaveBeenCalledTimes(2);
        expect(options.reconcile).toHaveBeenCalledTimes(1);
        expect(options.syncHistory).toHaveBeenCalledTimes(1);
        expect(options.invalidateContext).toHaveBeenCalledTimes(2);
    });

    it("merges partial items and ignores disconnected cards before filtering", async () => {
        const { coordinator, options } = setup();
        const connected = { isConnected: true }, disconnected = { isConnected: false };

        await coordinator.request({ items: [connected, disconnected], reason: "append" });

        expect(options.filterItems).toHaveBeenCalledWith([connected], "1");
        expect(options.reconcile).toHaveBeenCalledWith([connected, disconnected], "1");
        expect(options.syncHistory).not.toHaveBeenCalled();
        expect(options.invalidateContext).not.toHaveBeenCalled();
    });

    it("applies visibility-only requests without rerunning the evaluator", async () => {
        const { coordinator, options } = setup();

        await coordinator.request({ visibilityOnly: true, reason: "quick-filter" });

        expect(options.filterAll).not.toHaveBeenCalled();
        expect(options.filterItems).not.toHaveBeenCalled();
        expect(options.reconcile).toHaveBeenCalledWith([], "0");
    });

    it("does not reconcile or restart work after disposal during an async filter", async () => {
        const { coordinator, options } = setup();
        let release;
        options.filterAll.mockImplementationOnce(() => new Promise((resolve) => { release = resolve; }));

        const pending = coordinator.request({ full: true });
        await vi.waitFor(() => expect(options.filterAll).toHaveBeenCalledOnce());
        coordinator.dispose();
        release(true);

        await expect(pending).resolves.toBe(false);
        expect(options.filterAll).toHaveBeenCalledOnce();
        expect(options.reconcile).not.toHaveBeenCalled();
        await expect(coordinator.request({ full: true })).resolves.toBe(false);
    });

});
