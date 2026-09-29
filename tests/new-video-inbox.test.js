import { describe, expect, it } from "vitest";
import { aggregateNewVideoRecords } from "../src/features/discovery/new-video-workspace-controller.js";

describe("new video inbox aggregation", () => {
    it("deduplicates canonical numbers and aggregates actresses and categories", () => {
        const result = aggregateNewVideoRecords([
            { name: "Alice", starId: "a", actressType: "censored", newVideoList: [{ carNum: "abc_123", title: "VR Release", publishTime: "2026-08-01" }] },
            { name: "Bob", starId: "b", actressType: "uncensored", newVideoList: [{ carNum: "ABC-123", voteCount: 40, publishTime: "2026-08-02" }] }
        ], new Map, {});
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ carNum: "ABC-123", actressName: "Alice、Bob", starId: "a", voteCount: 40, publishTime: "2026-08-02", isVr: true });
        expect([...result[0].categories]).toEqual(["censored", "uncensored"]);
    });

    it("lazily restores expired snoozes while keeping active decisions", () => {
        const actresses = [{ newVideoList: ["ABC-1", "ABC-2", "ABC-3"] }], now = Date.parse("2026-08-22T00:00:00Z"), result = aggregateNewVideoRecords(actresses, new Map([["ABC-3", { stateFlags: { favorite: true } }]]), {
            "ABC-1": { action: "snoozed", until: "2026-08-21T00:00:00Z" },
            "ABC-2": { action: "ignored" }
        }, now);
        expect(result.map(item => item.decisionState)).toEqual(["pending", "ignored", "pending"]);
        expect(result[2].flags.favorite).toBe(true);
    });
});
