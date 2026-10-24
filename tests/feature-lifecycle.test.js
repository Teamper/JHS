// @vitest-environment jsdom
import jquery from "jquery";
import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { AutoPageController } from "../src/features/list/auto-page-controller.js";
import { OtherSitesController } from "../src/features/external-sites/other-sites-controller.js";

const repoRoot = join(import.meta.dirname, "..");
const $ = jquery;
const win = /** @type {any} */ (globalThis.window);
const doc = win.document;

beforeEach(() => { doc.body.innerHTML = '<div class="movie-list"></div>'; });
afterEach(() => vi.unstubAllGlobals());

function loadPlugin(relativePath, overrides = {}) {
    /** @type {Array<{ name: string, handler: (event: any) => void }>} */
    const settingsEvents = [];
    const settings = {
        snapshot: () => overrides.settingsSnapshot || {},
        addEventListener: (name, handler) => settingsEvents.push({ name, handler }),
        removeEventListener: vi.fn(),
    };
    const runtime = {
        settings,
        storageManager: overrides.storageManager || { getSetting: vi.fn(async () => ({})) },
        utils: overrides.utils || { htmlTo$dom: vi.fn((html) => $(new win.DOMParser().parseFromString(html, "text/html"))) },
        clog: { log: vi.fn(), warn: vi.fn(), debug: vi.fn(), error: vi.fn() },
        ...overrides.runtime,
    };
    const context = vm.createContext({
        window: win, document: doc, $, URL, Date, console,
        setTimeout, clearTimeout, requestAnimationFrame, cancelAnimationFrame,
        BasePlugin: class {
            getRuntimeService(name) { return runtime[name]; }
            getOptionalDependency(name) { return runtime.optional?.[name]; }
            getBean(name) { return runtime.optional?.[name]; }
        },
        clog: runtime.clog,
        utils: runtime.utils,
        storageManager: runtime.storageManager,
        isDetailPage: overrides.isDetailPage ?? true,
        isListPage: overrides.isListPage ?? true,
        r: true, l: false, o: "https://javdb.example/search?q=ABC",
        show: { error: vi.fn(), info: vi.fn(), ok: vi.fn() },
        ...overrides.globals,
    });
    const source = readTestFile(join(repoRoot, relativePath), "utf8");
    vm.runInContext(source + "; globalThis.TestPlugin = " + overrides.className + ";", context);
    return { Plugin: context.TestPlugin, settings, settingsEvents };
}

function makeAutoPage(autoPage, request = vi.fn(async () => ({ data: "" }))) {
    const settings = { snapshot: () => ({ autoPage }) };
    const scope = new LifecycleScope("test-auto-page-feature-lifecycle");
    const selectors = { boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" };
    const hostAdapter = { site: "javdb", document: doc, location: win.location, getListSelectors: () => selectors };
    const controller = new AutoPageController({
        hostAdapter, http: { request }, settings, list: { replaceCoverImages: vi.fn() },
        ui: { jquery: (value) => $(value) }, scope, document: doc, window: win, logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
    });
    controller.shouldDisablePaging = vi.fn(async () => false);
    return { controller, settings, scope, request };
}

describe("Live feature lifecycle (mount/unmount/reconfigure)", () => {
    it("AutoPage: OFF 释放监听并保留已加载页，ON 不重复映射，dispose 才清空", async () => {
        const request = vi.fn(async () => ({ data: '<div class="movie-list"><div class="item"><a href="/v/abc-002"><strong>ABC-002</strong></a></div></div><a class="pagination-next" href="/page/3">下一页</a>' }));
        const fixture = makeAutoPage("no", request);
        doc.querySelector(".movie-list").innerHTML = '<div class="item"><a href="/v/abc-001"><strong>ABC-001</strong></a></div>';
        await fixture.controller.reconfigure();
        expect(fixture.controller.started).toBe(false);
        expect(fixture.controller.loader).toBeUndefined();
        fixture.settings.snapshot = () => ({ autoPage: "yes" });
        doc.querySelector(".movie-list").insertAdjacentHTML("afterend", '<a class="pagination-next" href="/page/2">下一页</a>');
        await fixture.controller.reconfigure();
        expect(fixture.controller.started).toBe(true);
        expect(fixture.controller.loader).toBeInstanceOf(win.HTMLElement);
        await fixture.controller.loadNextPage();
        const pages = fixture.controller.pageItems, nextUrl = fixture.controller.nextUrl, firstScope = fixture.controller.liveScope;
        expect(pages.map(({ page }) => page)).toEqual([1, 2]);
        expect($(".movie-list").children()).toHaveLength(2);
        expect(firstScope.snapshot().listeners).toBe(3);
        fixture.controller.stop();
        expect(fixture.controller.loader).toBeUndefined();
        expect(firstScope.snapshot()).toMatchObject({ disposed: true, listeners: 0, requestConsumers: 0 });
        expect(firstScope.signal.aborted).toBe(true);
        expect(fixture.controller.pageItems).toBe(pages);
        expect(fixture.controller.nextUrl).toBe(nextUrl);
        expect(nextUrl).toBe("/page/3");
        await fixture.controller.reconfigure();
        await fixture.controller.start();
        expect(fixture.controller.pageItems).toBe(pages);
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1, 2]);
        expect(fixture.controller.loadedPage).toBe(2);
        expect(fixture.controller.nextUrl).toBe("/page/3");
        expect($(".movie-list").children()).toHaveLength(2);
        expect($(".jhs-scroll")).toHaveLength(1);
        expect(fixture.controller.liveScope.snapshot().listeners).toBe(3);
        expect(request).toHaveBeenCalledOnce();
        fixture.controller.dispose();
        expect(fixture.controller.pageItems).toEqual([]);
        expect(fixture.controller.nextUrl).toBeNull();
        expect(fixture.controller.liveScope).toBeNull();
        fixture.scope.dispose();
    });

    it("OtherSite: 使用 SettingsService 快照（无私有缓存），OFF 只删 JHS 自有面板", async () => {
        const snapshot = { enableLoadOtherSite: "no" };
        const settings = { snapshot: () => snapshot, addEventListener: vi.fn(), removeEventListener: vi.fn() };
        $("body").append('<div data-jhs-other-site-box></div><div data-jhs-other-site-settings></div><div id="otherSiteBox"></div>');
        const scope = new LifecycleScope("other-sites-feature-off");
        const controller = new OtherSitesController({
            window: win, document: doc, jquery: $, hostAdapter: { readMovieRef: () => null }, movie: {}, storage: {},
            settings, events: {}, scope, ui: { isHidden: () => false, openPage: vi.fn() }, notifications: { debug: vi.fn() }, site: "javdb", route: "detail",
        });
        const cache = await controller.getSettingCache();
        expect(cache).toBe(settings.snapshot());
        await controller.mount();
        controller.unmount();
        expect($("[data-jhs-other-site-box]").length).toBe(0);
        expect($("[data-jhs-other-site-settings]").length).toBe(0);
        expect($("#otherSiteBox").length).toBe(1);
        scope.dispose();
    });

    it("External sites: waits for legacy detail controls before mounting and follows later live setting changes", async () => {
        let snapshot = { enableLoadOtherSite: "yes" };
        const settingsEvents = [];
        const settings = {
            snapshot: () => snapshot,
            addEventListener: (name, handler) => settingsEvents.push({ name, handler }),
            removeEventListener: vi.fn(),
        };
        const handlers = new Set();
        const events = { on: vi.fn((name, handler) => { expect(name).toBe("jhs-features-ready"); handlers.add(handler); return () => handlers.delete(handler); }) };
        const scope = new LifecycleScope("other-sites-feature-live-toggle");
        const controller = new OtherSitesController({
            window: win, document: doc, jquery: $, hostAdapter: { readMovieRef: () => null }, movie: {}, storage: {},
            settings, events, scope, ui: { isHidden: () => false, openPage: vi.fn() },
            notifications: { debug: vi.fn() }, site: "javdb", route: "detail",
        });
        const mounted = vi.fn(async () => {}), unmounted = vi.fn();
        controller.mount = mounted;
        controller.unmount = unmounted;
        controller.start();
        expect(settingsEvents.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        const handler = settingsEvents[0].handler;
        snapshot = { enableLoadOtherSite: "no" };
        handler({ detail: { names: [ "enableLoadOtherSite" ] } });
        snapshot = { enableLoadOtherSite: "yes" };
        handler({ detail: { names: [ "enableLoadOtherSite" ] } });
        expect(mounted).not.toHaveBeenCalled();
        await Promise.all([...handlers].map(ready => ready()));
        expect(mounted).toHaveBeenCalledOnce();
        for (let i = 0; i < 3; i++) {
            snapshot = { enableLoadOtherSite: "no" };
            handler({ detail: { names: [ "enableLoadOtherSite" ] } });
            snapshot = { enableLoadOtherSite: "yes" };
            handler({ detail: { names: [ "enableLoadOtherSite" ] } });
        }
        expect(settingsEvents.filter((item) => item.name === "settings.changed")).toHaveLength(1);
        expect(events.on).toHaveBeenCalledOnce();
        expect(unmounted).toHaveBeenCalledTimes(4);
        expect(mounted).toHaveBeenCalledTimes(4); // 首次 ready 挂载 + 3 次重新启用
        scope.dispose();
        expect(handlers.size).toBe(0);
        expect(settings.removeEventListener).toHaveBeenCalledWith("settings.changed", handler);
    });

    it("AutoPage: stop 释放 liveScope，请求中切 OFF 不再 append", async () => {
        let resolveRequest;
        const pending = new Promise((resolve) => { resolveRequest = resolve; });
        const releaseRequest = vi.fn();
        const request = vi.fn((_options, scope) => { scope.ownRequestConsumer({ release: releaseRequest }); return pending; });
        const fixture = makeAutoPage("yes", request);
        doc.querySelector(".movie-list").insertAdjacentHTML("afterend", '<a class="pagination-next" href="/page/2">下一页</a>');
        await fixture.controller.reconfigure();
        expect(fixture.controller.started).toBe(true);
        const firstScope = fixture.controller.liveScope;
        const pages = fixture.controller.pageItems, nextUrl = fixture.controller.nextUrl;
        expect(firstScope).not.toBeNull();
        const loadPromise = fixture.controller.loadNextPage();
        await vi.waitFor(() => expect(request).toHaveBeenCalledOnce());
        expect(firstScope.snapshot()).toMatchObject({ listeners: 3, requestConsumers: 1 });
        fixture.controller.stop();
        expect(fixture.controller.started).toBe(false);
        expect(fixture.controller.liveScope).toBeNull();
        expect(firstScope.snapshot()).toMatchObject({ disposed: true, listeners: 0, requestConsumers: 0 });
        expect(firstScope.signal.aborted).toBe(true);
        expect(releaseRequest).toHaveBeenCalledOnce();
        resolveRequest({ data: '<div class="movie-list"><div class="item"></div></div>' });
        await loadPromise;
        expect(fixture.controller.pageItems).toBe(pages);
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1]);
        expect(fixture.controller.nextUrl).toBe(nextUrl);
        expect($(".movie-list").children().length).toBe(0);
        await fixture.controller.reconfigure();
        expect(fixture.controller.pageItems).toBe(pages);
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1]);
        expect($(".jhs-scroll")).toHaveLength(1);
        expect(fixture.controller.liveScope.snapshot().listeners).toBe(3);
        fixture.controller.dispose();
        expect(fixture.controller.pageItems).toEqual([]);
        expect(fixture.controller.nextUrl).toBeNull();
        fixture.scope.dispose();
    });

    it("AutoPage: 旧首次启动 Promise 完成时不能清空关闭重开后的新 Promise", async () => {
        const fixture = makeAutoPage("yes"), pendingChecks = [];
        fixture.controller.shouldDisablePaging = vi.fn(() => new Promise(resolve => pendingChecks.push(resolve)));
        const first = fixture.controller.start();
        expect(fixture.controller.start()).toBe(first);
        fixture.controller.stop();
        const second = fixture.controller.start();
        expect(second).not.toBe(first);
        expect(fixture.controller.start()).toBe(second);
        pendingChecks[0](false);
        await first;
        expect(fixture.controller.waterfallPromise).toBe(second);
        expect(fixture.controller.start()).toBe(second);
        expect(fixture.controller.loader).toBeUndefined();
        pendingChecks[1](false);
        await second;
        expect(fixture.controller.waterfallPromise).toBeNull();
        await fixture.controller.start();
        expect($(".jhs-scroll")).toHaveLength(1);
        expect(fixture.controller.liveScope.snapshot().listeners).toBe(3);
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1]);
        fixture.controller.dispose();
        fixture.scope.dispose();
    });

});
