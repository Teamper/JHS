// @vitest-environment jsdom
import jquery from "jquery";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { MediaLibraryController } from "../src/features/library/media-library-controller.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

let controller, scope, service, observers, settings;
beforeEach(async () => {
    document.body.innerHTML = '<main><div class="movie-list"><div class="item" data-jhs-flags=\'{"favorite":true}\'><a href="/v/a" title="ABC-123 标题"><div class="video-title"><strong>ABC-123</strong> 标题</div></a></div><div class="item"><a href="/v/b"><div class="video-title"><strong>ABC-124</strong> 相邻影片</div></a></div></div></main>';
    scope = new LifecycleScope("test:media");
    observers = [];
    window.IntersectionObserver = class {
        constructor(callback) { this.callback = callback; this.nodes = new Set(); observers.push(this); }
        observe(node) { this.nodes.add(node); }
        unobserve(node) { this.nodes.delete(node); }
        disconnect() { this.nodes.clear(); }
        intersect(node) { this.callback([{ target: node, isIntersecting: true }]); }
    };
    service = Object.assign(new EventTarget(), {
        initialize: vi.fn(async () => {}), enabled: () => true, listConnections: () => [],
        peek: () => ({ status: "unknown", hits: [], servers: [] }), invalidate: () => service.dispatchEvent(new Event("media.changed")),
        queryMovie: vi.fn(async (movie, options) => {
            const result = { status: movie.carNum === "ABC-123" ? "present" : "absent", hits: [], servers: [] };
            options.onUpdate(result);
            return result;
        }),
    });
    settings = new EventTarget();
    const host = { document, getListSelectors: () => ({ itemSelector: ".movie-list .item" }), locateListRoot: () => document.querySelector(".movie-list"), readMovieRef: () => null, locateMediaLibraryDetailRoot: () => null };
    controller = new MediaLibraryController({ host, service, scope, settings, dialog: {}, ui: { jquery } });
    await controller.start();
});
afterEach(() => scope.dispose());
it("queues cards only when they become visible", async () => {
    expect(service.queryMovie).not.toHaveBeenCalled();
    observers[0].intersect(document.querySelector(".item"));
    await vi.waitFor(() => expect(service.queryMovie).toHaveBeenCalledOnce());
    expect(service.queryMovie.mock.calls[0][0].carNum).toBe("ABC-123");
    expect(document.querySelector(".jhs-media-badge").textContent).toContain("已入库");
});
it("filters independently of state flags and keeps unqueried results unknown", async () => {
    observers[0].intersect(document.querySelector(".item"));
    await Promise.resolve();
    const filter = document.querySelector(".jhs-media-filter");
    [...filter.querySelectorAll("button")].find(node => node.textContent === "结果未知").click();
    const cards = [...document.querySelectorAll(".item")];
    expect(cards[0].hasAttribute("data-jhs-media-filtered")).toBe(true);
    expect(cards[1].hasAttribute("data-jhs-media-filtered")).toBe(false);
    expect(JSON.parse(cards[0].getAttribute("data-jhs-flags"))).toEqual({ favorite: true });
});
it("refreshes previously queried cards even when the current filter hides unknown results", async () => {
    observers[0].intersect(document.querySelector(".item"));
    await vi.waitFor(() => expect(service.queryMovie).toHaveBeenCalledOnce());
    [...document.querySelectorAll(".jhs-media-filter button")].find(node => node.textContent === "已入库").click();
    document.querySelector(".jhs-media-badge button:last-child").click();
    await vi.waitFor(() => expect(service.queryMovie).toHaveBeenCalledTimes(2));
    expect(controller.filter).toBe("present");
    expect(document.querySelector(".item").hasAttribute("data-jhs-media-filtered")).toBe(false);
});
it("owns added cards, removed consumers and disabled-feature cleanup", async () => {
    const node = document.querySelector(".item").cloneNode(true);
    node.querySelector(".jhs-media-badge").remove();
    document.querySelector(".movie-list").append(node);
    await vi.waitFor(() => expect(controller.cards.size).toBe(3));
    observers[0].intersect(node);
    const entry = controller.cards.get(node);
    node.remove();
    await vi.waitFor(() => expect(entry.scope.disposed).toBe(true));
    service.enabled = () => false;
    service.dispatchEvent(new Event("media.changed"));
    await vi.waitFor(() => expect(document.querySelector(".jhs-media-badge")).toBeNull());
    expect(observers[0].nodes.size).toBe(0);
    expect(document.querySelector(".jhs-media-filter")).toBeNull();
});
it("ignores late results after the card owner closes", async () => {
    let update;
    service.queryMovie.mockImplementation(async (_movie, options) => { update = options.onUpdate; return new Promise(() => {}); });
    const node = document.querySelector(".item");
    observers[0].intersect(node);
    const card = controller.cards.get(node);
    card.scope.dispose();
    update({ status: "present", servers: [], hits: [] });
    expect(card.view.root.isConnected).toBe(false);
});
it("uses the same movie query for an owned FC2 workspace and cancels its consumer on close", async () => {
    const root = document.createElement("div");
    root.dataset.jhsMovieCode = "FC2-1234567";
    root.innerHTML = '<div class="jhs-fc2-toolbar"></div>';
    document.body.append(root);
    await vi.waitFor(() => expect(service.queryMovie).toHaveBeenCalledWith({ carNum: "FC2-1234567" }, expect.objectContaining({ scope: expect.any(LifecycleScope) })));
    expect(root.querySelector(".jhs-fc2-toolbar .jhs-media-badge")).not.toBeNull();
    const scope = controller.cards.get(root).scope;
    root.remove();
    await vi.waitFor(() => expect(scope.disposed).toBe(true));
});
it("releases dialog ownership without re-entering an already completed close", () => {
    let options;
    controller.dialog = { open: vi.fn(value => { options = value; return 1; }), close: vi.fn(() => options.end()) };
    controller.openHits({ hits: [{ url: "https://media.example/web/#/details?id=a", serverName: "家庭媒体库", name: "ABC-123", path: "/ABC-123.mp4" }] });
    controller.dialog.close(1);
    expect(controller.dialog.close).toHaveBeenCalledOnce();
    expect(document.querySelector(".jhs-media-connections")).toBeNull();
});
it("allows configuration to reopen after a dialog mounting failure", () => {
    controller.dialog = { open: vi.fn(() => { throw new Error("mount failed"); }), close: vi.fn() };
    service.testConnection = vi.fn();
    expect(() => controller.configure()).toThrow("mount failed");
    expect(controller.configScope.disposed).toBe(true);
    expect(document.querySelector(".jhs-media-connections")).toBeNull();
    controller.dialog.open.mockReturnValue(1);
    controller.configure();
    expect(document.querySelector(".jhs-media-connections")).not.toBeNull();
});
