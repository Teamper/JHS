// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { AutoPageController } from "../src/features/list/auto-page-controller.js";
import { ListSortController } from "../src/features/list/list-sort-controller.js";
import { ListPaginationController } from "../src/features/list/list-pagination-controller.js";
import { ListPageCompatibilityService } from "../src/features/list/list-compatibility-service.js";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";
import { DiagnosticsService } from "../src/services/diagnostics-service.js";
import { ListView } from "../src/features/list/list-view.js";
import jquery from "jquery";

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren(); });

describe("continuous browsing work bounds", () => {
    it("restores native card display values without measuring layout while switching filters", () => {
        vi.stubGlobal("$", jquery);
        document.body.innerHTML = '<article class="item" style="display:grid" data-jhs-flags=\'{"favorite":true}\'></article><article class="item" style="display:flex"></article>';
        const cards = [...document.querySelectorAll(".item")], computed = vi.spyOn(window, "getComputedStyle");
        const view = new ListView({ hostAdapter: {}, selectors: { itemSelector: ".item" } });
        view.applyVisibility(cards, "favorite");
        expect(cards.map(card => card.style.display)).toEqual(["grid", "none"]);
        view.applyVisibility(cards, "all");
        expect(cards.map(card => card.style.display)).toEqual(["grid", "flex"]);
        expect(computed).not.toHaveBeenCalled();
    });
    it("does no historical-card geometry work during repeated scrolling until invalidation", () => {
        const scope = new LifecycleScope("scroll-budget");
        const controller = new AutoPageController({ hostAdapter: {}, settings: {}, http: {}, ui: {}, scope, window });
        const rects = vi.fn(() => [1]), bounds = vi.fn(() => ({ top: 100 }));
        controller.pageItems = Array.from({ length: 50 }, (_, index) => ({ page: index + 1, top: index * 100, url: window.location.href,
            items: Array.from({ length: 40 }, () => ({ isConnected: true, getClientRects: rects, getBoundingClientRect: bounds })) }));
        controller.checkScrollPosition(); rects.mockClear(); bounds.mockClear();
        for (let index = 0; index < 60; index++) controller.checkScrollPosition();
        expect(rects).not.toHaveBeenCalled(); expect(bounds).not.toHaveBeenCalled();
        controller.invalidatePagePositions(); controller.checkScrollPosition();
        expect(rects).toHaveBeenCalledTimes(49); expect(bounds).toHaveBeenCalledTimes(49);
        controller.pageItems[49].items.forEach(item => item.getClientRects = () => []);
        controller.invalidatePagePositions(); controller.refreshPagePositions();
        expect(controller.hiddenPages.has(controller.pageItems[49])).toBe(true);
        scope.dispose();
    });

    it("does not move already ordered cards or scan the list for pagination on card additions", async () => {
        document.body.innerHTML = '<div class="movie-list"></div><nav class="pagination"><ul class="pagination-list"><li class="pagination-link is-current">1</li></ul></nav>';
        const list = document.querySelector(".movie-list"), scope = new LifecycleScope("sort-budget");
        const hostAdapter = { site: "javdb", location: window.location, detectRoute: () => "list",
            getListSelectors: () => ({ itemSelector: ".movie-list > .item", boxSelector: ".movie-list" }) };
        const pagination = new ListPaginationController({ hostAdapter, navigation: {}, scope, document }); pagination.start();
        await Promise.resolve();
        const queries = vi.spyOn(list, "querySelector");
        for (let index = 0; index < 1000; index++) { const card = document.createElement("div"); card.className = "item"; list.append(card); }
        await Promise.resolve();
        expect(queries).not.toHaveBeenCalled();
        const mutations = [], observer = new MutationObserver(records => mutations.push(...records)); observer.observe(list, { childList: true });
        const sorter = new ListSortController({ hostAdapter, settings: { snapshot: () => ({ autoPage: "no" }) }, document });
        await sorter.sortItems("default"); await Promise.resolve();
        expect(mutations).toHaveLength(0);
        observer.disconnect(); scope.dispose();
    });

    it("refreshes only indexed cards after invalidation and coalesces one remote notification group", async () => {
        vi.stubGlobal("window", { isListPage: true });
        const handlers = new Map(), events = { on: (name, handler) => { handlers.set(name, handler); return () => {}; } };
        const scope = { addCleanup() {} }, settings = { snapshot: () => ({}), addEventListener() {} };
        const historyRefresh = vi.fn(async () => {});
        const list = new ListPageCompatibilityService({ runtimeServices: { scope: () => scope, settings, events }, resolveDependency: () => ({ tableObj: { setData: historyRefresh } }) });
        await list.handle({ scope, featureOwnsStartup: true });
        list.getIndexedItems = vi.fn(() => ["matched-card"]);
        list.invalidateListRefreshContext = vi.fn(); list.requestListRefresh = vi.fn(async () => true);
        await handlers.get("car-state-changed")({ carNums: ["ABC-1"] });
        expect(list.invalidateListRefreshContext).toHaveBeenCalledOnce();
        expect(list.requestListRefresh).toHaveBeenCalledWith(expect.objectContaining({ items: ["matched-card"], full: false }));
        expect(historyRefresh).toHaveBeenCalledOnce();
        list.requestListRefresh.mockClear();
        const payload = { notificationId: "one-commit", carNums: ["ABC-1"], changedDomains: ["car_list", "blacklist"] };
        await handlers.get("car-state-changed")(payload); await handlers.get("blacklist-rules-changed")(payload);
        expect(list.requestListRefresh).toHaveBeenCalledOnce();
        expect(list.requestListRefresh).toHaveBeenCalledWith(expect.objectContaining({ full: true }));
    });

    it("pauses a hidden scan at a record boundary and releases its wait on disposal", async () => {
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        const scope = new LifecycleScope("scan-budget"), controller = new NewVideoScanController({ scope });
        let resumed = false; const wait = controller.waitForVisible().then(() => resumed = true);
        await Promise.resolve(); expect(resumed).toBe(false);
        vi.spyOn(document, "hidden", "get").mockReturnValue(false); document.dispatchEvent(new Event("visibilitychange"));
        await wait; expect(resumed).toBe(true); expect(controller.visibilityWaits.size).toBe(0);
        vi.spyOn(document, "hidden", "get").mockReturnValue(true);
        const cancelled = controller.waitForVisible(); controller.dispose();
        await expect(cancelled).rejects.toMatchObject({ name: "AbortError" }); expect(controller.visibilityWaits.size).toBe(0); scope.dispose();
    });

    it("keeps performance observers off by default and disconnects an explicit capture", () => {
        const service = new DiagnosticsService(), instances = [];
        class Observer { static supportedEntryTypes = ["longtask", "event"]; constructor(callback) { this.callback = callback; this.disconnect = vi.fn(); instances.push(this); } observe() {} }
        expect(service.performanceSnapshot()).toBeNull();
        service.startPerformanceCapture({ PerformanceObserver: Observer });
        instances[0].callback({ getEntries: () => [{ duration: 80 }] });
        instances[1].callback({ getEntries: () => Array.from({ length: 250 }, () => ({ interactionId: 1, duration: 32 })) });
        service.recordWork("list.cards", 1);
        expect(service.performanceSnapshot()).toMatchObject({ longTasks: 1, blockingMs: 30, sampledInteractions: 200, interactionP95: 32 });
        service.stopPerformanceCapture(); expect(instances.every(observer => observer.disconnect.mock.calls.length === 1)).toBe(true);
    });
});
