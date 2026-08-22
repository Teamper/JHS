import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadTaskLifecycle({ isListPage = false, hidden = false } = {}) {
    const listeners = new Map(), documentListeners = new Map(), setTimeoutSpy = vi.fn(() => 1), clearTimeoutSpy = vi.fn();
    const location = new URL("https://javdb.com/v/test"), window = {
        location, isListPage, addEventListener: (type, listener) => listeners.set(type, listener)
    }, document = {
        hidden, addEventListener: (type, listener) => documentListeners.set(type, listener)
    }, locks = { request: vi.fn(async (key, options, callback) => callback({ key })) };
    const context = vm.createContext({
        console, URL, window, document, navigator: { locks }, setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy,
        localStorage: { getItem: vi.fn(), setItem: vi.fn() }, $: () => ({ length: 0 }), l: true, _: "yes",
        T: "javdb", I: "javbus", D: "censored", A: "uncensored", BasePlugin: class {},
        StorageQueue: class { constructor() { this.queue = Promise.resolve(); } },
        storageManager: {}, utils: { sleep: vi.fn(), getNowStr: vi.fn(), getHourDifference: vi.fn() },
        clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }, show: { info: vi.fn(), error: vi.fn() },
        i: (target, key, value) => (target[key] = value)
    });
    const source = [
        readFileSync(join(repoRoot, "src/core/site-context.js"), "utf8"),
        readFileSync(join(repoRoot, "src/parsers/third-party-parsers.js"), "utf8"),
        readFileSync(join(repoRoot, "src/plugins/new-video/task.js"), "utf8"),
        "globalThis.TestTaskPlugin=TaskPlugin;"
    ].join("\n");
    vm.runInContext(source, context);
    return { plugin: new context.TestTaskPlugin(), window, document, listeners, documentListeners, locks, setTimeoutSpy };
}

function loadListObserver() {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = true;
    const fetch = vi.fn(async () => ({ ok: true, json: async () => ({ translation: "译文" }) })), mapLimit = vi.fn(async (items, concurrency, mapper) => Promise.all(items.map(mapper))), storageManager = { getSetting: vi.fn(async () => "yes") };
    class BasePlugin {
        getSelector() { return { boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }; }
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
    vm.runInContext(`${readFileSync(join(repoRoot, "src/plugins/status/list-page.js"), "utf8")};globalThis.TestListPagePlugin=ListPagePlugin;`, context);
    return { dom, plugin: new context.TestListPagePlugin(), $, fetch, mapLimit, storageManager, clog: context.clog };
}

function initializeAccessibilityDom(html) {
    const dom = new JSDOM(html), source = readFileSync(join(repoRoot, "src/core/ui-primitives.js"), "utf8"), start = source.indexOf("function initializeUiAccessibility"), end = source.indexOf("class JhsSelect", start), context = vm.createContext({
        document: dom.window.document, Node: dom.window.Node, MutationObserver: dom.window.MutationObserver, queueMicrotask
    });
    vm.runInContext(`${source.slice(start, end)};initializeUiAccessibility();`, context);
    return dom;
}

describe("background task lifecycle", () => {
    it("does not initialize or schedule on a detail page despite the lexical isListPage helper", async () => {
        const { plugin, documentListeners, setTimeoutSpy } = loadTaskLifecycle({ isListPage: false });
        plugin.doTask = vi.fn();
        await plugin.handle();
        expect(plugin.doTask).not.toHaveBeenCalled();
        expect(documentListeners.size).toBe(0);
        expect(setTimeoutSpy).not.toHaveBeenCalled();
    });

    it("runs once on a visible list page and schedules the next visible check", async () => {
        const { plugin, setTimeoutSpy } = loadTaskLifecycle({ isListPage: true });
        plugin.doTask = vi.fn(async () => {});
        await plugin.handle();
        expect(plugin.doTask).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3e5);
    });

    it("keeps hidden list pages dormant and retains the cross-tab lock", async () => {
        const hidden = loadTaskLifecycle({ isListPage: true, hidden: true });
        hidden.plugin.doTask = vi.fn(), await hidden.plugin.handle();
        expect(hidden.plugin.doTask).not.toHaveBeenCalled();
        expect(hidden.setTimeoutSpy).not.toHaveBeenCalled();

        const visible = loadTaskLifecycle({ isListPage: true });
        visible.plugin.loadConfig = vi.fn(async () => visible.plugin.taskConfig = { enableCheckBlacklist: "no" });
        visible.plugin.getBean = () => ({ getJavDbUrl: vi.fn(async () => "https://javdb.com") });
        await visible.plugin.doTask();
        expect(visible.locks.request).toHaveBeenCalledTimes(1);
    });
});

describe("list mutation hot path", () => {
    it("processes an appended card once and ignores later sort-style moves", async () => {
        const { dom, plugin } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        plugin.processAddedItems = vi.fn(async (items) => items.forEach((item => item.dataset.jhsProcessed = "true")));
        plugin.checkDom();
        const item = dom.window.document.createElement("div");
        item.className = "item", container.append(item);
        await new Promise((resolve => setTimeout(resolve, 140)));
        expect(plugin.processAddedItems).toHaveBeenCalledTimes(1);
        expect(plugin.processAddedItems.mock.calls[0][0]).toEqual([ item ]);

        container.append(item);
        await new Promise((resolve => setTimeout(resolve, 140)));
        expect(plugin.processAddedItems).toHaveBeenCalledTimes(1);
    });

    it("bounds translation concurrency and deduplicates an in-flight car number", async () => {
        const { dom, plugin, $, fetch, mapLimit } = loadListObserver(), container = dom.window.document.querySelector(".movie-list");
        container.innerHTML = '<div class="item"><div class="video-title"><strong>ABC-123</strong> 原題</div></div><div class="item"><div class="video-title"><strong>ABC-123</strong> 原題</div></div>';
        const items = $(container).find(".item").toArray().map((item => $(item)));
        await plugin.translateListItems(items);
        expect(mapLimit).toHaveBeenCalledWith(items, 3, expect.any(Function));
        expect(fetch).toHaveBeenCalledTimes(1);
        expect($(items[0]).attr("data-jhs-translation-key")).toBe("ABC-123");
    });

    it("recovers from a damaged translation cache", () => {
        const { dom, plugin, clog } = loadListObserver();
        dom.window.localStorage.setItem("jhs_translate", "{");
        expect(plugin.getTranslationCache()).toEqual({});
        expect(clog.warn).toHaveBeenCalledTimes(1);
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
        container.innerHTML = `<div class="item" data-jhs-flags='{"favorite":true}' data-jhs-visibility='{}' data-jhs-setting-hide="yes"></div><div class="item" data-jhs-flags='{}' data-jhs-visibility='{"keyword":true}'></div>`;
        await plugin.createQuickFilter();
        $("body").append('<span class="jhs-mobile-filter-label"></span><button class="jhs-mobile-filter-option" data-jhs-filter="blockedItems" aria-checked="false"></button>');
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
