import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadAggregator() {
    const constants = readFileSync(join(repoRoot, "src/core/constants.js"), "utf8"), start = constants.indexOf("function normalizeCarNum"), end = constants.indexOf("function assertPageInfoContract", start), model = readFileSync(join(repoRoot, "src/core/state-model.js"), "utf8"), source = readFileSync(join(repoRoot, "src/plugins/new-video/new-video.js"), "utf8"), aggregateStart = source.indexOf("function aggregateNewVideoRecords"), aggregateEnd = source.indexOf("class NewVideoPlugin", aggregateStart), context = vm.createContext({ d: "filter", h: "favorite", g: "hasDown", p: "hasWatch", Date, Object, Array, Map, Set, JSON });
    vm.runInContext(`${constants.slice(start, end)}\n${model}\n${source.slice(aggregateStart, aggregateEnd)}; globalThis.aggregate = aggregateNewVideoRecords;`, context);
    return context.aggregate;
}

describe("new video inbox aggregation", () => {
    it("deduplicates canonical numbers and aggregates actresses and categories", () => {
        const aggregate = loadAggregator(), result = aggregate([
            { name: "Alice", starId: "a", actressType: "censored", newVideoList: [{ carNum: "abc_123", title: "VR Release", publishTime: "2026-08-01" }] },
            { name: "Bob", starId: "b", actressType: "uncensored", newVideoList: [{ carNum: "ABC-123", voteCount: 40, publishTime: "2026-08-02" }] }
        ], new Map, {});
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ carNum: "ABC-123", actressName: "Alice、Bob", starId: "a", voteCount: 40, publishTime: "2026-08-02", isVr: true });
        expect([...result[0].categories]).toEqual(["censored", "uncensored"]);
    });

    it("lazily restores expired snoozes while keeping active decisions", () => {
        const aggregate = loadAggregator(), actresses = [{ newVideoList: ["ABC-1", "ABC-2", "ABC-3"] }], now = Date.parse("2026-08-22T00:00:00Z"), result = aggregate(actresses, new Map([["ABC-3", { stateFlags: { favorite: true } }]]), {
            "ABC-1": { action: "snoozed", until: "2026-08-21T00:00:00Z" },
            "ABC-2": { action: "ignored" }
        }, now);
        expect(result.map(item => item.decisionState)).toEqual(["pending", "ignored", "pending"]);
        expect(result[2].flags.favorite).toBe(true);
    });
});
