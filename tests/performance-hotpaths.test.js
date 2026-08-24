import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadTaskLifecycle({ isListPage = false, hidden = false } = {}) {
    const listeners = new Map(), documentListeners = new Map(), setTimeoutSpy = vi.fn(() => 1), clearTimeoutSpy = vi.fn(), cleanups = [];
    const location = new URL("https://javdb.com/v/test"), window = {
        location, isListPage, addEventListener: (type, listener) => listeners.set(type, listener), removeEventListener: type => listeners.delete(type)
    }, document = {
        hidden, addEventListener: (type, listener) => documentListeners.set(type, listener), removeEventListener: type => documentListeners.delete(type)
    }, locks = { request: vi.fn(async (key, options, callback) => callback({ key })) };
    const storage = { getLocal: vi.fn(), setLocal: vi.fn() }, scope = {
        listen(target, type, listener) { target.addEventListener(type, listener); cleanups.push(() => target.removeEventListener(type, listener)); },
        addCleanup(cleanup) { cleanups.push(cleanup); },
        dispose() { [...cleanups].reverse().forEach(cleanup => cleanup()); }
    };
    const context = vm.createContext({
        console, URL, window, document, navigator: { locks }, setTimeout: setTimeoutSpy, clearTimeout: clearTimeoutSpy,
        localStorage: { getItem: vi.fn(), setItem: vi.fn() }, $: () => ({ length: 0 }), l: true, _: "yes",
        T: "javdb", I: "javbus", D: "censored", A: "uncensored", BasePlugin: class { getRuntimeService(name) { return "storage" === name ? storage : "scope" === name ? () => scope : null; } },
        StorageQueue: class { constructor() { this.queue = Promise.resolve(); } },
        storageManager: {}, utils: { sleep: vi.fn(), getNowStr: vi.fn(), getHourDifference: vi.fn() },
        clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }, show: { info: vi.fn(), error: vi.fn() },
        i: (target, key, value) => (target[key] = value)
    });
    const source = [
        readTestFile(join(repoRoot, "src/core/site-context.js"), "utf8"),
        readTestFile(join(repoRoot, "src/integrations/javdb/parser.js"), "utf8"),
        readTestFile(join(repoRoot, "src/integrations/host-list/parser.js"), "utf8"),
        readTestFile(join(repoRoot, "src/plugins/new-video/task.js"), "utf8"),
        "globalThis.TestTaskPlugin=TaskPlugin;"
    ].join("\n");
    vm.runInContext(source, context);
    return { plugin: new context.TestTaskPlugin(), window, document, listeners, documentListeners, locks, setTimeoutSpy, scope };
}

function loadListObserver() {
    const dom = new JSDOM('<div class="movie-list"></div>', { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = true;
    const translate = vi.fn(async () => "译文"), mapLimit = vi.fn(async (items, concurrency, mapper) => Promise.all(items.map(mapper))), storageManager = { getSetting: vi.fn(async () => "yes") };
    class BasePlugin {
        getSelector() { return { boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".movie-list .item img" }; }
        getRuntimeService(name) { return name === "translation" ? { translate } : async () => undefined; }
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
    vm.runInContext(`${readTestFile(join(repoRoot, "src/plugins/status/list-page.js"), "utf8")};globalThis.TestListPagePlugin=ListPagePlugin;`, context);
    return { dom, plugin: new context.TestListPagePlugin(), $, translate, mapLimit, storageManager, clog: context.clog };
}

function initializeAccessibilityDom(html) {
    const dom = new JSDOM(html), source = readTestFile(join(repoRoot, "src/core/ui-primitives.js"), "utf8"), start = source.indexOf("function initializeUiAccessibility"), end = source.indexOf("class JhsSelect", start), context = vm.createContext({
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
        const { plugin, setTimeoutSpy, scope, listeners, documentListeners } = loadTaskLifecycle({ isListPage: true });
        plugin.doTask = vi.fn(async () => {});
        await plugin.handle();
        expect(plugin.doTask).toHaveBeenCalledTimes(1);
        expect(setTimeoutSpy).toHaveBeenCalledWith(expect.any(Function), 3e5);
        expect(listeners.has("pagehide")).toBe(true);
        expect(documentListeners.has("visibilitychange")).toBe(true);
        scope.dispose();
        expect(listeners.size).toBe(0);
        expect(documentListeners.size).toBe(0);
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
        const items = $(container).find(".item").toArray().map((item => $(item)));
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
        expect($(".item").filter(((_, item) => "none" !== $(item).css("display"))).length).toBe(1);
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
