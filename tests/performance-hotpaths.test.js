import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadListObserver() {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = true;
    const translate = vi.fn(async () => "译文"), mapLimit = vi.fn(async (items, concurrency, mapper) => Promise.all(items.map(mapper))), storageManager = { car_list_key: "car_list", getSetting: vi.fn(async () => "yes"), _invalidateCache: vi.fn() };
    class BasePlugin {
        getSelector() { return { boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }; }
        getBean() { return null; }
        getRuntimeService(name) {
            if (name === "translation") return { translate };
            if (name === "settings") return { snapshot: () => ({ translateTitle: "yes" }) };
            return async () => undefined;
        }
    }
    const context = vm.createContext({
        console, window: dom.window, document: dom.window.document, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver,
        IntersectionObserver: undefined, localStorage: dom.window.localStorage, URLSearchParams, fetch, $, BasePlugin,
        r: true, l: false, c: false, _: "yes", C: "no", B: "actor", u: "屏蔽", b: "收藏", y: "下载", k: "观看",
        storageManager, utils: {}, clog: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() }, show: { error: vi.fn() },
        isHitShowPage: () => false, mapLimit, i: (target, key, value) => (target[key] = value), setTimeout, clearTimeout,
        normalizeStateFlags: flags => Object.fromEntries([ "favorite", "downloaded", "watched", "blocked" ].map((key => [ key, !0 === flags?.[key] ]))),
        hasAnyState: flags => [ "favorite", "downloaded", "watched", "blocked" ].some((key => !0 === flags?.[key]))
    });
    const source = [
        readTestFile(join(repoRoot, "src/features/list/list-filters.js"), "utf8"),
        readTestFile(join(repoRoot, "src/features/list/list-refresh-coordinator.js"), "utf8"),
        readTestFile(join(repoRoot, "src/features/list/list-compatibility-service.js"), "utf8"),
        "globalThis.TestListPagePlugin=ListPageCompatibilityService;"
    ].join("\n");
    vm.runInContext(source, context);
    const plugin = new context.TestListPagePlugin({ runtimeServices: {
        host: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }) },
        legacyStorage: storageManager,
        settings: { snapshot: () => ({ translateTitle: "yes", hoverBigImg: "no" }) },
        translation: { translate },
        scope: async () => ({ disposed: false }),
    } });
    return { dom, plugin, $, translate, mapLimit, storageManager, clog: context.clog };
}

function initializeAccessibilityDom(html) {
    const dom = new JSDOM(html), source = readTestFile(join(repoRoot, "src/core/ui-primitives.js"), "utf8"), start = source.indexOf("function initializeUiAccessibility"), end = source.indexOf("class JhsSelect", start), context = vm.createContext({
        document: dom.window.document, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, queueMicrotask
    });
    context.lifecycleScope = { observe(target, callback, options) { const observer = new dom.window.MutationObserver(callback); return observer.observe(target, options), observer; } };
    vm.runInContext(`${source.slice(start, end)};initializeUiAccessibility(lifecycleScope);`, context);
    return dom;
}

describe("list mutation hot path", () => {
    it("reruns the latest refresh after an in-flight refresh becomes stale", async () => {
        const { plugin } = loadListObserver();
        let releaseFirst;
        plugin.doFilter = vi.fn()
            .mockImplementationOnce(() => new Promise((resolve) => { releaseFirst = resolve; }))
            .mockResolvedValueOnce(true);
        const first = plugin.requestListRefresh({ reason: "test-first", full: true });
        await vi.waitFor(() => expect(plugin.doFilter).toHaveBeenCalledOnce());
        const second = plugin.requestListRefresh({ reason: "test-latest", full: true });
        releaseFirst(true);
        await expect(first).resolves.toBe(true);
        await expect(second).resolves.toBe(true);
        expect(plugin.doFilter).toHaveBeenCalledTimes(2);
    });

    it("does not commit visibility from a stale list generation", () => {
        const { plugin } = loadListObserver(), applyVisibility = vi.spyOn(plugin, "applyVisibility"), stale = plugin.advanceListGeneration();
        plugin.advanceListGeneration();
        expect(plugin.reconcileListItems(null, stale)).toBe(false);
        expect(applyVisibility).not.toHaveBeenCalled();
        expect(plugin.reconcileListItems(null, plugin.captureListRevision())).toBe(true);
        expect(applyVisibility).toHaveBeenCalledOnce();
    });

    it("processes an appended card once and ignores later sort-style moves", async () => {
        const { dom, plugin } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        plugin.processAddedItems = vi.fn(async (items) => items.forEach((item => item.dataset.jhsProcessed = "true")));
        plugin.checkDom({ observe(target, callback, options) { const observer = new dom.window.MutationObserver(callback); observer.observe(target, options); return observer; } });
        const item = dom.window.document.createElement("div");
        item.className = "item", container.append(item);
        await new Promise((resolve => setTimeout(resolve, 140)));
        expect(plugin.processAddedItems).toHaveBeenCalledTimes(1);
        expect(plugin.processAddedItems.mock.calls[0][0]).toEqual([ item ]);

        container.append(item);
        await new Promise((resolve => setTimeout(resolve, 140)));
        expect(plugin.processAddedItems).toHaveBeenCalledTimes(1);
    });

    it("bounds translation concurrency and delegates translation to the service", async () => {
        const { dom, plugin, $, translate, mapLimit } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        container.innerHTML = '<div class="item"><div class="video-title"><strong>ABC-123</strong> 原題</div></div><div class="item"><div class="video-title"><strong>ABC-123</strong> 原題</div></div>';
        const items = $(container).find(".item").toArray();
        await plugin.translateListItems(items);
        expect(mapLimit).toHaveBeenCalledWith(items, 3, expect.any(Function));
        expect(translate).toHaveBeenCalledTimes(2);
        expect($(items[0]).attr("data-jhs-translation-key")).toBe("ABC-123");
    });

    it("collects one current-page summary with hard-hidden union and debug reasons", () => {
        const { plugin, dom } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        container.innerHTML = `
            <div class="item" data-jhs-flags='{}' data-jhs-visibility='{}'></div>
            <div class="item" data-jhs-flags='{"blocked":true}' data-jhs-visibility='{"keyword":true,"actorBlacklist":true}'></div>
            <div class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{"actressBlacklist":true}'></div>
            <div class="item" data-jhs-flags='{"downloaded":true,"watched":true}' data-jhs-visibility='{}'></div>`;
        expect(plugin.getCurrentPageSummary()).toEqual({
            total: 4, pending: 1, blockedItems: 2, favorite: 1, downloaded: 1, watched: 1,
            debug: { manualBlocked: 1, keywordBlocked: 1, actorBlocked: 1, actressBlocked: 1 }
        });
        const collect = vi.spyOn(plugin, "collectCurrentPageSummary");
        plugin.recountStatuses();
        expect(collect).toHaveBeenCalledOnce();
        expect(plugin).not.toHaveProperty("currentPageBlockedItemCount");
        expect(plugin.currentPageWaitCheckCount).toBe(1);
    });

    it("projects setQuickFilter to desktop and mobile controls", async () => {
        const { plugin, dom, $ } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        container.innerHTML = `<div class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{}'></div><div class="item" data-jhs-flags='{}' data-jhs-visibility='{"keyword":true}'></div>`;
        await plugin.createQuickFilter();
        $("body").append('<span class="jhs-mobile-filter-label"></span><button class="jhs-mobile-filter-option" data-jhs-filter="blockedItems" aria-checked="false"></button>');
        plugin.setQuickFilter("all");
        // "全部"是包含 hard-hidden 的真全集
        expect($(".item").filter(((_, item) => "none" !== $(item).css("display"))).length).toBe(2);
        const appended = $('<div class="item" data-jhs-flags=\'{"downloaded":true}\' data-jhs-visibility="{}"></div>').appendTo(container);
        plugin.applyVisibility(appended);
        expect(appended.css("display")).not.toBe("none");
        plugin.setQuickFilter("blockedItems");
        expect(plugin.activeQuickFilter).toBe("blockedItems");
        expect($(".item").filter(((_, item) => "none" !== $(item).css("display"))).length).toBe(1);
        expect($(".jhs-quick-filter__label").text()).toBe("筛选：屏蔽项");
        expect($(".jhs-segmented__item.active").length).toBe(0);
        expect($(".jhs-mobile-filter-label").text()).toBe("筛选：屏蔽项");
        expect($(".jhs-mobile-filter-option").attr("aria-checked")).toBe("true");
        plugin.setQuickFilter("favorite");
        expect($(".item").filter(((_, item) => "none" !== $(item).css("display"))).length).toBe(1);
        expect($(".jhs-segmented__item[data-jhs-filter='favorite']").attr("aria-selected")).toBe("true");
        expect($(".jhs-quick-filter__label").text()).toBe("更多筛选");
    });
});

describe("accessibility mutation scope", () => {
    it("enhances JHS controls without relabeling ordinary host buttons", async () => {
        const dom = initializeAccessibilityDom('<button id="host" title="宿主"></button><button id="jhs" class="jhs-btn" title="工具"></button>'), { document } = dom.window;
        expect(document.querySelector("#host").hasAttribute("aria-label")).toBe(false);
        expect(document.querySelector("#jhs").getAttribute("aria-label")).toBe("工具");

        const hostRoot = document.createElement("div"), jhsRoot = document.createElement("div");
        hostRoot.innerHTML = '<button id="host-dynamic" title="宿主动态"></button>', jhsRoot.className = "jhs-panel", jhsRoot.innerHTML = '<button id="jhs-dynamic" title="动态工具"></button>',
        document.body.append(hostRoot, jhsRoot);
        await new Promise((resolve => setTimeout(resolve, 0)));
        expect(document.querySelector("#host-dynamic").hasAttribute("aria-label")).toBe(false);
        expect(document.querySelector("#jhs-dynamic").getAttribute("aria-label")).toBe("动态工具");
    });
});
