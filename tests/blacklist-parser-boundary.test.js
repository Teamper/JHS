import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadBlacklist(html, save = vi.fn(async () => {}), pageUrl = "https://javdb.com/actors/a") {
    const dom = new JSDOM(html, { url: pageUrl }), $ = jqueryFactory(dom.window);
    const gmHttp = { get: vi.fn(async () => '<div class="masonry"></div><div id="waterfall"></div>') };
    const listPage = { findCarNumAndHref: element => ({ carNum: element.attr("data-car"), url: element.attr("data-url"), publishTime: element.attr("data-date") }) };
    class BasePlugin {
        getSelector(site) { return "javbus" === site
            ? { boxSelector: ".masonry", itemSelector: ".masonry .item", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }
            : { boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }; }
        getBean(name) { return "ListPagePlugin" === name ? listPage : null; }
    }
    const context = vm.createContext({
        console, URL, Date, window: dom.window, document: dom.window.document, $, BasePlugin, storageManager: { batchSaveBlacklistCarList: save },
        T: "javdb", I: "javbus", d: "filter", r: true, l: false, o: "", _: "yes", gmHttp, clog: { error: vi.fn(), log: vi.fn() }, show: { info: vi.fn(), ok: vi.fn() }, utils: { htmlTo$dom: source => $(new JSDOM(source, { url: pageUrl }).window.document) }, i: (target, key, value) => target[key] = value
    });
    const source = [ "src/core/feature-helpers.js", "src/parsers/third-party-parsers.js", "src/plugins/blacklist/blacklist.js" ].map(file => readFileSync(join(repoRoot, file), "utf8")).join("\n");
    vm.runInContext(`${source};globalThis.Plugin=BlacklistPlugin`, context);
    return { plugin: new context.Plugin, $page: $(dom.window.document), save, gmHttp };
}

describe("blacklist parser boundaries", () => {
    it("uses the full-batch label for initial and refreshed tooltips", () => {
        const source = readFileSync(join(repoRoot, "src/plugins/blacklist/blacklist.js"), "utf8");
        expect(source).not.toContain("上次检测时间");
        expect(source.match(/上次整批检测/g)).toHaveLength(2);
    });

    it("rejects challenge, missing containers and empty pages with pagination", async () => {
        let loaded = loadBlacklist('<title>Just a moment...</title><div class="cf-chl-test"></div>');
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("challenge");
        loaded = loadBlacklist("<main>login</main>");
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("invalid");
        loaded = loadBlacklist('<div class="movie-list"></div><a class="pagination-next" href="?page=2"></a>');
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("空页面包含下一页");
    });

    it("propagates storage failures and records the maximum publication date", async () => {
        const html = '<div class="movie-list"><div class="item" data-car="A-1" data-url="/v/1" data-date="2026-08-01"></div><div class="item" data-car="A-2" data-url="/v/2" data-date="2026-09-03"></div><div class="item" data-car="A-3" data-url="/v/3" data-date="invalid"></div></div>';
        let loaded = loadBlacklist(html, vi.fn(async () => { throw new Error("write failed"); }));
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("write failed");
        loaded = loadBlacklist(html);
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).resolves.toMatchObject({ lastPublishTime: "2026-09-03" });
        expect(loaded.save).toHaveBeenCalledWith(expect.arrayContaining([ expect.objectContaining({ carNum: "A-2" }) ]));
    });

    it("uses the explicit site even when page text suggests the other site", async () => {
        let loaded = loadBlacklist('<p>javbus</p><div class="movie-list"><div class="item" data-car="DB-1" data-url="/v/1" data-date="2026-09-01"></div></div>');
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).resolves.toMatchObject({ lastPublishTime: "2026-09-01" });

        loaded = loadBlacklist('<div class="masonry"></div><div id="waterfall"><div class="item" data-car="BUS-1" data-url="/v/2" data-date="2026-09-02"></div></div>', vi.fn(async () => {}), "https://www.javbus.com/star/a");
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javbus")).resolves.toMatchObject({ lastPublishTime: "2026-09-02" });
        expect(loaded.save).toHaveBeenCalledWith(expect.arrayContaining([ expect.objectContaining({ carNum: "BUS-1" }) ]));
    });

    it("rejects an unknown explicit source site", async () => {
        const loaded = loadBlacklist('<div class="movie-list"></div>');
        await expect(loaded.plugin.parseAndSaveFilterInfo(loaded.$page, "A", "a", "unknown")).rejects.toThrow("未知黑名单来源站点");
    });

    it("keeps the explicit site through manual pagination", async () => {
        const loaded = loadBlacklist('<div class="masonry"></div><div id="waterfall"></div>', vi.fn(async () => {}), "https://www.javbus.com/star/a");
        loaded.plugin.parseAndSaveFilterInfo = vi.fn()
            .mockResolvedValueOnce({ nextPageLink: "https://www.javbus.com/star/a/2" })
            .mockResolvedValueOnce({ nextPageLink: null });
        await loaded.plugin.filterActorVideo("A", "a", loaded.$page, "javbus");
        expect(loaded.plugin.parseAndSaveFilterInfo).toHaveBeenNthCalledWith(1, loaded.$page, "A", "a", "javbus");
        expect(loaded.plugin.parseAndSaveFilterInfo).toHaveBeenNthCalledWith(2, expect.anything(), "A", "a", "javbus");
    });
});
