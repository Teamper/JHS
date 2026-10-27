import { describe, expect, it, vi } from "vitest";
import { ActorSourceHealth, ACTOR_SOURCE_RETRY_MS } from "../src/features/discovery/actor-source-health.js";
import { NewVideoScanController } from "../src/features/discovery/new-video-scan-controller.js";

describe("unavailable actor source recovery", () => {
    it("isolates 404 for 24 hours while retaining works and completing other actors", async () => {
        let now = Date.now(); const local = new Map();
        const health = new ActorSourceHealth({ getLocal: key => local.get(key), setLocal: (key, value) => local.set(key, value) }, () => now);
        const saved = [{ starId: "gone", name: "Missing", newVideoList: ["KEEP-1"] }, { starId: "ok", name: "Available" }];
        const movies = vi.fn(async (_provider, ref) => { if (ref.actorId === "gone") throw Object.assign(new Error("404"), { code: "NOT_FOUND" }); return []; });
        const controller = new NewVideoScanController({ state: { getFavoriteActressList: async () => saved, getBlacklistCarList: async () => [], updateFavoriteActress: vi.fn(async () => true) }, sourceHealth: health, titleKeywords: { getAll: async () => [] }, actressInfo: { movies }, scope: {}, getTimestamp: () => "2026-10-26", onNewItems() {} });
        const options = { baseUrl: "https://javdb.com", force: false, concurrency: 1, sleepMs: 0, intervalHours: 12, ruleHours: 0, isUnnecessaryCheck: () => false, isNetworkBlocked: () => false, sleep: async () => {} };
        await expect(controller.scanActresses(options)).resolves.toMatchObject({ success: 1, unavailable: 1, networkFailed: 0 });
        expect(saved[0].newVideoList).toEqual(["KEEP-1"]);
        await expect(controller.scanActresses(options)).resolves.toMatchObject({ success: 1, unavailable: 0, skippedUnavailable: 1 });
        expect(movies.mock.calls.filter(([, ref]) => ref.actorId === "gone")).toHaveLength(1);
        now += ACTOR_SOURCE_RETRY_MS;
        await controller.scanActresses(options);
        expect(movies.mock.calls.filter(([, ref]) => ref.actorId === "gone")).toHaveLength(2);
        movies.mockResolvedValue([]);
        await controller.scanActress(saved[0], { baseUrl: options.baseUrl });
        expect(health.list(options.baseUrl)).toEqual([]);
    });
    it("keeps failure progress separate by host and refuses future formats", () => {
        let value;
        const health = new ActorSourceHealth({ getLocal: () => value, setLocal: (_key, next) => { value = next; } });
        health.unavailable("https://javdb.com", { starId: "one", name: "A" });
        expect(health.isDeferred("https://mirror.example", "one")).toBe(false);
        value = '{"schema":2,"entries":{}}';
        expect(() => health.unavailable("https://javdb.com", { starId: "one", name: "A" })).toThrow();
        expect(value).toBe('{"schema":2,"entries":{}}');
    });
});
