import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { TaskSchedulerController } from "../src/features/discovery/task-scheduler-controller.js";

afterEach(() => {
    vi.useRealTimers();
});

function createScheduler({ hidden = false, isListPage = true, runTask = vi.fn(async () => {}) } = {}) {
    vi.useFakeTimers();
    const dom = new JSDOM("<!doctype html><body></body>", { url: "https://javdb.com/" });
    let isHidden = hidden;
    Object.defineProperty(dom.window.document, "hidden", { configurable: true, get: () => isHidden });
    const handlers = new Map();
    const events = {
        on: vi.fn((name, handler) => {
            const listeners = handlers.get(name) || new Set();
            listeners.add(handler);
            handlers.set(name, listeners);
            return () => listeners.delete(handler);
        }),
        async emit(name, payload) {
            await Promise.all([...(handlers.get(name) || [])].map((handler) => handler(payload)));
        },
        handlers,
    };
    const storage = { invalidateSettingCache: vi.fn() };
    const refreshConfiguration = vi.fn(async () => {}), onError = vi.fn();
    const scope = new LifecycleScope("feature:scheduler");
    const controller = new TaskSchedulerController({
        window: dom.window,
        document: dom.window.document,
        events,
        storage,
        scope,
        isListPage: () => isListPage,
        runTask,
        refreshConfiguration,
        onError,
    });
    return {
        controller, dom, events, storage, refreshConfiguration, runTask, onError, scope,
        setHidden(value) { isHidden = value; },
    };
}

describe("Feature-owned task scheduler lifecycle", () => {
    it("starts once on a visible list page, retains the five-minute delay, and releases resources", async () => {
        const harness = createScheduler();
        harness.controller.start();
        await vi.advanceTimersByTimeAsync(0);

        expect(harness.runTask).toHaveBeenCalledOnce();
        expect(vi.getTimerCount()).toBe(1);
        expect(harness.scope.snapshot().listeners).toBe(2);
        expect(harness.events.handlers.get("settings-changed").size).toBe(1);

        harness.scope.dispose();
        expect(harness.scope.snapshot()).toMatchObject({ listeners: 0, disposed: true });
        expect(harness.events.handlers.get("settings-changed").size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
        harness.dom.window.close();
    });

    it("keeps non-list and hidden pages dormant, then resumes on visibility", async () => {
        const detail = createScheduler({ isListPage: false });
        detail.controller.start();
        expect(detail.runTask).not.toHaveBeenCalled();
        expect(detail.scope.snapshot().listeners).toBe(0);
        detail.scope.dispose();
        detail.dom.window.close();

        const hidden = createScheduler({ hidden: true });
        hidden.controller.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(hidden.runTask).not.toHaveBeenCalled();
        hidden.setHidden(false);
        hidden.dom.window.document.dispatchEvent(new hidden.dom.window.Event("visibilitychange"));
        await vi.advanceTimersByTimeAsync(0);
        expect(hidden.runTask).toHaveBeenCalledOnce();
        hidden.scope.dispose();
        hidden.dom.window.close();
    });

    it("invalidates and refreshes schedule configuration on one settings event", async () => {
        const harness = createScheduler();
        harness.controller.start();
        await vi.advanceTimersByTimeAsync(0);
        await harness.events.emit("settings-changed", {});
        expect(harness.storage.invalidateSettingCache).toHaveBeenCalledOnce();
        expect(harness.refreshConfiguration).toHaveBeenCalledOnce();
        await vi.advanceTimersByTimeAsync(0);
        expect(harness.runTask).toHaveBeenCalledTimes(2);
        harness.scope.dispose();
        harness.dom.window.close();
    });

    it("does not reschedule when an in-flight batch resolves after feature shutdown", async () => {
        let finish;
        const runTask = vi.fn(() => new Promise((resolve) => { finish = resolve; }));
        const harness = createScheduler({ runTask });
        harness.controller.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(runTask).toHaveBeenCalledOnce();
        harness.scope.dispose();
        finish();
        await Promise.resolve();
        await Promise.resolve();
        expect(vi.getTimerCount()).toBe(0);
        harness.dom.window.close();
    });

    it("reports task and settings-refresh failures without stranding the loop", async () => {
        const runTask = vi.fn().mockRejectedValueOnce(new Error("batch failed"));
        const harness = createScheduler({ runTask });
        harness.refreshConfiguration.mockRejectedValueOnce(new Error("settings failed"));
        harness.controller.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(harness.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "batch failed" }));
        await harness.events.emit("settings-changed", {});
        expect(harness.onError).toHaveBeenCalledWith(expect.objectContaining({ message: "settings failed" }));
        expect(vi.getTimerCount()).toBe(1);
        harness.scope.dispose();
        harness.dom.window.close();
    });
});
