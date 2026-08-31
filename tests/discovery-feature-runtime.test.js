import { describe, expect, it, vi } from "vitest";
import { DiscoveryController } from "../src/features/discovery/discovery-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("DiscoveryController", () => {
    it("starts eager ranking surfaces and defers new-video tasks to idle", async () => {
        vi.useFakeTimers();
        try {
            const scope = new LifecycleScope("feature:discovery"), hitShowController = { start: vi.fn() }, top250Controller = { start: vi.fn() }, newVideoController = { setTaskApi: vi.fn(), start: vi.fn() }, taskController = { start: vi.fn(), singleTaskKey: "discovery-task" };
            const controller = new DiscoveryController({ hitShowController, top250Controller, newVideoController, taskController, scope });

            await controller.start();

            expect(hitShowController.start).toHaveBeenCalledWith(expect.objectContaining({ discoveryApi: expect.any(Object) }));
            expect(top250Controller.start).toHaveBeenCalledWith(expect.objectContaining({ discoveryApi: expect.any(Object) }));
            expect(newVideoController.setTaskApi).toHaveBeenCalledWith(expect.objectContaining({ singleTaskKey: "discovery-task" }));
            expect(newVideoController.start).not.toHaveBeenCalled();
            expect(taskController.start).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(100);
            expect(newVideoController.start).toHaveBeenCalledWith({ taskApi: expect.objectContaining({ singleTaskKey: "discovery-task" }) });
            expect(taskController.start).toHaveBeenCalledOnce();
            expect(controller.getApi()).toMatchObject({ hasHitShow: true, hasTop250: true, hasNewVideo: true, hasTask: true, singleTaskKey: "discovery-task" });
        } finally {
            vi.useRealTimers();
        }
    });

    it("cancels the idle handoff when disposed", async () => {
        vi.useFakeTimers();
        try {
            const scope = new LifecycleScope("feature:discovery"), newVideoController = { start: vi.fn() }, taskController = { start: vi.fn() }, controller = new DiscoveryController({ newVideoController, taskController, scope });
            await controller.start();
            controller.dispose();
            await vi.advanceTimersByTimeAsync(100);
            expect(newVideoController.start).not.toHaveBeenCalled();
            expect(taskController.start).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
