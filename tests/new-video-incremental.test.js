import { afterEach, describe, expect, it, vi } from "vitest";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { NewVideoPlugin } from "../src/plugins/new-video/new-video.js";
import { initializeEventBus } from "../src/core/event-bus.js";
import { normalizeCarNum } from "../src/core/constants.js";

const html = `<body><span id="newVideoCount"></span><div class="newVideoToolBox">
    <select id="nvSortBy"><option value="carNum_asc">asc</option><option value="carNum_desc">desc</option></select>
    <select id="nvCategoryFilter"><option value="all">all</option></select>
    <select id="nvStateFilter"><option value="pending">pending</option></select>
    <select id="nvDecisionFilter"><option value="pending">pending</option></select>
    <input id="nvSearch"><div id="new-video-list-container"></div><div id="new-video-list-footer"></div>
</div></body>`;
const harnesses = [];

async function createHarness(count = 9) {
    const dom = new JSDOM(html, { url: "https://javdb.com/" }), $ = jqueryFactory(dom.window);
    vi.stubGlobal("window", dom.window);
    vi.stubGlobal("document", dom.window.document);
    vi.stubGlobal("$", $);
    vi.stubGlobal("BroadcastChannel", class { addEventListener() {} postMessage() {} });
    vi.stubGlobal("clog", { error: vi.fn(), warn: vi.fn(), log: vi.fn(), debug: vi.fn() });
    vi.stubGlobal("show", { info: vi.fn(), ok: vi.fn(), error: vi.fn() });
    vi.stubGlobal("utils", { debounce: fn => Object.assign(fn, { cancel() {} }), q: vi.fn() });
    dom.window.matchMedia = () => ({ matches: true });
    dom.window.ImageHoverPreview = class {
        destroy() {}
        hidePreview() { this.currentTarget = null; }
    };
    let actresses = [{ name: "Fixture", starId: "fixture", actressType: "censored", newVideoList: Array.from({ length: count }, (_, index) => ({
        carNum: `ABC-${String(index + 1).padStart(3, "0")}`, title: index % 2 ? "Other" : "Keep",
        publishTime: "2026-09-09", coverUrl: `https://images.example.test/${index}.jpg`,
    })) }];
    const decisions = {}, bus = initializeEventBus();
    const storageManager = {
        getFavoriteActressList: vi.fn(async () => actresses), getCarMap: vi.fn(async () => new Map()),
        getSetting: vi.fn(async key => key === "autoRemoveNewVideoMarkAfterBrowse" ? "yes" : key === "checkNewVideo_ruleTime" ? 8760 : {}),
    };
    vi.stubGlobal("storageManager", storageManager);
    const state = {
        getNewVideoDecisions: vi.fn(async () => decisions),
        removeFromNewVideoList: vi.fn(async (values, reason) => {
            const keys = values.map(normalizeCarNum), removed = new Set(keys);
            actresses = actresses.map(actress => ({ ...actress, newVideoList: actress.newVideoList.filter(item => !removed.has(item.carNum)) }));
            keys.forEach(key => { decisions[key] = { action: "dismissed" }; });
            await bus.emit("new-video-changed", { carNums: keys, reason }, { broadcast: false });
            return { changed: keys };
        }),
    };
    const plugin = new NewVideoPlugin();
    plugin.runtimeServices = {
        state, movie: { externalSiteOrigin: () => "https://javdb.com" },
        storage: { getLocal: () => null }, actressInfo: { getAvatarSources: () => [] },
    };
    vi.spyOn(plugin, "getOptionalDependency").mockReturnValue(null);
    plugin.nvWorkspaceMounted = true, plugin.nvWorkspaceRoot = $(".newVideoToolBox"), plugin._viewMode = "list", plugin.nvPageSize = 3;
    await plugin.handle();
    await plugin.reloadNewVideoWorkspaceData();
    plugin.bindClick();
    $("#new-video-list-container").on("click.test", ".nv-card__link", event => event.preventDefault());
    const harness = { plugin, dom, $, state, storageManager };
    harnesses.push(harness);
    return harness;
}

function visibleKeys($) {
    return $("#nv-grid .nv-card").map((_, card) => card.getAttribute("data-car")).get();
}

afterEach(async () => {
    for (const { plugin, dom } of harnesses.splice(0)) {
        plugin.cleanupNewVideoWorkspace();
        plugin.nvEventUnsubscribe?.();
        plugin.taskStatusUnsubscribe?.();
        await plugin.nvWorkspaceReloadPromise;
        dom.window.close();
    }
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
});

describe("new-video browse removal", () => {
    it("keeps the page, both scroll containers, retained card/image nodes and selection while filling the gap", async () => {
        const { plugin, $, state, dom, storageManager } = await createHarness();
        plugin.nvCurrentPage = 2, plugin.nvRenderPage();
        const grid = $("#nv-grid")[0], retained = $('.nv-card[data-car="ABC-006"]')[0], image = $(retained).find("img")[0];
        $(retained).find(".nv-select").prop("checked", true).trigger("change");
        $('.nv-card[data-car="ABC-005"] .nv-card__link')[0].focus();
        $("#new-video-list-container").scrollTop(180), $(".newVideoToolBox").scrollTop(90);
        const reload = vi.spyOn(plugin, "reloadNewVideoWorkspaceData");
        storageManager.getFavoriteActressList.mockClear();
        await state.removeFromNewVideoList(["abc_005"], "browse");
        await plugin.flushWorkspaceReload();
        expect(reload).not.toHaveBeenCalled();
        expect(storageManager.getFavoriteActressList).toHaveBeenCalledOnce();
        expect($("#nv-grid")[0]).toBe(grid);
        expect(visibleKeys($)).toEqual(["ABC-004", "ABC-006", "ABC-007"]);
        expect($('.nv-card[data-car="ABC-006"]')[0]).toBe(retained);
        expect($(retained).find("img")[0]).toBe(image);
        expect($(retained).find(".nv-select").prop("checked")).toBe(true);
        expect(plugin.nvCurrentPage).toBe(2);
        expect($("#new-video-list-container").scrollTop()).toBe(180);
        expect($(".newVideoToolBox").scrollTop()).toBe(90);
        expect($(dom.window.document.activeElement).closest(".nv-card").attr("data-car")).toBe("ABC-006");
        expect($("#nv-pagination-bar").text()).toContain("共 8 条");
        expect($("#newVideoCount").text()).toBe("8");
        expect(plugin.nvAllItemsMap.has("ABC-005")).toBe(false);
        expect(plugin.nvActressesCache[0].newVideoList.some(item => normalizeCarNum(item.carNum) === "ABC-005")).toBe(false);
    });

    it("coalesces consecutive removals and retains the remaining selected card", async () => {
        const { plugin, $, state } = await createHarness(10);
        plugin.nvCurrentPage = 2, plugin.nvRenderPage();
        const retained = $('.nv-card[data-car="ABC-004"]')[0];
        $(retained).find(".nv-select").prop("checked", true).trigger("change");
        await Promise.all([ state.removeFromNewVideoList(["ABC-005"], "browse"), state.removeFromNewVideoList(["ABC-006"], "browse") ]);
        await plugin.flushWorkspaceReload();
        expect(visibleKeys($)).toEqual(["ABC-004", "ABC-007", "ABC-008"]);
        expect($('.nv-card[data-car="ABC-004"]')[0]).toBe(retained);
        expect([...plugin.nvSelected]).toEqual(["ABC-004"]);
        expect(plugin.nvCurrentPageItems.map(item => item.carNum)).toEqual(visibleKeys($));
    });

    it("uses the existing search and sort rules to choose the replacement card", async () => {
        const { plugin, $, state } = await createHarness(10);
        $("#nvSearch").val("keep"), $("#nvSortBy").val("carNum_desc");
        await plugin.renderNewVideoList();
        expect(visibleKeys($)).toEqual(["ABC-009", "ABC-007", "ABC-005"]);
        await state.removeFromNewVideoList(["ABC-007"], "browse");
        await plugin.flushWorkspaceReload();
        expect(visibleKeys($)).toEqual(["ABC-009", "ABC-005", "ABC-003"]);
        expect($("#nvSearch").val()).toBe("keep");
        expect($("#nvSortBy").val()).toBe("carNum_desc");
    });

    it("clamps an emptied last page to the previous page using the existing pagination", async () => {
        const { plugin, $, state } = await createHarness(4);
        plugin.nvCurrentPage = 2, plugin.nvRenderPage();
        const grid = $("#nv-grid")[0];
        await state.removeFromNewVideoList(["ABC-004"], "browse");
        await plugin.flushWorkspaceReload();
        expect(plugin.nvCurrentPage).toBe(1);
        expect($("#nv-grid")[0]).toBe(grid);
        expect(visibleKeys($)).toEqual(["ABC-001", "ABC-002", "ABC-003"]);
        expect($("#nv-pagination-bar")).toHaveLength(0);
    });

    it("reuses the empty view after the final item and clears the current-page selection source", async () => {
        const { plugin, $, state } = await createHarness(1);
        await state.removeFromNewVideoList(["ABC-001"], "browse");
        await plugin.flushWorkspaceReload();
        expect($(".nv-card")).toHaveLength(0);
        expect($("#new-video-list-container").text()).toContain("暂无新作品记录");
        expect(plugin.nvCurrentPageItems).toEqual([]);
        expect($("#newVideoCount").text()).toBe("0");
    });

    it("does not remove a clicked card when persistence fails or automatic removal is disabled", async () => {
        const { plugin, $, state, storageManager } = await createHarness();
        state.removeFromNewVideoList.mockRejectedValueOnce(new Error("storage failed"));
        $('.nv-card[data-car="ABC-002"] .nv-card__link').trigger("click");
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(visibleKeys($)).toEqual(["ABC-001", "ABC-002", "ABC-003"]);
        expect(plugin.nvAllItemsMap.has("ABC-002")).toBe(true);
        state.removeFromNewVideoList.mockClear();
        storageManager.getSetting.mockImplementation(async key => key === "autoRemoveNewVideoMarkAfterBrowse" ? "no" : {});
        $('.nv-card[data-car="ABC-002"] .nv-card__link').trigger("click");
        await new Promise(resolve => setTimeout(resolve, 0));
        expect(state.removeFromNewVideoList).not.toHaveBeenCalled();
        expect(visibleKeys($)).toEqual(["ABC-001", "ABC-002", "ABC-003"]);
    });

    it("keeps the fading card in layout until completion and rejects the old callback after reopening", async () => {
        const { plugin, $, state, dom } = await createHarness();
        let finish;
        const animate = vi.spyOn($.fn, "animate").mockImplementation(function(properties, duration, complete) {
            expect(properties).toEqual({ opacity: 0 });
            expect(duration).toBe(180);
            finish = complete;
            return this;
        });
        dom.window.matchMedia = () => ({ matches: false });
        await state.removeFromNewVideoList(["ABC-002"], "browse");
        const pending = plugin.flushWorkspaceReload();
        for (let attempt = 0; !finish && attempt < 20; attempt++) await Promise.resolve();
        expect(animate).toHaveBeenCalledOnce();
        expect($('.nv-card[data-car="ABC-002"]')).toHaveLength(1);
        expect($('.nv-card[data-car="ABC-002"]').css("display")).not.toBe("none");
        plugin.cleanupNewVideoWorkspace();
        $(".newVideoToolBox").remove();
        $(dom.window.document.body).append($(html).find(".newVideoToolBox").addBack(".newVideoToolBox"));
        plugin.nvWorkspaceMounted = true, plugin.nvWorkspaceRoot = $(".newVideoToolBox");
        await plugin.reloadNewVideoWorkspaceData();
        const newGrid = $("#nv-grid")[0], before = visibleKeys($);
        expect(newGrid).toBeDefined();
        expect(before).toEqual(["ABC-001", "ABC-003", "ABC-004"]);
        finish();
        await pending;
        expect($("#nv-grid")[0]).toBe(newGrid);
        expect(visibleKeys($)).toEqual(before);
        expect(plugin.nvRemovingCards.size).toBe(0);
    });

    it("preserves a filter change during fading and prunes a fading card selected again", async () => {
        const { plugin, $, state, dom } = await createHarness();
        dom.window.matchMedia = () => ({ matches: false });
        await state.removeFromNewVideoList(["ABC-002"], "browse");
        const pending = plugin.flushWorkspaceReload();
        await vi.waitFor(() => expect(plugin.nvRemovingCards.size).toBe(1));
        $('.nv-card[data-car="ABC-002"] .nv-select').prop("checked", true).trigger("change");
        $('.nv-card[data-car="ABC-003"] .nv-select').prop("checked", true).trigger("change");
        $("#nvSearch").val("keep"), plugin.nvRenderGeneration++;
        await plugin.renderNewVideoList();
        const grid = $("#nv-grid")[0];
        await pending;
        expect($("#nv-grid")[0]).toBe(grid);
        expect(visibleKeys($)).toEqual(["ABC-001", "ABC-003", "ABC-005"]);
        expect([...plugin.nvSelected]).toEqual(["ABC-003"]);
        expect($('.nv-card[data-car="ABC-003"] .nv-select').prop("checked")).toBe(true);
        expect($("#nvSearch").val()).toBe("keep");
    });

    it.each(["state-handled", "manual"])("shares the same incremental path for a committed %s removal", async reason => {
        const { plugin, $, state } = await createHarness();
        const grid = $("#nv-grid")[0], reload = vi.spyOn(plugin, "reloadNewVideoWorkspaceData");
        await state.removeFromNewVideoList(["ABC-002"], reason);
        await plugin.flushWorkspaceReload();
        expect(reload).not.toHaveBeenCalled();
        expect($("#nv-grid")[0]).toBe(grid);
        expect(visibleKeys($)).toEqual(["ABC-001", "ABC-003", "ABC-004"]);
    });
});
