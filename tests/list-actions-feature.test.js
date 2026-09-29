import { JSDOM } from "jsdom";
import jqueryFactory from "jquery";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { ListActionsController } from "../src/features/list/list-actions-controller.js";

function createHarness({
    url = "https://javdb.com/",
    html = '<div class="main-tabs"></div><div class="movie-list"><div class="item" data-jhs-flags="{}" data-jhs-visibility="{}"></div></div>',
    list = {}, batchController = null, blacklist = null, newVideo = null, openNewVideo = null, records = [], settingValues = {}, sortController = null,
} = {}) {
    const dom = new JSDOM(html, { url }), $ = jqueryFactory(dom.window), scope = new LifecycleScope("test:list-actions");
    const settings = Object.assign(new dom.window.EventTarget(), {
        values: { autoPage: "no", sortMethod: "default", waitCheckCount: 5, ...settingValues },
        snapshot() { return this.values; },
    });
    const notifications = { info: vi.fn(), error: vi.fn() };
    const diagnostics = { recordError: vi.fn() };
    const controller = new ListActionsController({
        hostAdapter: {
            site: "javdb", location: dom.window.location, detectRoute: () => "list",
            getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list > .item" }),
            getPageContext: () => ({ kind: "list" }),
        },
        list: list === null ? null : { batchSaveAllVideos: vi.fn(async () => {}), openMovieDetail: vi.fn(async () => {}), ...list }, batchController,
        settings, storage: { get: vi.fn(async () => records) },
        ui: { jquery: $, loading: () => ({ close: vi.fn() }) }, notifications, scope,
        sortController: sortController ?? {
            supportsSorting: () => true, supportsLiveSorting: () => true, isRestrictedContext: () => false,
            isOwnedRankingPage: () => false, isExternalFc2CatalogPage: () => false, isFc2ListPage: () => false,
            activeSortMethod: () => "default", sortItems: vi.fn(async () => {}), selectSortMethod: vi.fn(async () => {}),
        },
        blacklist, newVideo, openNewVideo, diagnostics, document: dom.window.document, window: dom.window,
    });
    return { dom, $, scope, settings, notifications, diagnostics, controller };
}

describe("native list actions controller", () => {
    let harness;
    afterEach(() => { harness?.scope.dispose(); harness = null; });

    it("mounts capability-dependent actions and routes batch operations through List Feature", async () => {
        harness = createHarness({
            blacklist: { addBlacklist: vi.fn(), filterAllVideo: vi.fn(), openBlacklistDialog: vi.fn() },
            newVideo: { openDialog: vi.fn() },
        });
        await harness.controller.start();
        expect(harness.$("#waitCheckBtn").length).toBe(1);
        expect(harness.$("#favoriteAllVideo, #hasDownAllVideo, #blacklistBtn, #newVideoBtn").length).toBe(4);

        harness.$("#favoriteAllVideo").trigger("click");
        await vi.waitFor(() => expect(harness.controller.list.batchSaveAllVideos).toHaveBeenCalledOnce());
        expect(harness.controller.list.batchSaveAllVideos).toHaveBeenCalledWith(
            { kind: "search", displayName: "当前搜索条件", recordName: "" }, "favorite",
        );
        harness.controller.dispose();
        expect(harness.scope.snapshot().listeners).toBe(0);
        expect(harness.$(".jhs-list-btn-row").length).toBe(0);
    });

    it("routes actor blacklist batches through the injected List Feature controller", async () => {
        const batchController = { run: vi.fn(async () => ({ matched: 2, updated: 2 })) };
        harness = createHarness({
            url: "https://javdb.com/actors/actor-id",
            html: '<div class="toolbar"></div><div class="actor-section-name">Actor Name, Alias</div><div class="movie-list"></div>',
            blacklist: { getActressPageInfo: () => ({ starId: "actor-id", name: "Actor Name" }) },
            batchController,
        });
        await harness.controller.start();

        harness.$("#filterAllVideo").trigger("click");
        await vi.waitFor(() => expect(batchController.run).toHaveBeenCalledOnce());
        expect(batchController.run).toHaveBeenCalledWith(
            { kind: "actor", displayName: "Actor Name", recordName: "Actor Name" }, "filter",
        );
    });

    it("opens new-video through the on-demand Feature command when injected", async () => {
        const openNewVideo = vi.fn(async () => {}), legacyOpen = vi.fn();
        harness = createHarness({ openNewVideo, newVideo: { openDialog: legacyOpen } });
        await harness.controller.start();

        harness.$("#newVideoBtn").trigger("click");
        await vi.waitFor(() => expect(openNewVideo).toHaveBeenCalledOnce());
        expect(legacyOpen).not.toHaveBeenCalled();
    });

    it("leaves only list-independent controls when optional capabilities are unavailable", async () => {
        harness = createHarness({ list: null });
        await harness.controller.start();
        expect(harness.$("#waitCheckBtn").length).toBe(1);
        expect(harness.$("#favoriteAllVideo, #hasDownAllVideo, #blacklistBtn, #newVideoBtn, #addBlacklistBtn").length).toBe(0);
        harness.$("#waitCheckBtn").trigger("click");
        await vi.waitFor(() => expect(harness.notifications.info).toHaveBeenCalledWith("列表功能已禁用"));
    });

    it("supports sort-menu keyboard movement and restores the previous choice after persistence failure", async () => {
        const sortController = {
            supportsSorting: () => true, supportsLiveSorting: () => true, isRestrictedContext: () => false,
            isOwnedRankingPage: () => false, isExternalFc2CatalogPage: () => false,
            activeSortMethod: () => "default", sortItems: vi.fn(async () => {}),
            selectSortMethod: vi.fn(async () => { throw new Error("storage unavailable"); }),
        };
        harness = createHarness({ sortController });
        await harness.controller.start();
        const first = harness.$('[data-sort-method="default"]')[0];
        first.focus();
        first.dispatchEvent(new harness.dom.window.KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
        expect(harness.dom.window.document.activeElement).toBe(harness.$('[data-sort-method="rateCount"]')[0]);

        harness.$('[data-sort-method="date"]').trigger("click");
        await vi.waitFor(() => expect(harness.notifications.error).toHaveBeenCalledWith("排序设置保存失败，已恢复原设置"));
        expect(harness.$('[data-sort-method="default"]').attr("aria-checked")).toBe("true");
        expect(harness.$("#jhs-sort-current").text()).toBe("默认");
        expect(harness.diagnostics.recordError).toHaveBeenCalledWith(expect.objectContaining({ contributionId: "list.actions" }));
    });

    it("reflects an existing actor blacklist record", async () => {
        harness = createHarness({
            url: "https://javdb.com/actors/actor-id",
            html: '<div class="toolbar"></div><div class="movie-list"></div>',
            records: [{ starId: "actor-id" }],
            blacklist: { getActressPageInfo: () => ({ starId: "actor-id", name: "Actor" }) },
        });
        await harness.controller.start();
        expect(harness.$("#addBlacklistBtn span").text()).toBe("已加入黑名单");
    });

    it("updates the tag blacklist button when its label arrives and cleans its observer and UI", async () => {
        harness = createHarness({
            url: "https://javdb.com/tags",
            html: '<div class="main-tabs"></div><div class="movie-list"></div><div id="jhs-check-tag"></div>',
            records: [{ starId: "no-drama" }],
            blacklist: { addBlacklist: vi.fn() },
        });
        await harness.controller.start();
        expect(harness.scope.snapshot().observers).toBe(1);

        harness.$("#jhs-check-tag").text("drama");
        await vi.waitFor(() => expect(harness.$("#addBlacklistBtn span").text()).toBe("已加入黑名单"));
        harness.scope.dispose();
        expect(harness.scope.snapshot().observers).toBe(0);
        expect(harness.$(".jhs-list-btn-row").length).toBe(0);
    });

    it("routes wait-check selection through injected list selectors and respects the configured limit", async () => {
        harness = createHarness({
            settingValues: { waitCheckCount: 1 },
            html: '<div class="main-tabs"></div><div class="movie-list"><div id="first" class="item" data-jhs-flags="{}" data-jhs-visibility="{}"></div><div id="second" class="item" data-jhs-flags="{}" data-jhs-visibility="{}"></div></div>',
        });
        await harness.controller.start();
        await harness.controller.openWaitCheck();
        expect(harness.controller.list.openMovieDetail).toHaveBeenCalledOnce();
        expect(harness.controller.list.openMovieDetail.mock.calls[0][0][0].id).toBe("first");
        expect(harness.controller.list.openMovieDetail.mock.calls[0][1]).toEqual({ autoplay: true, newTab: false });
    });
});
