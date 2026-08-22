import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadStatsPlugin() {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    const listPage = { getCurrentPageSummary: vi.fn(() => ({ blockedItems: 7 })), setQuickFilter: vi.fn() };
    const newVideo = { getPendingNewVideoTotal: vi.fn(async () => 3), openDialog: vi.fn() };
    const beans = { ListPagePlugin: listPage, NewVideoPlugin: newVideo, OtherSitePlugin: { getJavDbUrl: vi.fn(async () => "https://javdb.com") } };
    class BasePlugin { getBean(name) { return beans[name]; } }
    const layer = {
        close: vi.fn(),
        open: vi.fn(options => {
            const element = $("<div></div>").html(options.content).appendTo("body");
            options.success(element, 12);
            return 12;
        })
    };
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, BasePlugin, layer, URL,
        storageManager: {
            getCarList: vi.fn(async () => [ { stateFlags: { blocked: true } }, { stateFlags: { favorite: true, downloaded: true, watched: true } }, { stateFlags: {} } ]),
            getFavoriteActressList: vi.fn(async () => [ {} ]), getBlacklist: vi.fn(async () => [ {}, {} ])
        },
        stateService: { getActivityLog: vi.fn(async () => ({ entries: [], coverageStart: null })) },
        utils: { getDialogArea: vi.fn(() => [ "1040px", "760px" ]), setupEscClose: vi.fn() },
        normalizeStateFlags: flags => ({ blocked: !!flags?.blocked, favorite: !!flags?.favorite, downloaded: !!flags?.downloaded, watched: !!flags?.watched }),
        hasAnyState: flags => Object.values(flags).some(Boolean), escapeHtml: value => String(value), r: true, l: false
    });
    const source = readFileSync(join(import.meta.dirname, "../src/plugins/stats/stats.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestStatsPlugin=StatsPlugin`, context);
    return { $, layer, listPage, newVideo, plugin: new context.TestStatsPlugin() };
}

describe("Stats scope semantics", () => {
    it("keeps full-library metrics static and only exposes scope-matched actions", async () => {
        const { $, layer, listPage, newVideo, plugin } = loadStatsPlugin();
        await plugin.openDialog();

        expect(layer.open.mock.calls[0][0].title).toBe("统计");
        const groups = $(".jhs-stats__group"), overview = groups.eq(0), currentPage = groups.eq(1);
        expect(overview.find(".jhs-stats__metric")).toHaveLength(9);
        expect(overview.find("button.jhs-stats__metric")).toHaveLength(1);
        expect(overview.find("button[data-action='new-video'] span").text()).toBe("新作品待处理");
        expect(overview.find("[data-filter]")).toHaveLength(0);
        expect(overview.find(".jhs-stats__metric").filter(((_, element) => $(element).find("span").text() === "手动屏蔽")).find("strong").text()).toBe("1");

        expect(currentPage.find("button[data-action='filter'][data-filter='blockedItems'] strong").text()).toBe("7");
        overview.find("button[data-action='new-video']").trigger("click");
        expect(newVideo.openDialog).toHaveBeenCalledOnce();
        currentPage.find("button[data-action='filter']").trigger("click");
        expect(listPage.setQuickFilter).toHaveBeenCalledWith("blockedItems");
        expect(layer.close).toHaveBeenCalledTimes(2);
    });
});
