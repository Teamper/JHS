import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";
import { describe, expect, it } from "vitest";

const repoRoot = join(import.meta.dirname, "..");

function loadRetention() {
    const source = readFileSync(join(repoRoot, "src/core/state-service.js"), "utf8"), end = source.indexOf("class StateService");
    const context = vm.createContext({ Date, JSON, Object, Array, Math });
    vm.runInContext(`${source.slice(0, end)}; globalThis.prune = pruneActivityLog;`, context);
    return context.prune;
}

describe("activity retention", () => {
    it("keeps every entry from the latest 30 days beyond the soft limit", () => {
        const prune = loadRetention(), now = Date.parse("2026-08-22T00:00:00Z"), entries = Array.from({ length: 1500 }, ((_, index) => ({ id: String(index), commitState: "committed", createdAt: new Date(now - index * 6e4).toISOString() })));
        expect(prune({ entries }, now).entries).toHaveLength(1500);
    });

    it("uses the soft limit only for old entries", () => {
        const prune = loadRetention(), now = Date.parse("2026-08-22T00:00:00Z"), entries = Array.from({ length: 1500 }, ((_, index) => ({ id: String(index), commitState: "committed", createdAt: new Date(now - 40 * 864e5 - index * 6e4).toISOString() })));
        const result = prune({ entries: entries.reverse() }, now);
        expect(result.entries).toHaveLength(1000);
        expect(result.entries.at(-1).id).toBe("0");
    });

    it("records coverage when the hard limit truncates recent activity", () => {
        const prune = loadRetention(), now = Date.parse("2026-08-22T00:00:00Z"), entries = Array.from({ length: 10020 }, ((_, index) => ({ id: String(index), commitState: "committed", createdAt: new Date(now - index * 1e3).toISOString() }))), result = prune({ entries }, now);
        expect(result.entries).toHaveLength(10000);
        expect(result.coverageStart).toBe(result.entries[0].createdAt);
        expect(result.truncatedAt).toBeTruthy();
    });
});
