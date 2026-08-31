import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { Top250Controller } from "../src/features/discovery/top250-controller.js";

function loadTop250({ hitShow = null, movies = [], rankingError = null, html = '<section class="section"><div class="container"><h2 class="section-title">Top250</h2><div class="box"></div></div></section>', url = "https://javdb.com/advanced_search?handleTop=1&handleType=all&type_value=", hasCredential = false } = {}) {
    const dom = new JSDOM(html, { url }), $ = jqueryFactory(dom.window), loadingClose = vi.fn(), loading = vi.fn(() => ({ close: loadingClose }));
    const host = {
        locateListRoot: () => dom.window.document.querySelector(".movie-list"),
        getListContainer: () => dom.window.document.querySelector(".movie-list")?.parentElement ?? null,
        getListLayoutContainer: () => dom.window.document.querySelector("section .container"),
        createOwnedListRoot(classes = []) { const root = dom.window.document.createElement("div"); root.classList.add("movie-list", ...classes); return root; },
    };
    const storage = {
        getLocal: vi.fn(() => hasCredential ? "AES:fixture" : null),
        setLocal: vi.fn(),
        removeLocal: vi.fn(),
    }, movie = {
        topRankings: vi.fn(async () => {
            if (rankingError) throw rankingError;
            return { success: 1, action: "", message: "", movies };
        }),
    }, listActions = { mountOwnedRankingControls: vi.fn(async () => {}) }, show = { info: vi.fn(), error: vi.fn(), ok: vi.fn() }, dialog = { open: vi.fn(), close: vi.fn() }, account = { login: vi.fn() };
    vi.stubGlobal("$", $);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("loading", loading);
    vi.stubGlobal("show", show);
    vi.stubGlobal("clog", { error: vi.fn(), warn: vi.fn() });
    const scope = new LifecycleScope("test:top250"), discoveryApi = hitShow ? { hasHitShow: true, ...hitShow } : { hasHitShow: false }, controller = new Top250Controller({ document: dom.window.document, window: dom.window, hostAdapter: host, movie, dialog, account, storage, listActions, scope });
    controller.discoveryApi = discoveryApi;
    return { controller, $, movie, loading, loadingClose, show, dialog, listActions, dom, discoveryApi };
}

afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe("Top250Controller loading lifecycle", () => {
    it("intercepts the native premium ranking link even when the favorite tab label is absent", async () => {
        const { controller, $, dom } = loadTop250({ html: '<nav><a id="top-link" href="/rankings/top?t=y2025"><span>Top250</span></a></nav>', url: "https://javdb.com/" });
        controller.checkLogin = vi.fn();
        await controller.start({ discoveryApi: { hasHitShow: false } });
        $(dom.window.document.querySelector("#top-link")).trigger("click");
        expect(controller.checkLogin).toHaveBeenCalledOnce();
        expect(controller.checkLogin.mock.calls[0][1].get("t")).toBe("y2025");
        expect(dom.window.location.pathname).toBe("/");
    });

    it("short-circuits without creating a loading overlay when the shared ranking renderer is disabled", async () => {
        const { controller, movie, loading, show } = loadTop250();
        await expect(controller.handleTop()).resolves.toBeUndefined();
        expect(loading).not.toHaveBeenCalled();
        expect(show.info).toHaveBeenCalledWith("热播列表功能已禁用");
        expect(movie.topRankings).not.toHaveBeenCalled();
    });

    it("creates and closes exactly one loading overlay for a successful ranking render", async () => {
        const hitShow = { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) };
        const { controller, movie, loading, loadingClose, dom, discoveryApi } = loadTop250({ hitShow, movies: [{ number: "ABC-123", has_cnsub: false }] });
        movie.topRankings.mockResolvedValue({ success: 1, movies: [{ number: "ABC-123", hasSubtitle: false }] });
        controller.discoveryApi = discoveryApi;
        await expect(controller.handleTop()).resolves.toBeUndefined();
        expect(loading).toHaveBeenCalledOnce();
        expect(loadingClose).toHaveBeenCalledOnce();
        expect(movie.topRankings).toHaveBeenCalledWith(expect.objectContaining({ type: "all", typeValue: "", page: 1, limit: 50, scope: controller.scope }));
        expect(hitShow.markDataListHtml).toHaveBeenCalledOnce();
        expect(hitShow.loadScore).toHaveBeenCalledOnce();
        expect(dom.window.document.querySelector(".movie-list")).not.toBeNull();
    });

    it("mounts list action controls into the owned Top250 filter container", async () => {
        const hitShow = { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) }, { controller, movie, listActions, dom } = loadTop250({ hitShow, movies: [{ number: "ABC-123", has_cnsub: false }] });
        movie.topRankings.mockResolvedValue({ success: 1, movies: [{ number: "ABC-123", hasSubtitle: false }] });
        await controller.handleTop();
        expect(listActions.mountOwnedRankingControls).toHaveBeenCalledOnce();
        expect(listActions.mountOwnedRankingControls.mock.calls[0][0].is(".jhs-top250-filters")).toBe(true);
        expect(dom.window.document.querySelector(".jhs-top250-filters")).not.toBeNull();
    });

    it("renders on an owned ranking page without a native .movie-list node", async () => {
        const hitShow = { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) }, { controller, movie, dom } = loadTop250({ hitShow });
        movie.topRankings.mockResolvedValue({ success: 1, movies: [{ number: "ABC-123", hasSubtitle: false }] });
        await expect(controller.handleTop()).resolves.toBeUndefined();
        expect(hitShow.markDataListHtml).toHaveBeenCalledWith(expect.any(Array), { thumbnailFirst: true });
        expect(dom.window.document.querySelector(".movie-list")).not.toBeNull();
        expect(dom.window.document.querySelector(".jhs-top250-filters")).not.toBeNull();
        const children = [...dom.window.document.querySelector(".container").children].map(node => node.className);
        expect(children.indexOf("jhs-top250-filters")).toBe(children.indexOf("section-title") + 1);
        expect(children.indexOf("jhs-top250-filters")).toBeLessThan(children.indexOf("movie-list jhs-top250-list"));
        expect(children.indexOf("jhs-top250-filters")).toBeLessThan(children.indexOf("pagination"));
    });

    it("throws a clear error when neither list nor layout container exists", async () => {
        const { controller } = loadTop250({ hitShow: { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) } });
        controller.hostAdapter = { getListContainer: () => null, getListLayoutContainer: () => null, createOwnedListRoot: () => null };
        await expect(controller.handleTop()).rejects.toThrow("JavDB 列表容器不可用");
    });

    it("opens the login dialog when the stored credential is missing", async () => {
        const { controller, dialog, show } = loadTop250({ url: "https://javdb.com/" });
        controller.openLoginDialog = vi.fn();
        await controller.checkLogin(null, new URLSearchParams("t=y2025"));
        expect(show.error).toHaveBeenCalledWith("该类别依赖移动端接口，请先完成登录");
        expect(controller.openLoginDialog).toHaveBeenCalledOnce();
        expect(dialog.open).not.toHaveBeenCalled();
    });
});
