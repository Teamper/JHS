import { readTestFile } from "./helpers/read-test-file.js";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

function loadMobilePlugin({ beans: beanOverrides = null, isListPage = true, isDetailPage = false, openNewVideo = null } = {}) {
    const dom = new JSDOM("<body></body>", { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    dom.window.isListPage = isListPage, dom.window.isDetailPage = isDetailPage;
    const labels = { all: "全部", waitCheck: "待鉴定", favorite: "收藏", hasDown: "下载", hasWatch: "已看", blockedItems: "屏蔽项", favoriteUndownloaded: "收藏未下载", favoriteUnwatched: "收藏未观看", downloadedUnwatched: "下载未观看", recent7d: "最近 7 天" };
    const filterCatalog = { primary: [ "all", "waitCheck", "favorite", "hasDown", "hasWatch" ], secondary: [ "blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d" ], labels, normalize: value => labels[value] ? value : "waitCheck" };
    const listPage = { activeQuickFilter: "waitCheck", getQuickFilterCatalog: () => filterCatalog, setQuickFilter: vi.fn(), syncQuickFilterUi: vi.fn() }, listButtons = { openWaitCheck: vi.fn(async () => {}), sortItems: vi.fn(async () => {}) };
    const beans = beanOverrides ?? { ListPagePlugin: listPage, ListPageButtonPlugin: listButtons, NewVideoPlugin: {}, BlacklistPlugin: {}, SettingPlugin: {}, DetailPageButtonPlugin: {}, MagnetHubPlugin: {} };
    if (beans.ListPagePlugin && !beans.ListPagePlugin.getQuickFilterCatalog) beans.ListPagePlugin.getQuickFilterCatalog = () => filterCatalog;
    const settings = { snapshot: () => ({ sortMethod: "default" }), set: vi.fn(async () => {}) }, host = {
        readMovieRef: vi.fn(() => ({ carNum: "ABC-123" })),
        locateListRoot: vi.fn(() => dom.window.document.querySelector(".movie-list, .masonry")),
    };
    const context = vm.createContext({
        window: dom.window, document: dom.window.document, $, localStorage: dom.window.localStorage,
        PRIMARY_QUICK_FILTERS: [ "all", "waitCheck", "favorite", "hasDown", "hasWatch" ],
        SECONDARY_QUICK_FILTERS: [ "blockedItems", "favoriteUndownloaded", "favoriteUnwatched", "downloadedUnwatched", "recent7d" ],
        QUICK_FILTER_LABELS: labels, normalizeQuickFilterKey: value => labels[value] ? value : "waitCheck",
        r: true, l: false, m: "屏蔽", v: "收藏", y: "下载", k: "观看", normalizeStateFlags: value => value || {},
        storageManager: {}, stateService: {}, show: { info: vi.fn() }, utils: {}, clog: { debug: vi.fn(), warn: vi.fn(), error: vi.fn() }, setTimeout, clearTimeout
    });
    const source = readTestFile(join(import.meta.dirname, "../src/features/system/responsive-shell-controller.js"), "utf8");
    vm.runInContext(`${source};globalThis.TestMobilePlugin=ResponsiveShellController`, context);
    const plugin = new context.TestMobilePlugin({
        jquery: $, window: dom.window, document: dom.window.document,
        profile: { current: () => "compact" }, settings, host,
        state: { getState: vi.fn(async () => null) },
        logger: { debug: vi.fn(), warn: vi.fn(), error: vi.fn(), openDialog: vi.fn() },
        notifications: { error: vi.fn() }, capabilities: beans,
        openNewVideo,
    });
    if (beans.MagnetHubPlugin) plugin.attachFeatureMagnetHubAdapter(beans.MagnetHubPlugin);
    return { $, host, listButtons, listPage, plugin };
}

describe("mobile list FAB", () => {
    it("mounts and removes one scroll-safe area with the FAB", () => {
        const { $, plugin } = loadMobilePlugin();
        plugin.bindEvents = vi.fn();
        plugin.mountBottomBar();
        plugin.mountBottomBar();
        expect($("#jhs-fab")).toHaveLength(1);
        expect($("#jhs-fab-safe-area")).toHaveLength(1);
        expect($("html").hasClass("jhs-fab-mounted")).toBe(true);
        plugin.unmountBottomBar();
        expect($("#jhs-fab, #jhs-fab-safe-area")).toHaveLength(0);
        expect($("html").hasClass("jhs-fab-mounted")).toBe(false);
    });

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

    it("opens new-video through the Feature command when injected", async () => {
        const openNewVideo = vi.fn(async () => {}), legacyOpen = vi.fn();
        const { plugin } = loadMobilePlugin({ openNewVideo, beans: { NewVideoPlugin: { openDialog: legacyOpen } } });
        await plugin.handleAction("newVideo");
        expect(openNewVideo).toHaveBeenCalledOnce();
        expect(legacyOpen).not.toHaveBeenCalled();
    });

    it("adds the history entry when HistoryPlugin is available and opens it via handleAction", async () => {
        const history = { openHistory: vi.fn() };
        const { plugin } = loadMobilePlugin({ beans: { ListPagePlugin: { activeQuickFilter: "waitCheck", setQuickFilter: vi.fn(), syncQuickFilterUi: vi.fn() }, ListPageButtonPlugin: { openWaitCheck: vi.fn(async () => {}), sortItems: vi.fn(async () => {}) }, NewVideoPlugin: {}, BlacklistPlugin: {}, SettingPlugin: {}, DetailPageButtonPlugin: {}, HighlightMagnetPlugin: {}, MagnetHubPlugin: {}, HistoryPlugin: history } });
        const menu = plugin.createMenu();
        expect(menu.find(".jhs-fab-menu-item")).toHaveLength(8);
        expect(menu.find('[data-action="history"]')).toHaveLength(1);
        await plugin.handleAction("history");
        expect(history.openHistory).toHaveBeenCalledOnce();
    });

    it("reads the normalized car number from the HostAdapter", () => {
        const { host, plugin } = loadMobilePlugin();
        expect(plugin.getCarNum()).toBe("ABC-123");
        expect(host.readMovieRef).toHaveBeenCalledOnce();
    });
});

describe("mobile detail FAB", () => {
    it("projects the four status actions, magnet filter/search and subtitle when their plugins are present", () => {
        const { plugin } = loadMobilePlugin({ isListPage: false, isDetailPage: true });
        plugin.attachFeatureMagnetFilterAdapter({ doFilterMagnet() {}, showAll() {} });
        const menu = plugin.createMenu();
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

    it("shows the native filter action only when the Detail Feature capability is attached", () => {
        const { plugin } = loadMobilePlugin({ beans: { DetailPageButtonPlugin: {}, MagnetHubPlugin: {} }, isListPage: false, isDetailPage: true });
        plugin.attachFeatureMagnetFilterAdapter({ doFilterMagnet() {}, showAll() {} });
        const menu = plugin.createMenu();
        expect(menu.find('[data-action="magnetFilter"]')).toHaveLength(1);
        expect(menu.find('[data-action="magnet"]')).toHaveLength(1);
        expect(menu.find('[data-action="subtitle"]')).toHaveLength(1);
    });

    it("drops magnet filtering when there is no Feature capability but keeps other actions", () => {
        const { plugin } = loadMobilePlugin({ beans: { DetailPageButtonPlugin: {}, MagnetHubPlugin: {} }, isListPage: false, isDetailPage: true }), menu = plugin.createMenu();
        expect(menu.find('[data-action="magnetFilter"]')).toHaveLength(0);
        expect(menu.find('[data-action="magnet"]')).toHaveLength(1);
        expect(menu.find('[data-action="subtitle"]')).toHaveLength(1);
        expect(menu.find('[data-action="filter"]')).toHaveLength(1);
    });

    it("drops status dots, magnet search and subtitle when DetailPageButtonPlugin and MagnetHubPlugin are missing", () => {
        const { plugin } = loadMobilePlugin({ beans: { HighlightMagnetPlugin: {} }, isListPage: false, isDetailPage: true }), menu = plugin.createMenu();
        expect(menu.find('[data-action="filter"], [data-action="subtitle"], [data-action="magnet"]')).toHaveLength(0);
        expect(menu.find('[data-action="magnetFilter"]')).toHaveLength(0);
        expect(menu.find('[data-action="logger"]')).toHaveLength(1);
    });
});

describe("desktop commandbar restore (regular ↔ compact)", () => {
    it("parks desktop sources even when commandbar was never built (initial compact)", () => {
        const { $, plugin } = loadMobilePlugin();
        $("body").html('<div class="movie-list"></div><button type="button" id="waitCheckBtn">开始鉴定</button><button type="button" id="newVideoBtn">新作品</button><div id="jhs-quick-filter"></div><div class="jhs-sort-control"><button id="sort-toggle-btn">排序</button></div>');
        plugin.unmountDesktopCommandBar();
        expect($("#jhs-page-commandbar").length).toBe(0);
        expect($("#jhs-commandbar-parking").length).toBe(1);
        for (const selector of [ "#waitCheckBtn", "#newVideoBtn", "#jhs-quick-filter", ".jhs-sort-control" ]) {
            expect($(selector).closest("#jhs-commandbar-parking").length).toBe(1);
        }
    });

    it("restores every source control before removing the shell and keeps handlers alive", () => {
        const { $, plugin } = loadMobilePlugin();
        $("body").html('<div class="movie-list"></div><div class="jhs-list-btn-row"><button type="button" id="waitCheckBtn">开始鉴定</button><button type="button" id="newVideoBtn">新作品</button><button type="button" id="favoriteAllVideo">批量收藏</button></div><div id="jhs-quick-filter"></div><div class="jhs-sort-control"><button id="sort-toggle-btn">排序</button></div>');
        let clicked = 0;
        $("#waitCheckBtn").on("click", () => { clicked++; });
        plugin.buildCommandBar();
        expect($("#jhs-page-commandbar").length).toBe(1);
        expect($("#waitCheckBtn").closest("#jhs-page-commandbar").length).toBe(1);
        plugin.unmountDesktopCommandBar();
        expect($("#jhs-page-commandbar").length).toBe(0);
        for (const selector of [ "#waitCheckBtn", "#newVideoBtn", "#favoriteAllVideo", "#jhs-quick-filter", ".jhs-sort-control" ]) {
            expect($(selector).length).toBe(1);
        }
        // 控件进入隐藏 parking，而不是回到可见原始 row，避免 compact 下双 Surface 共存。
        expect($("#jhs-commandbar-parking").length).toBe(1);
        for (const selector of [ "#waitCheckBtn", "#newVideoBtn", "#favoriteAllVideo", "#jhs-quick-filter", ".jhs-sort-control" ]) {
            expect($(selector).closest("#jhs-commandbar-parking").length).toBe(1);
        }
        // 真实点击验证 handler 仍在。
        $("#waitCheckBtn").trigger("click");
        expect(clicked).toBe(1);
    });

    it("feature disposal restores moved controls and attributes and removes owned surfaces", () => {
        const { $, plugin } = loadMobilePlugin();
        $("body").html('<div class="movie-list"></div><div class="jhs-list-btn-row"><button type="button" id="waitCheckBtn" class="host-control">开始鉴定</button><button type="button" id="newVideoBtn">新作品</button></div><div id="jhs-quick-filter"></div>');
        const originalParent = $("#waitCheckBtn").parent()[0];
        plugin.buildCommandBar();
        plugin.mountBottomBar();
        $("#jhs-fab").trigger("click");
        expect(plugin._animationTimers.size).toBeGreaterThan(0);
        plugin.dispose();

        expect($("#waitCheckBtn").parent()[0]).toBe(originalParent);
        expect($("#waitCheckBtn").attr("class")).toBe("host-control");
        expect($("#jhs-fab, #jhs-fab-menu, #jhs-commandbar-parking, #jhs-page-commandbar")).toHaveLength(0);
        expect($("html").hasClass("jhs-fab-mounted")).toBe(false);
        expect(plugin._animationTimers.size).toBe(0);
    });

    it("restores desktop controls parked before the toolbar was ever mounted", () => {
        const { $, plugin } = loadMobilePlugin();
        $("body").html('<div class="jhs-list-btn-row"><button type="button" id="waitCheckBtn" class="host-control">开始鉴定</button><button type="button" id="newVideoBtn">新作品</button></div>');
        const originalParent = $("#waitCheckBtn").parent()[0];

        plugin.unmountDesktopCommandBar();
        expect($("#waitCheckBtn").closest("#jhs-commandbar-parking")).toHaveLength(1);
        plugin.dispose();

        expect($("#waitCheckBtn").parent()[0]).toBe(originalParent);
        expect($("#waitCheckBtn").attr("class")).toBe("host-control");
        expect($("#newVideoBtn").parent()[0]).toBe(originalParent);
        expect($("#jhs-commandbar-parking")).toHaveLength(0);
    });
});
