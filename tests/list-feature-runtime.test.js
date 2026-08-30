import { describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListController } from "../src/features/list/list-controller.js";
import { ListView } from "../src/features/list/list-view.js";
import { BasePlugin, PluginManager } from "../src/core/plugin-manager.js";

describe("List FeatureRuntime ownership", () => {
    it("passes the feature lifecycle scope to the legacy migration adapter", async () => {
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}), batchSaveAllVideos: vi.fn(), openMovieDetail: vi.fn(), findCarNumAndHref: vi.fn(), parseActressName: vi.fn() }, hostAdapter = { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) }, controller = new ListController({
            legacyPlugin,
            hostAdapter,
            scope,
        });

        await controller.start();
        await controller.start();

        expect(legacyPlugin.handle).toHaveBeenCalledOnce();
        expect(legacyPlugin.handle).toHaveBeenCalledWith({ scope, view: expect.any(ListView) });
        expect(controller.view).toBeInstanceOf(ListView);
        const api = controller.getApi();
        expect(api.getListSelectors()).toEqual({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" });
        api.batchSaveAllVideos("scope", "favorite");
        api.openMovieDetail("item", { newTab: false });
        api.findCarNumAndHref("item");
        api.parseActressName("/movie/ABC-123");
        expect(legacyPlugin.batchSaveAllVideos).toHaveBeenCalledWith("scope", "favorite");
        expect(legacyPlugin.openMovieDetail).toHaveBeenCalledWith("item", { newTab: false });
        expect(legacyPlugin.findCarNumAndHref).toHaveBeenCalledWith("item");
        expect(legacyPlugin.parseActressName).toHaveBeenCalledWith("/movie/ABC-123");
        controller.dispose();
        expect(scope.disposed).toBe(false);
        scope.dispose();
    });

    it("starts the waterfall contribution with the feature-owned list API", async () => {
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}), getSelector: vi.fn(() => ({ boxSelector: ".movie-list" })) }, autoPagePlugin = { handle: vi.fn(async () => {}) }, foldCategoryPlugin = { handle: vi.fn(async () => {}) }, hostAdapter = { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) }, controller = new ListController({
            legacyPlugin,
            autoPagePlugin,
            foldCategoryPlugin,
            hostAdapter,
            scope,
        });

        await controller.start();

        expect(autoPagePlugin.handle).toHaveBeenCalledWith({ scope, listFeatureApi: expect.objectContaining({ getListSelectors: expect.any(Function) }) });
        expect(foldCategoryPlugin.handle).toHaveBeenCalledWith({ scope });
        expect(controller.getApi().getListSelectors()).toEqual({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" });
        scope.dispose();
    });

    it("starts FC2 navigation with the feature scope even without the generic list adapter", async () => {
        const scope = new LifecycleScope("feature:list"), fc2NavigationPlugin = { handle: vi.fn(async () => {}) }, hostAdapter = { getListSelectors: () => null }, controller = new ListController({
            fc2NavigationPlugin,
            hostAdapter,
            scope,
        });

        await controller.start();

        expect(fc2NavigationPlugin.handle).toHaveBeenCalledWith({ scope });
        scope.dispose();
    });

    it("passes the feature-owned list API to card actions", async () => {
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}), getSelector: vi.fn(() => ({ boxSelector: ".movie-list" })) }, coverPlugin = { handle: vi.fn(async () => {}) }, hostAdapter = { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) }, controller = new ListController({
            legacyPlugin,
            coverPlugin,
            hostAdapter,
            scope,
        });

        await controller.start();

        expect(coverPlugin.handle).toHaveBeenCalledWith({ scope, listFeatureApi: expect.objectContaining({ getListSelectors: expect.any(Function) }) });
        scope.dispose();
    });

    it("defers list actions until the rest of the eager feature APIs can settle", async () => {
        vi.useFakeTimers();
        try {
            const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}) }, actionsPlugin = { handle: vi.fn(async () => {}) }, hostAdapter = { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) }, controller = new ListController({
                legacyPlugin,
                actionsPlugin,
                hostAdapter,
                scope,
            });

            await controller.start();
            expect(actionsPlugin.handle).not.toHaveBeenCalled();
            await vi.advanceTimersByTimeAsync(0);
            expect(actionsPlugin.handle).toHaveBeenCalledWith({ scope, listFeatureApi: expect.any(Object) });
            scope.dispose();
        } finally {
            vi.useRealTimers();
        }
    });

    it("does not mount a feature-owned legacy plugin through PluginManager", async () => {
        const handle = vi.fn(), insertStyle = vi.fn();
        class FeatureOwnedPlugin extends BasePlugin {
            getName() { return "FeatureOwnedPlugin"; }
            initCss() { return "<style data-test=feature-owned></style>"; }
            handle() { handle(); }
        }
        vi.stubGlobal("storageManager", { getSetting: vi.fn(async () => "[]") });
        vi.stubGlobal("utils", { isMobileMode: () => false, insertStyle });
        vi.stubGlobal("clog", { error: vi.fn() });
        const manager = new PluginManager();
        manager.register(FeatureOwnedPlugin, {}, { managedByFeature: true });

        await manager.processCss();
        await manager.processPlugins();

        expect(insertStyle).toHaveBeenCalledOnce();
        expect(handle).not.toHaveBeenCalled();
        expect(manager.getTimings()).toEqual([expect.objectContaining({ name: "FeatureOwnedPlugin", status: "managed-feature" })]);
    });
});
