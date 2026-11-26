import { pruneActivityLog as prune } from "../src/core/state-activity-model.js";
import { describe, expect, it } from "vitest";

describe("activity retention", () => {
    it("keeps every entry from the latest 30 days beyond the soft limit", () => {
        const now = Date.parse("2026-08-22T00:00:00Z"), entries = Array.from({ length: 1500 }, ((_, index) => ({ id: String(index), commitState: "committed", createdAt: new Date(now - index * 6e4).toISOString() })));
        expect(prune({ entries }, now).entries).toHaveLength(1500);
    });

    it("uses the soft limit only for old entries", () => {
        const now = Date.parse("2026-08-22T00:00:00Z"), entries = Array.from({ length: 1500 }, ((_, index) => ({ id: String(index), commitState: "committed", createdAt: new Date(now - 40 * 864e5 - index * 6e4).toISOString() })));
        const result = prune({ entries: entries.reverse() }, now);
        expect(result.entries).toHaveLength(1000);
        expect(result.entries.at(-1).id).toBe("0");
    });

    it("records coverage when the hard limit truncates recent activity", () => {
        const now = Date.parse("2026-08-22T00:00:00Z"), entries = Array.from({ length: 10020 }, ((_, index) => ({ id: String(index), commitState: "committed", createdAt: new Date(now - index * 1e3).toISOString() }))), result = prune({ entries }, now);
        expect(result.entries).toHaveLength(10000);
        expect(result.coverageStart).toBe(result.entries[0].createdAt);
        expect(result.truncatedAt).toBeTruthy();
    });
});
