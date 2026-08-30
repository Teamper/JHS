import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { LibraryController } from "../src/features/library/library-controller.js";

describe("Library FeatureRuntime ownership", () => {
    it("passes the feature scope to the migrated history contribution once", async () => {
        const scope = new LifecycleScope("feature:library"), repository = {}, historyPlugin = {
            handle: vi.fn(async () => {}),
            get historyRepository() { return repository; },
        }, statePlugin = { handle: vi.fn(async () => {}) };
        const controller = new LibraryController({ historyPlugin, statePlugin, scope });

        await controller.start();
        await controller.start();

        expect(historyPlugin.handle).toHaveBeenCalledOnce();
        expect(historyPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(statePlugin.handle).toHaveBeenCalledOnce();
        expect(statePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi().getHistoryRepository()).toBe(repository);
        controller.dispose();
        expect(scope.disposed).toBe(false);
        scope.dispose();
    });

    it("keeps the feature usable when the optional history contribution is unavailable", async () => {
        const scope = new LifecycleScope("feature:library"), controller = new LibraryController({ scope });

        await expect(controller.start()).resolves.toBeUndefined();
        expect(controller.getApi().getHistoryRepository()).toBeNull();
        scope.dispose();
    });
});
