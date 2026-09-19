import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";

function loadTop250({ hitShow = null, movies = [], listPageButton = null, credential = null, dialog = null, html = '<section class="section"><div class="container"><h2 class="section-title">Top250</h2><div class="box"></div></div></section>', url = "https://javdb.com/advanced_search?handleTop=1&handleType=all&type_value=" } = {}) {
    const dom = new JSDOM(html, { url });
    const $ = jqueryFactory(dom.window), q = vi.fn(), loading = vi.fn(() => ({ close: loadingClose })), loadingClose = vi.fn();
    const host = new JavDbHostAdapter(dom.window.document, dom.window.location);
    const hitShowMock = hitShow ? { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) } : null;
    const listPageButtonMock = listPageButton ?? { mountOwnedRankingControls: vi.fn(async () => {}) };
    const context = vm.createContext({
        BasePlugin: class {
            getBean(name) { return { HitShowPlugin: hitShowMock, ListPageButtonPlugin: listPageButtonMock }[name]; }
            getRuntimeService(name) { return { host, scope: async () => ({ signal: { aborted: false } }), movie: {}, settings: { snapshot: () => ({}) }, credential, dialog, account: { login: vi.fn() } }[name]; }
        },
        i: (target, key, value) => (target[key] = value), $, document: dom.window.document, window: dom.window,
        URLSearchParams, q, loading,
        show: { info: vi.fn(), error: vi.fn(), ok: vi.fn() }, clog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        escapeHtml: value => $("<span></span>").text(String(value ?? "")).html(),
        utils: { getResponsiveArea: vi.fn(() => ["360px", "auto"]) },
    });
    const source = readTestFile(join(process.cwd(), "src/plugins/external-search/top250.js"), "utf8");
    vm.runInContext(`${source};globalThis.Top250Plugin=Top250Plugin`, context);
    return { plugin: new context.Top250Plugin(), $, q, loading, loadingClose, show: context.show, hitShowMock, listPageButtonMock, dom };
}

describe("Top250Plugin handleTop loading lifecycle", () => {
    it("replaces native search results and pagination without duplicating the owned list on retry", async () => {
        const { plugin, q, $, dom } = loadTop250({ hitShow: true });
        $(".container").append('<div class="movie-list"><div class="item" id="native-result"></div></div><nav class="pagination"><a class="pagination-next" href="?page=2">Next</a></nav><aside id="host-extra">Keep</aside>');
        q.mockResolvedValue({ success: 1, data: { movies: [{ number: "TOP-001" }] } });
        await plugin.handleTop();
        await plugin.handleTop();
        expect(dom.window.document.querySelectorAll(".movie-list")).toHaveLength(1);
        expect(dom.window.document.querySelector(".movie-list").classList.contains("jhs-top250-list")).toBe(true);
        expect(dom.window.document.querySelector("#native-result")).toBeNull();
        expect(dom.window.document.querySelectorAll("nav.pagination")).toHaveLength(1);
        expect(dom.window.document.querySelector("nav.pagination .pagination-next").tagName).toBe("BUTTON");
        expect(dom.window.document.querySelectorAll(".jhs-top250-filters")).toHaveLength(1);
        expect(dom.window.document.querySelector("#host-extra")?.textContent).toBe("Keep");
    });

    it("intercepts the native premium ranking link even when the favorite tab label is absent", async () => {
        const { plugin, $, dom } = loadTop250({ html: '<nav><a id="top-link" href="/rankings/top?t=y2025"><span>Top250</span></a></nav>', url: "https://javdb.com/" });
        plugin.checkLogin = vi.fn();
        await plugin.handle();
        $(dom.window.document.querySelector("#top-link")).trigger("click");
        expect(plugin.checkLogin).toHaveBeenCalledOnce();
        expect(plugin.checkLogin.mock.calls[0][1].get("t")).toBe("y2025");
        expect(dom.window.location.pathname).toBe("/");
    });

    it("short-circuits without creating a loading overlay when HitShowPlugin is disabled", async () => {
        const { plugin, q, loading, show } = loadTop250({ hitShow: null });
        await expect(plugin.handleTop()).resolves.toBeUndefined();
        expect(loading).not.toHaveBeenCalled();
        expect(show.info).toHaveBeenCalledWith("热播列表功能已禁用");
        expect(q).not.toHaveBeenCalled();
    });

    it("creates and closes exactly one loading overlay for a successful ranking render", async () => {
        const hitShow = { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) };
        const { plugin, q, loading, loadingClose, hitShowMock, dom } = loadTop250({ hitShow, movies: [{ number: "ABC-123", has_cnsub: "0" }] });
        q.mockResolvedValue({ success: 1, data: { movies: [{ number: "ABC-123", has_cnsub: "0" }] } });
        await expect(plugin.handleTop()).resolves.toBeUndefined();
        expect(loading).toHaveBeenCalledOnce();
        expect(loadingClose).toHaveBeenCalledOnce();
        expect(q).toHaveBeenCalledOnce();
        expect(hitShowMock.markDataListHtml).toHaveBeenCalledOnce();
        expect(hitShowMock.loadScore).toHaveBeenCalledOnce();
        expect(dom.window.document.querySelector(".movie-list")).not.toBeNull();
    });

    it("mounts list action controls into the owned top250 filter container", async () => {
        const { plugin, q, listPageButtonMock, dom } = loadTop250({ hitShow: { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) }, movies: [{ number: "ABC-123", has_cnsub: "0" }] });
        q.mockResolvedValue({ success: 1, data: { movies: [{ number: "ABC-123", has_cnsub: "0" }] } });
        await plugin.handleTop();
        expect(listPageButtonMock.mountOwnedRankingControls).toHaveBeenCalledOnce();
        const target = listPageButtonMock.mountOwnedRankingControls.mock.calls[0][0];
        expect(target.is(".jhs-top250-filters")).toBe(true);
        expect(dom.window.document.querySelector(".jhs-top250-filters")).not.toBeNull();
    });

    it("renders on an owned ranking page without a native .movie-list node", async () => {
        const hitShow = { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) };
        const { plugin, q, dom, hitShowMock } = loadTop250({ hitShow });
        q.mockResolvedValue({ success: 1, data: { movies: [{ number: "ABC-123", has_cnsub: "0" }] } });
        await expect(plugin.handleTop()).resolves.toBeUndefined();
        expect(hitShowMock.markDataListHtml).toHaveBeenCalledWith(expect.any(Array), { thumbnailFirst: true });
        expect(dom.window.document.querySelector(".movie-list")).not.toBeNull();
        expect(dom.window.document.querySelector(".jhs-top250-filters")).not.toBeNull();
        // 筛选条必须紧跟标题并渲染在列表、分页之前（标题 → 筛选 → 列表 → 分页）
        const children = [...dom.window.document.querySelector(".container").children].map(node => node.className);
        expect(children.indexOf("jhs-top250-filters")).toBe(children.indexOf("section-title") + 1);
        expect(children.indexOf("jhs-top250-filters")).toBeLessThan(children.findIndex(className => className.includes("jhs-top250-list")));
        expect(children.indexOf("jhs-top250-filters")).toBeLessThan(children.indexOf("pagination"));
    });

    it("throws a clear error when neither list nor layout container exists", async () => {
        const { plugin } = loadTop250({ hitShow: { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) } });
        plugin.getRuntimeService = name => name === "host" ? { getListContainer: () => null, getListLayoutContainer: () => null, createOwnedListRoot: () => null } : {};
        await expect(plugin.handleTop()).rejects.toThrow("JavDB 列表容器不可用");
    });

    it("removes an invalid GM credential and opens one login dialog without re-entering checkLogin", async () => {
        const credential = { remove: vi.fn(async () => {}) }, dialog = { open: vi.fn(() => 1) };
        const { plugin, q, show } = loadTop250({ hitShow: { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) }, credential, dialog });
        q.mockResolvedValue({ success: 0, action: "JWTVerificationError", message: "JWT 已失效" });
        plugin.checkLogin = vi.fn();
        await plugin.handleTop();
        expect(q).toHaveBeenCalledOnce();
        expect(credential.remove).toHaveBeenCalledOnce();
        expect(dialog.open).toHaveBeenCalledOnce();
        expect(plugin.checkLogin).not.toHaveBeenCalled();
        expect(show.error).toHaveBeenCalledOnce();
    });
});
