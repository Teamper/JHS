import { describe, expect, it, vi } from "vitest";
import { StorageManager } from "../src/core/storage.js";
import { normalizePortableData } from "../src/core/migration.js";
import { emptySyncModel, materializeSyncData, projectSyncData, validateSyncState, versionSyncDiff } from "../src/core/webdav-sync-model.js";
import { CACHE_TTL } from "../src/core/cache-policy.js";
import { LifecycleScope } from "../src/core/lifecycle-scope.js";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";

describe("NewVideoScanController", () => {
    it("keeps an already queued work after it is saved when queue decisions are independent", async () => {
        const state = {
            getCarMap: async () => new Map([["ABC-123", {}], ["ABC-456", {}]]),
            getNewVideoDecisions: async () => ({}),
            getFavoriteActressList: async () => [{ starId: "actor", newVideoList: ["ABC-123"] }],
            updateFavoriteActress: vi.fn(async () => true),
        };
        const controller = new NewVideoScanController({
            state, preserveNewVideo: true, getTimestamp: () => "2026-11-21", onNewItems: vi.fn(),
        });
        await expect(controller.parseActorMovies([{ carNum: "ABC-123" }, { carNum: "ABC-456" }], "actor", "Actor", [], new Set())).resolves.toBe(0);
        expect(state.updateFavoriteActress.mock.lastCall[0].newVideoList.map(item => item.carNum)).toEqual(["ABC-123"]);
    });

    it("does not wait for another background permit after its final actor completed", async () => {
        const state = { getFavoriteActressList: async () => [{ starId: "a1", name: "Actor" }], getBlacklistCarList: async () => [], updateFavoriteActress: async () => true };
        let permits = 0;
        const controller = new NewVideoScanController({ state, readTitleKeywords: async () => [], actressInfo: { movies: async () => [] }, scope: {}, getTimestamp: () => "2026-10-24", onNewItems() {}, backgroundWork: { waitForTurn: async () => { if (++permits > 1) throw new Error("empty batch requested a permit"); } } });
        await expect(controller.scanActresses({ baseUrl: "https://javdb.com", concurrency: 1, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: false, isUnnecessaryCheck: () => false, isNetworkBlocked: () => false, sleep: async () => {} })).resolves.toMatchObject({ success: 1 });
        expect(permits).toBe(1);
    });

    it("filters persisted candidates and reports only undiscovered, non-dismissed works", async () => {
        const carMap = new Map([["SEEN-004", { carNum: "SEEN-004" }]]);
        const state = {
            getCarMap: vi.fn(async () => carMap),
            getNewVideoDecisions: vi.fn(async () => ({ "DISMISSED-005": { action: "dismissed" } })),
            updateFavoriteActress: vi.fn(async () => true),
        };
        const onNewItems = vi.fn(), controller = new NewVideoScanController({ state, getTimestamp: () => "2026-09-27 15:00:00", onNewItems });
        const items = [
            { carNum: "ABC-123", title: "New release", publishTime: "2026-09-20", score: "4.5", voteCount: "22", url: "/v/abc-123" },
            { carNum: "BLOCK-002", title: "Blocked", publishTime: "2026-09-22" },
            { carNum: "FILTER-003", title: "Special keyword", publishTime: "2026-09-23" },
            { carNum: "SEEN-004", title: "Already known", publishTime: "2026-09-24" },
            { carNum: "DISMISSED-005", title: "Dismissed", publishTime: "2026-09-25" },
        ];

        await expect(controller.parseActorMovies(items, "actor-1", "Actor One", ["keyword"], new Set(["BLOCK-002"]))).resolves.toBe(1);
        expect(state.updateFavoriteActress).toHaveBeenCalledWith({
            starId: "actor-1", lastCheckTime: "2026-09-27 15:00:00", lastPublishTime: "2026-09-25",
            newVideoList: [
                { carNum: "ABC-123", coverUrl: "", title: "New release", publishTime: "2026-09-20", score: 4.5, voteCount: 22, url: "/v/abc-123" },
                { carNum: "DISMISSED-005", coverUrl: "", title: "Dismissed", publishTime: "2026-09-25", score: 0, voteCount: 0, url: "" },
            ],
        }, { scan: true });
        expect(onNewItems).toHaveBeenCalledWith("Actor One", 1);
    });

    it("clears a previously stored list when the actor has no works", async () => {
        const state = { updateFavoriteActress: vi.fn(async () => true) };
        const controller = new NewVideoScanController({ state, getTimestamp: () => "2026-09-27 15:00:00", onNewItems: vi.fn() });

        await expect(controller.parseActorMovies([], "actor-1", "Actor One", [], new Set())).resolves.toBe(0);
        expect(state.updateFavoriteActress).toHaveBeenCalledWith({ starId: "actor-1", lastCheckTime: "2026-09-27 15:00:00", newVideoList: [] }, { scan: true });
    });

    it.each([[[]], [[{ carNum: "ABC-123", title: "New release" }]]])("does not report new work when another tab removed the actor before persistence: %j", async items => {
        const state = {
            getCarMap: vi.fn(async () => new Map()), getNewVideoDecisions: vi.fn(async () => ({})),
            updateFavoriteActress: vi.fn(async () => false),
        };
        const onNewItems = vi.fn();
        const controller = new NewVideoScanController({ state, getTimestamp: () => "2026-09-29", onNewItems });

        await expect(controller.parseActorMovies(items, "removed", "Removed Actor", [], new Set())).rejects.toThrow("演员记录已不存在");
        expect(state.updateFavoriteActress).toHaveBeenCalledOnce();
        expect(onNewItems).not.toHaveBeenCalled();
    });

    it("counts a concurrent actor removal as a failed save instead of a successful scan", async () => {
        const state = {
            getFavoriteActressList: vi.fn(async () => [{ starId: "removed", name: "Removed Actor", lastPublishTime: "2026-09-22" }]),
            getBlacklistCarList: vi.fn(async () => []), getCarMap: vi.fn(async () => new Map()),
            getNewVideoDecisions: vi.fn(async () => ({})), updateFavoriteActress: vi.fn(async () => false),
        };
        const controller = new NewVideoScanController({
            state, readTitleKeywords: vi.fn(async () => []),
            actressInfo: { movies: vi.fn(async () => [{ carNum: "ABC-123" }]) }, scope: {},
            logger: { html: vi.fn(), error: vi.fn(), warn: vi.fn() }, getTimestamp: () => "2026-09-29", onNewItems: vi.fn(),
        });

        const result = await controller.scanActresses({
            baseUrl: "https://javdb.com", concurrency: 1, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: true,
            isUnnecessaryCheck: () => false, isNetworkBlocked: () => false, sleep: async () => {},
        });
        expect(result).toMatchObject({ success: 0, parseFailed: 1, networkFailed: 0 });
    });

    it("does not write a scan result after the controller is disposed during reads", async () => {
        let resolveCarMap;
        const state = {
            getCarMap: () => new Promise((resolve) => { resolveCarMap = resolve; }),
            getNewVideoDecisions: async () => ({}),
            updateFavoriteActress: vi.fn(),
        };
        const controller = new NewVideoScanController({ state, getTimestamp: () => "2026-09-27", onNewItems: vi.fn() });
        const pending = controller.parseActorMovies([{ carNum: "ABC-123" }], "actor-1", "Actor One", [], new Set());
        controller.dispose();
        resolveCarMap(new Map());

        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(state.updateFavoriteActress).not.toHaveBeenCalled();
    });

    it.each([
        [[], 0], [[{ carNum: "ABC-001" }], 1],
    ])("keeps a committed actor scan when the feature closes during the storage write: %j", async (items, count) => {
        let finishWrite;
        const state = {
            getCarMap: async () => new Map(), getNewVideoDecisions: async () => ({}),
            updateFavoriteActress: vi.fn(() => new Promise(resolve => { finishWrite = resolve; })),
        };
        const onNewItems = vi.fn();
        const controller = new NewVideoScanController({ state, getTimestamp: () => "2026-09-29", onNewItems });
        const pending = controller.parseActorMovies(items, "actor", "Actor", [], new Set());
        await vi.waitFor(() => expect(finishWrite).toBeTypeOf("function"));
        controller.dispose();
        finishWrite(true);

        await expect(pending).resolves.toBe(count);
        expect(state.updateFavoriteActress).toHaveBeenCalledOnce();
        expect(onNewItems).not.toHaveBeenCalled();
    });

    it("owns actor ordering, interval and stopped filters, concurrent fetches, and result writes", async () => {
        const state = {
            getFavoriteActressList: vi.fn(async () => [
                { starId: "old", name: "Old", lastPublishTime: "2010-01-01", newVideoList: Array(99).fill({}) },
                { starId: "interval", name: "Interval", lastPublishTime: "2026-09-20", lastCheckTime: "recent", newVideoList: Array(10).fill({}) },
                { starId: "secondary", name: "Secondary", lastPublishTime: "2026-09-21", newVideoList: [{}] },
                { starId: "primary", name: "Primary", lastPublishTime: "2026-09-22", newVideoList: [{}, {}] },
            ]),
            getBlacklistCarList: vi.fn(async () => [{ carNum: "BLOCK-001" }]),
            getCarMap: vi.fn(async () => new Map()), getNewVideoDecisions: vi.fn(async () => ({})),
            updateFavoriteActress: vi.fn(async () => true),
        };
        const requested = [], actressInfo = { movies: vi.fn(async (_provider, { actorId }) => {
            requested.push(actorId);
            return [{ carNum: `${actorId}-001` }, { carNum: "BLOCK-001" }];
        }) };
        const logger = { html: vi.fn(), error: vi.fn(), warn: vi.fn() }, sleep = vi.fn(async () => {});
        const controller = new NewVideoScanController({
            state, readTitleKeywords: vi.fn(async () => []), actressInfo, scope: {}, logger,
            getTimestamp: () => "2026-09-27 15:00:00", onNewItems: vi.fn(),
        });

        const result = await controller.scanActresses({
            baseUrl: "https://javdb.com", concurrency: 1, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: false,
            isUnnecessaryCheck: (_date, interval) => interval === 12,
            isNetworkBlocked: () => false, sleep,
        });

        expect(requested).toEqual(["primary", "secondary"]);
        expect(result).toMatchObject({ actressCount: 4, eligibleCount: 2, success: 2, skippedInterval: 1, skippedStopped: 1, networkFailed: 0, parseFailed: 0 });
        expect(state.getBlacklistCarList).toHaveBeenCalledOnce();
        expect(state.updateFavoriteActress).toHaveBeenCalledTimes(2);
        expect(state.updateFavoriteActress).toHaveBeenCalledWith(expect.objectContaining({ starId: "primary", newVideoList: [expect.objectContaining({ carNum: "primary-001" })] }), { scan: true });
        expect(sleep).toHaveBeenCalledWith(0);
    });

    it("stops claiming actors after a blocked request and reports the unstarted remainder", async () => {
        const state = {
            getFavoriteActressList: vi.fn(async () => [
                { starId: "one", lastPublishTime: "2026-09-22" },
                { starId: "two", lastPublishTime: "2026-09-21" },
                { starId: "three", lastPublishTime: "2026-09-20" },
            ]),
            getBlacklistCarList: vi.fn(async () => []), getCarMap: vi.fn(async () => new Map()),
            getNewVideoDecisions: vi.fn(async () => ({})), updateFavoriteActress: vi.fn(),
        };
        const blocked = Object.assign(new Error("blocked"), { code: "CF_BLOCKED" });
        const actressInfo = { movies: vi.fn(async () => { throw blocked; }) };
        const controller = new NewVideoScanController({
            state, readTitleKeywords: vi.fn(async () => []), actressInfo, scope: {},
            logger: { html: vi.fn(), error: vi.fn(), warn: vi.fn() }, getTimestamp: () => "2026-09-27",
            onNewItems: vi.fn(),
        });

        const result = await controller.scanActresses({
            baseUrl: "https://javdb.com", concurrency: 1, sleepMs: 0, intervalHours: 12, ruleHours: 8760, force: true,
            isUnnecessaryCheck: () => false, isNetworkBlocked: error => error?.code === "CF_BLOCKED", sleep: async () => {},
        });

        expect(actressInfo.movies).toHaveBeenCalledOnce();
        expect(result).toMatchObject({ fatal: true, networkFailed: 1, aborted: 2, blockedError: blocked });
    });

    it("routes manual single-actress rechecks through injected services and keeps the record schema", async () => {
        const scope = {}, state = {
            getBlacklistCarList: vi.fn(async () => [{ carNum: "BLOCK-001" }]),
            getCarMap: vi.fn(async () => new Map()), getNewVideoDecisions: vi.fn(async () => ({})),
            updateFavoriteActress: vi.fn(async () => true),
        };
        const actressInfo = { movies: vi.fn(async () => [{ carNum: "ACTOR-001", title: "Synthetic title" }]) };
        const readTitleKeywords = vi.fn(async () => []), onActorStart = vi.fn();
        const controller = new NewVideoScanController({
            state, readTitleKeywords, actressInfo, scope, logger: { warn: vi.fn() },
            getTimestamp: () => "2026-09-27 15:00:00", onNewItems: vi.fn(),
        });

        await expect(controller.scanActress({ starId: "actor-1", name: "Actor One" }, { baseUrl: "https://javdb.com", onActorStart })).resolves.toBe(1);
        expect(onActorStart).toHaveBeenCalledWith({ starId: "actor-1", name: "Actor One" }, "https://javdb.com/actors/actor-1?t=d");
        expect(actressInfo.movies).toHaveBeenCalledWith("javdb", { actorId: "actor-1", baseUrl: "https://javdb.com" }, { scope, ttlMs: 0 });
        expect(state.updateFavoriteActress).toHaveBeenCalledWith({
            starId: "actor-1", lastCheckTime: "2026-09-27 15:00:00", lastPublishTime: null,
            newVideoList: [{ carNum: "ACTOR-001", coverUrl: "", title: "Synthetic title", publishTime: "", score: 0, voteCount: 0, url: "" }],
        }, { scan: true });
    });

    it("keeps migrated works through manual and scheduled scans, sync, and an in-flight removal", async () => {
        let favoriteActresses = [
            { starId: "old", name: "Actor", newVideoList: ["OLD-001", "AMBIGUOUS", { carNum: "LIVE-003", title: "Old title" }] },
            { starId: "new", name: "Actor", newVideoList: ["TARGET-002"] },
            { starId: "normal", name: "Other", newVideoList: ["NORMAL-004"] },
        ];
        let decisions = {};
        const state = Object.create(StorageManager.prototype);
        Object.assign(state, {
            favorite_actresses_key: "favorite_actresses",
            _actressLock: Promise.resolve(),
            getFavoriteActressList: async () => favoriteActresses,
            getBlacklistCarList: async () => [],
            getCarMap: async () => new Map(),
            getNewVideoDecisions: async () => decisions,
            _setItemAndInvalidate: async (_key, value) => { favoriteActresses = value; },
            stateService: state,
        });
        vi.stubGlobal("utils", { getNowStr: () => "2026-11-18 10:00:00" });
        try {
            const { actress } = await state.rebindFavoriteActress({ fromStarId: "old", toStarId: "new" });
            const movies = vi.fn(async () => [{ carNum: "LIVE-003", title: "Updated title" }]);
            const controller = new NewVideoScanController({
                state, readTitleKeywords: async () => [], actressInfo: { movies },
                scope: new LifecycleScope("rebind-scan"), getTimestamp: utils.getNowStr, onNewItems: vi.fn(),
            });
            await controller.scanActress(actress, { baseUrl: "https://javdb.com" });
            const getVideos = () => favoriteActresses.find(actor => actor.starId === "new").newVideoList;
            expect(getVideos()).toEqual([
                expect.objectContaining({ carNum: "LIVE-003", title: "Updated title", retainedAfterRebind: true }),
                { carNum: "OLD-001", retainedAfterRebind: true },
                { carNum: "AMBIGUOUS", retainedAfterRebind: true },
            ]);

            const replica = "aa4bd732-dfaa-4dfa-8e17-6dec447c1dfe";
            const backup = normalizePortableData({ data_version: 4, favorite_actresses: favoriteActresses }).data;
            const { model } = versionSyncDiff(emptySyncModel(), {}, projectSyncData(backup), [1, replica]);
            favoriteActresses = materializeSyncData(validateSyncState(model), backup).favorite_actresses;
            decisions = { "OLD-001": { action: "dismissed" }, "NORMAL-004": { action: "dismissed" } };
            movies.mockResolvedValueOnce([{ carNum: "NORMAL-004" }]);
            const normal = favoriteActresses.find(actor => actor.starId === "normal");
            await controller.scanActress(normal, { baseUrl: "https://javdb.com" });
            expect(favoriteActresses.find(actor => actor.starId === "normal").newVideoList)
                .toEqual([expect.objectContaining({ carNum: "NORMAL-004" })]);

            movies.mockResolvedValue([]);
            await controller.scanActresses({
                baseUrl: "https://javdb.com", concurrency: 1, sleepMs: 0, intervalHours: 12,
                ruleHours: 8760, force: true, isUnnecessaryCheck: () => false,
                isNetworkBlocked: () => false, sleep: async () => {},
            });
            expect(getVideos().map(movie => movie.carNum).sort()).toEqual(["AMBIGUOUS", "LIVE-003", "OLD-001"]);
            expect(favoriteActresses.find(actor => actor.starId === "normal").newVideoList).toEqual([]);

            let finishFetch;
            movies.mockImplementationOnce(() => new Promise(resolve => { finishFetch = resolve; }));
            const scanning = controller.scanActress(actress, { baseUrl: "https://javdb.com" });
            await vi.waitFor(() => expect(finishFetch).toBeTypeOf("function"));
            await state.updateFavoriteActress({ starId: "new", newVideoList: getVideos().filter(movie => movie.carNum !== "OLD-001") });
            finishFetch([{ carNum: "OLD-001", title: "Still on the server" }]);
            await scanning;
            expect(getVideos().map(movie => movie.carNum).sort()).toEqual(["AMBIGUOUS", "LIVE-003"]);
        } finally {
            vi.unstubAllGlobals();
        }
    });

    it("syncs every collection page before writing the merged actress list", async () => {
        const state = { addFavoriteActressList: vi.fn(async () => true) };
        const fetched = [];
        const actressInfo = { collection: vi.fn(async (_provider, { pageUrl }) => {
            fetched.push(pageUrl);
            expect(state.addFavoriteActressList).not.toHaveBeenCalled();
            return pageUrl.includes("page=2")
                ? { state: "valid", actors: [{ starId: "actor-2", name: "Actor Two" }], nextUrl: null, isEmpty: false }
                : { state: "valid", actors: [{ starId: "actor-1", name: "Actor One" }], nextUrl: "/users/collection_actors?page=2", isEmpty: false };
        }) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: {}, getTimestamp: () => "2026-09-27", onNewItems: vi.fn() });

        await expect(controller.syncFavoriteActresses({ baseUrl: "https://javdb.com", startUrl: "https://javdb.com/users/collection_actors" }))
            .resolves.toEqual({ actors: [{ starId: "actor-1", name: "Actor One" }, { starId: "actor-2", name: "Actor Two" }], pages: 2 });
        expect(fetched).toEqual([
            "https://javdb.com/users/collection_actors",
            "https://javdb.com/users/collection_actors?page=2",
        ]);
        expect(state.addFavoriteActressList).toHaveBeenCalledOnce();
        expect(state.addFavoriteActressList).toHaveBeenCalledWith([
            { starId: "actor-1", name: "Actor One" }, { starId: "actor-2", name: "Actor Two" },
        ]);
    });

    it.each([
        ["empty page with a next link", (_url) => ({ state: "valid", actors: [], nextUrl: "?page=2", isEmpty: true })],
        ["invalid page state", (_url) => ({ state: "invalid", actors: [], nextUrl: null, isEmpty: false })],
        ["cross-path pagination", (_url) => ({ state: "valid", actors: [{ starId: "uncommitted" }], nextUrl: "/actors/other", isEmpty: false })],
        ["pagination cycle", (url) => ({ state: "valid", actors: [{ starId: "uncommitted" }], nextUrl: url, isEmpty: false })],
    ])("does not commit a partial actress list after %s", async (_label, makePage) => {
        const state = { addFavoriteActressList: vi.fn(async () => true) };
        const actressInfo = { collection: vi.fn(async (_provider, { pageUrl }) => makePage(pageUrl)) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: {}, getTimestamp: () => "2026-09-27", onNewItems: vi.fn() });

        await expect(controller.syncFavoriteActresses({ baseUrl: "https://javdb.com", startUrl: "https://javdb.com/users/collection_actors" }))
            .rejects.toMatchObject({ _taskParse: true });
        expect(state.addFavoriteActressList).not.toHaveBeenCalled();
    });

    it("stops collection pagination at 200 pages without committing", async () => {
        const state = { addFavoriteActressList: vi.fn() };
        const actressInfo = { collection: vi.fn(async (_provider, { pageUrl }) => {
            const current = Number(new URL(pageUrl).searchParams.get("page") || 1);
            return { state: "valid", actors: [{ starId: `actor-${current}` }], nextUrl: `?page=${current + 1}`, isEmpty: false };
        }) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: {}, getTimestamp: () => "2026-09-27", onNewItems: vi.fn() });

        await expect(controller.syncFavoriteActresses({ baseUrl: "https://javdb.com", startUrl: "https://javdb.com/users/collection_actors" }))
            .rejects.toMatchObject({ _taskParse: true, message: "收藏演员分页超过 200 页" });
        expect(actressInfo.collection).toHaveBeenCalledTimes(200);
        expect(state.addFavoriteActressList).not.toHaveBeenCalled();
    });

    it("classifies collection request failures for the existing retry result", async () => {
        const state = { addFavoriteActressList: vi.fn() };
        const networkError = Object.assign(new Error("offline"), { code: "TIMEOUT" });
        const actressInfo = { collection: vi.fn(async () => { throw networkError; }) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: {}, getTimestamp: () => "2026-09-27", onNewItems: vi.fn() });

        await expect(controller.syncFavoriteActresses({ baseUrl: "https://javdb.com", startUrl: "https://javdb.com/users/collection_actors" }))
            .rejects.toMatchObject({ _taskNetwork: true, code: "TIMEOUT" });
        expect(state.addFavoriteActressList).not.toHaveBeenCalled();
    });

    it("does not commit a collection response that returns after the Feature closes", async () => {
        let resolvePage;
        const state = { addFavoriteActressList: vi.fn() };
        const actressInfo = { collection: () => new Promise((resolve) => { resolvePage = resolve; }) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: {}, getTimestamp: () => "2026-09-27", onNewItems: vi.fn() });
        const pending = controller.syncFavoriteActresses({ baseUrl: "https://javdb.com", startUrl: "https://javdb.com/users/collection_actors" });
        await vi.waitFor(() => expect(resolvePage).toBeTypeOf("function"));
        controller.dispose();
        resolvePage({ state: "valid", actors: [{ starId: "late-actor" }], nextUrl: null, isEmpty: false });

        await expect(pending).rejects.toMatchObject({ name: "AbortError" });
        expect(state.addFavoriteActressList).not.toHaveBeenCalled();
    });

    it("keeps a committed collection sync when the feature closes during the storage write", async () => {
        let finishWrite;
        const state = { addFavoriteActressList: vi.fn(() => new Promise(resolve => { finishWrite = resolve; })) };
        const actressInfo = { collection: vi.fn(async () => ({ state: "valid", actors: [{ starId: "actor" }], nextUrl: null, isEmpty: false })) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: {}, getTimestamp: () => "2026-09-29" });
        const pending = controller.syncFavoriteActresses({ baseUrl: "https://javdb.com", startUrl: "https://javdb.com/users/collection_actors" });
        await vi.waitFor(() => expect(finishWrite).toBeTypeOf("function"));
        controller.dispose();
        finishWrite(true);

        await expect(pending).resolves.toEqual({ actors: [{ starId: "actor" }], pages: 1 });
        expect(state.addFavoriteActressList).toHaveBeenCalledOnce();
    });

    it("keeps a committed actress result when the optional count notification fails", async () => {
        const state = { getCarMap: vi.fn(async () => new Map()), getNewVideoDecisions: vi.fn(async () => ({})), updateFavoriteActress: vi.fn(async () => true) };
        const logger = { warn: vi.fn() }, controller = new NewVideoScanController({
            state, readTitleKeywords: async () => [], actressInfo: {}, scope: {}, logger, getTimestamp: () => "2026-09-27", onNewItems: () => { throw new Error("toast failed"); },
        });

        await expect(controller.parseActorMovies([{ carNum: "ABC-001" }], "actor", "Actor", [], new Set())).resolves.toBe(1);
        expect(state.updateFavoriteActress).toHaveBeenCalledOnce();
        expect(logger.warn).toHaveBeenCalledOnce();
    });

    it("does not turn a saved scan into a failure when both the count notification and its warning fail", async () => {
        const state = { getCarMap: vi.fn(async () => new Map()), getNewVideoDecisions: vi.fn(async () => ({})), updateFavoriteActress: vi.fn(async () => true) };
        const logger = { warn: vi.fn(() => { throw new Error("logger unavailable"); }) };
        const controller = new NewVideoScanController({
            state, logger, getTimestamp: () => "2026-09-29", onNewItems: () => { throw new Error("toast unavailable"); },
        });

        await expect(controller.parseActorMovies([{ carNum: "ABC-001" }], "actor", "Actor", [], new Set())).resolves.toBe(1);
        expect(state.updateFavoriteActress).toHaveBeenCalledOnce();
        expect(logger.warn).toHaveBeenCalledOnce();
    });

    it("backfills due favorite actress profiles, respects 7d/24h cooldowns, skips unchanged writes, preserves existing profiles on null lookup, and prunes orphans", async () => {
        const localStore = new Map([
            ["jhs_actress_profile_attempts_v1", JSON.stringify({
                schema: 2,
                entries: {
                    "fresh-pos": 1000,
                    "fresh-neg": 1000 + CACHE_TTL.actressInfoNegative - 100,
                    "orphan-id": 500,
                },
            })],
        ]);
        const storage = {
            getLocal: vi.fn((key) => localStore.get(key) ?? null),
            setLocal: vi.fn((key, value) => localStore.set(key, value)),
        };
        const existingProfile = {
            url: "https://ja.wikipedia.org/wiki/Existing",
            birthday: "1995年1月1日", age: "31岁", height: "160cm", weight: "45kg",
            threeSizeText: "85 - 58 - 86", braSize: "D", matchedName: "Existing",
        };
        const preservedProfile = {
            url: "https://ja.wikipedia.org/wiki/Preserved",
            birthday: "1996年2月2日", age: "30岁", height: "165cm", weight: "48kg",
            threeSizeText: "88 - 59 - 88", braSize: "E", matchedName: "Preserved",
        };
        const state = {
            getFavoriteActressList: vi.fn(async () => [
                { starId: "fresh-pos", name: "FreshPos", allName: ["Existing"], actressProfile: existingProfile, actressProfileVerifiedUrl: existingProfile.url },
                { starId: "fresh-neg", name: "FreshNeg" },
                { starId: "due-same", name: "DueSame", allName: ["Existing"], actressProfile: existingProfile, actressProfileVerifiedUrl: existingProfile.url },
                { starId: "due-null", name: "DueNull", allName: ["Preserved"], actressProfile: preservedProfile, actressProfileVerifiedUrl: preservedProfile.url },
                { starId: "due-new", name: "DueNew", allName: ["DueAlias"] },
            ]),
            batchUpdateFavoriteActressProfiles: vi.fn(async (updates) => updates.length),
        };
        const actressInfo = {
            lookupAny: vi.fn(async (names) => {
                if (names.includes("DueSame")) return { info: { ...existingProfile }, matchedName: "Existing" };
                if (names.includes("DueNull")) return null;
                if (names.includes("DueNew")) return { info: { url: "https://ja.wikipedia.org/wiki/DueNew", birthday: "1998年5月6日", age: "28岁", height: "158cm", weight: "", threeSizeText: "83 - 57 - 84", braSize: "C" }, matchedName: "DueAlias" };
                return null;
            }),
        };
        const scope = new LifecycleScope("test:backfill");
        const onProgress = vi.fn();
        const now = 1000 + CACHE_TTL.actressInfoNegative + 500;
        const controller = new NewVideoScanController({ state, actressInfo, storage, scope, getTimestamp: () => "2026-11-18", onNewItems: vi.fn() });

        const summary = await controller.backfillFavoriteProfiles({ now, concurrency: 2, delayMs: 0, onProgress });
        expect(summary).toEqual({ total: 3, updated: 1, unchanged: 2, failed: 0, rateLimited: 0 });
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(state.batchUpdateFavoriteActressProfiles).toHaveBeenCalledExactlyOnceWith([
            {
                starId: "due-new",
                actressProfile: {
                    url: "https://ja.wikipedia.org/wiki/DueNew",
                    birthday: "1998年5月6日", age: "28岁", height: "158cm", weight: "",
                    threeSizeText: "83 - 57 - 84", braSize: "C", matchedName: "DueAlias",
                },
            },
        ]);
        const persisted = JSON.parse(localStore.get("jhs_actress_profile_attempts_v1"));
        expect(persisted.entries["orphan-id"]).toBeUndefined();
        expect(persisted.entries["due-new"]).toBe(now);
        expect(persisted.entries["due-null"]).toBe(now);
        expect(persisted.entries["due-same"]).toBe(now);
        scope.dispose();
    });

    it("skips state batch write when all backfilled profiles are unchanged", async () => {
        const existingProfile = {
            url: "https://ja.wikipedia.org/wiki/Same",
            birthday: "", age: "", height: "160cm", weight: "", threeSizeText: "", braSize: "C", matchedName: "Same",
        };
        const state = {
            getFavoriteActressList: vi.fn(async () => [{ starId: "same", name: "Same", actressProfile: existingProfile, actressProfileVerifiedUrl: existingProfile.url }]),
            batchUpdateFavoriteActressProfiles: vi.fn(),
        };
        const actressInfo = { lookupAny: vi.fn(async () => ({ info: { ...existingProfile }, matchedName: "Same" })) };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, getTimestamp: () => "2026-11-18", onNewItems: vi.fn() });

        const first = await controller.backfillFavoriteProfiles({ now: 10_000, concurrency: 1, delayMs: 0 });
        expect(first).toEqual({ total: 1, updated: 0, unchanged: 1, failed: 0, rateLimited: 0 });
        expect(state.batchUpdateFavoriteActressProfiles).not.toHaveBeenCalled();

        // In-memory fallback Map keeps cooldown when storage is omitted
        const second = await controller.backfillFavoriteProfiles({ now: 11_000, concurrency: 1, delayMs: 0 });
        expect(second).toEqual({ total: 0, updated: 0, unchanged: 0, failed: 0, rateLimited: 0 });
        expect(actressInfo.lookupAny).toHaveBeenCalledOnce();
    });

    it("stops claiming items on transient block error and aborts cleanly on scope cancellation", async () => {
        const state = {
            getFavoriteActressList: vi.fn(async () => [
                { starId: "a1", name: "A1" },
                { starId: "a2", name: "A2" },
                { starId: "a3", name: "A3" },
            ]),
            batchUpdateFavoriteActressProfiles: vi.fn(),
        };
        const actressInfo = {
            lookupAny: vi.fn(async () => { throw Object.assign(new Error("429"), { code: "RATE_LIMITED" }); }),
        };
        const controller = new NewVideoScanController({ state, actressInfo, scope: {}, logger: { warn: vi.fn() }, getTimestamp: () => "2026-11-18", onNewItems: vi.fn() });
        const rateSummary = await controller.backfillFavoriteProfiles({ now: 5000, concurrency: 1, delayMs: 0 });
        expect(rateSummary).toEqual({ total: 3, updated: 0, unchanged: 0, failed: 0, rateLimited: 1 });
        expect(actressInfo.lookupAny).toHaveBeenCalledOnce();
        expect(state.batchUpdateFavoriteActressProfiles).not.toHaveBeenCalled();

        const abortScope = new LifecycleScope("test:abort-backfill");
        const abortController = new NewVideoScanController({
            state,
            actressInfo: {
                lookupAny: vi.fn(async (_names, { scope }) => {
                    abortScope.dispose();
                    throw Object.assign(new Error("aborted"), { name: "AbortError", code: "ABORTED", cause: scope.signal.reason });
                }),
            },
            scope: abortScope,
            getTimestamp: () => "2026-11-18",
            onNewItems: vi.fn(),
        });
        await expect(abortController.backfillFavoriteProfiles({ now: 5000, concurrency: 1, delayMs: 0 })).rejects.toMatchObject({ code: "ABORTED" });
        expect(state.batchUpdateFavoriteActressProfiles).not.toHaveBeenCalled();

        abortController.dispose();
        expect(() => abortController.assertActive()).toThrow();
        try {
            abortController.assertActive();
        } catch (error) {
            expect(error).toMatchObject({ name: "AbortError", code: "ABORTED" });
        }
    });

    it("writes attempts only after IndexedDB batch write succeeds and reconciles committed update counts", async () => {
        const localStore = new Map();
        const storage = {
            getLocal: vi.fn((key) => localStore.get(key) ?? null),
            setLocal: vi.fn((key, value) => localStore.set(key, value)),
        };
        const order = [];
        const actressInfo = {
            lookupAny: vi.fn(async () => ({
                info: { url: "https://ja.wikipedia.org/wiki/A1", height: "161cm" },
                matchedName: "A1",
            })),
        };
        const failingState = {
            getFavoriteActressList: vi.fn(async () => [{ starId: "a1", name: "A1" }]),
            batchUpdateFavoriteActressProfiles: vi.fn(async () => {
                order.push("db-fail");
                throw new Error("IndexedDB quota exceeded");
            }),
        };
        const failCtrl = new NewVideoScanController({ state: failingState, actressInfo, storage, scope: {}, getTimestamp: () => "2026-11-18", onNewItems: vi.fn() });
        await expect(failCtrl.backfillFavoriteProfiles({ now: 1000, concurrency: 1, delayMs: 0 })).rejects.toThrow("IndexedDB quota exceeded");
        expect(storage.setLocal).not.toHaveBeenCalled();

        order.length = 0;
        const reconciledState = {
            getFavoriteActressList: vi.fn(async () => [{ starId: "a1", name: "A1" }]),
            batchUpdateFavoriteActressProfiles: vi.fn(async () => {
                order.push("db-commit");
                return 0;
            }),
        };
        storage.setLocal.mockImplementation((key, value) => {
            order.push("attempts-write");
            localStore.set(key, value);
        });
        const okCtrl = new NewVideoScanController({ state: reconciledState, actressInfo, storage, scope: {}, getTimestamp: () => "2026-11-18", onNewItems: vi.fn() });
        const summary = await okCtrl.backfillFavoriteProfiles({ now: 2000, concurrency: 1, delayMs: 0 });
        expect(summary).toEqual({ total: 1, updated: 0, unchanged: 1, failed: 0, rateLimited: 0 });
        expect(order).toEqual(["db-commit", "attempts-write"]);
    });

    it("resolves backfillFavoriteProfiles cleanly even when writing local cooldown cache throws QuotaExceededError", async () => {
        const storage = {
            getLocal: vi.fn(() => null),
            setLocal: vi.fn(() => { throw new Error("QuotaExceededError"); }),
        };
        const logger = { warn: vi.fn() };
        const state = {
            getFavoriteActressList: vi.fn(async () => [{ starId: "a1", name: "A1" }]),
            batchUpdateFavoriteActressProfiles: vi.fn(async () => 1),
        };
        const actressInfo = {
            lookupAny: vi.fn(async () => ({
                info: { url: "https://ja.wikipedia.org/wiki/A1", height: "161cm" },
                matchedName: "A1",
            })),
        };
        const controller = new NewVideoScanController({ state, actressInfo, storage, logger, scope: {}, getTimestamp: () => "2026-11-18", onNewItems: vi.fn() });
        const summary = await controller.backfillFavoriteProfiles({ now: 3000, concurrency: 1, delayMs: 0 });
        expect(summary).toEqual({ total: 1, updated: 1, unchanged: 0, failed: 0, rateLimited: 0 });
        expect(logger.warn).toHaveBeenCalledOnce();
    });
});
