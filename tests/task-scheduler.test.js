import { readListItem } from "../src/core/list-item-reader.js";
import { TaskExecutionService } from "../src/features/discovery/task-execution-service.js";
import { sleep } from "../src/core/timing.js";
import { JavDbHostAdapter } from "../src/platform/hosts/javdb-host-adapter.js";
import { join } from "node:path";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";

const NativeDate = Date;
const cleanup = [];
afterEach(() => {
    for (const dispose of cleanup.splice(0).reverse()) dispose();
    vi.unstubAllGlobals();
});

function createHarness(initialTime = "2026-08-23T13:20:00.789", pageUrl = "https://javdb.com/") {
    const clock = { now: new NativeDate(initialTime).getTime() };
    class ClockDate extends NativeDate {
        constructor(...args) { super(...(args.length ? args : [ clock.now ])); }
        static now() { return clock.now; }
    }
    const dom = new JSDOM('<body><div id="checkNewVideoMsg"></div><div id="checkBlacklistMsg"></div></body>', { url: pageUrl }), $ = jqueryFactory(dom.window), values = new Map;
    dom.window.isListPage = true;
    cleanup.push(() => dom.window.close());
    for (const [key, value] of Object.entries({
        Date: ClockDate, window: dom.window, document: dom.window.document, DOMParser: dom.window.DOMParser, $,
    })) vi.stubGlobal(key, value);
    const htmlToPage = html => $(new dom.window.DOMParser().parseFromString(html, "text/html"));
    const settings = {
        checkConcurrencyCount: 2, checkRequestSleep: 0,
        checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0,
        checkFavoriteActress_IntervalTime: 24,
        checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 0
    }, favorites = [], blacklistItems = [];
    const settingsService = { snapshot: () => ({ ...settings }), readStoredSnapshot: vi.fn(async () => ({ ...settings })) };
    const keywordRules = { getTitleKeywords: vi.fn(async () => []) };
    const state = {
        getNewVideoDecisions: async () => ({}),
        getFavoriteActressList: vi.fn(async () => favorites), getBlacklist: vi.fn(async () => blacklistItems), getBlacklistCarList: vi.fn(async () => []),
        addFavoriteActressList: vi.fn(async () => {}), updateFavoriteActress: vi.fn(async () => true), updateBlacklistItem: vi.fn(async update => Object.assign(blacklistItems.find(item => item.starId === update.starId), update)), getCarMap: vi.fn(async () => new Map)
    };
    const localStorage = { getItem: vi.fn(key => values.has(key) ? values.get(key) : null), setItem: vi.fn((key, value) => values.set(key, String(value))), removeItem: vi.fn(key => values.delete(key)) };
    const storage = { getLocal: localStorage.getItem, setLocal: localStorage.setItem, removeLocal: localStorage.removeItem }, scope = new LifecycleScope("feature:scheduler");
    let activeScope = scope;
    const eventHandlers = new Map, jhsEventBus = {
        on: vi.fn((type, handler) => {
            const handlers = eventHandlers.get(type) || [];
            handlers.push(handler), eventHandlers.set(type, handlers);
            return () => eventHandlers.set(type, handlers.filter(candidate => candidate !== handler));
        }),
        emit: vi.fn(async (type, payload, options) => {
            for (const handler of eventHandlers.get(type) || []) await handler(payload, options);
        })
    };
    const locks = { request: vi.fn(async (key, options, callback) => callback({ name: key })) };
    Object.defineProperty(dom.window.navigator, "locks", { configurable: true, value: locks });
    const gmHttp = { get: vi.fn() }, http = {
        request: vi.fn(async request => ({ data: await gmHttp.get(request.url), finalUrl: request.url }))
    }, actressInfo = {
        collection: vi.fn(async (_integrationId, input) => {
            const html = await gmHttp.get(input.pageUrl);
            return new JavDbHostAdapter(dom.window.document, dom.window.location).parseActorCollection(html, input.pageUrl);
        }),
        movies: vi.fn(async (_integrationId, input) => {
            const url = `${input.baseUrl}/actors/${input.actorId}?t=d`, html = await gmHttp.get(url), page = htmlToPage(html);
            return page.find(".movie-list .item").toArray().map(element => {
                const item = $(element), parsed = readListItem(item, $);
                return { ...parsed, coverUrl: item.find("img").attr("src") || "", score: 0, voteCount: 0 };
            });
        })
    }, beans = {
        OtherSitePlugin: { getJavDbUrl: vi.fn(() => "https://javdb.com"), getJavBusUrl: vi.fn(() => "https://www.javbus.com") },
        NewVideoPlugin: { loadData: vi.fn(async () => {}), resetBtnTip: vi.fn(async () => {}) },
        BlacklistPlugin: { resetBtnTip: vi.fn(async () => {}) }
    };
    const notificationError = vi.fn();
    const logger = { log: vi.fn(), html: vi.fn(), htmlDebug: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() };
    const plugin = new TaskExecutionService({
        runtimeServices: {
            storage, keywordRules, scope: () => activeScope, http, actressInfo, events: jhsEventBus,
            movie: { externalSiteOrigin: siteId => siteId === "javBusBtn" ? beans.OtherSitePlugin.getJavBusUrl() : beans.OtherSitePlugin.getJavDbUrl() },
            state, settings: settingsService,
            hostAdapters: {
                javdb: { getListSelectors: () => ({ boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }) },
                javbus: { getListSelectors: () => ({ boxSelector: ".masonry", itemSelector: ".masonry .item", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" }) },
            },
        },
        blacklist: { available: () => Boolean(beans.BlacklistPlugin), parseAndSave: (...args) => beans.BlacklistPlugin.parseAndSaveFilterInfo(...args) },
        sleep: vi.fn(async () => {}), logger, jquery: $,
        window: dom.window, notifications: { error: notificationError },
    });
    return { plugin, clock, values, settings, favorites, blacklistItems, state, settingsService, gmHttp, http, actressInfo, beans, locks, jhsEventBus, scope, setScope: value => { activeScope = value; }, document: dom.window.document, $, htmlToPage };
}

describe("task scheduler state machine", () => {
    it("finishes a 404 batch and does not schedule five-minute retries for that actor", async () => {
        const harness = createHarness();
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.favorites.push({ starId: "gone", name: "Gone", newVideoList: [{ carNum: "OLD-123" }] });
        harness.actressInfo.movies.mockRejectedValue(Object.assign(new Error("404"), { code: "NOT_FOUND" }));
        const result = await harness.plugin.checkNewVideo();
        expect(result).toMatchObject({ completed: true, networkFailed: 0, unavailable: 1 });
        expect(harness.favorites[0].newVideoList).toEqual([{ carNum: "OLD-123" }]);
        expect(harness.plugin.getTaskStatusSnapshot("newVideo")).toMatchObject({ unavailableCount: 1, isPending: false });
        harness.clock.now += 300000;
        expect(await harness.plugin.checkNewVideo()).toMatchObject({ attempted: false });
        harness.clock.now += 12 * 3600000;
        const next = await harness.plugin.checkNewVideo();
        expect(next).toMatchObject({ completed: true, skippedUnavailable: 1 });
        expect(harness.actressInfo.movies).toHaveBeenCalledOnce();
    });
    it("preflights every page movie before filters or favorite actress replacement", async () => {
        const harness = createHarness();
        harness.plugin.javDbUrl = "https://javdb.com";
        const page = harness.htmlToPage('<div class="movie-list"><div class="item"><a href="/v/test"><div class="video-title"><strong>ABC-123</strong> </div></a><div class="meta">2026-08-01</div></div><div class="item"><a href="/v/test"><div class="video-title"><strong>STUDIO-NAME</strong> filtered</div></a><div class="meta">2026-09-01</div></div></div>');
        await expect(harness.plugin.parsePage(page, "javdb", "actor", "Actor", ["filtered"], new Set(["STUDIO-NAME"]))).rejects.toMatchObject({ code: "INCOMPLETE_MOVIE_IDENTITY" });
        expect(harness.state.updateFavoriteActress).not.toHaveBeenCalled();
        expect(harness.state.getCarMap).not.toHaveBeenCalled();
    });

    it("preserves fallback actor results and dates when any item has an unreliable identity", async () => {
        const harness = createHarness();
        await expect(harness.plugin.parseActorMovies([{ carNum: "HEYZO1234" }, { carNum: "FC2", title: "filtered" }], "actor", "Actor", ["filtered"], new Set(["FC2"]))).rejects.toMatchObject({ code: "INCOMPLETE_MOVIE_IDENTITY" });
        expect(harness.state.updateFavoriteActress).not.toHaveBeenCalled();
        expect(harness.state.getCarMap).not.toHaveBeenCalled();
    });

    it("preflights a compatibility blacklist page before any legacy save or success timestamp", async () => {
        const harness = createHarness();
        harness.blacklistItems.push({ starId: "a", name: "A", url: "https://javdb.com/actors/a", createTime: "1", checkTime: "2020-01-01" });
        harness.plugin.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.gmHttp.get.mockResolvedValue('<div class="movie-list"><div class="item"><a href="/v/test"><div class="video-title"><strong>ABC-123</strong> </div></a><div class="meta"></div></div><div class="item"><a href="/v/test"><div class="video-title"><strong>STUDIO-NAME</strong> </div></a><div class="meta"></div></div></div>');
        harness.beans.BlacklistPlugin.parseAndSaveFilterInfo = vi.fn(async () => ({ lastPublishTime: "2026-09-01" }));
        await expect(harness.plugin.checkBlacklist(true)).resolves.toMatchObject({ completed: false, parseFailed: 1, success: 0 });
        expect(harness.beans.BlacklistPlugin.parseAndSaveFilterInfo).not.toHaveBeenCalled();
        expect(harness.state.updateBlacklistItem).not.toHaveBeenCalled();
        expect(harness.blacklistItems[0].checkTime).toBe("2020-01-01");
        expect(harness.values.has("jhs_time_checkBlacklist")).toBe(false);
    });
    it("preserves supported zero settings while rejecting zero task intervals and concurrency", async () => {
        const harness = createHarness();
        Object.assign(harness.settings, { checkConcurrencyCount: "0", checkRequestSleep: "0", checkBlacklist_intervalTime: "0", checkBlacklist_ruleTime: "0", checkNewVideo_ruleTime: 0 });
        await harness.plugin.loadConfig();
        expect(harness.plugin.taskConfig).toMatchObject({ checkConcurrencyCount: 2, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0, checkNewVideo_ruleTime: 0 });
    });

    it("derives next from a downgrade-compatible completed string", async () => {
        const harness = createHarness("2026-08-23T11:00:00");
        harness.settings.checkNewVideo_intervalTime = 2;
        harness.values.set("jhs_time_checkNewVideo", "2026-08-23 10:00:00");
        expect(await harness.plugin.shouldStartTask("newVideo")).toBe(false);
        expect(Number(harness.values.get("jhs_time_checkNewVideo_next"))).toBe(new Date("2026-08-23T12:00:00").getTime());
        expect(harness.values.get("jhs_time_checkNewVideo")).toBe("2026-08-23 10:00:00");
    });

    it("restores a missing pending next from attempt plus five minutes", async () => {
        const harness = createHarness("2026-08-23T14:01:00");
        harness.values.set("jhs_time_checkNewVideo", "2026-08-23 13:00:00");
        harness.values.set("jhs_time_checkNewVideo_attempt", String(new Date("2026-08-23T14:00:00").getTime()));
        expect(await harness.plugin.shouldStartTask("newVideo")).toBe(false);
        expect(Number(harness.values.get("jhs_time_checkNewVideo_next"))).toBe(new Date("2026-08-23T14:05:00").getTime());
        harness.clock.now = new Date("2026-08-23T14:06:00").getTime();
        expect(await harness.plugin.shouldStartTask("newVideo")).toBe(true);
    });

    it("keeps attempt second-aligned and completes without violating the invariant", async () => {
        const harness = createHarness();
        const attempt = harness.plugin.beginTaskAttempt("newVideo");
        expect(attempt % 1000).toBe(0);
        await harness.plugin.finalizeTask("newVideo", true);
        const state = harness.plugin.getTaskScheduleState("newVideo");
        expect(state.completed).toBeGreaterThanOrEqual(state.attempt);
        expect(harness.values.get("jhs_time_checkNewVideo")).toMatch(/^2026-08-23 13:20:00$/);
    });

    it("recalculates idle schedules but preserves pending retry leases", async () => {
        const harness = createHarness("2026-08-23T11:00:00");
        harness.settings.checkNewVideo_intervalTime = 2;
        harness.values.set("jhs_time_checkNewVideo", "2026-08-23 10:00:00");
        harness.values.set("jhs_time_checkNewVideo_attempt", String(new Date("2026-08-23T09:00:00").getTime()));
        await harness.plugin.recalculateSchedules();
        expect(Number(harness.values.get("jhs_time_checkNewVideo_next"))).toBe(new Date("2026-08-23T12:00:00").getTime());
        harness.values.set("jhs_time_checkNewVideo_attempt", String(new Date("2026-08-23T10:30:00").getTime()));
        harness.values.set("jhs_time_checkNewVideo_next", "9999999999999");
        harness.settings.checkNewVideo_intervalTime = 6;
        await harness.plugin.recalculateSchedules();
        expect(harness.values.get("jhs_time_checkNewVideo_next")).toBe("9999999999999");
    });

    it("finalizes with the latest interval and blocks a second page during the lease", async () => {
        const harness = createHarness("2026-08-23T13:00:00");
        harness.settings.checkNewVideo_intervalTime = 24;
        harness.plugin.beginTaskAttempt("newVideo");
        expect(await harness.plugin.shouldStartTask("newVideo")).toBe(false);
        expect(await harness.plugin.shouldStartTask("newVideo", true)).toBe(true);
        harness.settings.checkNewVideo_intervalTime = 2;
        harness.clock.now = new Date("2026-08-23T13:03:00").getTime();
        await harness.plugin.finalizeTask("newVideo", true);
        expect(Number(harness.values.get("jhs_time_checkNewVideo_next"))).toBe(new Date("2026-08-23T15:03:00").getTime());
    });

    it("keeps the old config available while a serialized refresh is in flight", async () => {
        const harness = createHarness(), previous = { checkNewVideo_intervalTime: 12 };
        harness.plugin.taskConfig = previous;
        let release;
        harness.settingsService.readStoredSnapshot.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
        const refresh = harness.plugin.invalidateConfig(true);
        expect(harness.plugin.taskConfig).toBe(previous);
        release({ ...harness.settings, checkNewVideo_intervalTime: 3 });
        await refresh;
        expect(harness.plugin.taskConfig).not.toBe(previous);
        expect(harness.plugin.taskConfig.checkNewVideo_intervalTime).toBe(3);
    });

    it("coalesces a direct load with a newer load so the late old read cannot overwrite settings", async () => {
        const harness = createHarness();
        let releaseOld;
        harness.settingsService.readStoredSnapshot.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }));
        const oldLoad = harness.plugin.loadConfig();
        harness.settings.checkNewVideo_intervalTime = 3;
        const newLoad = harness.plugin.loadConfig();
        releaseOld({ ...harness.settings, checkNewVideo_intervalTime: 12 });
        await Promise.all([oldLoad, newLoad]);
        expect(harness.plugin.taskConfig.checkNewVideo_intervalTime).toBe(3);
        expect(harness.settingsService.readStoredSnapshot).toHaveBeenCalledTimes(2);
    });

    it("reports only current-tab execution as running and cleans active state on failure", async () => {
        const harness = createHarness("2026-08-23T14:03:00");
        harness.values.set("jhs_time_checkNewVideo", "2026-08-23 13:00:00");
        harness.values.set("jhs_time_checkNewVideo_attempt", String(new Date("2026-08-23T14:00:00").getTime()));
        harness.values.set("jhs_time_checkNewVideo_next", String(new Date("2026-08-23T14:06:00").getTime()));
        expect(harness.plugin.getTaskStatusSnapshot("newVideo").state).toBe("pending");
        await expect(harness.plugin.withActiveTask("newVideo", async () => {
            expect(harness.plugin.getTaskStatusSnapshot("newVideo").state).toBe("running");
            throw new Error("business failed");
        })).rejects.toThrow("business failed");
        expect(harness.plugin.activeTasks.has("newVideo")).toBe(false);
        expect(harness.jhsEventBus.emit).toHaveBeenNthCalledWith(1, "task-status-changed", { taskName: "newVideo", phase: "started" }, { broadcast: false });
        expect(harness.jhsEventBus.emit).toHaveBeenNthCalledWith(2, "task-status-changed", { taskName: "newVideo", phase: "finished" }, { broadcast: false });
        harness.clock.now = new Date("2026-08-23T14:07:00").getTime();
        expect(harness.plugin.getTaskStatusSnapshot("newVideo").state).toBe("due");
    });

    it("completes an empty new-video batch and retries only a failed actress", async () => {
        const empty = createHarness();
        empty.plugin.taskConfig = { checkConcurrencyCount: 2, checkRequestSleep: 0, checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 0 };
        empty.plugin.javDbUrl = "https://javdb.com";
        await empty.plugin.checkNewVideo();
        expect(empty.values.get("jhs_time_checkNewVideo")).toMatch(/^2026-/);

        const harness = createHarness("2026-08-23T13:00:00"), calls = [];
        harness.favorites.push({ starId: "a", name: "A" }, { starId: "b", name: "B" });
        harness.plugin.taskConfig = { checkConcurrencyCount: 2, checkRequestSleep: 0, checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.gmHttp.get.mockImplementation(async url => (calls.push(url), "<div class=\"movie-list\"></div>"));
        let failB = true;
        harness.plugin.parseActorMovies = vi.fn(async (movies, starId) => {
            if ("b" === starId && failB) throw new Error("parse failed");
            harness.favorites.find(item => item.starId === starId).lastCheckTime = harness.plugin.taskConfig ? "2026-08-23 13:00:00" : null;
        });
        const first = await harness.plugin.checkNewVideo();
        expect(first).toMatchObject({ success: 1, parseFailed: 1 });
        expect(harness.$("#checkNewVideoMsg").text()).toContain("整批检测未完成，5 分钟后补偿未完成项");
        expect(harness.values.has("jhs_time_checkNewVideo")).toBe(false);
        failB = false, calls.length = 0, harness.clock.now += 300001;
        const second = await harness.plugin.checkNewVideo();
        expect(second).toMatchObject({ success: 1, parseFailed: 0, skippedInterval: 1 });
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain("/actors/b");
    });

    it("does not mark a completed new-video batch as failed when its closing notice throws", async () => {
        const harness = createHarness();
        harness.plugin.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.plugin.logger.html = vi.fn(message => {
            if (String(message).includes("检测最新作品---结束")) throw new Error("notice unavailable");
        });
        harness.plugin.logger.warn = vi.fn(() => { throw new Error("warning unavailable"); });

        const result = await harness.plugin.checkNewVideo(true);

        expect(result).toMatchObject({ completed: true, success: 0, parseFailed: 0, networkFailed: 0 });
        expect(harness.values.get("jhs_time_checkNewVideo")).toMatch(/^2026-/);
    });

    it("still broadcasts saved new work when the closing notice fails", async () => {
        const harness = createHarness();
        harness.plugin.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.plugin.getNewVideoScanner = () => ({
            scanActresses: async () => ({ actressCount: 1, success: 1, parseFailed: 0, networkFailed: 0, aborted: 0, skippedInterval: 0, skippedStopped: 0, fatal: false, blockedError: null }),
        });
        harness.plugin.logger.html = vi.fn(message => {
            if (String(message).includes("检测最新作品---结束")) throw new Error("notice unavailable");
        });

        const result = await harness.plugin.checkNewVideo(true);

        expect(result).toMatchObject({ completed: true, success: 1, parseFailed: 0 });
        expect(harness.jhsEventBus.emit).toHaveBeenCalledWith("new-video-changed", { reason: "task-completed", carNums: [] });
    });

    it("keeps a saved manual actress scan when its closing notice fails", async () => {
        const harness = createHarness();
        harness.plugin.javDbUrl = "https://javdb.com";
        const scanner = { scanActress: vi.fn(async () => 1) };
        harness.plugin.getNewVideoScanner = () => scanner;
        harness.plugin.logger.html = vi.fn(message => {
            if (String(message).includes("检测最新作品---结束")) throw new Error("notice unavailable");
        });
        harness.plugin.logger.warn = vi.fn(() => { throw new Error("warning unavailable"); });

        await harness.plugin.checkOneNewVideo({ starId: "actor-1", name: "Actor One" });

        expect(harness.plugin.featureNewVideoScanController.scanActress).toHaveBeenCalledOnce();
        expect(harness.$("#checkNewVideoMsg").text()).toBe("检测完毕");
        expect(harness.jhsEventBus.emit).toHaveBeenCalledWith("new-video-changed", { reason: "single-actress-check", carNums: [] });
        expect(harness.plugin.notifications.error).not.toHaveBeenCalled();
    });

    it("still reports a failed manual actress scan without broadcasting success", async () => {
        const harness = createHarness();
        harness.plugin.javDbUrl = "https://javdb.com";
        const failure = new Error("write failed");
        harness.plugin.getNewVideoScanner = () => ({ scanActress: vi.fn(async () => { throw failure; }) });

        await harness.plugin.checkOneNewVideo({ starId: "actor-1", name: "Actor One" });

        expect(harness.$("#checkNewVideoMsg").text()).toBe("演员信息检测失败，请重试");
        expect(harness.plugin.notifications.error).toHaveBeenCalledOnce();
        expect(harness.plugin.logger.error).toHaveBeenCalledWith("检测屏蔽演员信息, 发生错误:", expect.any(String), failure);
        expect(harness.plugin.notifications.error.mock.calls.flat().join(" ")).not.toContain(failure.message);
        expect(harness.jhsEventBus.emit).not.toHaveBeenCalledWith("new-video-changed", expect.anything());
    });

    it("keeps a committed favorite-actress sync when its closing notice and warning fail", async () => {
        const harness = createHarness();
        harness.plugin.taskConfig = { checkFavoriteActress_IntervalTime: 24 };
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.plugin.getNewVideoScanner = () => ({ syncFavoriteActresses: async () => ({ actors: [], pages: 1 }) });
        harness.plugin.logger.log = vi.fn(message => {
            if (String(message).includes("所有演员信息已收集")) throw new Error("notice unavailable");
        });
        harness.plugin.logger.warn = vi.fn(() => { throw new Error("warning unavailable"); });

        const result = await harness.plugin.checkFavoriteActress(true);

        expect(result).toMatchObject({ completed: true, success: 0, parseFailed: 0 });
        expect(harness.values.get("jhs_time_checkFavoriteActress")).toMatch(/^2026-/);
    });

    it("keeps a completed blacklist batch when its closing notice fails", async () => {
        const harness = createHarness();
        harness.plugin.taskConfig = { checkConcurrencyCount: 1, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.plugin.logger.log = vi.fn(message => {
            if (String(message).includes("黑名单整批检测：")) throw new Error("notice unavailable");
        });

        const result = await harness.plugin.checkBlacklist(true);

        expect(result).toMatchObject({ completed: true, success: 0, parseFailed: 0 });
        expect(harness.values.get("jhs_time_checkBlacklist")).toMatch(/^2026-/);
    });

    it("records the maximum real publication date before inbox filters", async () => {
        const harness = createHarness(), page = harness.htmlToPage('<div class="movie-list"><div class="item"><a href="/v/1"><div class="video-title"><strong>A-1</strong> normal</div></a><div class="meta">2026-08-01</div></div><div class="item"><a href="/v/2"><div class="video-title"><strong>B-1</strong> filtered title</div></a><div class="meta">2026-09-03</div></div><div class="item"><a href="/v/3"><div class="video-title"><strong>C-1</strong> normal</div></a><div class="meta">2026-08-20</div></div></div>');
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.state.getCarMap.mockResolvedValue(new Map([[ "C-1", {} ]]));
        await harness.plugin.parsePage(page, "javdb", "actor", "Actor", [ "filtered" ], new Set);
        expect(harness.state.updateFavoriteActress).toHaveBeenCalledWith(expect.objectContaining({
            starId: "actor", lastPublishTime: "2026-09-03", newVideoList: [ expect.objectContaining({ carNum: "A-1" }) ]
        }), { scan: true });
    });

    it("completes a structurally valid empty actress sync and rejects a login page", async () => {
        const empty = createHarness();
        empty.plugin.taskConfig = { checkFavoriteActress_IntervalTime: 24 }, empty.plugin.javDbUrl = "https://javdb.com";
        empty.gmHttp.get.mockResolvedValue('<div id="actors"></div>');
        await expect(empty.plugin.checkFavoriteActress()).resolves.toMatchObject({ success: 0, pages: 1 });
        expect(empty.values.get("jhs_time_checkFavoriteActress")).toMatch(/^2026-/);
        expect(empty.state.addFavoriteActressList).not.toHaveBeenCalled();

        const login = createHarness();
        login.plugin.taskConfig = { checkFavoriteActress_IntervalTime: 24 }, login.plugin.javDbUrl = "https://javdb.com";
        login.gmHttp.get.mockResolvedValue('<form action="/users/sign_in"></form>');
        await expect(login.plugin.checkFavoriteActress()).resolves.toMatchObject({ attempted: true, completed: false, fatal: false, parseFailed: 1 });
        expect(login.values.has("jhs_time_checkFavoriteActress")).toBe(false);
    });

    it("returns completed false when favorite finalize cannot read the latest interval", async () => {
        const harness = createHarness();
        harness.plugin.taskConfig = { checkFavoriteActress_IntervalTime: 24 }, harness.plugin.javDbUrl = "https://javdb.com";
        harness.gmHttp.get.mockResolvedValue('<div id="actors"></div>');
        const finalize = harness.plugin.finalizeTask.bind(harness.plugin);
        harness.plugin.finalizeTask = vi.fn(async (name, completed) => {
            if (completed) throw new Error("setting read failed");
            return finalize(name, false);
        });
        await expect(harness.plugin.checkFavoriteActress()).resolves.toMatchObject({ attempted: true, completed: false, fatal: false, parseFailed: 1 });
        expect(harness.values.has("jhs_time_checkFavoriteActress")).toBe(false);
        expect(Number(harness.values.get("jhs_time_checkFavoriteActress_next"))).toBe(harness.clock.now + 300000);
    });

    it("retries only a failed blacklist item after five minutes", async () => {
        const harness = createHarness("2026-08-23T13:00:00"), calls = [];
        harness.blacklistItems.push({ starId: "a", name: "A", url: "https://javdb.com/actors/a", createTime: "1" }, { starId: "b", name: "B", url: "https://javdb.com/actors/b", createTime: "2" });
        harness.plugin.taskConfig = { checkConcurrencyCount: 2, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com", harness.gmHttp.get.mockImplementation(async url => (calls.push(url), "<div class=\"movie-list\"></div>"));
        let failB = true;
        harness.beans.BlacklistPlugin.parseAndSaveFilterInfo = vi.fn(async (page, name) => {
            if ("B" === name && failB) throw new Error("parse failed");
            return { lastPublishTime: "2026-08-01" };
        });
        const first = await harness.plugin.checkBlacklist();
        expect(first).toMatchObject({ success: 1, parseFailed: 1 });
        expect(harness.values.has("jhs_time_checkBlacklist")).toBe(false);
        failB = false, calls.length = 0, harness.clock.now += 300001;
        const second = await harness.plugin.checkBlacklist();
        expect(second).toMatchObject({ success: 1, parseFailed: 0, skippedInterval: 1 });
        expect(calls).toHaveLength(1);
        expect(calls[0]).toContain("/actors/b");
    });
});

describe("favorite actress pagination boundaries", () => {
    it("rejects pagination cycles and cross-origin next links", async () => {
        const cycle = createHarness(), pages = new Map([
            [ "https://javdb.com/users/collection_actors", '<div id="actors"><div class="actor-box"><a title="A" href="/actors/a"></a></div></div><a class="pagination-next" href="?page=2"></a>' ],
            [ "https://javdb.com/users/collection_actors?page=2", '<div id="actors"><div class="actor-box"><a title="B" href="/actors/b"></a></div></div><a class="pagination-next" href="/users/collection_actors"></a>' ]
        ]);
        cycle.plugin.javDbUrl = "https://javdb.com", cycle.gmHttp.get.mockImplementation(async url => pages.get(url));
        await expect(cycle.plugin.scrapeActorInfo("https://javdb.com/users/collection_actors", [])).rejects.toThrow("分页循环");

        const cross = createHarness();
        cross.plugin.javDbUrl = "https://javdb.com", cross.gmHttp.get.mockResolvedValue('<div id="actors"><div class="actor-box"><a title="A" href="/actors/a"></a></div></div><a class="pagination-next" href="https://evil.example/users/collection_actors?page=2"></a>');
        await expect(cross.plugin.scrapeActorInfo("https://javdb.com/users/collection_actors", [])).rejects.toThrow("分页地址越界");
    });

    it("rejects page 201 before requesting it", async () => {
        const harness = createHarness();
        harness.plugin.javDbUrl = "https://javdb.com", harness.gmHttp.get.mockImplementation(async url => {
            const page = Number(new URL(url).searchParams.get("page") || 1), next = page < 201 ? `<a class="pagination-next" href="?page=${page + 1}"></a>` : "";
            return `<div id="actors"><div class="actor-box"><a title="A${page}" href="/actors/a${page}"></a></div></div>${next}`;
        });
        await expect(harness.plugin.scrapeActorInfo("https://javdb.com/users/collection_actors", [])).rejects.toThrow("超过 200 页");
        expect(harness.gmHttp.get).toHaveBeenCalledTimes(200);
    });
});

describe("background task failure isolation", () => {
    it("continues new-video detection after an ordinary favorite parse failure", async () => {
        const harness = createHarness();
        harness.$("body").append('<a href="/users/profile">profile</a>');
        harness.gmHttp.get.mockResolvedValue('<form action="/users/sign_in"></form>');

        await harness.plugin.doTask();

        expect(harness.values.has("jhs_time_checkFavoriteActress")).toBe(false);
        expect(Number(harness.values.get("jhs_time_checkFavoriteActress_next"))).toBe(harness.clock.now + 300000);
        expect(harness.values.get("jhs_time_checkNewVideo")).toMatch(/^2026-/);
    });

    it("continues after an ordinary favorite network failure but stops on global blocks", async () => {
        const ordinary = createHarness();
        ordinary.$("body").append('<a href="/users/profile">profile</a>');
        ordinary.gmHttp.get.mockRejectedValue(new Error("offline"));
        ordinary.plugin.checkNewVideo = vi.fn(async () => ({ attempted: true, completed: true, fatal: false }));
        await ordinary.plugin.doTask();
        expect(ordinary.plugin.checkNewVideo).toHaveBeenCalledOnce();

        for (const flag of [ "_cfBlocked", "_circuitBroken" ]) {
            const blocked = createHarness();
            blocked.$("body").append('<a href="/users/profile">profile</a>');
            const error = Object.assign(new Error("blocked"), { [flag]: true });
            blocked.gmHttp.get.mockRejectedValue(error);
            blocked.plugin.checkNewVideo = vi.fn();
            await blocked.plugin.doTask();
            expect(blocked.plugin.checkNewVideo).not.toHaveBeenCalled();
            expect(Number(blocked.values.get("jhs_time_checkFavoriteActress_next"))).toBe(blocked.clock.now + 300000);
        }
    });

    it("continues after an ordinary blacklist failure and stops on a global blacklist block", async () => {
        const ordinary = createHarness();
        ordinary.blacklistItems.push({ starId: "a", name: "A", url: "https://javdb.com/actors/a", createTime: "1" });
        ordinary.gmHttp.get.mockResolvedValue('<div class="movie-list"></div>');
        ordinary.beans.BlacklistPlugin.parseAndSaveFilterInfo = vi.fn(async () => { throw new Error("parse failed"); });
        ordinary.plugin.checkNewVideo = vi.fn(async () => ({ attempted: true, completed: true, fatal: false }));
        await ordinary.plugin.doTask();
        expect(ordinary.plugin.checkNewVideo).toHaveBeenCalledOnce();
        expect(ordinary.values.has("jhs_time_checkBlacklist")).toBe(false);

        const blocked = createHarness();
        blocked.blacklistItems.push({ starId: "a", name: "A", url: "https://javdb.com/actors/a", createTime: "1" });
        blocked.gmHttp.get.mockRejectedValue(Object.assign(new Error("blocked"), { _cfBlocked: true }));
        blocked.plugin.checkFavoriteActress = vi.fn();
        blocked.plugin.checkNewVideo = vi.fn();
        await blocked.plugin.doTask();
        expect(blocked.plugin.checkFavoriteActress).not.toHaveBeenCalled();
        expect(blocked.plugin.checkNewVideo).not.toHaveBeenCalled();
    });
});

describe("blacklist source resolution", () => {
    it("resolves configured hosts and supported mirrors without reading page text", async () => {
        const harness = createHarness();
        harness.beans.OtherSitePlugin.getJavDbUrl.mockReturnValue("https://private-db.example");
        harness.beans.OtherSitePlugin.getJavBusUrl.mockReturnValue("https://private-bus.example");
        await expect(harness.plugin.resolveBlacklistSite("https://private-db.example/actors/a")).resolves.toBe("javdb");
        await expect(harness.plugin.resolveBlacklistSite("https://private-bus.example/star/a")).resolves.toBe("javbus");
        await expect(harness.plugin.resolveBlacklistSite("https://javdb521.com/actors/a")).resolves.toBe("javdb");
        await expect(harness.plugin.resolveBlacklistSite("https://mirror.javsee.com/star/a")).resolves.toBe("javbus");
        await expect(harness.plugin.resolveBlacklistSite("https://seejav.example/star/a")).resolves.toBe("javbus");
        await expect(harness.plugin.resolveBlacklistSite("https://example.com/actors/a")).resolves.toBeNull();
        await expect(harness.plugin.resolveBlacklistSite("not-a-url")).resolves.toBeNull();
    });

    it("accepts a JavDB mirror item even when the configured base URL is the default host", async () => {
        const harness = createHarness("2026-08-23T13:20:00.789", "https://javdb521.com/");
        harness.blacklistItems.push({ starId: "a", name: "A", url: "https://javdb521.com/actors/a", createTime: "1" });
        harness.plugin.taskConfig = { checkConcurrencyCount: 2, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0 };
        harness.plugin.javDbUrl = "https://javdb.com", harness.gmHttp.get.mockResolvedValue('<div class="movie-list"></div>');
        harness.beans.BlacklistPlugin.parseAndSaveFilterInfo = vi.fn(async () => ({ lastPublishTime: null }));
        await expect(harness.plugin.checkBlacklist()).resolves.toMatchObject({ completed: true, parseFailed: 0 });
        expect(harness.beans.BlacklistPlugin.parseAndSaveFilterInfo).toHaveBeenCalledWith(expect.anything(), "A", "a", "javdb");
    });

    it("passes the URL-derived site into automatic blacklist parsing", async () => {
        for (const [pageUrl, itemUrl, site, html] of [
            [ "https://javdb.com/", "https://javdb.com/actors/a", "javdb", '<div class="movie-list"></div>' ],
            [ "https://www.javbus.com/", "https://www.javbus.com/star/a", "javbus", '<div class="masonry"></div><div id="waterfall"></div>' ]
        ]) {
            const harness = createHarness("2026-08-23T13:20:00.789", pageUrl);
            harness.blacklistItems.push({ starId: "a", name: "A", url: itemUrl, createTime: "1" });
            harness.plugin.taskConfig = { checkConcurrencyCount: 2, checkRequestSleep: 0, checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0 };
            harness.plugin.javDbUrl = "https://javdb.com", harness.gmHttp.get.mockResolvedValue(html);
            harness.beans.BlacklistPlugin.parseAndSaveFilterInfo = vi.fn(async () => ({ lastPublishTime: null }));
            await harness.plugin.checkBlacklist();
            expect(harness.beans.BlacklistPlugin.parseAndSaveFilterInfo).toHaveBeenCalledWith(expect.anything(), "A", "a", site);
        }
    });
});
