// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { AutoPageController } from "../src/features/list/auto-page-controller.js";

class SettingsFixture extends window.EventTarget {
    constructor(autoPage) { super(); this.autoPage = autoPage; }
    snapshot() { return { autoPage: this.autoPage }; }
    update(autoPage) {
        this.autoPage = autoPage;
        this.dispatchEvent(new window.CustomEvent("settings.changed", { detail: { names: ["autoPage"] } }));
    }
}

function card(carNum, href) {
    const item = document.createElement("div");
    item.className = "item";
    item.innerHTML = `<a href="${href}"><div class="cover"><img src="/cover.jpg"></div><div class="video-title"><strong>${carNum}</strong></div></a>`;
    return item;
}

function setup(autoPage = "yes", response = "", visibilitySnapshot = null) {
    document.body.innerHTML = `<div class="movie-list">${card("ABC-001", "/v/abc-001").outerHTML}</div><a class="pagination-next" href="/page/2">下一页</a><div class="pagination">旧分页</div>`;
    window.isListPage = true;
    const $ = jqueryFactory;
    vi.stubGlobal("$", $);
    vi.stubGlobal("jQuery", $);
    const settings = new SettingsFixture(autoPage);
    const scope = new LifecycleScope("test-auto-page");
    const handlers = new Map();
    const eventBus = {
        on: vi.fn((type, handler) => {
            const listeners = handlers.get(type) ?? new Set();
            listeners.add(handler);
            handlers.set(type, listeners);
            return () => listeners.delete(handler);
        }),
        async emit(type, payload) { for (const handler of [...(handlers.get(type) ?? [])]) await handler(payload); },
    };
    const selectors = {
        boxSelector: ".movie-list", itemSelector: ".movie-list .item", coverImgSelector: ".cover img",
        requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next",
    };
    const hostAdapter = { site: "javdb", document, location: window.location, getListSelectors: () => selectors };
    const http = { request: vi.fn(async () => ({ data: response })) };
    const list = { replaceCoverImages: vi.fn(), getVisibilitySnapshot: () => visibilitySnapshot };
    const logger = { log: vi.fn(), error: vi.fn(), warn: vi.fn() };
    const controller = new AutoPageController({ hostAdapter, http, settings, list, ui: { jquery: (value) => $(value) }, eventBus, scope, document, window, logger });
    return { controller, settings, scope, eventBus, handlers, http, list, selectors, logger };
}

const initialPageUrl = window.location.href;
afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    window.history.replaceState({}, "", initialPageUrl);
    window.scrollY = 0;
    document.body.innerHTML = "";
});

describe("List Feature auto-page controller", () => {
    it.each([
        "https://javdb.com/rankings/movies?p=daily",
        "https://javdb.com/rankings/playback?p=weekly",
        "https://javdb.com/rankings/top?t=all",
        "https://javdb.com/want_watch_videos",
        "https://javdb.com/watched_videos",
        "https://javdb.com/tags/fc2?jhs_source=123av",
    ])("keeps 6.5.1 native and owned list routes out of auto-page: %s", async (url) => {
        const { controller, scope } = setup("yes");
        controller.window = { isListPage: true, location: { href: url } };
        await expect(controller.shouldDisablePaging()).resolves.toBe(true);
        scope.dispose();
    });

    it("keeps the OFF state inert, mounts on a live ON change, and stops without reloading", async () => {
        const { controller, settings, scope } = setup("no");
        await expect(controller.mount()).resolves.toBe(true);
        expect(controller.loader).toBeUndefined();
        expect(controller.liveScope).toBeNull();
        settings.update("yes");
        await vi.waitFor(() => expect(controller.loader).toBeInstanceOf(HTMLDivElement));
        const liveScope = controller.liveScope;
        const pages = controller.pageItems, nextUrl = controller.nextUrl;
        expect(liveScope?.snapshot().listeners).toBe(3);
        settings.update("no");
        await vi.waitFor(() => expect(controller.loader).toBeUndefined());
        expect(liveScope?.snapshot()).toMatchObject({ disposed: true, listeners: 0 });
        expect(controller.pageItems).toBe(pages);
        expect(controller.pageItems).toHaveLength(1);
        expect(controller.nextUrl).toBe(nextUrl);
        scope.dispose();
        expect(controller.pageItems).toEqual([]);
        expect(controller.nextUrl).toBeNull();
    });

    it("appends the next host page, upgrades its covers, and replaces native pagination", async () => {
        const html = `<div class="movie-list">${card("ABC-002", "/v/abc-002").outerHTML}</div><a class="pagination-next" href="/page/3">下一页</a><div class="pagination">新分页</div>`;
        const { controller, http, list, scope } = setup("yes", html);
        await controller.mount();
        await controller.loadNextPage();
        expect(http.request).toHaveBeenCalledOnce();
        expect(document.querySelectorAll(".movie-list .item")).toHaveLength(2);
        expect(list.replaceCoverImages).toHaveBeenCalledWith(expect.arrayContaining([expect.any(HTMLImageElement)]));
        expect(document.querySelector(".pagination").textContent).toContain("新分页");
        expect(controller.nextUrl).toBe("/page/3");
        expect(controller.pageItems).toHaveLength(2);
        scope.dispose();
    });

    it.each([
        { site: "javdb", route: "/?page=5" },
        { site: "javbus", route: "/page/5" },
    ])("continues the loaded page counter from a native $site page route", async ({ site, route }) => {
        window.history.replaceState({}, "", route);
        const html = `<div class="movie-list">${card("ABC-006", "/v/page-6").outerHTML}</div><a class="pagination-next" href="/page/7">下一页</a>`;
        const fixture = setup("yes", html);
        fixture.controller.hostAdapter.site = site;
        document.querySelector(".pagination-next").setAttribute("href", "/page/6");
        await fixture.controller.mount();
        await fixture.controller.loadNextPage();
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([5, 6]);
        expect(fixture.controller.loadedPage).toBe(6);
        expect(fixture.controller.currentPage).toBe(5);
        fixture.scope.dispose();
    });

    it("stops before appending pages with two consecutive duplicate car numbers", async () => {
        const html = `<div class="movie-list">${card("ABC-001", "/v/dup-1").outerHTML}${card("ABC-001", "/v/dup-2").outerHTML}</div><a class="pagination-next" href="/page/3">下一页</a>`;
        const { controller, scope } = setup("yes", html);
        await controller.mount();
        await controller.loadNextPage();
        expect(document.querySelectorAll(".movie-list .item")).toHaveLength(1);
        expect(controller.nextUrl).toBeNull();
        expect(controller.loader.classList.contains("waterfall-stopped")).toBe(true);
        expect(controller.loader.textContent).toContain("下一页包含重复内容");
        scope.dispose();
    });

    it("pauses an empty quick filter and lets each manual action load only one page", async () => {
        const pages = [
            `<div class="movie-list">${card("ABC-002", "/v/abc-002").outerHTML}</div><a class="pagination-next" href="/page/3">下一页</a>`,
            `<div class="movie-list">${card("ABC-003", "/v/abc-003").outerHTML}</div><a class="pagination-next" href="/page/4">下一页</a>`,
            `<div class="movie-list">${card("ABC-004", "/v/abc-004").outerHTML}</div><a class="pagination-next" href="/page/5">下一页</a>`,
        ];
        const fixture = setup("yes", "", { filter: "favorite", visible: 0, total: 30 });
        fixture.http.request.mockImplementation(async () => ({ data: pages.shift() }));
        await fixture.controller.mount();
        fixture.controller.loader.getBoundingClientRect = () => ({ top: 0 });

        expect(fixture.controller.loader.textContent).toContain("已加载内容无匹配");
        fixture.controller.checkLoad();
        expect(fixture.http.request).not.toHaveBeenCalled();

        fixture.controller.loader.querySelector(".jhs-scroll__continue").click();
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledOnce());
        await vi.waitFor(() => expect(document.querySelectorAll(".movie-list .item")).toHaveLength(2));
        await fixture.eventBus.emit("list-items-added", { items: [document.querySelectorAll(".movie-list .item")[1]] });
        expect(fixture.http.request).toHaveBeenCalledOnce();
        expect(fixture.controller.loader.querySelector(".jhs-scroll__continue")).not.toBeNull();

        fixture.controller.loader.querySelector(".jhs-scroll__continue").click();
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledTimes(2));
        await vi.waitFor(() => expect(document.querySelectorAll(".movie-list .item")).toHaveLength(3));
        expect(fixture.http.request).toHaveBeenCalledTimes(2);
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1, 2, 3]);
        expect(fixture.controller.loadedPage).toBe(3);
        expect(fixture.controller.currentPage).toBe(1);

        fixture.controller.onVisibilityChanged({ filter: "all", visible: 32, total: 32 });
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledTimes(3));
        fixture.scope.dispose();
    });

    it("rejects an in-flight page after AutoPage is switched off", async () => {
        let resolveResponse;
        const pending = new Promise((resolve) => { resolveResponse = resolve; });
        const fixture = setup("yes");
        fixture.http.request.mockImplementation(() => pending);
        await fixture.controller.mount();
        const pages = fixture.controller.pageItems, nextUrl = fixture.controller.nextUrl;
        const load = fixture.controller.loadNextPage();
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledOnce());
        fixture.settings.update("no");
        resolveResponse({ data: `<div class="movie-list">${card("ABC-002", "/v/late").outerHTML}</div>` });
        await load;
        expect(document.querySelectorAll(".movie-list .item")).toHaveLength(1);
        expect(fixture.controller.pageItems).toBe(pages);
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1]);
        expect(fixture.controller.loadedPage).toBe(1);
        expect(fixture.controller.nextUrl).toBe(nextUrl);
        fixture.scope.dispose();
    });

    it("keeps loaded page numbers separate from the viewport and preserves their mapping across OFF and ON", async () => {
        const fixture = setup("yes", "", { filter: "favorite", visible: 0, total: 3 });
        let nextPage = 2;
        fixture.http.request.mockImplementation(async () => {
            const page = nextPage++;
            return { data: `<div class="movie-list">${card(`ABC-00${page}`, `/v/page-${page}`).outerHTML}</div><a class="pagination-next" href="/page/${page + 1}">下一页</a>` };
        });
        await fixture.controller.mount();
        await fixture.controller.loadNextPage({ manual: true });
        await fixture.controller.loadNextPage({ manual: true });
        const pages = fixture.controller.pageItems;
        expect(pages.map(({ page }) => page)).toEqual([1, 2, 3]);
        expect(fixture.controller.currentPage).toBe(1);
        expect(fixture.controller.loadedPage).toBe(3);
        pages.slice(1).forEach((page, index) => {
            const top = (index + 1) * 500;
            page.items[0].getClientRects = () => [{ top }];
            page.items[0].getBoundingClientRect = () => ({ top: top - window.scrollY });
        });
        window.scrollY = 600;
        fixture.controller.checkScrollPosition();
        expect(fixture.controller.currentPage).toBe(2);
        expect(window.location.pathname).toBe("/page/2");

        const oldScope = fixture.controller.liveScope;
        fixture.settings.update("no");
        expect(oldScope.disposed).toBe(true);
        fixture.settings.update("yes");
        await vi.waitFor(() => expect(fixture.controller.loader).toBeInstanceOf(HTMLDivElement));
        expect(fixture.controller.pageItems).toBe(pages);
        expect(fixture.controller.currentPage).toBe(2);
        expect(fixture.controller.loadedPage).toBe(3);
        expect(fixture.controller.nextUrl).toBe("/page/4");
        expect(document.querySelectorAll(".jhs-scroll")).toHaveLength(1);
        expect(fixture.controller.liveScope.snapshot().listeners).toBe(3);
        await fixture.controller.start();
        expect(document.querySelectorAll(".jhs-scroll")).toHaveLength(1);

        window.scrollY = 1100;
        fixture.controller.checkScrollPosition();
        expect(fixture.controller.currentPage).toBe(3);
        expect(window.location.pathname).toBe("/page/3");
        pages[2].items[0].getClientRects = () => [];
        fixture.controller.invalidatePagePositions();
        fixture.controller.checkScrollPosition();
        expect(fixture.controller.currentPage).toBe(2);
        expect(window.location.pathname).toBe("/page/2");
        window.scrollY = 0;
        fixture.controller.checkScrollPosition();
        expect(fixture.controller.currentPage).toBe(1);
        expect(window.location.href).toBe(initialPageUrl);
        await fixture.controller.loadNextPage({ manual: true });
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1, 2, 3, 4]);
        expect(fixture.controller.loadedPage).toBe(4);
        expect(fixture.controller.currentPage).toBe(1);
        fixture.scope.dispose();
    });

    it("keeps the final loaded page exhausted after OFF and ON even if the original next link remains", async () => {
        const html = `<div class="movie-list">${card("ABC-002", "/v/final-page").outerHTML}</div>`;
        const fixture = setup("yes", html);
        await fixture.controller.mount();
        await fixture.controller.loadNextPage();
        expect(document.querySelector(".pagination-next")).not.toBeNull();
        fixture.settings.update("no");
        fixture.settings.update("yes");
        await vi.waitFor(() => expect(fixture.controller.loader).toBeInstanceOf(HTMLDivElement));
        fixture.controller.checkLoad();
        await fixture.controller.loadNextPage();
        expect(fixture.controller.nextUrl).toBeNull();
        expect(fixture.controller.hasMore).toBe(false);
        expect(fixture.controller.loader.textContent).toBe("已经到底了");
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1, 2]);
        expect(fixture.http.request).toHaveBeenCalledOnce();
        fixture.scope.dispose();
    });

    it("ignores a rejected old request after OFF and ON without replacing the new loader state", async () => {
        let rejectResponse;
        const pending = new Promise((_, reject) => { rejectResponse = reject; });
        const fixture = setup("yes", "", { filter: "favorite", visible: 0, total: 1 });
        fixture.http.request.mockImplementation(() => pending);
        await fixture.controller.mount();
        const load = fixture.controller.loadNextPage({ manual: true });
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledOnce());
        fixture.settings.update("no");
        fixture.settings.update("yes");
        await vi.waitFor(() => expect(fixture.controller.loader).toBeInstanceOf(HTMLDivElement));
        rejectResponse(new Error("old request aborted"));
        await load;
        expect(fixture.controller.loader.classList.contains("waterfall-paused")).toBe(true);
        expect(fixture.controller.loader.textContent).toContain("已加载内容无匹配");
        expect(fixture.controller.pageItems.map(({ page }) => page)).toEqual([1]);
        expect(fixture.controller.isLoading).toBe(false);
        expect(fixture.logger.error).not.toHaveBeenCalled();
        fixture.scope.dispose();
    });

    it("rechecks viewport loading after the List Feature reports newly processed items", async () => {
        const fixture = setup("yes");
        await fixture.controller.mount();
        const checkLoad = vi.spyOn(fixture.controller, "checkLoad").mockImplementation(() => {});
        await fixture.eventBus.emit("list-items-added", { items: [document.querySelector(".movie-list .item")] });
        expect(checkLoad).toHaveBeenCalledOnce();
        fixture.scope.dispose();
        expect(fixture.handlers.get("list-items-added").size).toBe(0);
    });
});
