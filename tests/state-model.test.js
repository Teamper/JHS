import { normalizeCarNum } from "../src/core/constants.js";
import { createEmptyStateFlags, syncLegacyStatus, mergeCanonicalCarRecords } from "../src/core/state-model.js";
import { describe, expect, it } from "vitest";

describe("v2 state model", () => {
    it("uses independent flags and a deterministic legacy projection", () => {
        const flags = createEmptyStateFlags();
        flags.favorite = true, flags.downloaded = true;
        expect(syncLegacyStatus({ stateFlags: flags }).status).toBe("hasDown");
        flags.watched = true, flags.blocked = true;
        expect(syncLegacyStatus({ stateFlags: flags }).status).toBe("filter");
        const record = syncLegacyStatus({ stateFlags: flags });
        expect(record.status).toBe("filter");
        expect(record.stateFlags).toEqual({ favorite: true, downloaded: true, watched: true, blocked: true });
    });

    it("maps legacy statuses without treating unknown values as state", () => {
        expect(mergeCanonicalCarRecords([{ carNum: "ABC-1", status: "favorite" }]).list[0].stateFlags).toEqual({ favorite: true, downloaded: false, watched: false, blocked: false });
        expect(mergeCanonicalCarRecords([{ carNum: "ABC-1", status: "future-value" }]).list[0].stateFlags).toEqual({ favorite: false, downloaded: false, watched: false, blocked: false });
    });

    it("normalizes separators but only inserts missing hyphens for safe prefixes", () => {
        expect(normalizeCarNum("  abc＿123  ")).toBe("ABC-123");
        expect(normalizeCarNum("abc—123")).toBe("ABC-123");
        expect(normalizeCarNum("ABC123")).toBe("ABC-123");
        expect(normalizeCarNum("UNKNOWN123")).toBe("UNKNOWN123");
    });

    it("merges canonical collisions and reports the original keys", () => {
        const result = mergeCanonicalCarRecords([
            { carNum: "abc-123", status: "favorite", createDate: "2025-01-01", updateDate: "2025-01-02", names: "A" },
            { carNum: "ABC123", status: "hasDown", createDate: "2025-01-03", updateDate: "2025-01-04", url: "https://example.test/v" }
        ]);
        expect(result.list).toHaveLength(1);
        expect(result.list[0]).toMatchObject({ carNum: "ABC-123", status: "hasDown", names: "A", url: "https://example.test/v", stateFlags: { favorite: true, downloaded: true, watched: false, blocked: false } });
        expect(result.collisions).toEqual([{ carNum: "ABC-123", originals: [ "abc-123", "ABC123" ], count: 2 }]);
    });
});
