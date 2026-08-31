import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";
import { BlacklistController } from "../src/features/library/blacklist-controller.js";

const repoRoot = join(import.meta.dirname, "..");

function listMarkup(site, records = []) {
    if (site === "javbus") return `<div class="masonry"></div><div id="waterfall">${records.map(({ carNum, publishTime }) => `<div class="item"><a href="/v/${carNum}"></a><date>${publishTime}</date><date>${carNum}</date></div>`).join("")}</div>`;
    return `<div class="movie-list">${records.map(({ carNum, publishTime }) => `<div class="item"><a href="/v/${carNum}"></a><div class="video-title"><strong>${carNum}</strong></div><div class="meta">${publishTime}</div></div>`).join("")}</div>`;
}

function loadBlacklist(html, pageUrl = "https://javdb.com/actors/a", write = vi.fn(async () => {})) {
    const dom = new JSDOM(html, { url: pageUrl }), $ = jqueryFactory(dom.window), site = pageUrl.includes("javbus") ? "javbus" : "javdb";
    const storage = {
        get: vi.fn(async () => []),
        set: write,
    };
    const controller = new BlacklistController({
        hostAdapter: {
            site,
            document: dom.window.document,
            location: dom.window.location,
            getListSelectors: () => site === "javbus"
                ? { boxSelector: ".masonry", itemSelector: ".masonry .item", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }
                : { boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" },
        },
        storage,
        http: { request: vi.fn(async () => ({ data: listMarkup("javbus") })) },
        scope: { disposed: false, assertActive() {}, addCleanup() {} },
    });
    vi.stubGlobal("$", $);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("utils", { htmlTo$dom: source => $(new JSDOM(source, { url: pageUrl }).window.document) });
    vi.stubGlobal("clog", { error: vi.fn(), log: vi.fn(), warn: vi.fn() });
    return { controller, $page: $(dom.window.document), storage, write, http: controller.http };
}

describe("blacklist parser boundaries", () => {
    it("uses the full-batch label for initial and refreshed tooltips", () => {
        const source = readTestFile(join(repoRoot, "src/features/library/blacklist-controller.js"), "utf8");
        expect(source).not.toContain("上次检测时间");
        expect(source.match(/上次整批检测/g)).toHaveLength(2);
        expect(source).not.toMatch(/\b(?:gmHttp|localStorage)\s*\./);
    });

    it("rejects challenge, missing containers and empty pages with pagination", async () => {
        let loaded = loadBlacklist("<title>Just a moment...</title><div class=\"cf-chl-test\"></div>");
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("challenge");
        loaded = loadBlacklist("<main>login</main>");
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("invalid");
        loaded = loadBlacklist(`<div class="movie-list"></div><a class="pagination-next" href="?page=2"></a>`);
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("空页面包含下一页");
    });

    it("propagates storage failures and records the maximum publication date", async () => {
        const html = listMarkup("javdb", [ { carNum: "A-1", publishTime: "2026-08-01" }, { carNum: "A-2", publishTime: "2026-09-03" }, { carNum: "A-3", publishTime: "invalid" } ]);
        let loaded = loadBlacklist(html, "https://javdb.com/actors/a", vi.fn(async () => { throw new Error("write failed"); }));
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).rejects.toThrow("write failed");
        const write = vi.fn(async () => {});
        loaded = loadBlacklist(html, "https://javdb.com/actors/a", write);
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).resolves.toMatchObject({ lastPublishTime: "2026-09-03" });
        expect(write).toHaveBeenCalledWith("blacklist_car_list", expect.arrayContaining([ expect.objectContaining({ carNum: "A-2" }) ]));
    });

    it("uses the explicit site even when page text suggests the other site", async () => {
        let loaded = loadBlacklist(`<p>javbus</p>${listMarkup("javdb", [ { carNum: "DB-1", publishTime: "2026-09-01" } ])}`);
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javdb")).resolves.toMatchObject({ lastPublishTime: "2026-09-01" });

        loaded = loadBlacklist(listMarkup("javbus", [ { carNum: "BUS-1", publishTime: "2026-09-02" } ]), "https://www.javbus.com/star/a");
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "javbus")).resolves.toMatchObject({ lastPublishTime: "2026-09-02" });
        expect(loaded.write).toHaveBeenCalledWith("blacklist_car_list", expect.arrayContaining([ expect.objectContaining({ carNum: "BUS-1" }) ]));
    });

    it("rejects an unknown explicit source site", async () => {
        const loaded = loadBlacklist(`<div class="movie-list"></div>`);
        await expect(loaded.controller.parseAndSaveFilterInfo(loaded.$page, "A", "a", "unknown")).rejects.toThrow("未知黑名单来源站点");
    });

    it("keeps the explicit site through manual pagination", async () => {
        const loaded = loadBlacklist(listMarkup("javbus"), "https://www.javbus.com/star/a");
        loaded.controller.parseAndSaveFilterInfo = vi.fn()
            .mockResolvedValueOnce({ nextPageLink: "https://www.javbus.com/star/a/2", recordCount: 0 })
            .mockResolvedValueOnce({ nextPageLink: null, recordCount: 0 });
        await loaded.controller.filterActorVideo("A", "a", loaded.$page, "javbus");
        expect(loaded.http.request).toHaveBeenCalledWith(expect.objectContaining({ url: "https://www.javbus.com/star/a/2" }), loaded.controller.scope);
        expect(loaded.controller.parseAndSaveFilterInfo).toHaveBeenNthCalledWith(1, loaded.$page, "A", "a", "javbus");
        expect(loaded.controller.parseAndSaveFilterInfo).toHaveBeenNthCalledWith(2, expect.anything(), "A", "a", "javbus");
    });
});
