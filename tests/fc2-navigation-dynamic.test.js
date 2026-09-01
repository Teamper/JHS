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
        expect(scope.observe).toHaveBeenCalledWith(list, expect.any(Function), { childList: true, subtree: false });

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
});
