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

    it("re-reads cards added to the same list root before judging duplicate pages", async () => {
        const page2 = `<div class="movie-list">${card("ABC-002", "/v/abc-002").outerHTML}</div><a class="pagination-next" href="/page/3">下一页</a>`;
        const page3 = `<div class="movie-list">${card("ABC-010", "/v/host-10").outerHTML}${card("ABC-011", "/v/host-11").outerHTML}</div><a class="pagination-next" href="/page/4">下一页</a>`;
        const { controller, scope, http } = setup("yes", "");
        http.request.mockImplementationOnce(async () => ({ data: page2 })).mockImplementationOnce(async () => ({ data: page3 }));
        await controller.mount();
        await controller.loadNextPage();
        document.querySelector(".movie-list").insertAdjacentHTML("beforeend", card("ABC-010", "/v/host-10").outerHTML + card("ABC-011", "/v/host-11").outerHTML);
        await vi.waitFor(() => expect(controller.knownCarNums).toBeNull());
        await controller.loadNextPage();
        expect(document.querySelectorAll(".movie-list .item")).toHaveLength(4);
        expect(controller.nextUrl).toBeNull();
        scope.dispose();
    });

    it("reads only the new cards across 25 pages and invalidates when a live card is removed", async () => {
        const { controller, scope, http } = setup();
        vi.spyOn(controller, "checkLoad").mockImplementation(() => {});
        const list = document.querySelector(".movie-list");
        const pageCards = page => Array.from({ length: 40 }, (_, index) => {
            const number = `ABC-${1000 + page * 40 + index}`;
            return card(number, `/v/${number}`).outerHTML;
        }).join("");
        list.innerHTML = pageCards(1);
        let page = 2;
        http.request.mockImplementation(async () => ({
            data: `<div class="movie-list">${pageCards(page++)}</div><a class="pagination-next" href="/page/${page}">下一页</a>`,
        }));
        const read = vi.spyOn(controller, "readCarNumbers");
        await controller.mount();
        await controller.loadNextPage();
        expect(read.mock.calls.map(([collection]) => collection.length)).toEqual([40, 40]);
        for (let next = 3; next <= 25; next++) {
            read.mockClear();
            await controller.loadNextPage();
            expect(read.mock.calls.map(([collection]) => collection.length)).toEqual([40]);
        }
        expect(list.children).toHaveLength(1000);
        expect(controller.knownCarNums.size).toBe(1000);
        list.firstElementChild.remove();
        await vi.waitFor(() => expect(controller.knownCarNums).toBeNull());
        const remaining = list.firstElementChild.outerHTML;
        http.request.mockResolvedValueOnce({
            data: `<div class="movie-list">${card("ABC-1040", "/v/reappeared").outerHTML}${remaining}</div>`,
        });
        await controller.loadNextPage();
        expect(controller.loadedPage).toBe(26);
        scope.dispose();
    });

    it("loads through pages hidden by a quick filter, then waits for scrolling when the footer moves down", async () => {
        const pages = [
            `<div class="movie-list">${card("ABC-002", "/v/abc-002").outerHTML}</div><a class="pagination-next" href="/page/3">下一页</a>`,
            `<div class="movie-list">${card("ABC-003", "/v/abc-003").outerHTML}</div><a class="pagination-next" href="/page/4">下一页</a>`,
            `<div class="movie-list">${card("ABC-004", "/v/abc-004").outerHTML}</div>`,
        ];
        const { controller, eventBus, http, scope } = setup("yes", "", { filter: "all", visible: 1, total: 1 });
        http.request.mockImplementation(async () => ({ data: pages.shift() }));
        const threshold = window.innerHeight + 500;
        let footerTop = threshold + 100;
        const added = () => eventBus.emit("list-items-added", { items: [document.querySelector(".movie-list .item:last-child")] });
        try {
            await controller.mount();
            controller.loader.getBoundingClientRect = () => ({ top: footerTop });
            controller.checkLoad();
            expect(http.request).not.toHaveBeenCalled();

            footerTop = 0;
            const filterChanged = eventBus.emit("list-visibility-changed", { filter: "hasWatch", visible: 0, total: 1 });
            expect(http.request).toHaveBeenCalledOnce();
            controller.checkLoad();
            expect(http.request).toHaveBeenCalledOnce();
            await filterChanged;
            await vi.waitFor(() => expect(controller.loadedPage).toBe(2));

            await eventBus.emit("list-visibility-changed", { filter: "hasWatch", visible: 0, total: 2 });
            expect(http.request).toHaveBeenCalledOnce();
            await added();
            await vi.waitFor(() => expect(controller.loadedPage).toBe(3));

            footerTop = threshold;
            await eventBus.emit("list-visibility-changed", { filter: "hasWatch", visible: 1, total: 3 });
            await added();
            expect(http.request).toHaveBeenCalledTimes(2);

            footerTop = threshold - 1;
            window.dispatchEvent(new window.Event("scroll"));
            await vi.waitFor(() => expect(controller.loader.textContent).toBe("已经到底了"));
            await added();
            expect(http.request).toHaveBeenCalledTimes(3);
            expect(controller.pageItems.map(({ page }) => page)).toEqual([1, 2, 3, 4]);
        } finally {
            scope.dispose();
        }
    });

    it("keeps a failed filtered page available for manual retry", async () => {
        const html = `<div class="movie-list">${card("ABC-002", "/v/abc-002").outerHTML}</div>`;
        const { controller, eventBus, http, scope } = setup("yes", html, { filter: "hasWatch", visible: 0, total: 1 });
        http.request.mockRejectedValueOnce(new Error("page request failed"));
        try {
            await controller.mount();
            controller.checkLoad();
            await vi.waitFor(() => expect(controller.loader.textContent).toContain("点击重试"));
            await eventBus.emit("list-visibility-changed", { filter: "favorite", visible: 0, total: 1 });
            controller.checkLoad();
            expect(http.request).toHaveBeenCalledOnce();

            controller.loader.querySelector(".jhs-scroll__retry").click();
            await vi.waitFor(() => expect(controller.loader.textContent).toBe("已经到底了"));
            expect(http.request.mock.calls.map(([request]) => new URL(request.url).pathname)).toEqual(["/page/2", "/page/2"]);
        } finally {
            scope.dispose();
        }
    });

    it("rejects an in-flight page after AutoPage is switched off", async () => {
        let resolveResponse;
        const pending = new Promise((resolve) => { resolveResponse = resolve; });
        const fixture = setup("yes");
        fixture.http.request.mockImplementation(() => pending);
        await fixture.controller.mount();
        const pages = fixture.controller.pageItems, nextUrl = fixture.controller.nextUrl;
        const liveScope = fixture.controller.liveScope;
        const load = fixture.controller.loadNextPage();
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledOnce());
        fixture.settings.update("no");
        expect(liveScope.disposed).toBe(true);
        expect(fixture.http.request.mock.calls[0][1]).toBe(liveScope);
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
        await fixture.controller.loadNextPage();
        await fixture.controller.loadNextPage();
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
        await fixture.controller.loadNextPage();
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
        const load = fixture.controller.loadNextPage();
        await vi.waitFor(() => expect(fixture.http.request).toHaveBeenCalledOnce());
        fixture.settings.update("no");
        fixture.settings.update("yes");
        await vi.waitFor(() => expect(fixture.controller.loader).toBeInstanceOf(HTMLDivElement));
        rejectResponse(new Error("old request aborted"));
        await load;
        expect(fixture.controller.loader.textContent).toBe("");
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
