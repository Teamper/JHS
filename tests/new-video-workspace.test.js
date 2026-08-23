import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function normalizeCarNum(value) {
    const normalized = String(value || "").trim().toUpperCase().replace(/[_\s]+/g, "-");
    return normalized;
}

function createHarness() {
    const dom = new JSDOM(`<body><div class="newVideoToolBox"><select id="paramActressType"><option value="all" selected>all</option></select><select id="paramSortBy"><option value="default" selected>default</option></select><select id="nvCategoryFilter"><option value="all" selected>all</option></select><select id="nvStateFilter"><option value="pending" selected>pending</option></select><select id="nvDecisionFilter"><option value="pending" selected>pending</option></select><select id="nvSortBy"><option value="publishTime_desc" selected>sort</option></select><input id="nvSearch"><div id="actress-card-container"></div><div id="actress-pagination"></div><div id="new-video-list-container"></div><div id="new-video-list-footer"></div><div id="jhs-task-status-list"></div></div></body>`, { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    const actresses = [{ name: "Alice", starId: "alice", actressType: "censored", newVideoList: [{ carNum: "abc_001", title: "One", publishTime: "2026-08-01" }, { carNum: "ABC-002", title: "Two", publishTime: "2026-08-02" }] }];
    const storageManager = {
        getFavoriteActressList: vi.fn(async () => actresses),
        getCarMap: vi.fn(async () => new Map),
        getSetting: vi.fn(async () => 8760)
    };
    const stateService = { getNewVideoDecisions: vi.fn(async () => ({})) };
    const beans = {
        OtherSitePlugin: { getJavDbUrl: vi.fn(async () => "https://javdb.com") },
        TaskPlugin: { getTaskStatusSnapshot: vi.fn(() => ({ state: "idle", completedAt: null, nextAt: null })) }
    };
    class BasePlugin { getBean(name) { return beans[name]; } }
    class ImageHoverPreview { bindEvents() {} }
    const renderStateView = (container, options) => (container.empty().append($("<div></div>").text(options.title || "")), container);
    const context = vm.createContext({
        console, Date, URL, Object, Array, Map, Set, Promise, Number, String, Math,
        window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
        $, BasePlugin, ImageHoverPreview, storageManager, stateService, renderStateView,
        i: (target, key, value) => target[key] = value,
        normalizeCarNum,
        normalizeHttpUrl: (value, base = dom.window.location.href) => { try { const url = new URL(String(value), base); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } },
        normalizeStateFlags: flags => ({ favorite: !!flags?.favorite, downloaded: !!flags?.downloaded, watched: !!flags?.watched, blocked: !!flags?.blocked }),
        hasAnyState: flags => Object.values(flags).some(Boolean),
        parseNumberSetting: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
        mapLimit: async (items, limit, worker) => Promise.all(items.map(worker)),
        escapeHtml: value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]),
        utils: { genericSort: items => [...items], htmlTo$dom: html => $(new JSDOM(html).window.document), q: vi.fn() },
        gmHttp: { get: vi.fn() }, JhsSelect: { setValue: vi.fn() },
        show: { info: vi.fn(), ok: vi.fn(), error: vi.fn() }, clog: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
        jhsEventBus: { on: vi.fn() }, setTimeout, clearTimeout, fetch: vi.fn(), indexedDB: {}, loading: vi.fn(),
        shouldSkipStopped: () => false,
        T: "javdb", I: "javbus", D: "filter", A: "uncensored", _: "yes", l: false
    });
    context.globalThis = context;
    const source = readFileSync(join(repoRoot, "src/plugins/new-video/new-video.js"), "utf8"), start = source.indexOf("function aggregateNewVideoRecords");
    vm.runInContext(`${source.slice(start)};globalThis.TestPlugin=NewVideoPlugin`, context);
    const plugin = new context.TestPlugin;
    plugin.nvWorkspaceMounted = true, plugin._viewMode = "list";
    return { plugin, $, actresses, storageManager, stateService, beans };
}

afterEach(() => vi.useRealTimers());

describe("new video workspace snapshot", () => {
    it("reads each source once and keeps view-only filtering in memory", async () => {
        const harness = createHarness();
        harness.plugin.renderCurrentView = vi.fn(async () => {}), harness.plugin.renderTaskStatuses = vi.fn();
        await harness.plugin.reloadNewVideoWorkspaceData();
        expect(harness.storageManager.getFavoriteActressList).toHaveBeenCalledOnce();
        expect(harness.storageManager.getCarMap).toHaveBeenCalledOnce();
        expect(harness.stateService.getNewVideoDecisions).toHaveBeenCalledOnce();
        expect(harness.plugin.nvAllItemsMap.has("ABC-001")).toBe(true);
        harness.$("#nvSearch").val("two");
        const filtered = await harness.plugin.getNewVideoFlatList();
        expect(filtered.map(item => item.carNum)).toEqual(["ABC-002"]);
        expect(harness.storageManager.getFavoriteActressList).toHaveBeenCalledOnce();
        expect(harness.storageManager.getCarMap).toHaveBeenCalledOnce();
    });

    it("coalesces invalidations and clears only successfully processed selection", async () => {
        vi.useFakeTimers();
        const { plugin } = createHarness();
        plugin.showNewVideoCount = vi.fn(async () => {}), plugin.reloadNewVideoWorkspaceData = vi.fn(async () => {});
        plugin.scheduleWorkspaceReload(), plugin.scheduleWorkspaceReload(), plugin.scheduleWorkspaceReload();
        await vi.runAllTimersAsync();
        expect(plugin.showNewVideoCount).toHaveBeenCalledOnce();
        expect(plugin.reloadNewVideoWorkspaceData).toHaveBeenCalledOnce();
        plugin.nvSelected = new Set(["ABC-001", "ABC-002", "ABC-003"]), plugin.renderBatchBar = vi.fn();
        plugin.applyProcessedSelection({ changed: ["abc_001", "ABC-002"] });
        expect([...plugin.nvSelected]).toEqual(["ABC-003"]);
    });

    it("hydrates only visible actors, deduplicates them, and rejects stale commits", async () => {
        const { plugin } = createHarness(), covers = new Map([["ABC-001", { coverUrl: "https://img/1.jpg" }], ["ABC-002", { coverUrl: "https://img/2.jpg" }]]);
        plugin.getActorCoverRequest = vi.fn(async () => covers);
        await plugin.hydrateVisibleCovers([{ carNum: "ABC-001", starId: "alice" }, { carNum: "ABC-002", starId: "alice" }], plugin.nvRenderGeneration);
        expect(plugin.getActorCoverRequest).toHaveBeenCalledOnce();
        expect(plugin.nvCoverCache.size).toBe(2);
        plugin.nvCoverCache = new Map, plugin.nvRenderGeneration++;
        await plugin.hydrateVisibleCovers([{ carNum: "ABC-001", starId: "alice" }], plugin.nvRenderGeneration - 1);
        expect(plugin.nvCoverCache.size).toBe(0);
    });

    it("renders and hydrates the current page without invalidating covers on checkbox changes", () => {
        const { plugin, $ } = createHarness();
        plugin.nvPageSize = 2, plugin.nvFlatListCache = Array.from({ length: 5 }, (_, index) => ({ carNum: `ABC-00${index + 1}`, actressName: "Alice", actresses: ["Alice"], starId: "alice", flags: {}, decisionState: "pending" }));
        plugin.hydrateVisibleCovers = vi.fn(async () => {}), plugin.renderBatchBar = vi.fn();
        const generation = plugin.nvRenderGeneration;
        plugin.nvRenderPage(generation);
        expect(plugin.hydrateVisibleCovers).toHaveBeenCalledWith(expect.arrayContaining([expect.objectContaining({ carNum: "ABC-001" }), expect.objectContaining({ carNum: "ABC-002" })]), generation);
        expect(plugin.hydrateVisibleCovers.mock.calls[0][0]).toHaveLength(2);
        $(".nv-select").first().prop("checked", true).trigger("change");
        expect(plugin.nvRenderGeneration).toBe(generation);
    });

    it("renders imported actress fields through DOM setters and normalized URLs", async () => {
        const { plugin, $ } = createHarness();
        plugin._viewMode = "actress", plugin.nvJavDbUrl = "https://javdb.com", plugin.nvActressesCache = [{ starId: 'a\" onmouseover=\"alert(1)', name: '<img id="injected">', allName: ['Alias\" title=\"bad'], avatar: "javascript:alert(1)", newVideoList: [], lastPublishTime: '2026\" bad' }];
        plugin.getPendingNewVideoCount = () => 0, plugin.renderPagination = vi.fn();
        await plugin.renderActressCards();
        expect($("#injected")).toHaveLength(0);
        expect($(".actress-card-name").text()).toBe('<img id="injected">');
        expect($(".actress-card__profile").attr("href")).toContain("a%22%20onmouseover%3D%22alert(1)");
        expect($(".actress-card-avatar").attr("src")).toBe("https://c0.jdbstatic.com/images/actor_unknow.jpg");
    });
});
