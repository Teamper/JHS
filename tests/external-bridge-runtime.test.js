import { describe, expect, it, vi } from "vitest";
import { ExternalBridgeController } from "../src/features/external-bridge/external-bridge-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("ExternalBridgeController", () => {
    it("starts enabled bridge contributions with one Feature scope", async () => {
        const scope = new LifecycleScope("feature:external-bridge"), plugins = Object.fromEntries([
            ["translationController", { start: vi.fn() }],
            ["oneOneFiveController", { start: vi.fn() }],
            ["offlineController", { start: vi.fn(), registry: { providers: new Map([["115", { id: "115" }]]) } }],
            ["oneTwoThreeController", { start: vi.fn() }],
            ["javTrailersController", { start: vi.fn() }],
            ["subtitleController", { start: vi.fn() }],
        ]);
        const controller = new ExternalBridgeController({ ...plugins, scope });

        await controller.start();

        expect(plugins.oneTwoThreeController.start).toHaveBeenCalledOnce();
        expect(plugins.translationController.start).toHaveBeenCalledOnce();
        expect(plugins.oneOneFiveController.start).toHaveBeenCalledOnce();
        expect(plugins.offlineController.start).toHaveBeenCalledOnce();
        expect(plugins.javTrailersController.start).toHaveBeenCalledOnce();
        expect(plugins.subtitleController.start).toHaveBeenCalledOnce();
        expect(controller.getApi()).toMatchObject({ hasTranslation: true, hasOffline: true });
        expect(controller.getApi().getOfflineProvider("115")).toBe(plugins.offlineController.registry.providers.get("115"));
    });

    it("does not start a second time and releases the started state on failure", async () => {
        const scope = new LifecycleScope("feature:external-bridge"), start = vi.fn().mockRejectedValue(new Error("bridge failed"));
        const controller = new ExternalBridgeController({ translationController: { start }, scope });

        await expect(controller.start()).rejects.toThrow("bridge failed");
        expect(controller.started).toBe(false);
        start.mockResolvedValue(undefined);
        await controller.start();
        expect(start).toHaveBeenCalledTimes(2);
    });
});
