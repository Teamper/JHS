import { describe, expect, it, vi } from "vitest";
import { StateService } from "../src/core/state-service.js";
import { StorageMutationCoordinator } from "../src/core/storage-mutation-coordinator.js";
import { ACTRESS_PROFILE_BACKFILL_KEY, createActressProfileBackfillState } from "../src/core/actress-profile-backfill-state.js";
import { memoryAtomicStorage, storageFromForage } from "./helpers/atomic-storage.js";
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
        const storage = storageFromForage({
            getItem: async key => key === "favorite_actresses" ? structuredClone(favoriteActresses) : key === "new_video_decisions" ? structuredClone(decisions) : null,
            setItem: async (key, value) => {
                if (key === "favorite_actresses") favoriteActresses = value;
                if (key === "new_video_decisions") decisions = value;
            },
        });
        const state = new StateService(storage, {});
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
});

describe("favorite actress profile backfill", () => {
    function profile(name, height = "160cm") {
        return { url: new URL("/wiki/" + name, "https://ja.wikipedia.org").href, height, matchedName: name };
    }
    function createBackfill(actresses, { initial, beforeWrite, lookup = async ([name]) => ({ info: profile(name), matchedName: name }) } = {}) {
        const data = new Map([["favorite_actresses", actresses]]);
        if (initial) data.set(ACTRESS_PROFILE_BACKFILL_KEY, initial);
        const storage = storageFromForage({ getItem: async key => data.get(key) ?? null }, memoryAtomicStorage(data, { beforeWrite }));
        const state = new StateService(storage, {}, new StorageMutationCoordinator({ lockManager: null }), { actorClock: () => "2026-11-25 12:00:00" });
        const lookupAny = vi.fn(lookup);
        const logger = { warn: vi.fn() };
        const controller = (scope = new LifecycleScope("test:backfill")) => new NewVideoScanController({
            state, scope, logger, actressInfo: { lookupAny }, getTimestamp: () => "",
            onNewItems: () => {},
        });
        return { data, state, controller, lookupAny };
    }
    const actresses = (...names) => names.map(name => ({ starId: name.toLowerCase(), name }));

    it("respects positive and negative cooldowns, preserves unchanged profiles, and prunes removed actors", async () => {
        const records = actresses("Recent", "Missing", "Same", "Kept", "New");
        for (const index of [0, 2, 3]) {
            const saved = profile(records[index].name);
            Object.assign(records[index], { actressProfile: saved, actressProfileVerifiedUrl: saved.url });
        }
        const now = CACHE_TTL.actressInfoNegative + 1500;
        const writes = [];
        const h = createBackfill(records, {
            initial: { ...createActressProfileBackfillState(), initialized: true, entries: { recent: 1000, missing: now - 100, removed: 500 } },
            beforeWrite: async key => writes.push(key),
            lookup: async ([name]) => name === "Kept" ? null : { info: profile(name), matchedName: name },
        });
        const onProgress = vi.fn();
        const ctrl = h.controller();
        const summary = await ctrl.backfillFavoriteProfiles({ now, delayMs: 0, onProgress });
        expect(summary).toEqual({ total: 3, updated: 1, unchanged: 2, failed: 0, rateLimited: 0 });
        expect(h.lookupAny.mock.calls.map(([names]) => names[0])).toEqual(["Same", "Kept", "New"]);
        expect(onProgress).toHaveBeenCalledTimes(3);
        expect(writes).toContain("favorite_actresses");
        expect(h.data.get("favorite_actresses")).toEqual([
            ...records.slice(0, 4), expect.objectContaining({
                starId: "new", actressProfile: expect.objectContaining(profile("New")), actressProfileVerifiedUrl: profile("New").url,
            }),
        ]);
        expect((await h.state.getActressProfileBackfillState()).entries).toEqual({
            recent: 1000, missing: now - 100, same: now, kept: now, new: now,
        });
        writes.length = 0;
        await ctrl.backfillFavoriteProfiles({ now: now + 1, starIds: ["same"], force: true, refresh: true, delayMs: 0 });
        expect(writes).toEqual([ACTRESS_PROFILE_BACKFILL_KEY]);
        expect(h.lookupAny).toHaveBeenLastCalledWith(["Same"], { scope: ctrl.scope, refresh: true });
    });

    it("keeps the first sweep pending after targeted success and resumes after a committed batch and cancellation", async () => {
        const scope = new LifecycleScope("test:closed-page");
        let interrupt = true;
        const h = createBackfill(actresses("Alice", "Bella", "Cara"), {
            lookup: async ([name], { scope: requestScope }) => {
                if (name === "Cara" && interrupt) {
                    scope.dispose();
                    throw requestScope.signal.reason;
                }
                return { info: profile(name), matchedName: name };
            },
        });
        await h.controller().backfillFavoriteProfiles({ now: 1000, starIds: ["alice"], force: true, delayMs: 0 });
        expect(await h.controller().needsProfileBackfillInit()).toBe(true);
        await expect(h.controller(scope).backfillFavoriteProfiles({
            now: 2000, concurrency: 1, commitBatchSize: 1, delayMs: 0,
        })).rejects.toMatchObject({ name: "AbortError" });
        expect(await h.state.getActressProfileBackfillState()).toMatchObject({
            initialized: false, entries: { alice: 1000, bella: 2000 },
        });
        interrupt = false;
        h.lookupAny.mockClear();
        const reopened = h.controller();
        expect(await reopened.needsProfileBackfillInit()).toBe(true);
        await reopened.backfillFavoriteProfiles({ now: 3000, delayMs: 0 });
        expect(h.lookupAny).toHaveBeenCalledExactlyOnceWith(["Cara"], { scope: reopened.scope });
        expect(await h.state.getActressProfileBackfillState()).toMatchObject({
            initialized: true, entries: { alice: 1000, bella: 2000, cara: 3000 },
        });
    });

    it("treats legacy cooling data as pending and marks completion for an empty untargeted run", async () => {
        const h = createBackfill([], { initial: { schema: 3, entries: { obsolete: 1000 } } });
        const ctrl = h.controller();
        expect(await ctrl.needsProfileBackfillInit()).toBe(true);
        await ctrl.backfillFavoriteProfiles({ starIds: ["missing"] });
        expect(await ctrl.needsProfileBackfillInit()).toBe(true);
        await ctrl.backfillFavoriteProfiles();
        expect(await h.state.getActressProfileBackfillState()).toEqual({ ...createActressProfileBackfillState(), initialized: true });
        expect(await ctrl.needsProfileBackfillInit()).toBe(false);
    });

    it("rejects future cooling data before any lookup or mutation", async () => {
        const future = { schema: 5, entries: { other: 1000 } };
        const h = createBackfill(actresses("Alice"), { initial: future });
        await expect(h.controller().backfillFavoriteProfiles()).rejects.toThrow("来自更新版本");
        expect(h.lookupAny).not.toHaveBeenCalled();
        expect(h.data.get(ACTRESS_PROFILE_BACKFILL_KEY)).toEqual(future);
    });

    it("keeps rate-limited sweeps pending and leaves failed actors eligible after a fully attempted sweep", async () => {
        let limited = true;
        const h = createBackfill(actresses("Alice", "Bella", "Cara"), {
            lookup: async ([name]) => {
                if (name === "Bella" && limited) throw Object.assign(new Error("limited"), { code: "RATE_LIMITED" });
                if (name === "Bella") throw new Error("offline");
                return { info: profile(name), matchedName: name };
            },
        });
        const ctrl = h.controller();
        expect(await ctrl.backfillFavoriteProfiles({ now: 1000, concurrency: 1, delayMs: 0 })).toMatchObject({ updated: 1, rateLimited: 1 });
        expect(h.lookupAny).toHaveBeenCalledTimes(2);
        expect(await h.state.getActressProfileBackfillState()).toMatchObject({ initialized: false, entries: { alice: 1000 } });
        limited = false;
        expect(await ctrl.backfillFavoriteProfiles({ now: 2000, delayMs: 0 })).toMatchObject({ total: 2, updated: 1, failed: 1 });
        expect(await h.state.getActressProfileBackfillState()).toMatchObject({ initialized: true, entries: { alice: 1000, cara: 2000 } });
    });

    it("keeps committed batches and rolls the failed actor and its cooldown back together", async () => {
        const h = createBackfill(actresses("Alice", "Bella", "Cara"), {
            beforeWrite: async (key, value) => {
                if (key === "favorite_actresses" && value[1].actressProfile) throw new Error("IndexedDB quota exceeded");
            },
        });
        await expect(h.controller().backfillFavoriteProfiles({ now: 1000, concurrency: 1, commitBatchSize: 1, delayMs: 0 }))
            .rejects.toThrow("IndexedDB quota exceeded");
        expect(h.lookupAny).toHaveBeenCalledTimes(2);
        expect(await h.state.getActressProfileBackfillState()).toMatchObject({ initialized: false, entries: { alice: 1000 } });
        expect(h.data.get("favorite_actresses")).toEqual([
            expect.objectContaining({ actressProfile: expect.objectContaining(profile("Alice")) }),
            { starId: "bella", name: "Bella" },
            { starId: "cara", name: "Cara" },
        ]);
    });

    it("stops concurrent workers from retrying a failed batch", async () => {
        let release;
        const blocked = new Promise(resolve => { release = resolve; });
        const beforeWrite = vi.fn(async () => { throw new Error("write failed"); });
        const h = createBackfill(actresses("Alice", "Bella"), {
            beforeWrite, lookup: async ([name]) => {
                if (name === "Bella") await blocked;
                return { info: profile(name), matchedName: name };
            },
        });
        const running = h.controller().backfillFavoriteProfiles({ delayMs: 0, commitBatchSize: 1 });
        await vi.waitFor(() => expect(beforeWrite).toHaveBeenCalledTimes(1));
        release();
        await expect(running).rejects.toThrow("write failed");
        expect(beforeWrite).toHaveBeenCalledTimes(1);
        expect(h.data.has(ACTRESS_PROFILE_BACKFILL_KEY)).toBe(false);
    });

    it("invalidates only cleared actors, including completed lookups waiting for their batch", async () => {
        let release;
        const blocked = new Promise(resolve => { release = resolve; });
        const h = createBackfill(actresses("Alice", "Bella", "Cara", "Recent"), {
            initial: { ...createActressProfileBackfillState(), entries: { recent: 950 } },
            lookup: async ([name]) => {
                if (name === "Bella") return null;
                if (name === "Cara") await blocked;
                return { info: profile(name), matchedName: name };
            },
        });
        const running = h.controller().backfillFavoriteProfiles({ now: 1000, concurrency: 1, delayMs: 0 });
        await vi.waitFor(() => expect(h.lookupAny).toHaveBeenCalledTimes(3));
        await h.state.clearActressProfileBackfillAttempts(["alice", "bella"]);
        release();
        await expect(running).resolves.toEqual({ total: 3, updated: 1, unchanged: 2, failed: 0, rateLimited: 0 });
        expect(await h.state.getActressProfileBackfillState()).toMatchObject({
            initialized: false, entries: { recent: 950, cara: 1000 },
        });
        expect(Object.keys((await h.state.getActressProfileBackfillState()).entries).sort()).toEqual(["cara", "recent"]);
        expect(h.data.get("favorite_actresses").slice(0, 2)).toEqual(actresses("Alice", "Bella"));
    });
});
