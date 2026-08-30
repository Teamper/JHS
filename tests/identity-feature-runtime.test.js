import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { IdentityController } from "../src/features/identity/identity-controller.js";

describe("Identity FeatureRuntime ownership", () => {
    it("passes one feature scope through navigation and actress-info contributions", async () => {
        const scope = new LifecycleScope("feature:identity");
        const imageSearchPlugin = { open: vi.fn(), handleImageFile: vi.fn(), resetSearchUI: vi.fn() };
        const javdbNavigationPlugin = { handle: vi.fn(async () => {}) };
        const actressInfoPlugin = { handle: vi.fn(async () => {}) };
        const controller = new IdentityController({ javdbNavigationPlugin, imageSearchPlugin, actressInfoPlugin, scope });

        await controller.start();
        await controller.start();

        expect(javdbNavigationPlugin.handle).toHaveBeenCalledOnce();
        expect(javdbNavigationPlugin.handle).toHaveBeenCalledWith({ scope, identityApi: controller.getApi() });
        expect(actressInfoPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi().hasSearchByImage).toBe(true);
        controller.getApi().openSearchByImage("callback");
        expect(imageSearchPlugin.open).toHaveBeenCalledWith("callback");
        controller.dispose();
        expect(scope.disposed).toBe(false);
        scope.dispose();
    });

    it("keeps identity available when optional contributions are disabled", async () => {
        const scope = new LifecycleScope("feature:identity");
        const controller = new IdentityController({ scope });

        await expect(controller.start()).resolves.toBeUndefined();
        expect(controller.getApi()).toMatchObject({ hasSearchByImage: false, hasActressInfo: false });
        scope.dispose();
    });
});
