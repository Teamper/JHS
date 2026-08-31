import { describe, expect, it, vi } from "vitest";
import { ExternalBridgeController } from "../src/features/external-bridge/external-bridge-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

describe("ExternalBridgeController", () => {
    it("starts enabled bridge contributions with one Feature scope", async () => {
        const scope = new LifecycleScope("feature:external-bridge"), plugins = Object.fromEntries([
            ["translationController", { start: vi.fn() }],
            ["oneOneFiveController", { start: vi.fn() }],
            ["unifiedOfflinePlugin", { handle: vi.fn(), registry: { providers: new Map([["115", { id: "115" }]]) } }],
            ["oneTwoThreeController", { start: vi.fn() }],
            ["javTrailersPlugin", { handle: vi.fn() }],
            ["subtitlePlugin", { handle: vi.fn() }],
        ]);
        const controller = new ExternalBridgeController({ ...plugins, scope });

        await controller.start();

        expect(plugins.oneTwoThreeController.start).toHaveBeenCalledOnce();
        expect(plugins.translationController.start).toHaveBeenCalledOnce();
        expect(plugins.oneOneFiveController.start).toHaveBeenCalledOnce();
        expect(plugins.unifiedOfflinePlugin.handle).toHaveBeenCalledWith({ scope, oneTwoThreeController: plugins.oneTwoThreeController });
        expect(plugins.javTrailersPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(plugins.subtitlePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi()).toMatchObject({ hasTranslation: true, hasOffline: true });
        expect(controller.getApi().getOfflineProvider("115")).toBe(plugins.unifiedOfflinePlugin.registry.providers.get("115"));
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
