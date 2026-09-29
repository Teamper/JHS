import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskCompatibilityBean } from "../src/compat/task-compatibility-bean.js";

afterEach(() => vi.useRealTimers());

describe("TaskCompatibilityBean startup readiness", () => {
    it("runs an early manual scan once after the delayed scheduler service connects", async () => {
        vi.useFakeTimers();
        const bean = new TaskCompatibilityBean();
        const checkBlacklist = vi.fn(async () => ({ completed: true }));
        const pending = bean.checkBlacklist(true);
        expect(bean.serviceWaiters.size).toBe(1);
        bean.connect({ checkBlacklist });

        await expect(pending).resolves.toEqual({ completed: true });
        expect(checkBlacklist).toHaveBeenCalledExactlyOnceWith(true);
        expect(bean.serviceWaiters.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });

    it("rejects an unavailable scheduler after a bounded wait and clears its waiter", async () => {
        vi.useFakeTimers();
        const bean = new TaskCompatibilityBean();
        const pending = bean.checkBlacklist(true);
        const assertion = expect(pending).rejects.toThrow("后台任务尚未就绪，请稍后重试");
        await vi.advanceTimersByTimeAsync(10_000);

        await assertion;
        expect(bean.serviceWaiters.size).toBe(0);
    });

    it("cancels an early scan wait and its timer when the dialog closes", async () => {
        vi.useFakeTimers();
        const bean = new TaskCompatibilityBean();
        const controller = new AbortController();
        const pending = bean.waitForService(10_000, controller.signal);
        expect(bean.serviceWaiters.size).toBe(1);
        expect(vi.getTimerCount()).toBe(1);

        controller.abort();
        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(bean.serviceWaiters.size).toBe(0);
        expect(vi.getTimerCount()).toBe(0);
    });
});
