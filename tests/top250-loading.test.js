import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { describe, expect, it, vi } from "vitest";

function loadTop250({ hitShow = null, movies = [] } = {}) {
    const dom = new JSDOM('<section class="section"><div class="container"><h2 class="section-title">Top250</h2><div class="box"></div></div></section>', { url: "https://javdb.com/advanced_search?handleTop=1&handleType=all&type_value=" });
    const $ = jqueryFactory(dom.window), q = vi.fn(), loading = vi.fn(() => ({ close: loadingClose })), loadingClose = vi.fn();
    const host = {
        locateListRoot: () => dom.window.document.querySelector(".container"),
        getListContainer: () => dom.window.document.querySelector(".container"),
        createOwnedListRoot(classes = []) { const root = dom.window.document.createElement("div"); root.classList.add("movie-list", ...classes); return root; },
    };
    const hitShowMock = hitShow ? { markDataListHtml: vi.fn(() => ""), initializeRenderedList: vi.fn(async () => {}), loadScore: vi.fn(async () => {}) } : null;
    const context = vm.createContext({
        BasePlugin: class {
            getBean(name) { return "HitShowPlugin" === name ? hitShowMock : undefined; }
            getRuntimeService(name) { return { host, scope: async () => ({ signal: { aborted: false } }), movie: {}, settings: { snapshot: () => ({}) } }[name]; }
        },
        i: (target, key, value) => (target[key] = value), $, document: dom.window.document, window: dom.window,
        URLSearchParams, q, loading,
        show: { info: vi.fn(), error: vi.fn(), ok: vi.fn() }, clog: { error: vi.fn(), log: vi.fn(), warn: vi.fn() },
        escapeHtml: value => $("<span></span>").text(String(value ?? "")).html(),
        hasStoredEncryptedCredential: () => false, removeStoredEncryptedCredential: () => {}, storeEncryptedCredential: async () => {},
    });
    const source = readTestFile(join(process.cwd(), "src/plugins/external-search/top250.js"), "utf8");
    vm.runInContext(`${source};globalThis.Top250Plugin=Top250Plugin`, context);
    return { plugin: new context.Top250Plugin(), $, q, loading, loadingClose, show: context.show, hitShowMock, dom };
}

describe("Top250Plugin handleTop loading lifecycle", () => {
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
});
