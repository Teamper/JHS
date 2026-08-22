import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadMobilePlugin() {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = true, dom.window.isDetailPage = false;
    const listPage = { activeQuickFilter: "waitCheck", setQuickFilter: vi.fn(), syncQuickFilterUi: vi.fn() }, listButtons = { openWaitCheck: vi.fn(async () => {}), sortItems: vi.fn(async () => {}) };
    const beans = { ListPagePlugin: listPage, ListPageButtonPlugin: listButtons };
    class BasePlugin { getBean(name) { return beans[name]; } }
    const labels = { all: "全部", waitCheck: "待鉴定", favorite: "收藏", hasDown: "下载", hasWatch: "已看", blockedItems: "屏蔽项", favoriteUndownloaded: "收藏未下载", favoriteUnwatched: "收藏未观看", downloadedUnwatched: "下载未观看", recent7d: "最近 7 天" };
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, BasePlugin, localStorage: dom.window.localStorage,
        PRIMARY_QUICK_FILTERS: [ "all", "waitCheck", "favorite", "hasDown", "hasWatch" ],
        SECONDARY_QUICK_FILTERS: [ "blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d" ],
        QUICK_FILTER_LABELS: labels, normalizeQuickFilterKey: value => labels[value] ? value : "waitCheck",
        r: true, l: false, m: "屏蔽", v: "收藏", y: "下载", k: "观看", normalizeStateFlags: value => value || {},
        storageManager: {}, stateService: {}, show: { info: vi.fn() }, utils: {}, clog: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, setTimeout, clearTimeout
    });
    const source = readFileSync(join(import.meta.dirname, "../src/plugins/status/mobile-bottom-bar.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestMobilePlugin=MobileBottomBarPlugin`, context);
    return { $, listButtons, listPage, plugin: new context.TestMobilePlugin() };
}

describe("mobile list FAB", () => {
    it("keeps six list actions and projects all ten quick filters", () => {
        const { plugin } = loadMobilePlugin(), menu = plugin.createMenu();
        expect(menu.find(".jhs-fab-menu-item")).toHaveLength(6);
        expect(menu.find(".jhs-mobile-filter-option")).toHaveLength(10);
        expect(menu.find('[data-action="quickFilter"]')).toHaveLength(1);
    });

    it("calls the identification API directly instead of simulating a desktop click", async () => {
        const { listButtons, plugin } = loadMobilePlugin();
        await plugin.handleAction("check");
        expect(listButtons.openWaitCheck).toHaveBeenCalledOnce();
    });
});
