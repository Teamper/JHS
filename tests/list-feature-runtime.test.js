import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListController } from "../src/features/list/list-controller.js";
import { ListView } from "../src/features/list/list-view.js";
import { ListDomObserver } from "../src/features/list/list-dom-observer.js";
import { ListMediaController } from "../src/features/list/list-media-controller.js";
import { ListImageController } from "../src/features/list/list-image-controller.js";
import { ListEventController } from "../src/features/list/list-event-controller.js";
import { ListBatchService } from "../src/features/list/list-batch-service.js";
import { ListIncrementalService } from "../src/features/list/list-incremental-service.js";
import { BasePlugin, PluginManager } from "../src/core/plugin-manager.js";

describe("List FeatureRuntime ownership", () => {
    it("passes the feature lifecycle scope to the legacy migration adapter", async () => {
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}), attachListDomObserver: vi.fn(), attachListMedia: vi.fn(), attachListImages: vi.fn(), attachListEvents: vi.fn(), attachListIncremental: vi.fn(), batchSaveAllVideos: vi.fn(), openMovieDetail: vi.fn(), findCarNumAndHref: vi.fn(), parseActressName: vi.fn(), setQuickFilter: vi.fn() }, hostAdapter = { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img" }) }, controller = new ListController({
            legacyPlugin,
            hostAdapter,
            scope,
        });

        await controller.start();
        await controller.start();

        expect(legacyPlugin.handle).toHaveBeenCalledOnce();
        expect(legacyPlugin.handle).toHaveBeenCalledWith({ scope, view: expect.any(ListView) });
        expect(controller.view).toBeInstanceOf(ListView);
        expect(legacyPlugin.attachListDomObserver).toHaveBeenCalledWith(expect.any(ListDomObserver));
        expect(legacyPlugin.attachListMedia).toHaveBeenCalledWith(expect.any(ListMediaController));
        expect(legacyPlugin.attachListImages).toHaveBeenCalledWith(expect.any(ListImageController));
        expect(legacyPlugin.attachListEvents).toHaveBeenCalledWith(expect.any(ListEventController));
        expect(legacyPlugin.attachListIncremental).toHaveBeenCalledWith(expect.any(ListIncrementalService));
        const api = controller.getApi();
        expect(api.getListSelectors()).toEqual({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img" });
        controller.state.setView({ applyVisibility: vi.fn(), syncQuickFilterUi: vi.fn() });
        const dom = new JSDOM('<div class="item"><a href="/v/ABC-123"><div class="video-title"><strong>ABC-123</strong> title</div></a></div>');
        globalThis.$ = jqueryFactory(dom.window);
        const card = globalThis.$(".item");
        api.batchSaveAllVideos("scope", "favorite");
        api.openMovieDetail("item", { newTab: false });
        expect(api.findCarNumAndHref(card)).toMatchObject({ carNum: "ABC-123", url: "/v/ABC-123" });
        api.parseActressName("/movie/ABC-123");
        api.setQuickFilter("favorite", { syncUi: false });
        expect(legacyPlugin.batchSaveAllVideos).toHaveBeenCalledWith("scope", "favorite");
        expect(legacyPlugin.openMovieDetail).toHaveBeenCalledWith("item", { newTab: false });
        expect(legacyPlugin.findCarNumAndHref).not.toHaveBeenCalled();
        expect(legacyPlugin.parseActressName).toHaveBeenCalledWith("/movie/ABC-123");
        expect(legacyPlugin.setQuickFilter).not.toHaveBeenCalled();
        expect(api.getActiveQuickFilter()).toBe("favorite");
        controller.dispose();
        expect(scope.disposed).toBe(false);
        scope.dispose();
    });

    it("routes the feature batch API through the owned service", async () => {
        const dom = new JSDOM('<div class="movie-list"><div class="item"><a href="/v/ABC-123"><div class="video-title"><strong>ABC-123</strong> title</div></a></div></div>', { url: "https://javdb.com/search?q=abc" });
        globalThis.$ = jqueryFactory(dom.window);
        const scope = new LifecycleScope("feature:list"), stateService = { patch: vi.fn(async () => {}), getActivityLog: vi.fn(async () => ({ entries: [] })) }, storage = {
            getTitleFilterKeyword: vi.fn(async () => []), getBlacklistMap: vi.fn(async () => new Map()), getBlacklistCarList: vi.fn(async () => []),
            getSetting: vi.fn(async () => ({})), getCarMap: vi.fn(async () => new Map([["ABC-123", { stateFlags: { favorite: true } }]])),
        }, legacyPlugin = {
            handle: vi.fn(async () => {}),
            attachListBatch: vi.fn(),
            attachListEvaluation: vi.fn(),
        }, hostAdapter = {
            document: dom.window.document,
            location: dom.window.location,
            getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }),
        }, controller = new ListController({ legacyPlugin, hostAdapter, stateService, storage, http: { request: vi.fn() }, scope });

        await controller.start();
        const api = controller.getApi();
        await expect(api.batchSaveAllVideos({ kind: "search" }, "favorite", { filter: "favorite", confirm: false })).resolves.toMatchObject({ matched: 1, updated: 1 });

        expect(controller.batch).toBeInstanceOf(ListBatchService);
        expect(legacyPlugin.attachListBatch).toHaveBeenCalledWith(controller.batch);
        expect(legacyPlugin.attachListEvaluation).toHaveBeenCalledWith(controller.evaluation);
        expect(stateService.patch).toHaveBeenCalledOnce();
        controller.dispose();
        expect(controller.batch).toBeNull();
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

    it("starts the 123AV lookup contribution through the list feature", async () => {
        const scope = new LifecycleScope("feature:list"), fc2LookupPlugin = { handle: vi.fn(async () => {}) }, hostAdapter = { getListSelectors: () => null }, controller = new ListController({
            fc2LookupPlugin,
            hostAdapter,
            scope,
        });

        await controller.start();

        expect(fc2LookupPlugin.handle).toHaveBeenCalledWith({ scope });
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

    it("registers feature-owned styles outside PluginManager", async () => {
        const scope = new LifecycleScope("feature:list"), release = vi.fn(), styles = { register: vi.fn(() => release) }, legacyPlugin = { initCss: vi.fn(() => "<style>.list-test{color:red}</style>"), handle: vi.fn(async () => {}) }, hostAdapter = { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item" }) }, controller = new ListController({ legacyPlugin, hostAdapter, styles, scope });

        await controller.start();

        expect(styles.register).toHaveBeenCalledWith("jhs-list-feature-style", ".list-test{color:red}");
        controller.dispose();
        expect(release).toHaveBeenCalledOnce();
        scope.dispose();
    });
});

afterEach(() => { delete globalThis.$; });
