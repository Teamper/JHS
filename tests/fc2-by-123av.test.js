import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadFc2123Av({ search = "", page = 1 } = {}) {
    const dom = new JSDOM('<section class="section"><div class="container"><h2 class="section-title">123Av</h2><div class="box"></div></div></section>', { url: `https://javdb.com/advanced_search?type=100&keyword=${encodeURIComponent(search)}&page=${page}` });
    const $ = jqueryFactory(dom.window), catalog = vi.fn(async () => ({ items: [], maxPage: 1 })), loadingClose = vi.fn(), setHrefParam = vi.fn();
    const host = {
        locateListRoot: () => dom.window.document.querySelector(".container"),
        getListContainer: () => dom.window.document.querySelector(".container"),
        createOwnedListRoot(classes = []) { const root = dom.window.document.createElement("div"); root.classList.add("movie-list", ...classes); return root; },
    };
    const context = vm.createContext({
        BasePlugin: class {
            getBean() { return undefined; }
            getRuntimeService(name) { return { host, scope: async () => ({}), movie: { catalog }, settings: { snapshot: () => ({ translateTitle: "_" }) }, translation: {} }[name]; }
        },
        _: "_", o: "", escapeHtml: value => $("<span></span>").text(String(value ?? "")).html(),
        renderTranslatedTitle: async () => {}, createFc2SourceLinks: () => "", renderFc2Gallery: () => {}, renderFc2State: () => {},
        $, document: dom.window.document, window: dom.window, URLSearchParams,
        loading: () => ({ close: loadingClose }), show: { info: vi.fn(), error: vi.fn(), ok: vi.fn() },
        clog: { error: vi.fn(), log: vi.fn(), warn: vi.fn(), debug: vi.fn() },
        utils: { setHrefParam, smoothScrollToTop: vi.fn(async () => {}) },
    });
    const source = readTestFile(join(process.cwd(), "src/plugins/external-search/fc2-by-123av.js"), "utf8");
    vm.runInContext(`${source};globalThis.Fc2By123AvPlugin=Fc2By123AvPlugin`, context);
    return { plugin: new context.Fc2By123AvPlugin(), $, catalog, setHrefParam, loadingClose, show: context.show, dom };
}

describe("Fc2By123AvPlugin page-state handling", () => {
    it("resets page and maxPage when searching with a new keyword", async () => {
        const { plugin, dom, catalog, setHrefParam } = loadFc2123Av({ page: 8 });
        plugin.hookPage();
        dom.window.document.querySelector("#search-123av-keyword").value = "fc2-123";
        dom.window.document.querySelector("#search-123av-btn").click();
        expect(plugin.currentPage).toBe(1);
        expect(plugin.maxPage).toBe(null);
        expect(setHrefParam).toHaveBeenCalledWith("page", 1);
        expect(setHrefParam).toHaveBeenCalledWith("keyword", "fc2-123");
        await vi.waitFor(() => expect(catalog).toHaveBeenCalledWith("av123", { page: 1, keyword: "fc2-123" }, expect.anything()));
        expect(plugin.currentPage).toBe(1);
        expect(plugin.maxPage).toBe(1);
    });

    it("clears keyword, page and maxPage when resetting the search", async () => {
        const { plugin, dom, catalog, setHrefParam } = loadFc2123Av({ search: "old", page: 3 });
        plugin.hookPage();
        dom.window.document.querySelector("#search-123av-keyword").value = "old";
        plugin.currentPage = 4, plugin.maxPage = 20;
        dom.window.document.querySelector("#clear-123av-btn").click();
        expect(plugin.keyword).toBe("");
        expect(plugin.currentPage).toBe(1);
        expect(plugin.maxPage).toBe(null);
        expect(setHrefParam).toHaveBeenCalledWith("keyword", "");
        await vi.waitFor(() => expect(catalog).toHaveBeenCalledWith("av123", { page: 1, keyword: "" }, expect.anything()));
    });

    it("normalizes maxPage and clamps currentPage into bounds", async () => {
        const { plugin, catalog } = loadFc2123Av({ page: 99 });
        catalog.mockResolvedValue({ items: [], maxPage: 5 });
        await plugin.handleQuery();
        expect(plugin.maxPage).toBe(5);
        expect(plugin.currentPage).toBe(5);
    });

    it("treats a missing maxPage as 1", async () => {
        const { plugin, catalog } = loadFc2123Av({ page: 3 });
        catalog.mockResolvedValue({ items: [], maxPage: null });
        await plugin.handleQuery();
        expect(plugin.maxPage).toBe(1);
        expect(plugin.currentPage).toBe(1);
    });

    it("drops stale results from an earlier overlapping request", async () => {
        const { plugin, catalog } = loadFc2123Av();
        plugin.hookPage();
        let resolveFirst, resolveSecond;
        const first = new Promise(resolve => { resolveFirst = resolve; }), second = new Promise(resolve => { resolveSecond = resolve; });
        catalog.mockImplementationOnce(() => first).mockImplementationOnce(() => second);
        const flush = () => new Promise(resolve => setTimeout(resolve, 0));
        const p1 = plugin.handleQuery();
        await flush();
        const p2 = plugin.handleQuery();
        await flush();
        resolveFirst({ items: [{ url: "/m/OLD", title: "old" }], maxPage: 10 });
        resolveSecond({ items: [{ url: "/m/NEW", title: "new" }], maxPage: 10 });
        await Promise.all([p1, p2]);
        expect(plugin.$listRoot.html()).toContain("NEW");
        expect(plugin.$listRoot.html()).not.toContain("OLD");
    });
});
