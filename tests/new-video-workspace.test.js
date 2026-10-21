import { OwnedPopover } from "../src/core/owned-popover.js";
import { renderTaskStatus, taskStatusView } from "../src/core/task-status-view.js";
import { formatUiDateTime } from "../src/core/ui-date-time.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { dismissActiveTooltip } from "../src/core/tooltip-controller.js";
import { PRODUCT_NAMES } from "../src/core/product-names.js";
import { readTestFile } from "./helpers/read-test-file.js";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { NewVideoWorkspaceController } from "../src/features/discovery/new-video-workspace-controller.js";
import { FEATURE_ICONS } from "../src/core/feature-icons.js";
import { getIcon } from "../src/core/icons.js";

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
    const stateService = {
        getNewVideoDecisions: vi.fn(async () => ({})),
        getFavoriteActressList: vi.fn(() => storageManager.getFavoriteActressList()),
        getCarMap: vi.fn(() => storageManager.getCarMap()),
    };
    const beans = {
        OtherSitePlugin: { getJavDbUrl: vi.fn(async () => "https://javdb.com") },
        TaskPlugin: { getTaskStatusSnapshot: vi.fn(() => ({ state: "idle", completedAt: null, nextAt: null })) }
    };
    const runtimeServices = {
        profile: Object.assign(new dom.window.EventTarget(), { current: () => "wide" }),
        actressInfo: { placeholderUrl: vi.fn(() => "https://c0.jdbstatic.com/images/actor_unknow.jpg"), getAvatarSources: vi.fn(() => []) },
        storage: { getLocal: vi.fn(() => null), setLocal: vi.fn() },
        state: stateService,
        movie: { externalSiteOrigin: vi.fn(() => "https://javdb.com") },
    };
    class BasePlugin { getBean(name) { return beans[name]; } getRuntimeService(name) { return runtimeServices[name]; } }
    class ImageHoverPreview { constructor() {} bindEvents() {} destroy() {} }
    dom.window.ImageHoverPreview = ImageHoverPreview;
    const renderStateView = (container, options) => (container.empty().append($("<div></div>").text(options.title || "")), container);
    const context = vm.createContext({
        OwnedPopover, renderTaskStatus, taskStatusView, formatUiDateTime, LifecycleScope, dismissActiveTooltip, PRODUCT_NAMES, console, Date, URL, Object, Array, Map, Set, Promise, Number, String, Math, FEATURE_ICONS, getIcon,
        window: dom.window, document: dom.window.document, localStorage: dom.window.localStorage,
        $, BasePlugin, ImageHoverPreview, storageManager, stateService, renderStateView,
        JHS_Z_INDEX: { dialogHoverPreview: 999999992 },
        i: (target, key, value) => target[key] = value,
        normalizeCarNum,
        normalizeHttpUrl: (value, base = dom.window.location.href) => { try { const url = new URL(String(value), base); return ["http:", "https:"].includes(url.protocol) ? url.href : null; } catch { return null; } },
        normalizeStateFlags: flags => ({ favorite: !!flags?.favorite, downloaded: !!flags?.downloaded, watched: !!flags?.watched, blocked: !!flags?.blocked }),
        hasAnyState: flags => Object.values(flags).some(Boolean),
        parseNumberSetting: (value, fallback) => Number.isFinite(Number(value)) ? Number(value) : fallback,
        mapLimit: async (items, limit, worker) => Promise.all(items.map(worker)),
        escapeHtml: value => String(value ?? "").replace(/[&<>"']/g, character => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]),
        utils: { genericSort: items => [...items], htmlTo$dom: html => $(new JSDOM(html).window.document), q: vi.fn() },
        gmHttp: { get: vi.fn() }, JhsSelect: { setValue: vi.fn(), setVisible: vi.fn(), enhance: vi.fn() },
        show: { info: vi.fn(), ok: vi.fn(), error: vi.fn() }, clog: { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() },
        jhsEventBus: { on: vi.fn() }, setTimeout, clearTimeout, fetch: vi.fn(), indexedDB: {}, loading: vi.fn(),
        shouldSkipStopped: () => false,
        T: "javdb", I: "javbus", D: "filter", A: "uncensored", _: "yes", l: false
    });
    context.globalThis = context;
    const source = readTestFile(join(repoRoot, "src/plugins/new-video/new-video.js"), "utf8"), start = source.indexOf("class NewVideoWorkspaceService");
    vm.runInContext(`${source.slice(start)};globalThis.TestPlugin=NewVideoWorkspaceService`, context);
    const plugin = new context.TestPlugin({ runtimeServices: { ...runtimeServices, settings:{snapshot:()=>({})}, state: stateService, scope: () => Promise.resolve({ assertActive() {}, disposed: false }) }, resolveDependency: name => beans[name], jquery: $, legacyStorage: storageManager, utilities: context.utils, notifications: context.show, logger: context.clog, events: context.jhsEventBus, createImageHoverPreview: config => new dom.window.ImageHoverPreview(config), document: dom.window.document, window: dom.window });
    plugin.nvWorkspaceMounted = true, plugin._viewMode = "list";
    plugin.featureNewVideoWorkspaceController = new NewVideoWorkspaceController({
        state: stateService,
        settings: { snapshot: () => ({ checkNewVideo_ruleTime: 8760 }) },
        movie: runtimeServices.movie,
    });
    return { plugin, $, actresses, storageManager, stateService, beans, runtimeServices, dom, context };
}

afterEach(() => vi.useRealTimers());

describe("new video workspace snapshot", () => {
    it("accepts the initial snapshot after a filter changes while it is loading", async () => {
        const { plugin, $, dom } = createHarness();
        const snapshot = await plugin.featureNewVideoWorkspaceController.loadWorkspace();
        snapshot.items[0].isVr = true;
        let finish;
        plugin.featureNewVideoWorkspaceController.loadWorkspace = vi.fn(() => new Promise(resolve => finish = resolve));
        plugin.utils.debounce = fn => Object.assign(fn, { cancel() {} });
        plugin.hydrateVisibleCovers = vi.fn();
        $("#nvCategoryFilter").append('<option value="vr">VR</option>');
        plugin.bindClick();
        const pending = plugin.reloadNewVideoWorkspaceData();
        $("#nvCategoryFilter").val("vr").trigger("change");
        await Promise.resolve();
        expect($("#new-video-list-container").text()).toContain("加载中");
        finish(snapshot); await pending;
        expect(plugin.nvAllItemsMap.size).toBe(2);
        expect($("#nv-grid .nv-card")).toHaveLength(1);
        expect($("#nvCategoryFilter").val()).toBe("vr");
        dom.window.close();
    });

    it("keeps current-page selection available to append another page and retains its focus", async () => {
        const { plugin, $, dom } = createHarness();
        plugin.nvPageSize = 1; plugin.hydrateVisibleCovers = vi.fn();
        await plugin.reloadNewVideoWorkspaceData(); plugin.bindBatchActions();
        $("#nvSelectPage").trigger("focus").trigger("click");
        expect($("#nvSelectPage")).toHaveLength(1);
        expect(dom.window.document.activeElement.id).toBe("nvSelectPage");
        const first = [...plugin.nvSelected];
        plugin.nvCurrentPage = 2; plugin.nvRenderPage(); plugin.renderBatchBar();
        $("#nvSelectPage").trigger("click").trigger("click");
        expect(plugin.nvSelected.size).toBe(2);
        expect([...plugin.nvSelected]).toEqual(expect.arrayContaining(first));
        $("#nvClearSelection").trigger("focus").trigger("click");
        expect(plugin.nvSelected.size).toBe(0);
        expect($("#nvSelectPage")).toHaveLength(1);
        expect(dom.window.document.activeElement.id).toBe("nvSelectPage");
        dom.window.close();
    });

    it.each(["state", "decision", "search", "sort", "view"])("uses the latest %s after a pending workspace load", async action => {
        const { plugin, $, dom } = createHarness(), snapshot = await plugin.featureNewVideoWorkspaceController.loadWorkspace();
        let finish;
        plugin.featureNewVideoWorkspaceController.loadWorkspace = vi.fn(() => new Promise(resolve => finish = resolve));
        plugin.utils.debounce = fn => Object.assign(fn, { cancel() {} });
        plugin.hydrateVisibleCovers = vi.fn(); plugin.bindClick();
        const pending = plugin.reloadNewVideoWorkspaceData();
        if (action === "state") { snapshot.items[0].flags.favorite = true; $("#nvStateFilter").append('<option value="favorite">收藏</option>').val("favorite").trigger("change"); }
        if (action === "decision") { snapshot.items[0].decisionState = "ignored"; $("#nvDecisionFilter").append('<option value="ignored">已忽略</option>').val("ignored").trigger("change"); }
        if (action === "search") $("#nvSearch").val(snapshot.items[0].carNum).trigger("input");
        if (action === "sort") $("#nvSortBy").append('<option value="publishTime_asc">发行升序</option>').val("publishTime_asc").trigger("change");
        if (action === "view") plugin.setViewMode("actress");
        await Promise.resolve();
        expect($(action === "view" ? "#actress-card-container" : "#new-video-list-container").text()).toContain("加载中");
        finish(snapshot); await pending;
        expect(plugin.nvAllItemsMap.size).toBe(2);
        if (action === "view") expect($(".actress-card")).toHaveLength(1);
        else expect($("#nv-grid .nv-card")).toHaveLength(action === "sort" ? 2 : 1);
        if (action === "sort") expect(plugin.nvSortBy).toBe("publishTime_asc");
        expect(plugin.nvWorkspaceLoading).toBe(false);
        dom.window.close();
    });

    it.each(["older-first", "newer-first", "reopen"])("ignores obsolete workspace loads without clearing a newer loading state (%s)", async order => {
        const { plugin, $, dom } = createHarness(), snapshot = await plugin.featureNewVideoWorkspaceController.loadWorkspace(), completions = [];
        plugin.featureNewVideoWorkspaceController.loadWorkspace = vi.fn(() => new Promise(resolve => completions.push(resolve)));
        plugin.hydrateVisibleCovers = vi.fn();
        const first = plugin.reloadNewVideoWorkspaceData();
        if (order === "reopen") { plugin.cleanupNewVideoWorkspace(); plugin.nvWorkspaceMounted = true; }
        const second = plugin.reloadNewVideoWorkspaceData();
        if (order === "older-first") {
            completions[0]({ ...snapshot, items: [] }); await first;
            expect(plugin.nvWorkspaceLoading).toBe(true);
            expect($("#new-video-list-container").attr("aria-busy")).toBe("true");
        }
        completions[1](snapshot); await second;
        if (order !== "older-first") { completions[0]({ ...snapshot, items: [] }); await first; }
        expect(plugin.nvAllItemsMap.size).toBe(2);
        expect($("#nv-grid .nv-card")).toHaveLength(2);
        expect(plugin.nvWorkspaceLoading).toBe(false);
        dom.window.close();
    });

    it("shows a loading error in the current view and permits a filtered retry", async () => {
        const { plugin, $, dom } = createHarness(), snapshot = await plugin.featureNewVideoWorkspaceController.loadWorkspace();
        let reject;
        plugin.featureNewVideoWorkspaceController.loadWorkspace = vi.fn(() => new Promise((_resolve, fail) => reject = fail));
        const pending = plugin.reloadNewVideoWorkspaceData();
        plugin.setViewMode("actress"); reject(new Error("fixture failure")); await pending;
        expect($("#actress-card-container").text()).toBe("加载失败");
        expect(plugin.nvWorkspaceLoading).toBe(false);
        plugin._viewMode = "list"; $("#nvSearch").val(snapshot.items[0].carNum);
        plugin.featureNewVideoWorkspaceController.loadWorkspace.mockResolvedValueOnce(snapshot); plugin.hydrateVisibleCovers = vi.fn();
        await plugin.reloadNewVideoWorkspaceData({ preservePage: true });
        expect($("#nv-grid .nv-card")).toHaveLength(1);
        dom.window.close();
    });

    it("owns Escape and settings listeners before loading and rejects an old dialog completion", async () => {
        const { plugin, $ } = createHarness(), listeners = new Set(), completions = [];
        plugin.runtimeServices.settings = {
            addEventListener: vi.fn((_name, listener) => listeners.add(listener)),
            removeEventListener: vi.fn((_name, listener) => listeners.delete(listener)),
        };
        plugin.runtimeServices.dialog = { open: vi.fn(() => plugin.runtimeServices.dialog.open.mock.calls.length) };
        plugin.utils.getDialogArea = () => ["600px", "500px"];
        plugin.utils.setupEscClose = vi.fn();
        plugin.utils.releaseEscClose = vi.fn();
        plugin.getTaskButtonTips = vi.fn(async () => ({ favorite: "", newVideo: "" }));
        plugin.bindClick = plugin.applyViewMode = plugin.renderTaskStatuses = vi.fn();
        plugin.reloadNewVideoWorkspaceData = vi.fn(() => new Promise(resolve => completions.push(resolve)));

        await plugin.openDialog();
        const first = plugin.runtimeServices.dialog.open.mock.calls[0][0], firstRoot = $("<div></div>").append(first.content).appendTo("body"), firstLoading = first.success(firstRoot, 1);
        expect(plugin.utils.setupEscClose).toHaveBeenCalledWith(1);
        expect(listeners.size).toBe(1);
        first.end(); firstRoot.remove();
        await plugin.openDialog();
        const second = plugin.runtimeServices.dialog.open.mock.calls[1][0], secondRoot = $("<div></div>").append(second.content).appendTo("body"), secondLoading = second.success(secondRoot, 2);
        completions[0](); await firstLoading;
        completions[1](); await secondLoading;
        first.end();
        expect(plugin.nvWorkspaceRoot).toBe(secondRoot);
        expect(listeners.size).toBe(1);
        second.end(); secondRoot.remove();
        expect(listeners.size).toBe(0);
        expect(plugin.runtimeServices.settings.addEventListener).toHaveBeenCalledTimes(2);
        expect(plugin.utils.setupEscClose).toHaveBeenCalledTimes(2);
        expect(plugin.utils.releaseEscClose).toHaveBeenCalledTimes(2);
    });

    it("merges pending opens and never opens after disposal during tip loading", async () => {
        const { plugin } = createHarness();
        let finishTips;
        plugin.runtimeServices.dialog = { open: vi.fn() };
        plugin.getTaskButtonTips = vi.fn(() => new Promise(resolve => finishTips = resolve));
        const first = plugin.openDialog(), second = plugin.openDialog();
        await vi.waitFor(() => expect(plugin.getTaskButtonTips).toHaveBeenCalledOnce());
        plugin.dispose();
        finishTips({ favorite: "", newVideo: "" });
        await Promise.all([first, second]);
        expect(plugin.runtimeServices.dialog.open).not.toHaveBeenCalled();
    });

    it("does not let a disposed activation open after a replacement activation", async () => {
        const { plugin } = createHarness(), tips = [];
        plugin.runtimeServices.dialog = { open: vi.fn(() => 9) };
        plugin.utils.getDialogArea = () => ["600px", "500px"];
        plugin.getTaskButtonTips = vi.fn(() => new Promise(resolve => tips.push(resolve)));
        const first = plugin.openDialog();
        await vi.waitFor(() => expect(tips).toHaveLength(1));
        plugin.dispose(); plugin.prepareFeatureActivation();
        const second = plugin.openDialog();
        await vi.waitFor(() => expect(tips).toHaveLength(2));
        tips[0]({ favorite: "", newVideo: "" }); await first;
        expect(plugin.runtimeServices.dialog.open).not.toHaveBeenCalled();
        tips[1]({ favorite: "", newVideo: "" }); await second;
        expect(plugin.runtimeServices.dialog.open).toHaveBeenCalledOnce();
        expect(plugin.nvDialogId).toBe(9);
    });

    it("allows another open after a failed prerequisite", async () => {
        const { plugin } = createHarness();
        plugin.runtimeServices.dialog = { open: vi.fn(() => 9) };
        plugin.utils.getDialogArea = () => ["600px", "500px"];
        plugin.getTaskButtonTips = vi.fn().mockRejectedValueOnce(new Error("tips unavailable")).mockResolvedValueOnce({ favorite: "", newVideo: "" });
        await expect(plugin.openDialog()).rejects.toThrow("tips unavailable");
        await plugin.openDialog();
        expect(plugin.runtimeServices.dialog.open).toHaveBeenCalledOnce();
    });

    it("renders readable card tooltips while keeping actor text escaped", async () => {
        const { plugin, $, actresses } = createHarness();
        const name = 'Alice"><img id="jhs-tooltip-injection" src=x>';
        actresses[0].name = name;
        actresses[0].newVideoList[0].voteCount = 12;
        actresses[0].newVideoList[0].coverUrl = "https://img.example.test/thumbs/test.jpg";
        await plugin.reloadNewVideoWorkspaceData();
        const card = $('.nv-card[data-car="ABC-001"]');
        expect(card.attr("title")).toContain(`番号：ABC-001\n演员：${name}\n发行：2026-08-01`);
        expect(card.attr("title")).not.toContain("\\n");
        expect(card.find("#jhs-tooltip-injection")).toHaveLength(0);
        expect(card.find(".nv-card__rating").text()).toBe("12 人评价");
        expect(card.find(".nv-cover-img").attr("data-full")).toBe("https://img.example.test/covers/test.jpg");
        const image = card.find(".nv-cover-img")[0];
        vm.runInNewContext(`(function () { ${image.getAttribute("onerror")} }).call(image)`, { image });
        expect(card.find(".nv-cover-img").hasClass("jhs-is-hidden")).toBe(true);
        expect(card.find('[data-jhs-role="cover-fallback"]').hasClass("jhs-is-hidden")).toBe(false);
        expect(card.find(".nv-card__rating").text()).toBe("12 人评价");
        plugin.nvSelected.add("ABC-001");
        plugin.renderBatchBar();
        expect($("#batchMarkWatched").text()).toBe("已观看");
        expect($("#batchRemoveFromNewVideo").text()).toBe("从新作品列表移除");
        expect($(".jhs-new-video-batch__more summary [data-jhs-icon=chevron-down]")).toHaveLength(1);
    });

    it("settles missing or failed cover hydration and permits a later successful retry", async () => {
        for (const fails of [false, true]) {
            const { plugin, $ } = createHarness(), failure = new Error("synthetic cover request failure");
            const item = { carNum: "ABC-001", actressName: "Alice", actresses: ["Alice"], starId: "alice", flags: {}, decisionState: "pending" };
            plugin.nvFlatListCache = [item];
            const hydrate = plugin.hydrateVisibleCovers;
            plugin.hydrateVisibleCovers = vi.fn(async () => {});
            plugin.nvRenderPage();
            expect($(".nv-placeholder").text()).toBe("加载中…");
            plugin.getActorCoverRequest = fails ? vi.fn().mockRejectedValueOnce(failure) : vi.fn().mockResolvedValueOnce(new Map());
            await hydrate.call(plugin, [item], plugin.nvRenderGeneration);
            expect($(".nv-placeholder").text()).toBe("暂无封面");
            expect($(".nv-placeholder").hasClass("jhs-is-hidden")).toBe(false);
            expect(plugin.nvCoverCache.size).toBe(0);
            if (fails) expect(plugin.logger.warn).toHaveBeenCalledWith("获取演员封面失败: alice", failure);
            plugin.getActorCoverRequest.mockResolvedValueOnce(new Map([["ABC-001", { coverUrl: "https://img.example/cover.jpg" }]]));
            await hydrate.call(plugin, [item], plugin.nvRenderGeneration);
            expect(plugin.getActorCoverRequest).toHaveBeenCalledTimes(2);
            expect($(".nv-cover-img").attr("src")).toBe("https://img.example/cover.jpg");
            expect($('[data-jhs-role="cover-fallback"]').hasClass("jhs-is-hidden")).toBe(true);
        }
    });

    it("counts existing records with cleared flags as pending, matching the workspace", async () => {
        const {plugin,storageManager}=createHarness();
        const records=new Map([
            ["ABC-001",{carNum:"ABC-001",stateFlags:{favorite:false,downloaded:false,watched:false,blocked:false}}],
            ["ABC-002",{carNum:"ABC-002",stateFlags:{favorite:true}}],
        ]);
        storageManager.getCarMap.mockResolvedValue(records);
        plugin.renderCurrentView=vi.fn(async()=>{});
        plugin.renderTaskStatuses=vi.fn();
        await plugin.reloadNewVideoWorkspaceData();
        const pending=await plugin.getNewVideoFlatList();
        expect(pending.map(item=>item.carNum)).toEqual(["ABC-001"]);
        expect(await plugin.getPendingNewVideoTotal()).toBe(pending.length);
        records.get("ABC-002").stateFlags.favorite=false;
        expect(await plugin.getPendingNewVideoTotal()).toBe(2);
    });
    it("routes workspace, editor, CDN and avatar dialogs through DialogService", () => {
        const source = readTestFile(join(repoRoot, "src/plugins/new-video/new-video.js"), "utf8");
        expect(source).toContain('getRuntimeService("dialog")');
        expect(source).not.toContain("layer.open");
        expect(source).not.toContain("layer.close");
    });

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

    it("keeps a saved actress edit successful when its invalidation event fails", async () => {
        const { plugin, $, actresses, storageManager } = createHarness();
        const dialog = { open: vi.fn(options => { $(plugin.document.body).append(options.content); }), close: vi.fn() };
        plugin.runtimeServices.dialog = dialog;
        plugin.utils.getDialogArea = () => ["400px", "auto"];
        storageManager.updateFavoriteActress = vi.fn(async () => true);
        plugin.events.emit = vi.fn(async () => { throw new Error("event channel closed"); });
        plugin.logger.warn.mockImplementation(() => { throw new Error("logger unavailable"); });

        await plugin.editActress(actresses[0]);
        $("#edit-actress-name").val("Alice Updated");
        await dialog.open.mock.calls[0][0].yes(1);

        expect(storageManager.updateFavoriteActress).toHaveBeenCalledOnce();
        expect(plugin.events.emit).toHaveBeenCalledOnce();
        expect(plugin.notifications.error).not.toHaveBeenCalled();
        expect(plugin.notifications.ok).toHaveBeenCalledWith("已更新演员信息");
        expect(dialog.close).toHaveBeenCalledWith(1);
    });

    it("keeps the editor open and the original actress unchanged when persistence fails", async () => {
        const { plugin, $, actresses, storageManager } = createHarness();
        const dialog = { open: vi.fn(options => { $(plugin.document.body).append(options.content); }), close: vi.fn() };
        plugin.runtimeServices.dialog = dialog;
        plugin.utils.getDialogArea = () => ["400px", "auto"];
        storageManager.updateFavoriteActress = vi.fn(async () => { throw new Error("IndexedDB unavailable"); });
        plugin.events.emit = vi.fn();

        await plugin.editActress(actresses[0]);
        $("#edit-actress-name").val("Alice Updated");
        await dialog.open.mock.calls[0][0].yes(1);

        expect(actresses[0].name).toBe("Alice");
        expect(plugin.notifications.error).toHaveBeenCalledWith("演员信息保存失败，请重试");
        expect(plugin.events.emit).not.toHaveBeenCalled();
        expect(dialog.close).not.toHaveBeenCalled();
    });

    it("does not claim an edit succeeded after another tab removed the actress", async () => {
        const { plugin, $, actresses, storageManager } = createHarness();
        const dialog = { open: vi.fn(options => { $(plugin.document.body).append(options.content); }), close: vi.fn() };
        plugin.runtimeServices.dialog = dialog;
        plugin.utils.getDialogArea = () => ["400px", "auto"];
        storageManager.updateFavoriteActress = vi.fn(async () => false);
        plugin.events.emit = vi.fn();

        await plugin.editActress(actresses[0]);
        $("#edit-actress-name").val("Alice Updated");
        await dialog.open.mock.calls[0][0].yes(1);

        expect(actresses[0].name).toBe("Alice");
        expect(plugin.notifications.error).toHaveBeenCalledWith("演员信息保存失败，请重试");
        expect(plugin.events.emit).not.toHaveBeenCalled();
        expect(dialog.close).not.toHaveBeenCalled();
    });

    it("closes the editor after a durable edit even when the success toast fails", async () => {
        const { plugin, $, actresses, storageManager } = createHarness();
        const dialog = { open: vi.fn(options => { $(plugin.document.body).append(options.content); }), close: vi.fn() };
        plugin.runtimeServices.dialog = dialog;
        plugin.utils.getDialogArea = () => ["400px", "auto"];
        storageManager.updateFavoriteActress = vi.fn(async () => true);
        plugin.events.emit = vi.fn(async () => {});
        plugin.notifications.ok.mockImplementation(() => { throw new Error("toast unavailable"); });

        await plugin.editActress(actresses[0]);
        $("#edit-actress-name").val("Alice Updated");
        await dialog.open.mock.calls[0][0].yes(1);

        expect(storageManager.updateFavoriteActress).toHaveBeenCalledOnce();
        expect(plugin.notifications.error).not.toHaveBeenCalled();
        expect(plugin.logger.warn).toHaveBeenCalledOnce();
        expect(dialog.close).toHaveBeenCalledWith(1);
    });

    it("does not retry a completed actress uncollect when workspace invalidation fails", async () => {
        const { plugin, $, actresses, storageManager, runtimeServices } = createHarness();
        plugin._viewMode = "actress", plugin.nvJavDbUrl = "https://javdb.com", plugin.nvActressesCache = actresses;
        plugin.getPendingNewVideoCount = () => 0, plugin.renderPagination = vi.fn();
        plugin.document.head.append($("<meta name='csrf-token' content='synthetic-token'>")[0]);
        runtimeServices.actressInfo.uncollect = vi.fn(async () => ({ success: true }));
        storageManager.removeFavoriteActress = vi.fn(async () => true);
        plugin.events.emit = vi.fn(async () => { throw new Error("event channel closed"); });
        let confirmation;
        plugin.utils.q = vi.fn((_event, _message, callback) => { confirmation = callback(); });

        await plugin.renderActressCards();
        $(".btn-delete-actress").first().trigger("click");
        await expect(confirmation).resolves.toBeUndefined();
        expect(runtimeServices.actressInfo.uncollect).toHaveBeenCalledOnce();
        expect(storageManager.removeFavoriteActress).toHaveBeenCalledOnce();
        expect(plugin.events.emit).toHaveBeenCalledOnce();
    });
});


function installOwnedDialogs(harness) {
    const { plugin, $ } = harness, dialogs = new Map(); let nextId = 0;
    const dialog = {
        open: vi.fn(options => {
            // Real Layer 1.0.9 treats object content as a jQuery value and calls parents().
            if (typeof options.content === "object") {
                if (!options.content.parents("body").length) throw new TypeError("Layer requires mounted jQuery content");
                options.content.show();
            }
            const id = ++nextId, root = $('<div class="layui-layer"></div>').attr("id", `layui-layer${id}`).append(options.content).appendTo(plugin.document.body);
            dialogs.set(id, { options, root }); options.success?.(root, id); return id;
        }),
        close: vi.fn(id => { const item = dialogs.get(id); if (!item) return; dialogs.delete(id); item.root.remove(); item.options.end?.(); }),
    };
    plugin.runtimeServices.dialog = dialog;
    plugin.utils.getDialogArea = () => ["600px", "500px"];
    plugin.utils.getResponsiveArea = value => value;
    plugin.utils.setupEscClose = vi.fn(); plugin.utils.releaseEscClose = vi.fn();
    plugin.utils.debounce = fn => Object.assign(fn, { cancel: vi.fn() });
    return { dialog, dialogs };
}

describe("new video interaction ownership", () => {
    it("uses labels for all six editor fields and opens one editor for a repeated actor action", async () => {
        const harness = createHarness(), { plugin, actresses, dom } = harness, { dialog } = installOwnedDialogs(harness);
        await plugin.editActress(actresses[0]); await plugin.editActress(actresses[0]);
        expect(dialog.open).toHaveBeenCalledOnce();
        const controls = plugin.editor.root.find("input,textarea,select").get();
        expect(controls).toHaveLength(6);
        for (const control of controls) expect(control.labels.length, control.id).toBe(1);
        plugin.dispose(); dom.window.close();
    });
    it("cancels the editor request consumer and loading surface on close, ignoring a late result", async () => {
        const harness = createHarness(), { plugin, actresses, runtimeServices, context, dom } = harness, { dialog } = installOwnedDialogs(harness);
        let resolveSearch, requestScope; const release = vi.fn(), closeLoading = vi.fn();
        context.loading.mockReturnValue({ close: closeLoading }); plugin.avatarSources = [{ id: "fixture", name: "Fixture" }];
        runtimeServices.actressInfo.searchAvatars = vi.fn((_names, _source, { scope }) => { requestScope = scope; scope.ownRequestConsumer({ release }); return new Promise(resolve => resolveSearch = resolve); });
        await plugin.editActress(actresses[0]);
        const pending = plugin.searchAvatar(); await plugin.searchAvatar();
        expect(runtimeServices.actressInfo.searchAvatars).toHaveBeenCalledOnce();
        dialog.close(plugin.editor.id);
        expect(requestScope.disposed).toBe(true); expect(release).toHaveBeenCalledOnce(); expect(closeLoading).toHaveBeenCalledOnce();
        resolveSearch(["https://img.example/late.jpg"]); await pending;
        expect(dialog.open).toHaveBeenCalledOnce(); expect(plugin.notifications.error).not.toHaveBeenCalled();
        expect(plugin._editActressRoot).toBeNull(); dom.window.close();
    });
    it("allows a replacement search after editing the name and rejects the older response", async () => {
        const harness = createHarness(), { plugin, actresses, runtimeServices, dom } = harness, { dialog } = installOwnedDialogs(harness);
        const completions = []; plugin.avatarSources = [{ id: "fixture", name: "Fixture" }];
        runtimeServices.actressInfo.searchAvatars = vi.fn((_names, _source, { scope }) => new Promise(resolve => completions.push({ resolve, scope })));
        await plugin.editActress(actresses[0]); const first = plugin.searchAvatar();
        plugin.editor.root.find("#edit-actress-name").val("Replacement").trigger("input");
        expect(completions[0].scope.disposed).toBe(true);
        const second = plugin.searchAvatar(); completions[1].resolve(["https://img.example/new.jpg"]); await second;
        expect(dialog.open).toHaveBeenCalledTimes(2);
        expect(dom.window.document.querySelector('.gfriends-selectable-img').getAttribute('src')).toBe("https://img.example/new.jpg");
        completions[0].resolve(["https://img.example/old.jpg"]); await first;
        expect(dialog.open).toHaveBeenCalledTimes(2);
        plugin.dispose(); dom.window.close();
    });
    it("releases an orphaned editor and normalizes every native child content node for real Layer", async () => {
        const harness = createHarness(), { plugin, actresses, runtimeServices, dom } = harness, { dialog, dialogs } = installOwnedDialogs(harness);
        let finishSearch, requestScope; plugin.avatarSources = [{ id: "fixture", name: "Fixture" }];
        runtimeServices.actressInfo.searchAvatars = vi.fn((_names, _source, { scope }) => { requestScope = scope; return new Promise(resolve => finishSearch = resolve); });
        await plugin.editActress(actresses[0]); const editor = plugin.editor;
        const content = dom.window.document.createElement("div"); content.textContent = "Child content";
        const child = plugin.openEditorChild(editor, { type: 1, content, title: "Child" });
        expect(dialog.open.mock.calls.at(-1)[0].content.jquery).toBeDefined();
        dialogs.get(child.id).root.remove(); await Promise.resolve();
        expect(child.scope.disposed).toBe(true); expect(plugin.editor).toBe(editor);
        const pending = plugin.searchAvatar(); dialogs.get(editor.id).root.remove(); await Promise.resolve();
        expect(requestScope.disposed).toBe(true); expect(plugin.editor).toBeNull();
        finishSearch(["https://img.example/late.jpg"]); await pending;
        expect(dialog.open).toHaveBeenCalledTimes(2); expect(plugin.notifications.error).not.toHaveBeenCalled(); dom.window.close();
    });
    it("owns candidate image events and the selection close timer with the editor", async () => {
        vi.useFakeTimers();
        const harness = createHarness(), { plugin, actresses, runtimeServices, dom, $ } = harness, { dialog, dialogs } = installOwnedDialogs(harness);
        plugin.avatarSources = [{ id: "fixture", name: "Fixture" }];
        runtimeServices.actressInfo.searchAvatars = vi.fn(async () => ["https://img.example/chosen.jpg"]);
        await plugin.editActress(actresses[0]); const editor = plugin.editor; await plugin.searchAvatar();
        const candidate = $(dom.window.document.querySelector(".gfriends-image-item-wrapper")), image = candidate.find("img");
        candidate.trigger("click"); expect(editor.root.find("#edit-actress-avatar").val()).toBe("https://img.example/chosen.jpg");
        expect(vi.getTimerCount()).toBe(1);
        dialog.close(editor.id);
        expect(dialogs.size).toBe(0); expect(vi.getTimerCount()).toBe(0);
        await plugin.editActress({ starId: "replacement", name: "Replacement" });
        const replacement = plugin.editor;
        candidate.trigger("click");
        expect(replacement.root.find("#edit-actress-avatar").val()).toBe("");
        image.trigger("error"); expect(plugin.notifications.error).not.toHaveBeenCalled();
        await vi.runAllTimersAsync(); expect(plugin.editor).toBe(replacement);
        plugin.dispose(); dom.window.close();
    });
    it("closes CDN selection and candidates when its owning Feature scope is disposed", async () => {
        const harness = createHarness(), { plugin, actresses, dom } = harness, { dialogs } = installOwnedDialogs(harness);
        const featureScope = new LifecycleScope("fixture-new-video"); plugin.runtimeServices.scope = () => featureScope;
        plugin.avatarSources = [{ id: "fixture", name: "Fixture" }];
        await plugin.editActress(actresses[0]); plugin.editor.root.find("#select-cdn-btn").trigger("click");
        expect(dialogs.size).toBe(2); featureScope.dispose();
        expect(dialogs.size).toBe(0); expect(plugin.editor).toBeNull(); dom.window.close();
    });
    it("prevents concurrent saves and never closes a newer editor when an older save completes", async () => {
        const harness = createHarness(), { plugin, actresses, storageManager, dom } = harness, { dialogs, dialog } = installOwnedDialogs(harness);
        let finishSave; storageManager.updateFavoriteActress = vi.fn(() => new Promise(resolve => finishSave = resolve)); plugin.events.emit = vi.fn(async () => {});
        await plugin.editActress(actresses[0]); const old = plugin.editor, oldOptions = dialogs.get(old.id).options;
        old.root.find("#edit-actress-name").val("Old write"); const pending = oldOptions.yes(old.id); await oldOptions.yes(old.id);
        expect(storageManager.updateFavoriteActress).toHaveBeenCalledOnce(); dialog.close(old.id);
        await plugin.editActress({ starId: "new", name: "New editor" }); const current = plugin.editor;
        finishSave(true); await pending;
        expect(plugin.editor).toBe(current); expect(dialogs.has(current.id)).toBe(true);
        expect(plugin.notifications.ok).not.toHaveBeenCalled(); expect(plugin.events.emit).toHaveBeenCalledOnce();
        plugin.dispose(); dom.window.close();
    });
    it("releases editor work immediately but retains Layer object content until its animated end", async () => {
        vi.useFakeTimers();
        const harness = createHarness(), { plugin, actresses, dom } = harness, { dialog, dialogs } = installOwnedDialogs(harness);
        dialog.close.mockImplementation(id => {
            const item = dialogs.get(id);
            if (!item) return;
            setTimeout(() => {
                expect(item.options.content[0].isConnected).toBe(true);
                dialogs.delete(id); item.root.remove(); item.options.end?.();
            }, 200);
        });
        await plugin.editActress(actresses[0]); const editor = plugin.editor;
        const content = dom.window.document.createElement("div"), child = plugin.openEditorChild(editor, { type: 1, content, title: "Candidate" });
        plugin.closeActressEditor();
        expect(editor.scope.disposed).toBe(true); expect(child.scope.disposed).toBe(true);
        expect(content.isConnected).toBe(true); expect(editor.root[0].isConnected).toBe(true);
        await vi.advanceTimersByTimeAsync(200);
        expect(content.isConnected).toBe(false); expect(editor.root[0].isConnected).toBe(false);
        expect(dialogs.size).toBe(0); dom.window.close();
    });
    it("keeps filters and commands on the same controls through profile and view changes", async () => {
        const harness = createHarness(), { plugin, runtimeServices, dom, $ } = harness, { dialogs, dialog } = installOwnedDialogs(harness);
        let profile = "compact"; runtimeServices.profile.current = () => profile;
        plugin.getTaskButtonTips = vi.fn(async () => ({ favorite: "", newVideo: "" })); plugin.reloadNewVideoWorkspaceData = vi.fn(async () => {}); plugin.renderCurrentView = vi.fn();
        await plugin.openDialog(); const root = plugin.nvWorkspaceRoot;
        expect(root.find(".newVideoToolBox").attr("data-jhs-compact")).toBe("true");
        expect(root.find("#nv-filter-panel").prop("hidden")).toBe(true); expect(root.find("#jhs-task-status-list").prop("hidden")).toBe(true);
        const filter = root.find("#nvDecisionFilter")[0]; root.find("#nvDecisionFilter").val("ignored");
        plugin.setViewMode("list");
        expect(root.find(".jhs-new-video-toolbar__actions #checkNewVideo")).toHaveLength(1);
        expect(root.find(".jhs-new-video-more__menu #checkFavoriteActress")).toHaveLength(1);
        root.find("#nvFilterToggle").trigger("click"); expect(root.find("#nv-filter-panel").prop("hidden")).toBe(false);
        expect(root.find("#nvFilterToggle").attr("aria-label")).toContain("决策：已忽略");
        profile = "wide"; runtimeServices.profile.dispatchEvent(new dom.window.Event("profile.changed"));
        expect(root.find(".jhs-new-video-toolbar__actions button")).toHaveLength(4);
        profile = "compact"; runtimeServices.profile.dispatchEvent(new dom.window.Event("profile.changed"));
        expect(root.find("#nvDecisionFilter")[0]).toBe(filter); expect($(filter).val()).toBe("ignored");
        expect(root.find("#nv-filter-panel").prop("hidden")).toBe(false);
        const persisted = runtimeServices.storage.setLocal.mock.calls.map(call => call[0]); expect(persisted).toEqual(["jhs_newVideoViewMode"]);
        dialog.close(plugin.nvDialogId); expect(dialogs.size).toBe(0); dom.window.close();
    });
});
