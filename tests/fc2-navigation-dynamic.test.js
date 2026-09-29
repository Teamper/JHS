// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import jquery from "jquery";
import { JhsEventBus } from "../src/core/event-bus.js";
import { Fc2NavigationController } from "../src/features/list/fc2-navigation-controller.js";

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
    const cleanups = [];
    const observers = new Map();
    return {
        disposed: false,
        assertActive() { if (this.disposed) throw new Error("scope disposed"); },
        addCleanup: vi.fn((fn) => cleanups.push(fn)),
        observe: vi.fn((target, callback, _options) => { observers.set(target, callback); }),
        fireAddedNodes(target) { observers.get(target)?.([{ addedNodes: [document.createElement("div")] }]); },
        dispose() { this.disposed = true; cleanups.splice(0).reverse().forEach((fn) => fn()); },
    };
}

function makeFc2Mock() {
    return {
        resolveFc2Source: vi.fn(async () => ""),
        createFc2PageUrl: vi.fn((_movieId, carNum, _href, _opts) => `https://owned.example/detail/${carNum}`),
        resolveMovieIdForRecord: vi.fn(async () => "mid"),
        openFc2Dialog: vi.fn(),
        openFc2Page: vi.fn(),
        openNativeFallback: vi.fn(),
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
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $), vi.stubGlobal("clog", { warn: vi.fn(), error: vi.fn() });
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        FakeBroadcastChannel.channels = [];
        const eventBus = new JhsEventBus("fc2-navigation-test");
        const fc2 = makeFc2Mock(), scope = makeScope(), host = { locateListRoot: () => list };
        const controller = new Fc2NavigationController({ hostAdapter: host, fc2, scope, eventBus, ui: { jquery: $ } });

        await controller.start();
        expect(first.querySelector("a").href).toBe("http://localhost:3000/v/abc");
        expect(first.querySelector("a").dataset.jhsFc2Primary).toBe("true");
        expect(first.querySelectorAll("a")[1].href).toBe("http://localhost:3000/actors/actor-1");
        expect(scope.observe).toHaveBeenCalledWith(list, expect.any(Function), { childList: true, subtree: false });
        expect(scope.observe).toHaveBeenCalledWith(document.documentElement, expect.any(Function), { childList: true, subtree: true });

        // AutoPage appends a new page of cards; list-items-added triggers protection.
        const second = fc2Card("FC2-456", "/v/xyz");
        list.appendChild(second);
        await eventBus.emit("list-items-added", { items: [second] }, { broadcast: false });
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(second.querySelector("a").href).toBe("http://localhost:3000/v/xyz");
        expect(second.querySelector("a").closest(".item").getAttribute("data-jhs-fc2-protected")).toBe("true");

        // Fallback observer path (list.core disabled) also protects new cards.
        const third = fc2Card("FC2-789", "/v/zzz");
        list.appendChild(third);
        scope.fireAddedNodes(list);
        await new Promise((resolve) => setTimeout(resolve, 150));
        expect(third.querySelector("a").href).toBe("http://localhost:3000/v/zzz");

        scope.dispose();
        expect(eventBus.listeners.get("list-items-added")?.size ?? 0).toBe(0);
    });

    it("handles the whole primary anchor while leaving secondary links native", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list"), card = fc2Card("FC2-999", "/v/primary");
        list.appendChild(card);
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $), vi.stubGlobal("clog", { warn: vi.fn(), error: vi.fn() });
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        FakeBroadcastChannel.channels = [];
        const eventBus = new JhsEventBus("fc2-navigation-test");
        const fc2 = makeFc2Mock(), scope = makeScope(), host = { locateListRoot: () => list };
        const controller = new Fc2NavigationController({ hostAdapter: host, fc2, scope, eventBus, ui: { jquery: $ } });

        await controller.start();
        const primary = card.querySelector("a[data-jhs-fc2-primary]");
        primary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
        await vi.waitFor(() => expect(fc2.openFc2Dialog).toHaveBeenCalledOnce());
        primary.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true }));
        await vi.waitFor(() => expect(fc2.openFc2Page).toHaveBeenCalledOnce());
        primary.dispatchEvent(new MouseEvent("auxclick", { bubbles: true, cancelable: true, button: 1 }));
        await vi.waitFor(() => expect(fc2.openFc2Page).toHaveBeenCalledTimes(2));
        card.querySelectorAll("a")[1].dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
        expect(fc2.openFc2Dialog).toHaveBeenCalledOnce();
        expect(card.querySelectorAll("a")[1].href).toBe("http://localhost:3000/actors/actor-1");
        scope.dispose();
    });

    it("falls back to the original URL when FC2 lookup fails and does nothing without the FC2 capability", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list"), card = fc2Card("FC2-321", "/v/fallback");
        list.appendChild(card);
        const $ = jquery;
        vi.stubGlobal("$", $), vi.stubGlobal("jQuery", $), vi.stubGlobal("clog", { warn: vi.fn(), error: vi.fn() });
        globalThis.BroadcastChannel = FakeBroadcastChannel;
        const eventBus = new JhsEventBus("fc2-navigation-test");
        const fc2 = makeFc2Mock(), scope = makeScope(), host = { locateListRoot: () => list };
        const controller = new Fc2NavigationController({ hostAdapter: host, fc2, scope, eventBus, ui: { jquery: $ } });
        await controller.start();
        fc2.resolveMovieIdForRecord.mockRejectedValueOnce(new Error("lookup unavailable"));
        const primary = card.querySelector("a[data-jhs-fc2-primary]");
        const click = new MouseEvent("click", { bubbles: true, cancelable: true, button: 0, ctrlKey: true });
        primary.dispatchEvent(click);
        await vi.waitFor(() => expect(fc2.openNativeFallback).toHaveBeenCalledWith(
            "/v/fallback", "FC2-321", expect.objectContaining({ newTab: true }),
        ));
        expect(click.defaultPrevented).toBe(true);
        scope.dispose();

        const disabledScope = makeScope();
        const disabled = new Fc2NavigationController({ hostAdapter: host, fc2: null, scope: disabledScope, eventBus, ui: { jquery: $ } });
        await expect(disabled.start()).resolves.toBe(false);
        expect(card.getAttribute("data-jhs-fc2-protected")).toBe("true");
        expect(disabledScope.observe).not.toHaveBeenCalled();
    });

    it("keeps the native fallback when FC2 lookup and the global logger are unavailable", async () => {
        document.body.innerHTML = '<div class="movie-list"></div>';
        const list = document.querySelector(".movie-list"), card = fc2Card("FC2-654", "/v/native");
        list.appendChild(card);
        vi.stubGlobal("clog", undefined);
        const fc2 = makeFc2Mock(), scope = makeScope(), logger = { warn: vi.fn(), error: vi.fn(() => { throw new Error("logger unavailable"); }) };
        const controller = new Fc2NavigationController({
            hostAdapter: { locateListRoot: () => list }, fc2, scope, eventBus: null, ui: { jquery }, logger,
        });
        await controller.start();
        fc2.resolveMovieIdForRecord.mockRejectedValueOnce(new Error("lookup unavailable"));

        card.querySelector("a[data-jhs-fc2-primary]").dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, button: 0 }));
        await vi.waitFor(() => expect(fc2.openNativeFallback).toHaveBeenCalledOnce());
        expect(logger.error).toHaveBeenCalledWith("打开 FC2 详情失败，回退原始链接", expect.any(Error));
        scope.dispose();
    });
});
