// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from "vitest";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { Fc2CatalogController } from "../src/features/external-bridge/fc2-catalog-controller.js";

function createController({ search = "", page = 1, catalog = vi.fn(async () => ({ items: [], maxPage: 1 })) } = {}) {
    const dom = new JSDOM('<nav id="navbar-menu-hero"><a href="/tags/fc2">FC2</a></nav><section><div class="container"><h2 class="section-title">FC2</h2><div class="movie-list"><div class="item">native</div></div><nav class="pagination"></nav></div></section>', {
        url: `https://javdb.com/tags/fc2?c10=1&jhs_source=123av&keyword=${encodeURIComponent(search)}&page=${page}`,
    });
    const scope = new LifecycleScope("feature:fc2-catalog");
    const close = vi.fn(), smoothScrollToTop = vi.fn(async () => {}), notifications = { error: vi.fn() }, diagnostics = { recordError: vi.fn() };
    const jquery = jqueryFactory.fn?.jquery ? jqueryFactory : jqueryFactory(dom.window);
    const movie = { catalog, resolve: vi.fn(async () => ({ movieId: "movie-1" })) };
    const controller = new Fc2CatalogController({
        document: dom.window.document, window: dom.window, site: "javdb", route: "list",
        hostAdapter: new JavDbHostAdapter(dom.window.document, dom.window.location), movie,
        ui: { jquery, loading: vi.fn(() => ({ close })), smoothScrollToTop }, notifications, diagnostics, scope,
        processAddedItems: vi.fn(async () => {}),
    });
    return { controller, dom, catalog, scope, close, smoothScrollToTop, notifications, diagnostics, movie };
}

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

describe("FC2 123AV Feature catalog lifecycle", () => {
    for (const actorsFail of [false, true]) it(`clears summary and actors busy after ${actorsFail ? "failed" : "successful"} actor loading`, async () => {
        const { controller, dom, scope, movie } = createController();
        vi.stubGlobal("$", controller.jquery);
        let finishSummary, finishActors;
        controller.get123AvVideoInfo = vi.fn(() => new Promise(resolve => { finishSummary = resolve; }));
        controller.getActressInfo = vi.fn(() => new Promise((resolve, reject) => { finishActors = actorsFail ? reject : resolve; }));
        controller.getImgList = vi.fn(async () => []); movie.sourceUrls = vi.fn(() => []);
        const root = controller.jquery('<div><div class="jhs-fc2-summary__body"><div data-jhs-role="summary-content"></div></div><div data-jhs-role="gallery-grid"></div></div>').appendTo(dom.window.document.body);
        const context = { root, carNum: "FC2-123", source: "123av", url: "https://123av.com/video/test", isAlive: () => !scope.disposed };
        const pending = controller.loadDetail(context, context.url);
        expect(root.find('[data-jhs-role="summary-content"]').attr("aria-busy")).toBe("true");
        finishSummary({ title: "测试影片", publishDate: "2026-10-06" });
        await vi.waitFor(() => expect(root.find('[data-jhs-role="actors"]').attr("aria-busy")).toBe("true"));
        expect(root.find('[data-jhs-role="summary-content"]').attr("aria-busy")).toBe("false");
        finishActors(actorsFail ? new Error("offline") : { actors: [] }); await pending;
        expect(root.find('[data-jhs-role="actors"]').attr("aria-busy")).toBe("false");
        expect(root.text()).toContain(actorsFail ? "演员信息加载失败" : "暂无演员信息");
        scope.dispose(); dom.window.close();
    });
    it("keeps the card summary and cover when 123AV detail fails and gallery finishes", async () => {
        const { controller, dom, scope, movie } = createController();
        vi.stubGlobal("$", controller.jquery);
        let failSummary;
        controller.get123AvVideoInfo = vi.fn(() => new Promise((_resolve, reject) => { failSummary = reject; }));
        controller.getImgList = vi.fn(async () => ["https://images.example.test/scene.jpg"]);
        controller.getActressInfo = vi.fn(async () => ({ actors: [] }));
        movie.sourceUrls = vi.fn(() => []);
        const root = controller.jquery('<div><div data-jhs-role="summary-content"><h1>列表标题</h1></div><div data-jhs-role="main-preview"><img src="https://images.example.test/card.jpg"></div><div data-jhs-role="gallery-grid"></div></div>').appendTo(dom.window.document.body);
        const context = { root, carNum: "FC2-123", source: "123av", url: "https://123av.com/video/test", isAlive: () => !scope.disposed };
        const pending = controller.loadDetail(context, context.url);
        expect(root.find("h1").text()).toBe("列表标题");
        failSummary(new Error("network unavailable"));
        await pending;
        expect(root.find("h1").text()).toBe("列表标题");
        expect(root.find('[data-jhs-role="main-preview"] img').attr("src")).toBe("https://images.example.test/card.jpg");
        expect(root.find('[data-jhs-role="gallery-grid"] img')).toHaveLength(1);
        expect(root.text()).toContain("影片信息加载失败");
        scope.dispose();
        dom.window.close();
    });

    it("resets page and maxPage when searching with a new keyword", async () => {
        const { controller, dom, catalog } = createController({ search: "old", page: 8, catalog: vi.fn(async () => ({ items: [], maxPage: 20 })) });
        await controller.start();
        const input = dom.window.document.querySelector("#search-123av-keyword");
        input.value = "fc2-123";
        dom.window.document.querySelector(".jhs-btn--primary").click();
        await vi.waitFor(() => expect(catalog).toHaveBeenLastCalledWith("av123", { page: 1, keyword: "fc2-123" }, { scope: controller.scope }));
        expect(new URL(dom.window.location.href).searchParams.get("page")).toBe("1");
        expect(controller.maxPage).toBe(20);
    });

    it("clears keyword, page and maxPage when resetting the search", async () => {
        const { controller, dom, catalog } = createController({ search: "old", page: 3, catalog: vi.fn(async () => ({ items: [], maxPage: 20 })) });
        await controller.start();
        controller.currentPage = 4;
        controller.maxPage = 20;
        dom.window.document.querySelector("#search-123av-keyword").value = "old";
        dom.window.document.querySelector(".jhs-btn--secondary").click();
        await vi.waitFor(() => expect(catalog).toHaveBeenLastCalledWith("av123", { page: 1, keyword: "" }, { scope: controller.scope }));
        expect(controller.currentPage).toBe(1);
        expect(controller.maxPage).toBe(20);
        expect(new URL(dom.window.location.href).searchParams.get("keyword")).toBe("");
    });

    it("normalizes maxPage and clamps currentPage into bounds", async () => {
        const { controller } = createController({ page: 99, catalog: vi.fn(async () => ({ items: [], maxPage: 5 })) });
        await controller.start();
        expect(controller.maxPage).toBe(5);
        expect(controller.currentPage).toBe(5);
        expect(controller.paginationList.querySelector('[data-page="5"]')).not.toBeNull();
    });

    it("treats a missing maxPage as 1", async () => {
        const { controller } = createController({ page: 3, catalog: vi.fn(async () => ({ items: [], maxPage: null })) });
        await controller.start();
        expect(controller.maxPage).toBe(1);
        expect(controller.currentPage).toBe(1);
    });

    it("drops stale results and cleans all owned controls on Feature shutdown", async () => {
        let resolveFirst;
        const first = new Promise((resolve) => { resolveFirst = resolve; });
        const catalog = vi.fn().mockReturnValueOnce(first).mockResolvedValueOnce({ items: [{ url: "/m/NEW", title: "new", carNum: "FC2-2" }], maxPage: 10 });
        const { controller, dom, scope, smoothScrollToTop } = createController({ catalog });
        const startPromise = controller.start();
        await vi.waitFor(() => expect(catalog).toHaveBeenCalledTimes(1));
        const second = controller.query();
        await vi.waitFor(() => expect(catalog).toHaveBeenCalledTimes(2));
        resolveFirst({ items: [{ url: "/m/OLD", title: "old", carNum: "FC2-1" }], maxPage: 10 });
        await Promise.all([startPromise, second]);
        expect(controller.catalogRoot.textContent).toContain("new");
        expect(controller.catalogRoot.textContent).not.toContain("old");
        expect(controller.processAddedItems).toHaveBeenCalledOnce();
        expect(smoothScrollToTop).toHaveBeenCalledOnce();
        scope.dispose();
        expect(dom.window.document.querySelector("#jhs-123av-nav")).toBeNull();
        expect(dom.window.document.querySelector("#search-123av-keyword")).toBeNull();
        expect(dom.window.document.querySelector(".page-box")).toBeNull();
        expect(dom.window.document.querySelector("h2.section-title").textContent).toBe("FC2");
        expect(dom.window.document.querySelector(".movie-list:not(.jhs-123av-list) .item").textContent).toBe("native");
        expect(dom.window.document.querySelector("nav.pagination")).not.toBeNull();
    });
});
