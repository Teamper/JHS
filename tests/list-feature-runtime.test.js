import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListController } from "../src/features/list/list-controller.js";
import { ListFilterContextProvider } from "../src/features/list/list-filter-context.js";
import { CompatibilityBeanRegistry } from "../src/core/compatibility-bean-registry.js";
import { JSDOM } from "jsdom";

const HOST_SELECTORS = { boxSelector: ".movie-list", itemSelector: ".movie-list .item" };
const hostAdapter = { getListSelectors: () => HOST_SELECTORS };

beforeEach(() => {
    const root = { length: 0, first: vi.fn(() => root), off: vi.fn(() => root), on: vi.fn(() => root), each: vi.fn(() => root) };
    vi.stubGlobal("$", () => root);
});

afterEach(() => vi.unstubAllGlobals());

describe("List FeatureRuntime ownership", () => {
    it("reports list observer failures through the injected logger without a global logger", async () => {
        vi.stubGlobal("clog", undefined);
        const logger = { error: vi.fn(), debug: vi.fn() };
        const controller = new ListController({ legacyPlugin: { handle: async () => {} }, hostAdapter, scope: new LifecycleScope("feature:list"), logger });
        await controller.start();

        const failure = new Error("added cards failed");
        controller.domObserver.onError(failure);
        controller.domObserver.onMissingRoot();

        expect(logger.error).toHaveBeenCalledWith("列表增量处理失败", failure);
        expect(logger.error).toHaveBeenCalledWith("没有找到容器节点!");
        controller.dispose();
    });

    it("runs the initial filter, index, announcement, and observer activation in Feature order", async () => {
        const calls = [], card = { dataset: {} }, legacyPlugin = {
            handle: vi.fn(async () => {}),
            advanceListGeneration: vi.fn(() => { calls.push("generation"); return "1:0"; }),
            isCurrentListGeneration: vi.fn(() => true),
            recordListPhase: vi.fn((phase) => calls.push(["phase", phase])),
        };
        const events = { emit: vi.fn(async (...args) => calls.push(["event", ...args])) };
        const controller = new ListController({ legacyPlugin, hostAdapter, scope: new LifecycleScope("feature:list"), events });
        await controller.start();
        controller.hostAdapter = { ...hostAdapter, document: { querySelector: vi.fn(() => ({})), querySelectorAll: vi.fn(() => [card]) } };
        controller.filterListItems = vi.fn(async (_items, revision) => { calls.push(["filter", revision]); return true; });
        controller.view.createQuickFilter = vi.fn(() => calls.push("quick-filter"));
        controller.view.applyVisibility = vi.fn(() => calls.push("visibility"));
        vi.spyOn(controller.itemIndex, "rebuild").mockImplementation(() => calls.push("index"));
        controller.domObserver.start = vi.fn(() => calls.push("observer"));

        await expect(controller.initializeListRuntime()).resolves.toBe(true);

        expect(controller.filterListItems).toHaveBeenCalledWith(null, "1:0");
        expect(card.dataset.jhsProcessed).toBe("true");
        expect(calls.map((entry) => Array.isArray(entry) ? entry[0] : entry)).toEqual([
            "generation", "filter", "quick-filter", "visibility", "index", "phase", "event", "observer",
        ]);
        expect(events.emit).toHaveBeenCalledWith("list-items-added", { items: [card] }, { broadcast: false });
        controller.dispose();
    });

    it("completes appended-card sorting, decoration, indexing, and publication in Feature order", async () => {
        let generation = 0;
        const order = [], card = { isConnected: true, dataset: {} };
        const legacyPlugin = {
            handle: vi.fn(async () => {}),
            attachFeatureListAddedItemsAdapter: vi.fn(), detachFeatureListAddedItemsAdapter: vi.fn(),
            advanceListGeneration: vi.fn(() => ++generation), captureListRevision: vi.fn(() => `${generation}:0`),
            isCurrentListGeneration: vi.fn((revision) => revision === `${generation}:0`),
        };
        const controller = new ListController({
            legacyPlugin, hostAdapter, scope: new LifecycleScope("feature:list"),
            sortController: { sortItems: vi.fn(async () => order.push("sort")) },
            coverButtons: { addSvgBtn: vi.fn(async () => order.push("buttons")) },
            events: { emit: vi.fn(async (...args) => order.push(["event", ...args])) },
        });
        controller.filterListItems = vi.fn(async (items) => { order.push("filter"); expect(items).toEqual([card]); return true; });
        controller.view = { getActiveFilter: () => "waitCheck", applyVisibility: vi.fn(() => order.push("visibility")), dispose: vi.fn() };
        controller.itemIndex = { add: vi.fn(() => order.push("index")), clear: vi.fn() };

        await expect(controller.processAddedItems([card], "stale-observer-revision")).resolves.toBe(true);

        expect(order.map((entry) => Array.isArray(entry) ? entry[0] : entry)).toEqual(["filter", "visibility", "sort", "buttons", "index", "event"]);
        expect(card.dataset.jhsProcessed).toBe("true");
        expect(controller.itemIndex.add).toHaveBeenCalledWith([card]);
        expect(controller.events.emit).toHaveBeenCalledWith("list-items-added", { items: [card] }, { broadcast: false });
        expect(legacyPlugin.attachFeatureListAddedItemsAdapter).toHaveBeenCalledWith(controller);

        controller.dispose();
        expect(legacyPlugin.detachFeatureListAddedItemsAdapter).toHaveBeenCalledWith(controller);
    });

    it("does not decorate or publish appended cards when filtering finishes after disposal", async () => {
        let generation = 0, releaseFilter;
        const card = { isConnected: true, dataset: {} }, sortItems = vi.fn(), addSvgBtn = vi.fn(), emit = vi.fn();
        const legacyPlugin = {
            advanceListGeneration: () => ++generation, captureListRevision: () => `${generation}:0`,
            isCurrentListGeneration: (revision) => revision === `${generation}:0`,
        };
        const controller = new ListController({
            legacyPlugin, hostAdapter, scope: new LifecycleScope("feature:list"),
            sortController: { sortItems }, coverButtons: { addSvgBtn }, events: { emit },
        });
        controller.filterListItems = () => new Promise((resolve) => { releaseFilter = resolve; });
        controller.view = { getActiveFilter: () => "waitCheck", applyVisibility: vi.fn(), dispose: vi.fn() };
        controller.itemIndex = { add: vi.fn(), clear: vi.fn() };

        const pending = controller.processAddedItems([card]);
        await vi.waitFor(() => expect(releaseFilter).toEqual(expect.any(Function)));
        controller.dispose();
        releaseFilter(true);

        await expect(pending).resolves.toBe(false);
        expect(sortItems).not.toHaveBeenCalled();
        expect(addSvgBtn).not.toHaveBeenCalled();
        expect(emit).not.toHaveBeenCalled();
        expect(card.dataset.jhsProcessed).toBeUndefined();
    });

    it("owns and disposes the shared refresh coordinator through the legacy capability boundary", async () => {
        let attached = null;
        const legacyPlugin = {
            handle: vi.fn(async () => {}),
            attachFeatureListRefreshAdapter: vi.fn((adapter) => { attached = adapter; }),
            detachFeatureListRefreshAdapter: vi.fn((adapter) => { if (attached === adapter) attached = null; }),
            advanceListGeneration: vi.fn(),
            captureListRevision: vi.fn(() => "4:0"),
            isCurrentListGeneration: vi.fn(() => true),
        };
        const controller = new ListController({ legacyPlugin, hostAdapter, scope: new LifecycleScope("feature:list") });
        controller.filterListItems = vi.fn(async () => true);

        await controller.start();
        expect(attached).toBe(controller.listRefreshController);
        const applyVisibility = vi.spyOn(controller.view, "applyVisibility");
        await attached.request({ full: true, reason: "test" });
        expect(controller.filterListItems).toHaveBeenCalledWith(null, "4:0");
        expect(applyVisibility).toHaveBeenCalledWith(null, "waitCheck");
        expect(legacyPlugin.advanceListGeneration).toHaveBeenCalledOnce();

        controller.dispose();
        expect(attached).toBeNull();
        expect(legacyPlugin.detachFeatureListRefreshAdapter).toHaveBeenCalledOnce();
        await expect(controller.listRefreshController.request({ full: true })).resolves.toBe(false);
    });

    it("owns the initial quick-filter state and forwards transitions through the compatibility boundary", async () => {
        const scope = new LifecycleScope("feature:list"), beginQuickFilterTransition = vi.fn();
        const legacyPlugin = {
            handle: vi.fn(async () => {}), beginQuickFilterTransition,
        };
        const controller = new ListController({
            legacyPlugin, hostAdapter, scope, settings: { snapshot: () => ({ defaultQuickFilterTab: "favorite" }) },
            readFilterSources: async () => ({ titleKeywords: [], activity: { entries: [] } }),
        });

        await controller.start();

        expect(legacyPlugin.activeQuickFilter).toBe("favorite");
        expect(controller.view.getActiveFilter()).toBe("favorite");
        const refresh = vi.spyOn(controller.listRefreshController, "request");
        await controller.setQuickFilter("hasDown", { syncUi: false });
        expect(controller.view.getActiveFilter()).toBe("hasDown");
        expect(beginQuickFilterTransition).toHaveBeenCalledWith("hasDown");
        expect(refresh).toHaveBeenCalledWith({ reason: "quick-filter", visibilityOnly: true });
        expect(controller.batchController.getActiveFilter()).toBe("hasDown");

        controller.dispose();
        scope.dispose();
    });

    it("attaches and releases the Feature evaluation-context provider around the list lifecycle", async () => {
        const readFilterSources = vi.fn(async () => ({ titleKeywords: ["synthetic"], activity: { entries: [] } }));
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}) };
        const controller = new ListController({ legacyPlugin, hostAdapter, scope, readFilterSources });

        await controller.start();
        const context = await controller.batchController.getEvaluationContext();
        expect(context.titleKeywords).toEqual(["synthetic"]);
        expect(readFilterSources).toHaveBeenCalledOnce();

        controller.dispose();
        scope.dispose();
        expect(controller.filterContextProvider).toBeNull();
    });

    it("invalidates the injected list-data snapshot before a full refresh", async () => {
        const readFilterSources = vi.fn(async () => ({ titleKeywords: [], activity: { entries: [] } }));
        const legacyStorage = { car_list_key: "car_list", _invalidateCache: vi.fn() };
        const legacyPlugin = {
            captureListRevision: () => "2:0", isCurrentListGeneration: () => true,
            invalidateListRefreshContext: vi.fn(),
        };
        const controller = new ListController({ legacyPlugin, legacyStorage, readFilterSources, hostAdapter, scope: new LifecycleScope("feature:list") });
        controller.filterContextProvider = new ListFilterContextProvider({ readSources: readFilterSources });
        controller.filterListItems = vi.fn(async () => { await controller.filterContextProvider.get(); return true; });
        controller.view = { getActiveFilter: () => "waitCheck", applyVisibility: vi.fn(), dispose: vi.fn() };

        await controller.filterContextProvider.get();
        await controller.listRefreshController.request({ full: true, reason: "test" });

        expect(readFilterSources).toHaveBeenCalledTimes(2);
        expect(legacyStorage._invalidateCache).toHaveBeenCalledWith("car_list");
        expect(legacyPlugin.invalidateListRefreshContext).toHaveBeenCalledOnce();
        controller.dispose();
    });

    it("filters and decorates initial cards in the Feature without calling the legacy filter implementation", async () => {
        const dom = new JSDOM('<div class="movie-list"><article class="item" data-car-num="AA-001" data-title="Favorite"><div class="tags"></div></article><article class="item" data-car-num="AA-002" data-title="Other"><div class="tags"></div></article></div>', { url: "https://javdb.com/" });
        const cards = [ ...dom.window.document.querySelectorAll(".item") ];
        const selectors = { boxSelector: ".movie-list", itemSelector: ".movie-list .item" };
        const context = {
            titleKeywords: [], settings: { tagPosition: "leftTop" }, recentCarNums: new Set(), actorCarNumToNameMap: new Map(), actressCarNumToNameMap: new Map(),
            carMap: new Map([["AA-001", { stateFlags: { favorite: true } }]]),
        };
        const legacyPlugin = {
            captureListRevision: () => "1:0",
            isCurrentListGeneration: (revision) => revision === "1:0",
            recordListPhase: vi.fn(),
            translateListItems: vi.fn(),
            doFilter: vi.fn(() => { throw new Error("Feature must own filtering"); }),
        };
        const controller = new ListController({
            legacyPlugin,
            hostAdapter: { site: "javdb", document: dom.window.document, getListSelectors: () => selectors },
            scope: new LifecycleScope("feature:list"),
            settings: { snapshot: () => ({ tagPosition: "leftTop" }) },
            readFilterSources: async () => ({ titleKeywords: [], activity: { entries: [] }, settings: { tagPosition: "leftTop" }, carMap: context.carMap }),
            readCardIdentity: (item) => ({ carNum: item.getAttribute("data-car-num"), title: item.getAttribute("data-title") }),
        });
        controller.filterContextProvider = { get: vi.fn(async () => context), dispose: vi.fn() };
        controller.view = { selectors, getActiveFilter: () => "favorite", dispose: vi.fn() };

        await expect(controller.filterListItems(null, "1:0")).resolves.toBe(true);

        expect(legacyPlugin.doFilter).not.toHaveBeenCalled();
        expect(controller.filterContextProvider.get).toHaveBeenCalledOnce();
        expect(JSON.parse(cards[0].getAttribute("data-jhs-flags"))).toMatchObject({ favorite: true });
        expect(cards[0].querySelector(".jhs-status-tags--left .status-tag")?.textContent).toBeTruthy();
        expect(cards[1].querySelector(".jhs-status-tags")).toBeNull();
        expect(legacyPlugin.translateListItems).toHaveBeenCalledWith(cards);
        expect(legacyPlugin.recordListPhase).toHaveBeenCalledWith("doFilter-start", 2);
        expect(legacyPlugin.recordListPhase).toHaveBeenCalledWith("doFilter-end", 2);
        controller.dispose();
        dom.window.close();
    });

    it("coalesces summary publication and cancels the pending frame when the Feature closes", () => {
        const callbacks = [], publishSummary = vi.fn(), collectSummary = vi.fn(() => ({ total: 0 }));
        const window = {
            requestAnimationFrame: vi.fn((callback) => { callbacks.push(callback); return callbacks.length; }),
            cancelAnimationFrame: vi.fn(),
        };
        const controller = new ListController({
            legacyPlugin: { publishListSummary: publishSummary },
            hostAdapter, scope: new LifecycleScope("feature:list"), window,
        });
        controller.cardStatePresenter = { collectSummary };

        controller.scheduleRecount();
        controller.scheduleRecount();
        expect(window.requestAnimationFrame).toHaveBeenCalledOnce();
        callbacks[0](0);
        expect(collectSummary).toHaveBeenCalledOnce();
        expect(publishSummary).toHaveBeenCalledWith({ total: 0 });

        controller.scheduleRecount();
        controller.dispose();
        callbacks[1](0);
        expect(window.cancelAnimationFrame).toHaveBeenCalledWith(2);
        expect(publishSummary).toHaveBeenCalledOnce();
    });

    it("injects and detaches the native card-state presenter through the list compatibility boundary", async () => {
        let attached = null;
        const detach = vi.fn(() => { attached = null; });
        const attachCardStatePresenter = vi.fn((presenter) => { attached = presenter; return detach; });
        const scope = new LifecycleScope("feature:list"), legacyPlugin = {
            handle: vi.fn(async () => {}), attachCardStatePresenter,
        };
        const controller = new ListController({ legacyPlugin, hostAdapter, scope, readFilterSources: async () => ({ titleKeywords: [], activity: { entries: [] } }) });

        await controller.start();

        expect(attached).toBe(controller.cardStatePresenter);
        expect(attachCardStatePresenter).toHaveBeenCalledOnce();
        controller.dispose();
        scope.dispose();
        expect(detach).toHaveBeenCalledOnce();
        expect(attached).toBeNull();
    });

    it("passes the feature scope to the legacy page implementation once", async () => {
        const scope = new LifecycleScope("feature:list"), legacyPlugin = { handle: vi.fn(async () => {}), setSortController: vi.fn() };
        const controller = new ListController({ legacyPlugin, hostAdapter, scope });

        await controller.start();
        await controller.start();

        expect(legacyPlugin.handle).toHaveBeenCalledOnce();
        expect(legacyPlugin.setSortController).toHaveBeenNthCalledWith(1, null);
        expect(legacyPlugin.handle).toHaveBeenCalledWith({ scope, view: expect.any(Object), itemIndex: expect.any(Object), observer: expect.any(Object), batchController: expect.any(Object), featureOwnsStartup: true });
        controller.dispose();
        expect(scope.disposed).toBe(false);
        scope.dispose();
    });

    it("injects the List Feature sort capability before legacy list processing starts", async () => {
        const scope = new LifecycleScope("feature:list"), sortController = { sortItems: vi.fn(async () => {}) };
        const legacyPlugin = { handle: vi.fn(async () => {}), setSortController: vi.fn() };
        const controller = new ListController({ legacyPlugin, hostAdapter, scope, sortController });

        await controller.start();

        expect(legacyPlugin.setSortController).toHaveBeenNthCalledWith(1, sortController);
        controller.dispose();
        expect(legacyPlugin.setSortController).toHaveBeenLastCalledWith(null);
        scope.dispose();
    });

    it("owns initial and automatic-page cover upgrades through one injected Feature capability", async () => {
        const dom = new JSDOM('<div class="masonry"><article class="item"><img class="cover" src="https://www.javbus.com/imgs/thumb/abc.jpg"></article></div>', { url: "https://www.javbus.com/" });
        vi.stubGlobal("MutationObserver", dom.window.MutationObserver);
        const image = dom.window.document.querySelector("img");
        Object.defineProperty(image, "complete", { configurable: true, value: true });
        const host = {
            site: "javbus", document: dom.window.document, location: dom.window.location,
            getListSelectors: () => ({ boxSelector: ".masonry", itemSelector: ".masonry .item", coverImgSelector: ".masonry img.cover" }),
            locateListRoot: () => dom.window.document.querySelector(".masonry"),
        };
        let attached = null;
        const legacyPlugin = {
            handle: vi.fn(async () => {}),
            findCarNumAndHref: () => ({ carNum: "ABC-001", title: "Synthetic" }),
            attachFeatureCoverImageAdapter: vi.fn((adapter) => { attached = adapter; }),
            detachFeatureCoverImageAdapter: vi.fn((adapter) => { if (attached === adapter) attached = null; }),
        };
        const scope = new LifecycleScope("feature:list");
        const controller = new ListController({ legacyPlugin, hostAdapter: host, scope, window: {}, readFilterSources: async () => ({ titleKeywords: [], activity: { entries: [] } }) });

        await controller.start();

        expect(image.src).toBe("https://www.javbus.com/imgs/cover/abc_b.jpg");
        expect(attached).toBe(controller.coverImageController);
        const dynamic = dom.window.document.createElement("img");
        dynamic.src = "https://www.javbus.com/pics/thumb/def.jpg";
        Object.defineProperty(dynamic, "complete", { configurable: true, value: true });
        attached.replace([dynamic]);
        expect(dynamic.src).toBe("https://www.javbus.com/pics/cover/def_b.jpg");

        controller.dispose();
        expect(attached).toBeNull();
        expect(legacyPlugin.detachFeatureCoverImageAdapter).toHaveBeenCalledOnce();
        scope.dispose();
        dom.window.close();
    });

    it("owns list CSS and releases it on feature disposal", async () => {
        const release = vi.fn(), css = vi.fn(async () => "<style>.jhs-list{color:red}</style>"), handle = vi.fn(async () => {});
        const register = vi.fn(() => release), scope = new LifecycleScope("feature:list");
        const controller = new ListController({ legacyPlugin: { handle, initCss: css }, hostAdapter, scope, styles: { register } });

        await controller.start();
        controller.dispose();

        expect(register).toHaveBeenCalledWith("jhs-list-feature-style", ".jhs-list{color:red}");
        expect(register).toHaveBeenCalledWith("jhs-list-card-state-feature", expect.stringContaining(".jhs-status-tags"));
        expect(register).toHaveBeenCalledWith("jhs-list-pagination-feature", expect.stringContaining(".jhs-jump-page-input"));
        expect(handle).toHaveBeenCalledWith({ scope, view: expect.any(Object), itemIndex: expect.any(Object), observer: expect.any(Object), batchController: expect.any(Object), featureOwnsStartup: true });
        expect(release).toHaveBeenCalledTimes(3);
        scope.dispose();
    });

    it("releases registered list CSS when the legacy handler fails", async () => {
        const release = vi.fn(), register = vi.fn(() => release), scope = new LifecycleScope("feature:list");
        const controller = new ListController({
            legacyPlugin: { initCss: () => "<style>.jhs-list{}</style>", handle: async () => { throw new Error("mount failed"); } },
            hostAdapter, scope, styles: { register },
        });

        await expect(controller.start()).rejects.toThrow("mount failed");
        expect(release).toHaveBeenCalledTimes(3);
        expect(controller.started).toBe(false);
        scope.dispose();
    });

    it("keeps the compatibility registry lookup-only with zero executor metrics", () => {
        const registry = new CompatibilityBeanRegistry(), bean = { handle: vi.fn(), initCss: vi.fn() };
        registry.registerCompatibilityBean("FeatureBean", bean);

        expect(registry.getBean("FeatureBean")).toBe(bean);
        expect(registry.getPluginNames()).toEqual([]);
        expect(registry.getTimings()).toEqual([]);
        expect(registry.getCssTimings()).toEqual([]);
        expect(registry.getStartupReport()).toMatchObject({ registeredPlugins: 0, cssMs: 0, immediateMs: 0, idlePending: 0, idleCompleted: 0 });
        expect(registry.processPlugins).toBeUndefined();
        expect(registry.prepareCss).toBeUndefined();
        expect(bean.handle).not.toHaveBeenCalled();
        expect(bean.initCss).not.toHaveBeenCalled();
    });
});
