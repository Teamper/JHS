// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { initializeEventBus } from "../src/core/event-bus.js";
import { Fc2NavigationPlugin } from "../src/plugins/status/fc2-navigation.js";

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
    const cover = document.createElement("div");
    cover.className = "cover";
    const image = document.createElement("img");
    image.src = "/cover.jpg";
    cover.appendChild(image);
    anchor.appendChild(cover);
    anchor.appendChild(title);
    item.appendChild(anchor);
    const secondary = document.createElement("a");
    secondary.href = "/actors/actor-1";
    secondary.textContent = "Actor";
    secondary.addEventListener("click", event => event.preventDefault());
    item.appendChild(secondary);
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
        initializeEventBus();
        const fc2 = makeFc2Mock(), scope = makeScope(), host = { locateListRoot: () => list };
        const plugin = new Fc2NavigationPlugin();
        plugin.getOptionalDependency = (name) => (name === "Fc2Plugin" ? fc2 : undefined);
        plugin.getRuntimeService = (name) => (name === "host" ? host : name === "scope" ? () => scope : undefined);

        await plugin.handle();
        expect(first.querySelector("a").href).toBe("http://localhost:3000/v/abc");
        expect(first.querySelector("a").dataset.jhsFc2Primary).toBe("true");
        expect(first.querySelectorAll("a")[1].href).toBe("http://localhost:3000/actors/actor-1");
        expect(scope.observe).toHaveBeenCalledWith(list, expect.any(Function), { childList: true, subtree: false });

        // AutoPage appends a new page of cards; list-items-added triggers protection.
        const second = fc2Card("FC2-456", "/v/xyz");
        list.appendChild(second);
        const bus = (await import("../src/core/event-bus.js")).jhsEventBus;
        bus.emit("list-items-added", { items: [second] }, { broadcast: false });
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(second.querySelector("a").href).toBe("http://localhost:3000/v/xyz");
        expect(second.querySelector("a").closest(".item").getAttribute("data-jhs-fc2-protected")).toBe("true");

        // Fallback observer path (list.core disabled) also protects new cards.
        const third = fc2Card("FC2-789", "/v/zzz");
        list.appendChild(third);
        scope.fireAddedNodes();
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(third.querySelector("a").href).toBe("http://localhost:3000/v/zzz");

        scope.dispose();
    });

    it("handles the whole primary anchor while leaving secondary links native", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list"), card = fc2Card("FC2-999", "/v/primary");
        list.appendChild(card);
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $), vi.stubGlobal("utils", { openPage: vi.fn() });
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        FakeBroadcastChannel.channels = [];
        window.isListPage = true;
        initializeEventBus();
        const fc2 = makeFc2Mock(), scope = makeScope(), host = { locateListRoot: () => list };
        const plugin = new Fc2NavigationPlugin();
        plugin.getOptionalDependency = (name) => (name === "Fc2Plugin" ? fc2 : undefined);
        plugin.getRuntimeService = (name) => (name === "host" ? host : name === "scope" ? () => scope : undefined);

        await plugin.handle();
        const primary = card.querySelector("a[data-jhs-fc2-primary]");
        primary.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
        await vi.waitFor(() => expect(fc2.openFc2Dialog).toHaveBeenCalledOnce());
        primary.dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0, ctrlKey: true }));
        await vi.waitFor(() => expect(fc2.openFc2Page).toHaveBeenCalledOnce());
        primary.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, button: 1 }));
        await vi.waitFor(() => expect(fc2.openFc2Page).toHaveBeenCalledTimes(2));
        card.querySelectorAll("a")[1].dispatchEvent(new MouseEvent("click", { bubbles: true, button: 0 }));
        expect(fc2.openFc2Dialog).toHaveBeenCalledOnce();
        expect(card.querySelectorAll("a")[1].href).toBe("http://localhost:3000/actors/actor-1");
        scope.dispose();
    });
});
