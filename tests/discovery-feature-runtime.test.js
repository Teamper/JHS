import { describe, expect, it, vi } from "vitest";
import { DiscoveryController } from "../src/features/discovery/discovery-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("DiscoveryController", () => {
    it("starts eager ranking surfaces and defers new-video tasks to idle", async () => {
        vi.useFakeTimers();
        try {
            const scope = new LifecycleScope("feature:discovery"), hitShowPlugin = { handle: vi.fn() }, top250Plugin = { handle: vi.fn() }, newVideoPlugin = { setTaskApi: vi.fn(), handle: vi.fn() }, taskPlugin = { handle: vi.fn(), singleTaskKey: "discovery-task" };
            const controller = new DiscoveryController({ hitShowPlugin, top250Plugin, newVideoPlugin, taskPlugin, scope });

            await controller.start();

            expect(hitShowPlugin.handle).toHaveBeenCalledWith(expect.objectContaining({ scope, discoveryApi: expect.any(Object) }));
            expect(top250Plugin.handle).toHaveBeenCalledWith(expect.objectContaining({ scope, discoveryApi: expect.any(Object) }));
            expect(newVideoPlugin.setTaskApi).toHaveBeenCalledWith(expect.objectContaining({ singleTaskKey: "discovery-task" }));
            expect(newVideoPlugin.handle).not.toHaveBeenCalled();
            expect(taskPlugin.handle).not.toHaveBeenCalled();

            await vi.advanceTimersByTimeAsync(100);
            expect(newVideoPlugin.handle).toHaveBeenCalledWith({ scope, taskApi: expect.objectContaining({ singleTaskKey: "discovery-task" }) });
            expect(taskPlugin.handle).toHaveBeenCalledWith({ scope });
            expect(controller.getApi()).toMatchObject({ hasHitShow: true, hasTop250: true, hasNewVideo: true, hasTask: true, singleTaskKey: "discovery-task" });
        } finally {
            vi.useRealTimers();
        }
    });

    it("cancels the idle handoff when disposed", async () => {
        vi.useFakeTimers();
        try {
            const scope = new LifecycleScope("feature:discovery"), newVideoPlugin = { handle: vi.fn() }, taskPlugin = { handle: vi.fn() }, controller = new DiscoveryController({ newVideoPlugin, taskPlugin, scope });
            await controller.start();
            controller.dispose();
            await vi.advanceTimersByTimeAsync(100);
            expect(newVideoPlugin.handle).not.toHaveBeenCalled();
            expect(taskPlugin.handle).not.toHaveBeenCalled();
        } finally {
            vi.useRealTimers();
        }
    });
});
