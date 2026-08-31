import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { IdentityController } from "../src/features/identity/identity-controller.js";

describe("Identity FeatureRuntime ownership", () => {
    it("passes one feature scope through navigation and identity contributions", async () => {
        const scope = new LifecycleScope("feature:identity");
        const imageSearchController = { start: vi.fn(async () => {}), open: vi.fn(), handleImageFile: vi.fn(), resetSearchUI: vi.fn() };
        const javdbNavigationController = { start: vi.fn(async () => {}) };
        const javbusNavigationController = { start: vi.fn(async () => {}) };
        const actressInfoController = { start: vi.fn(async () => {}) };
        const controller = new IdentityController({ javdbNavigationController, javbusNavigationController, imageSearchController, actressInfoController, scope });

        await controller.start();
        await controller.start();

        expect(imageSearchController.start).toHaveBeenCalledOnce();
        expect(javdbNavigationController.start).toHaveBeenCalledOnce();
        expect(javdbNavigationController.start).toHaveBeenCalledWith({ scope, identityApi: controller.getApi() });
        expect(javbusNavigationController.start).toHaveBeenCalledOnce();
        expect(javbusNavigationController.start).toHaveBeenCalledWith({ scope, identityApi: controller.getApi() });
        expect(actressInfoController.start).toHaveBeenCalledOnce();
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
