// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { initializeEventBus } from "../src/core/event-bus.js";
import { Fc2NavigationPlugin } from "../src/features/list/list-fc2-navigation-controller.js";

class FakeBroadcastChannel {
    static channels = [];
    constructor(name) { this.name = name; this.handlers = []; FakeBroadcastChannel.channels.push(this); }
    addEventListener(type, handler) { "message" === type && this.handlers.push(handler); }
    postMessage(data) { FakeBroadcastChannel.channels.filter((channel) => channel.name === this.name).forEach((channel) => channel.handlers.forEach((handler) => handler({ data }))); }
}

function fc2Card(carNum, href) {
    const item = document.createElement("div");
    item.className = "item";
    const anchor = document.createElement("a");
    anchor.href = href;
    const title = document.createElement("div");
    title.className = "video-title";
    const strong = document.createElement("strong");
    strong.textContent = carNum;
    title.appendChild(strong);
    anchor.appendChild(title);
    item.appendChild(anchor);
    return item;
}

function makeScope() {
    let observerCallback = null;
    const cleanups = [];
    return {
        addCleanup: vi.fn((fn) => cleanups.push(fn)),
        observe: vi.fn((_target, callback, _options) => { observerCallback = callback; }),
        fireAddedNodes() { observerCallback?.([{ addedNodes: [document.createElement("div")] }]); },
        dispose() { cleanups.forEach((fn) => fn()); cleanups.length = 0; },
    };
}

function makeFc2Mock() {
    return {
        resolveFc2Source: vi.fn(async () => ""),
        createFc2PageUrl: vi.fn((_movieId, carNum, _href, _opts) => `https://owned.example/detail/${carNum}`),
        resolveMovieIdForRecord: vi.fn(async () => "mid"),
        openFc2Dialog: vi.fn(),
        openFc2Page: vi.fn(),
    };
}

describe("FC2 dynamic navigation protection", () => {
    afterEach(() => { vi.unstubAllGlobals(); document.body.innerHTML = ""; });

    it("protects cards appended after initial render via list-items-added and the observer fallback", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list");
        const first = fc2Card("FC2-123", "/v/abc");
        list.appendChild(first);
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $);
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        FakeBroadcastChannel.channels = [];
        window.isListPage = true;
        const eventBus = initializeEventBus(), fc2 = makeFc2Mock(), scope = makeScope(), host = { locateListRoot: () => list };
        const plugin = new Fc2NavigationPlugin({ hostAdapter: host, fc2, eventBus, scope, window, ui: { getJQuery: () => $, getClog: () => ({}) } });

        await plugin.handle({ scope });
        expect(first.querySelector("a").href).toBe("https://owned.example/detail/FC2-123");
        expect(scope.observe).toHaveBeenCalledWith(list, expect.any(Function), { childList: true, subtree: true });

        // AutoPage appends a new page of cards; list-items-added triggers protection.
        const second = fc2Card("FC2-456", "/v/xyz");
        list.appendChild(second);
        const bus = (await import("../src/core/event-bus.js")).jhsEventBus;
        bus.emit("list-items-added", { items: [second] }, { broadcast: false });
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(second.querySelector("a").href).toBe("https://owned.example/detail/FC2-456");
        expect(second.querySelector("a").closest(".item").getAttribute("data-jhs-fc2-protected")).toBe("true");

        // Fallback observer path (list.core disabled) also protects new cards.
        const third = fc2Card("FC2-789", "/v/zzz");
        list.appendChild(third);
        scope.fireAddedNodes();
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(third.querySelector("a").href).toBe("https://owned.example/detail/FC2-789");

        scope.dispose();
    });

    it("redirects JavDB FC2 entry links before the host login route", async () => {
        document.body.innerHTML = '<div class="movie-list"></div><a id="tag" href="/tags/fc2?c10=1">FC2</a><a id="rank" href="/rankings/movies?p=daily&amp;t=fc2">FC2</a><a id="list" href="/fc2">FC2</a>';
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $);
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        window.isListPage = true;
        const eventBus = initializeEventBus(), fc2 = makeFc2Mock(), scope = makeScope(), list = document.querySelector(".movie-list"), host = { locateListRoot: () => list };
        const plugin = new Fc2NavigationPlugin({ hostAdapter: host, fc2, eventBus, scope, window, ui: { getJQuery: () => $, getClog: () => ({}) } });

        await plugin.handle({ scope });
        for (const id of ["tag", "rank", "list"]) expect(document.querySelector(`#${id}`)?.getAttribute("href")).toBe("/advanced_search?type=3&score_min=0&d=1");
        const dynamic = document.createElement("a");
        dynamic.id = "dynamic";
        dynamic.href = "/tags/fc2?c10=2";
        dynamic.textContent = "FC2";
        document.body.appendChild(dynamic);
        scope.fireAddedNodes();
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(dynamic.getAttribute("href")).toBe("/advanced_search?type=3&score_min=0&d=1");
        scope.dispose();
        expect(document.querySelector("#list")?.getAttribute("href")).toBe("/fc2");
        expect(dynamic.getAttribute("href")).toBe("/tags/fc2?c10=2");
    });

    it("redirects FC2 entry links on non-list pages like the legacy plugin", async () => {
        document.body.innerHTML = '<a id="tag" href="/tags/fc2?c10=1">FC2</a><a id="rank" href="/rankings/movies?p=daily&amp;t=fc2">FC2</a><a id="list" href="/fc2">FC2</a>';
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $);
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        window.isListPage = false;
        const scope = makeScope(), fc2 = makeFc2Mock();
        const plugin = new Fc2NavigationPlugin({ hostAdapter: { locateListRoot: () => null }, fc2, scope, window, ui: { getJQuery: () => $, getClog: () => ({}) } });

        await plugin.handle({ scope });
        for (const id of ["tag", "rank", "list"]) expect(document.querySelector(`#${id}`)?.getAttribute("href")).toBe("/advanced_search?type=3&score_min=0&d=1");
        scope.dispose();
        expect(document.querySelector("#list")?.getAttribute("href")).toBe("/fc2");
    });

    it("leaves FC2 card toolbar actions for the card action controller", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list");
        const card = fc2Card("FC2-123", "/v/abc");
        const tools = document.createElement("div");
        tools.className = "jhs-cover-tools";
        const trigger = document.createElement("button");
        trigger.className = "jhs-card-menu-trigger";
        tools.appendChild(trigger);
        card.querySelector("a").appendChild(tools);
        list.appendChild(card);
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $);
        window.isListPage = true;
        const eventBus = initializeEventBus(), fc2 = makeFc2Mock(), scope = makeScope();
        const plugin = new Fc2NavigationPlugin({ hostAdapter: { locateListRoot: () => list }, fc2, eventBus, scope, window, ui: { getJQuery: () => $, getClog: () => ({}) } });

        await plugin.handle({ scope });
        $(trigger).trigger($.Event("click", { button: 0 }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fc2.openFc2Dialog).not.toHaveBeenCalled();
        expect(fc2.openFc2Page).not.toHaveBeenCalled();
        scope.dispose();
    });

    it("leaves FC2 card video clicks for the list media controller", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list");
        const card = fc2Card("FC2-123", "/v/abc");
        const video = document.createElement("video");
        card.querySelector("a").appendChild(video);
        list.appendChild(card);
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $);
        window.isListPage = true;
        const eventBus = initializeEventBus(), fc2 = makeFc2Mock(), scope = makeScope();
        const plugin = new Fc2NavigationPlugin({ hostAdapter: { locateListRoot: () => list }, fc2, eventBus, scope, window, ui: { getJQuery: () => $, getClog: () => ({}) } });

        await plugin.handle({ scope });
        $(video).trigger($.Event("click", { button: 0 }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(fc2.openFc2Dialog).not.toHaveBeenCalled();
        expect(fc2.openFc2Page).not.toHaveBeenCalled();
        scope.dispose();
    });
});
