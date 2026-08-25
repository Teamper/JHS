import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadMobilePlugin({ beans: beanOverrides = null, isListPage = true, isDetailPage = false } = {}) {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = isListPage, dom.window.isDetailPage = isDetailPage;
    const listPage = { activeQuickFilter: "waitCheck", setQuickFilter: vi.fn(), syncQuickFilterUi: vi.fn() }, listButtons = { openWaitCheck: vi.fn(async () => {}), sortItems: vi.fn(async () => {}) };
    const beans = beanOverrides ?? { ListPagePlugin: listPage, ListPageButtonPlugin: listButtons, NewVideoPlugin: {}, BlacklistPlugin: {}, SettingPlugin: {}, DetailPageButtonPlugin: {}, HighlightMagnetPlugin: {}, MagnetHubPlugin: {} };
    const settings = { snapshot: () => ({ sortMethod: "default" }), set: vi.fn(async () => {}) }, host = { readMovieRef: vi.fn(() => ({ carNum: "ABC-123" })) };
    class BasePlugin { getBean(name) { return beans[name]; } getRuntimeService(name) { return "host" === name ? host : settings; } }
    const labels = { all: "全部", waitCheck: "待鉴定", favorite: "收藏", hasDown: "下载", hasWatch: "已看", blockedItems: "屏蔽项", favoriteUndownloaded: "收藏未下载", favoriteUnwatched: "收藏未观看", downloadedUnwatched: "下载未观看", recent7d: "最近 7 天" };
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, BasePlugin, localStorage: dom.window.localStorage,
        PRIMARY_QUICK_FILTERS: [ "all", "waitCheck", "favorite", "hasDown", "hasWatch" ],
        SECONDARY_QUICK_FILTERS: [ "blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d" ],
        QUICK_FILTER_LABELS: labels, normalizeQuickFilterKey: value => labels[value] ? value : "waitCheck",
        r: true, l: false, m: "屏蔽", v: "收藏", y: "下载", k: "观看", normalizeStateFlags: value => value || {},
        storageManager: {}, stateService: {}, show: { info: vi.fn() }, utils: {}, clog: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, setTimeout, clearTimeout
    });
    const source = readTestFile(join(import.meta.dirname, "../src/plugins/status/mobile-bottom-bar.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestMobilePlugin=MobileBottomBarPlugin`, context);
    return { $, host, listButtons, listPage, plugin: new context.TestMobilePlugin() };
}

describe("mobile list FAB", () => {
    it("projects list actions, ten quick filters and a radio-style sort submenu", () => {
        const { plugin } = loadMobilePlugin(), menu = plugin.createMenu();
        expect(menu.find(".jhs-fab-menu-item")).toHaveLength(7);
        expect(menu.find(".jhs-mobile-filter-option")).toHaveLength(10);
        expect(menu.find('.jhs-mobile-sort-option[role="menuitemradio"]')).toHaveLength(3);
        expect(menu.find('.jhs-mobile-sort-option[aria-checked="true"]')).toHaveLength(1);
        expect(menu.find('[data-action="quickFilter"]')).toHaveLength(1);
    });

    it("renders only the logger item when every capability plugin is disabled", () => {
        const { plugin } = loadMobilePlugin({ beans: {} }), menu = plugin.createMenu();
        expect(menu.find(".jhs-fab-menu-item")).toHaveLength(1);
        expect(menu.find('[data-action="logger"]')).toHaveLength(1);
        expect(menu.find('[data-action="setting"]')).toHaveLength(0);
        expect(menu.find(".jhs-mobile-filter-menu, .jhs-mobile-sort-menu")).toHaveLength(0);
    });

    it("calls the identification API directly instead of simulating a desktop click", async () => {
        const { listButtons, plugin } = loadMobilePlugin();
        await plugin.handleAction("check");
        expect(listButtons.openWaitCheck).toHaveBeenCalledOnce();
    });

    it("reads the normalized car number from the HostAdapter", () => {
        const { host, plugin } = loadMobilePlugin();
        expect(plugin.getCarNum()).toBe("ABC-123");
        expect(host.readMovieRef).toHaveBeenCalledOnce();
    });
});

describe("mobile detail FAB", () => {
    it("projects the four status actions, magnet filter/search and subtitle when their plugins are present", () => {
        const { plugin } = loadMobilePlugin({ isListPage: false, isDetailPage: true }), menu = plugin.createMenu();
        expect(menu.find(".jhs-fab-menu-item")).toHaveLength(9);
        expect(menu.find('[data-action="filter"], [data-action="fav"], [data-action="down"], [data-action="watch"]')).toHaveLength(4);
        expect(menu.find('[data-action="magnetFilter"]')).toHaveLength(1);
        expect(menu.find('[data-action="magnet"]')).toHaveLength(1);
        expect(menu.find('[data-action="subtitle"]')).toHaveLength(1);
        expect(menu.find('[data-action="logger"], [data-action="setting"]')).toHaveLength(2);
    });

    it("renders only the logger item on a detail page when every capability plugin is disabled", () => {
        const { plugin } = loadMobilePlugin({ beans: {}, isListPage: false, isDetailPage: true }), menu = plugin.createMenu();
        expect(menu.find(".jhs-fab-menu-item")).toHaveLength(1);
        expect(menu.find('[data-action="logger"]')).toHaveLength(1);
        expect(menu.find('[data-action="setting"], [data-action="filter"], [data-action="magnetFilter"], [data-action="magnet"]')).toHaveLength(0);
    });

    it("drops the magnet filter item when HighlightMagnetPlugin is missing but keeps magnet search", () => {
        const { plugin } = loadMobilePlugin({ beans: { DetailPageButtonPlugin: {}, MagnetHubPlugin: {} }, isListPage: false, isDetailPage: true }), menu = plugin.createMenu();
        expect(menu.find('[data-action="magnetFilter"]')).toHaveLength(0);
        expect(menu.find('[data-action="magnet"]')).toHaveLength(1);
        expect(menu.find('[data-action="subtitle"]')).toHaveLength(1);
        expect(menu.find('[data-action="filter"]')).toHaveLength(1);
    });

    it("drops status dots, magnet search and subtitle when DetailPageButtonPlugin and MagnetHubPlugin are missing", () => {
        const { plugin } = loadMobilePlugin({ beans: { HighlightMagnetPlugin: {} }, isListPage: false, isDetailPage: true }), menu = plugin.createMenu();
        expect(menu.find('[data-action="filter"], [data-action="subtitle"], [data-action="magnet"]')).toHaveLength(0);
        expect(menu.find('[data-action="magnetFilter"]')).toHaveLength(1);
        expect(menu.find('[data-action="logger"]')).toHaveLength(1);
    });
});
