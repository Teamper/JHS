import { describe, expect, it, vi } from "vitest";
import { CompatibilityController } from "../src/features/compatibility/compatibility-controller.js";
import { DetailController } from "../src/features/detail/detail-controller.js";
import { StatsController } from "../src/features/stats/stats-controller.js";
import { ResponsiveShellController } from "../src/features/system/responsive-shell-controller.js";

function createScope() {
    return { assertActive: vi.fn() };
}

describe("feature controller ownership", () => {
    it("starts native compatibility enhancements only once", async () => {
        const scope = createScope(), document = { querySelectorAll: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() }, controller = new CompatibilityController({
            hostAdapter: { site: "javbus", document, location: { pathname: "/", href: "https://javbus.com/" } },
            storage: { get: vi.fn(async () => []) }, state: {}, features: {}, styles: { register: vi.fn() }, route: "other", scope,
        });
        await controller.start();
        await controller.start();

        expect(scope.assertActive).toHaveBeenCalledTimes(2);
        expect(document.addEventListener).toHaveBeenCalledOnce();
        expect(controller.getApi()).toEqual({ hasEnhancements: true });
    });

    it("keeps a disabled compatibility contribution inert", async () => {
        const scope = createScope(), document = { querySelectorAll: vi.fn(() => []), addEventListener: vi.fn(), removeEventListener: vi.fn() }, controller = new CompatibilityController({
            hostAdapter: { site: "javdb", document, location: { pathname: "/", href: "https://javdb.com/" } },
            storage: { get: vi.fn(async () => []) }, state: {}, features: {}, styles: { register: vi.fn() }, enabled: false, route: "other", scope,
        });
        await controller.start();

        expect(document.addEventListener).not.toHaveBeenCalled();
        expect(controller.getApi()).toEqual({ hasEnhancements: false });
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
        }, calls = [], fc2Plugin = { handle: vi.fn(() => calls.push("fc2")) }, nativePlugin = { handle: vi.fn(() => calls.push("native")) }, workspacePlugin = { handle: vi.fn(() => calls.push("workspace")) }, reviewPlugin = { handle: vi.fn(() => calls.push("reviews")) }, relatedPlugin = { handle: vi.fn(() => calls.push("related")) }, pageActionsPlugin = { handle: vi.fn(() => calls.push("page-actions")) }, magnetPlugin = { handle: vi.fn(() => calls.push("magnet")) }, previewPlugin = { handle: vi.fn(() => calls.push("preview")) }, externalSitesPlugin = { handle: vi.fn(() => calls.push("external-sites")) }, screenshotPlugin = { handle: vi.fn(() => calls.push("screenshot")) };
        const controller = new DetailController({ hostAdapter, fc2Plugin, nativePlugin, workspacePlugin, reviewPlugin, relatedPlugin, pageActionsPlugin, screenshotPlugin, magnetPlugin, previewPlugin, externalSitesPlugin, scope, enabledContributions: [] });

        await controller.start();

        expect(calls).toEqual(["fc2", "native", "workspace", "reviews", "related", "page-actions", "magnet", "preview", "external-sites", "screenshot"]);
        expect(fc2Plugin.handle).toHaveBeenCalledWith({ scope });
        expect(nativePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(workspacePlugin.handle).toHaveBeenCalledWith({ scope });
        expect(reviewPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(relatedPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(pageActionsPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(screenshotPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(magnetPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(previewPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(externalSitesPlugin.handle).toHaveBeenCalledWith({ scope });
    });

    it("mounts only the FC2-owned contribution on an owned-detail route", async () => {
        const scope = createScope(), hostAdapter = { locateDetailRoot: vi.fn(), locateDetailSlots: vi.fn(), readMovieRef: vi.fn() }, calls = [], fc2Plugin = { handle: vi.fn(() => calls.push("fc2")) }, nativePlugin = { handle: vi.fn(() => calls.push("native")) };
        const controller = new DetailController({ hostAdapter, fc2Plugin, nativePlugin, ownedDetail: true, scope, enabledContributions: ["detail.fc2-owned"] });

        await controller.start();

        expect(calls).toEqual(["fc2"]);
        expect(hostAdapter.locateDetailRoot).not.toHaveBeenCalled();
        expect(fc2Plugin.handle).toHaveBeenCalledWith({ scope });
    });

    it("starts the native stats contribution and exposes its action", async () => {
        const scope = createScope(), controller = new StatsController({
            diagnostics: { exportSnapshot: vi.fn(() => ({ activeFeatures: [], errors: [] })) },
            dialog: { open: vi.fn(), close: vi.fn() }, movie: {}, storage: {}, state: { getActivityLog: vi.fn() }, features: {}, route: "detail", scope,
        });
        await controller.start();

        expect(scope.assertActive).toHaveBeenCalledOnce();
        expect(controller.getApi().openDialog).toEqual(expect.any(Function));
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
