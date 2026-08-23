import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import jqueryFactory from "jquery";
import { JSDOM } from "jsdom";
import { describe, expect, it, vi } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function createHarness(initialTime = "2026-08-23T13:20:00.789", pageUrl = "https://javdb.com/") {
    const clock = { now: new Date(initialTime).getTime() };
    class ClockDate extends Date {
        constructor(...args) { super(...(args.length ? args : [ clock.now ])); }
        static now() { return clock.now; }
    }
    const dom = new JSDOM('<body><div id="checkNewVideoMsg"></div><div id="checkBlacklistMsg"></div></body>', { url: pageUrl }), $ = jqueryFactory(dom.window), values = new Map;
    const settings = {
        checkConcurrencyCount: 2, checkRequestSleep: 0,
        checkBlacklist_intervalTime: 12, checkBlacklist_ruleTime: 0,
        checkFavoriteActress_IntervalTime: 24,
        checkNewVideo_intervalTime: 12, checkNewVideo_ruleTime: 0
    }, favorites = [], blacklistItems = [];
    const storageManager = {
        setting_key: "setting", _invalidateCache: vi.fn(),
        getSetting: vi.fn(async (key = null, fallback) => null == key ? { ...settings } : Object.prototype.hasOwnProperty.call(settings, key) ? settings[key] : fallback),
        getFavoriteActressList: vi.fn(async () => favorites), getBlacklist: vi.fn(async () => blacklistItems), getTitleFilterKeyword: vi.fn(async () => []), getBlacklistCarList: vi.fn(async () => []),
        addFavoriteActressList: vi.fn(async () => {}), updateFavoriteActress: vi.fn(async () => true), updateBlacklistItem: vi.fn(async update => Object.assign(blacklistItems.find(item => item.starId === update.starId), update)), getCarMap: vi.fn(async () => new Map)
    };
    const localStorage = { getItem: vi.fn(key => values.has(key) ? values.get(key) : null), setItem: vi.fn((key, value) => values.set(key, String(value))), removeItem: vi.fn(key => values.delete(key)) };
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
    const gmHttp = { get: vi.fn() }, beans = {
        OtherSitePlugin: { getJavDbUrl: vi.fn(async () => "https://javdb.com"), getJavBusUrl: vi.fn(async () => "https://www.javbus.com") },
        NewVideoPlugin: { loadData: vi.fn(async () => {}), resetBtnTip: vi.fn(async () => {}) },
        BlacklistPlugin: { resetBtnTip: vi.fn(async () => {}) },
        ListPagePlugin: { findCarNumAndHref: element => ({ carNum: element.attr("data-car"), url: element.attr("data-url"), title: element.attr("data-title") || "", publishTime: element.attr("data-date") || "" }) }
    };
    class BasePlugin {
        getBean(name) { return beans[name]; }
        getSelector(site = "javdb") { return site === "javbus" ? { boxSelector: ".masonry", itemSelector: ".masonry .item", requestDomItemSelector: "#waterfall .item", nextPageSelector: "#next" } : { boxSelector: ".movie-list", itemSelector: ".movie-list .item", requestDomItemSelector: ".movie-list .item", nextPageSelector: ".pagination-next" }; }
    }
    class StorageQueue { async addTask(task) { return task(); } async waitAllFinished() {} }
    const format = timestamp => {
        const date = new ClockDate(timestamp), pad = value => String(value).padStart(2, "0");
        return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
    };
    const context = vm.createContext({
        console, URL, Date: ClockDate, Math, Number, Object, Array, Map, Set, Promise, globalThis: null,
        window: Object.assign(dom.window, { isListPage: true }), document: dom.window.document, navigator: { locks }, localStorage, gmHttp, storageManager, $, BasePlugin, StorageQueue,
        T: "javdb", I: "javbus", D: "censored", A: "uncensored", _: "yes", l: false,
        utils: { sleep: vi.fn(async () => {}), getNowStr: (a = "-", b = ":", timestamp = null) => format(null == timestamp ? clock.now : timestamp), getHourDifference: (left, right) => Math.floor(Math.abs(right.getTime() - left.getTime()) / 36e5), genericSort: items => [ ...items ], htmlTo$dom: html => $(new JSDOM(html, { url: "https://javdb.com/" }).window.document) },
        clog: { log: vi.fn(), debug: vi.fn(), error: vi.fn(), warn: vi.fn() }, show: { info: vi.fn(), error: vi.fn() }, i: (target, key, value) => target[key] = value,
        jhsEventBus, normalizeCarNum: value => String(value || "").toUpperCase(),
        setTimeout, clearTimeout
    });
    context.globalThis = context;
    const source = [ "src/core/site-context.js", "src/core/feature-helpers.js", "src/parsers/third-party-parsers.js", "src/plugins/new-video/task.js" ].map(file => readFileSync(join(repoRoot, file), "utf8")).join("\n");
    vm.runInContext(`${source};globalThis.Task=TaskPlugin`, context);
    const plugin = new context.Task;
    return { plugin, clock, values, settings, favorites, blacklistItems, storageManager, gmHttp, beans, locks, jhsEventBus, $, htmlToPage: context.utils.htmlTo$dom };
}

describe("task scheduler state machine", () => {
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
        harness.storageManager.getSetting.mockImplementationOnce(() => new Promise(resolve => { release = resolve; }));
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
        harness.storageManager.getSetting.mockImplementationOnce(() => new Promise(resolve => { releaseOld = resolve; }));
        const oldLoad = harness.plugin.loadConfig();
        harness.settings.checkNewVideo_intervalTime = 3;
        const newLoad = harness.plugin.loadConfig();
        releaseOld({ ...harness.settings, checkNewVideo_intervalTime: 12 });
        await Promise.all([oldLoad, newLoad]);
        expect(harness.plugin.taskConfig.checkNewVideo_intervalTime).toBe(3);
        expect(harness.storageManager.getSetting).toHaveBeenCalledTimes(2);
    });

    it("recalculates schedules once for one settings-changed notification", async () => {
        const harness = createHarness();
        harness.plugin.runAndSchedule = vi.fn(async () => {}), harness.plugin.scheduleTask = vi.fn();
        const recalculate = vi.spyOn(harness.plugin, "recalculateSchedules");
        await harness.plugin.handle();
        await harness.jhsEventBus.emit("settings-changed", {});
        expect(recalculate).toHaveBeenCalledOnce();
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
        harness.plugin.parsePage = vi.fn(async (page, site, starId) => {
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

    it("records the maximum real publication date before inbox filters", async () => {
        const harness = createHarness(), page = harness.htmlToPage('<div class="movie-list"><div class="item" data-car="A-1" data-url="/v/1" data-title="normal" data-date="2026-08-01"></div><div class="item" data-car="B-1" data-url="/v/2" data-title="filtered title" data-date="2026-09-03"></div><div class="item" data-car="C-1" data-url="/v/3" data-title="normal" data-date="2026-08-20"></div></div>');
        harness.plugin.javDbUrl = "https://javdb.com";
        harness.storageManager.getCarMap.mockResolvedValue(new Map([[ "C-1", {} ]]));
        await harness.plugin.parsePage(page, "javdb", "actor", "Actor", [ "filtered" ], new Set);
        expect(harness.storageManager.updateFavoriteActress).toHaveBeenCalledWith(expect.objectContaining({
            starId: "actor", lastPublishTime: "2026-09-03", newVideoList: [ expect.objectContaining({ carNum: "A-1" }) ]
        }));
    });

    it("completes a structurally valid empty actress sync and rejects a login page", async () => {
        const empty = createHarness();
        empty.plugin.taskConfig = { checkFavoriteActress_IntervalTime: 24 }, empty.plugin.javDbUrl = "https://javdb.com";
        empty.gmHttp.get.mockResolvedValue('<div id="actors"></div>');
        await expect(empty.plugin.checkFavoriteActress()).resolves.toMatchObject({ success: 0, pages: 1 });
        expect(empty.values.get("jhs_time_checkFavoriteActress")).toMatch(/^2026-/);
        expect(empty.storageManager.addFavoriteActressList).not.toHaveBeenCalled();

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
        harness.beans.OtherSitePlugin.getJavDbUrl.mockResolvedValue("https://private-db.example");
        harness.beans.OtherSitePlugin.getJavBusUrl.mockResolvedValue("https://private-bus.example");
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
