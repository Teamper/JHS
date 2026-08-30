import { describe, expect, it, vi } from "vitest";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";
import { DetailController } from "../src/features/detail/detail-controller.js";
import { StatsController } from "../src/features/stats/stats-controller.js";
import { ResponsiveShellController } from "../src/features/system/responsive-shell-controller.js";

function createScope() {
    return { assertActive: vi.fn() };
}

describe("feature controller ownership", () => {
    it("hands the feature scope to compatibility and starts only once", async () => {
        const scope = createScope(), plugin = { handle: vi.fn() }, controller = new CompatibilityController({ plugin, scope });
        await controller.start();
        await controller.start();

        expect(scope.assertActive).toHaveBeenCalledTimes(2);
        expect(plugin.handle).toHaveBeenCalledOnce();
        expect(plugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi()).toEqual({ hasEnhancements: true });
    });

    it("hands the feature scope to the detail workspace contribution", async () => {
        const scope = createScope(), hostAdapter = {
            locateDetailRoot: vi.fn(() => null),
            locateDetailSlots: vi.fn(() => ({})),
            readMovieRef: vi.fn(() => ({ carNum: "ABC-1" })),
        }, workspacePlugin = { handle: vi.fn() };
        const controller = new DetailController({ hostAdapter, workspacePlugin, scope, enabledContributions: ["detail.workspace"] });

        await expect(controller.start()).resolves.toMatchObject({ movieRef: { carNum: "ABC-1" }, contributions: ["detail.workspace"] });
        expect(workspacePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(hostAdapter.locateDetailRoot).toHaveBeenCalledOnce();
    });

    it("runs native detail enhancement before the workspace contribution", async () => {
        const scope = createScope(), hostAdapter = {
            locateDetailRoot: vi.fn(() => null),
            locateDetailSlots: vi.fn(() => ({})),
            readMovieRef: vi.fn(() => null),
        }, calls = [], nativePlugin = { handle: vi.fn(() => calls.push("native")) }, workspacePlugin = { handle: vi.fn(() => calls.push("workspace")) }, reviewPlugin = { handle: vi.fn(() => calls.push("reviews")) }, relatedPlugin = { handle: vi.fn(() => calls.push("related")) }, screenshotPlugin = { handle: vi.fn(() => calls.push("screenshot")) }, magnetPlugin = { handle: vi.fn(() => calls.push("magnet")) };
        const controller = new DetailController({ hostAdapter, nativePlugin, workspacePlugin, reviewPlugin, relatedPlugin, screenshotPlugin, magnetPlugin, scope, enabledContributions: [] });

        await controller.start();

        expect(calls).toEqual(["native", "workspace", "reviews", "related", "screenshot", "magnet"]);
        expect(nativePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(workspacePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(reviewPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(relatedPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(screenshotPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(magnetPlugin.handle).toHaveBeenCalledWith({ scope });
    });

    it("hands the feature scope to the stats contribution and exposes its action", async () => {
        const scope = createScope(), plugin = { handle: vi.fn(), openDialog: vi.fn(() => "opened") }, controller = new StatsController({ statsPlugin: plugin, scope });
        await controller.start();

        expect(plugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi().openDialog()).toBe("opened");
        expect(controller.getApi().hasDashboard).toBe(true);
    });

    it("hands the feature scope to the responsive shell contribution", async () => {
        const scope = createScope(), plugin = { handle: vi.fn() }, controller = new ResponsiveShellController({ plugin, scope });
        await controller.start();
        await controller.start();

        expect(scope.assertActive).toHaveBeenCalledTimes(2);
        expect(plugin.handle).toHaveBeenCalledOnce();
        expect(plugin.handle).toHaveBeenCalledWith({ scope });
    });
});
