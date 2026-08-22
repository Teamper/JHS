import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadStateModel() {
    const constants = readFileSync(join(repoRoot, "src/core/constants.js"), "utf8"), normalizeStart = constants.indexOf("function normalizeCarNum"), normalizeEnd = constants.indexOf("function assertPageInfoContract", normalizeStart);
    const source = readFileSync(join(repoRoot, "src/core/state-model.js"), "utf8"), context = vm.createContext({ d: "filter", h: "favorite", g: "hasDown", p: "hasWatch" });
    vm.runInContext(`${constants.slice(normalizeStart, normalizeEnd)}\n${source}; globalThis.api = { normalizeCarNum, createEmptyStateFlags, stateFlagsFromLegacyStatus, normalizeStateFlags, projectLegacyStatus, syncLegacyStatus, hasAnyState, mergeCanonicalCarRecords };`, context);
    return context.api;
}

describe("v2 state model", () => {
    it("uses independent flags and a deterministic legacy projection", () => {
        const api = loadStateModel(), flags = api.createEmptyStateFlags();
        flags.favorite = true, flags.downloaded = true;
        expect(api.projectLegacyStatus(flags)).toBe("hasDown");
        flags.watched = true, flags.blocked = true;
        expect(api.projectLegacyStatus(flags)).toBe("filter");
        const record = api.syncLegacyStatus({ stateFlags: flags });
        expect(record.status).toBe("filter");
        expect(record.stateFlags).toEqual({ favorite: true, downloaded: true, watched: true, blocked: true });
    });

    it("maps legacy statuses without treating unknown values as state", () => {
        const api = loadStateModel();
        expect(api.stateFlagsFromLegacyStatus("favorite")).toEqual({ favorite: true, downloaded: false, watched: false, blocked: false });
        expect(api.stateFlagsFromLegacyStatus("future-value")).toEqual({ favorite: false, downloaded: false, watched: false, blocked: false });
    });

    it("normalizes separators but only inserts missing hyphens for safe prefixes", () => {
        const api = loadStateModel();
        expect(api.normalizeCarNum("  abc＿123  ")).toBe("ABC-123");
        expect(api.normalizeCarNum("abc—123")).toBe("ABC-123");
        expect(api.normalizeCarNum("ABC123")).toBe("ABC-123");
        expect(api.normalizeCarNum("UNKNOWN123")).toBe("UNKNOWN123");
    });

    it("merges canonical collisions and reports the original keys", () => {
        const api = loadStateModel(), result = api.mergeCanonicalCarRecords([
            { carNum: "abc-123", status: "favorite", createDate: "2025-01-01", updateDate: "2025-01-02", names: "A" },
            { carNum: "ABC123", status: "hasDown", createDate: "2025-01-03", updateDate: "2025-01-04", url: "https://example.test/v" }
        ]);
        expect(result.list).toHaveLength(1);
        expect(result.list[0]).toMatchObject({ carNum: "ABC-123", status: "hasDown", names: "A", url: "https://example.test/v", stateFlags: { favorite: true, downloaded: true, watched: false, blocked: false } });
        expect(result.collisions).toEqual([{ carNum: "ABC-123", originals: [ "abc-123", "ABC123" ], count: 2 }]);
    });
});
