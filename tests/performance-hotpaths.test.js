import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ListPageService } from "../src/features/list/list-page-service.js";
import { initializeUiAccessibility } from "../src/core/ui-primitives.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { initializeRuntimeConstants } from "../src/core/constants.js";

const windows = [], scopes = [];
function fixture(html, url = "https://javdb.com/") {
    const dom = new JSDOM(html, { url });
    windows.push(dom.window);
    for (const name of ["window", "document", "Node", "Element", "HTMLElement", "MutationObserver", "localStorage"]) {
        vi.stubGlobal(name, name === "window" ? dom.window : dom.window[name]);
    }
    return dom;
}

afterEach(() => {
    scopes.splice(0).forEach(scope => scope.dispose());
    windows.splice(0).forEach(window => window.close());
    vi.unstubAllGlobals();
});

function loadListObserver() {
    const dom = fixture('<div class="movie-list"></div>'), $ = jqueryFactory(dom.window);
    vi.stubGlobal("$", $);
    dom.window.isListPage = true;
    initializeRuntimeConstants(dom.window.location);
    const translate = vi.fn(async () => "译文");
    const scope = new LifecycleScope("list-hotpath-fixture");
    scopes.push(scope);
    const plugin = new ListPageService({ runtimeServices: {
        host: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }) },
        settings: { snapshot: () => ({ translateTitle: "yes", hoverBigImg: "no" }) },
        translation: { translate },
        scope: async () => scope,
    } });
    return { dom, plugin, $, translate, scope };
}

function initializeAccessibilityDom(html, clock = performance) {
    const dom = fixture(html), scope = new LifecycleScope("list-accessibility");
    scopes.push(scope);
    vi.stubGlobal("performance", clock);
    initializeUiAccessibility(scope);
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
        const { dom, plugin, scope } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        plugin.processAddedItems = vi.fn(async (items) => items.forEach((item => item.dataset.jhsProcessed = "true")));
        plugin.checkDom(scope);
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
        const { dom, plugin, $, translate } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        container.innerHTML = Array.from({ length: 7 }, (_, index) =>
            `<div class="item"><div class="video-title"><strong>ABC-12${index + 3}</strong> 原題 ${index}</div></div>`).join("");
        let inFlight = 0, peak = 0;
        translate.mockImplementation(async () => {
            peak = Math.max(peak, ++inFlight);
            await new Promise(resolve => setTimeout(resolve, 5));
            inFlight--;
            return "译文";
        });
        const items = $(container).find(".item").toArray();
        await plugin.translateListItems(items);
        expect(peak).toBe(3);
        expect(translate).toHaveBeenCalledTimes(items.length);
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

        $(".jhs-quick-filter__toggle").trigger("click");
        const undownloadedOption = $('.jhs-quick-filter__menu [data-jhs-filter="undownloaded"]');
        expect(undownloadedOption.text()).toBe("全部未下载");
        undownloadedOption.trigger("click");
        expect(plugin.activeQuickFilter).toBe("undownloaded");
        expect($(".item").filter(((_, item) => "none" !== $(item).css("display"))).length).toBe(1);
        expect(appended.css("display")).toBe("none");
        expect(undownloadedOption.attr("aria-checked")).toBe("true");
        expect($(".jhs-quick-filter__label").text()).toBe("筛选：全部未下载");
        expect($(".jhs-quick-filter__menu").hasClass("is-open")).toBe(false);
    });
});

describe("accessibility mutation scope", () => {
    it("enhances JHS controls without relabeling ordinary host buttons", async () => {
        let elapsed = 0;
        const dom = initializeAccessibilityDom('<button id="host" title="宿主"></button><button id="jhs" class="jhs-btn" title="工具"></button>', { now: () => elapsed += 100 }), { document } = dom.window;
        expect(document.querySelector("#host").hasAttribute("aria-label")).toBe(false);
        expect(document.querySelector("#jhs").getAttribute("aria-label")).toBe("工具");

        const hostRoot = document.createElement("div"), jhsRoot = document.createElement("div");
        hostRoot.innerHTML = '<button id="host-dynamic" title="宿主动态"></button>', jhsRoot.className = "jhs-panel", jhsRoot.innerHTML = '<button id="jhs-dynamic" title="动态工具"></button>',
        document.body.append(hostRoot, jhsRoot);
        // The accessibility budget can yield after the first root; join the observable completion.
        await vi.waitFor(() => expect(document.querySelector("#jhs-dynamic").getAttribute("aria-label")).toBe("动态工具"));
        expect(document.querySelector("#host-dynamic").hasAttribute("aria-label")).toBe(false);
    });
});
