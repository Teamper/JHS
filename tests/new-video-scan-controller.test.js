import { describe, expect, it, vi } from "vitest";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";

describe("NewVideoScanController", () => {
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
        });
        expect(onNewItems).toHaveBeenCalledWith("Actor One", 1);
    });

    it("clears a previously stored list when the actor has no works", async () => {
        const state = { updateFavoriteActress: vi.fn(async () => true) };
        const controller = new NewVideoScanController({ state, getTimestamp: () => "2026-09-27 15:00:00", onNewItems: vi.fn() });

        await expect(controller.parseActorMovies([], "actor-1", "Actor One", [], new Set())).resolves.toBe(0);
        expect(state.updateFavoriteActress).toHaveBeenCalledWith({ starId: "actor-1", lastCheckTime: "2026-09-27 15:00:00", newVideoList: [] });
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
            state, titleKeywords: { getAll: vi.fn(async () => []) },
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
            state, titleKeywords: { getAll: vi.fn(async () => []) }, actressInfo, scope: {}, logger,
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
        expect(state.updateFavoriteActress).toHaveBeenCalledWith(expect.objectContaining({ starId: "primary", newVideoList: [expect.objectContaining({ carNum: "primary-001" })] }));
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
            state, titleKeywords: { getAll: vi.fn(async () => []) }, actressInfo, scope: {},
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
        const titleKeywords = { getAll: vi.fn(async () => []) }, onActorStart = vi.fn();
        const controller = new NewVideoScanController({
            state, titleKeywords, actressInfo, scope, logger: { warn: vi.fn() },
            getTimestamp: () => "2026-09-27 15:00:00", onNewItems: vi.fn(),
        });

        await expect(controller.scanActress({ starId: "actor-1", name: "Actor One" }, { baseUrl: "https://javdb.com", onActorStart })).resolves.toBe(1);
        expect(onActorStart).toHaveBeenCalledWith({ starId: "actor-1", name: "Actor One" }, "https://javdb.com/actors/actor-1?t=d");
        expect(actressInfo.movies).toHaveBeenCalledWith("javdb", { actorId: "actor-1", baseUrl: "https://javdb.com" }, { scope, ttlMs: 0 });
        expect(state.updateFavoriteActress).toHaveBeenCalledWith({
            starId: "actor-1", lastCheckTime: "2026-09-27 15:00:00", lastPublishTime: null,
            newVideoList: [{ carNum: "ACTOR-001", coverUrl: "", title: "Synthetic title", publishTime: "", score: 0, voteCount: 0, url: "" }],
        });
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
            state, titleKeywords: {}, actressInfo: {}, scope: {}, logger, getTimestamp: () => "2026-09-27", onNewItems: () => { throw new Error("toast failed"); },
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
