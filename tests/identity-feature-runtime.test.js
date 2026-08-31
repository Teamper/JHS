import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { IdentityController } from "../src/features/identity/identity-controller.js";

describe("Identity FeatureRuntime ownership", () => {
    it("passes one feature scope through navigation and actress-info contributions", async () => {
        const scope = new LifecycleScope("feature:identity");
        const imageSearchPlugin = { open: vi.fn(), handleImageFile: vi.fn(), resetSearchUI: vi.fn() };
        const imageSearchController = { start: vi.fn(async () => {}), ...imageSearchPlugin };
        const javdbNavigationController = { start: vi.fn(async () => {}) };
        const javbusNavigationController = { start: vi.fn(async () => {}) };
        const actressInfoPlugin = { handle: vi.fn(async () => {}) };
        const controller = new IdentityController({ javdbNavigationController, javbusNavigationController, imageSearchController, actressInfoPlugin, scope });

        await controller.start();
        await controller.start();

        expect(imageSearchController.start).toHaveBeenCalledOnce();
        expect(javdbNavigationController.start).toHaveBeenCalledOnce();
        expect(javdbNavigationController.start).toHaveBeenCalledWith({ scope, identityApi: controller.getApi() });
        expect(javbusNavigationController.start).toHaveBeenCalledOnce();
        expect(javbusNavigationController.start).toHaveBeenCalledWith({ scope, identityApi: controller.getApi() });
        expect(actressInfoPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi().hasSearchByImage).toBe(true);
        controller.getApi().openSearchByImage("callback");
        expect(imageSearchController.open).toHaveBeenCalledWith("callback");
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
